import json
import os
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple
from urllib.parse import unquote


def _fully_unquote(value: str) -> str:
    """Decode percent-escapes, including repeated encodings of ``..`` and separators."""
    decoded = value
    for _ in range(8):
        unquoted = unquote(decoded)
        if unquoted == decoded:
            break
        decoded = unquoted
    return decoded.replace("\\", "/")


def _is_inside_directory(root: str, candidate: str) -> bool:
    try:
        return os.path.commonpath([root, candidate]) == root
    except ValueError:
        return False


def _classify_static_path(static_folder: str, requested_path: str) -> Tuple[str, Optional[str]]:
    """Classify a static path after normalization.

    Returns ``("file", absolute_path)`` for a regular file that stays inside
    ``static_folder``. Returns ``("missing", None)`` when the normalized path
    stays inside but is not a file. Returns ``("reject", None)`` for traversal,
    encoded ``..``, absolute paths, symlink escapes, and directories.
    """
    if not static_folder:
        return "reject", None

    try:
        static_root = os.path.realpath(static_folder)
    except OSError:
        return "reject", None

    decoded = _fully_unquote(requested_path or "")
    if "\x00" in decoded or os.path.isabs(decoded) or decoded.startswith("/"):
        return "reject", None
    if decoded == "":
        return "missing", None

    try:
        real_candidate = os.path.realpath(os.path.join(static_root, decoded))
    except OSError:
        return "reject", None

    if not _is_inside_directory(static_root, real_candidate):
        return "reject", None
    if os.path.isfile(real_candidate):
        return "file", real_candidate
    if os.path.isdir(real_candidate):
        return "reject", None
    return "missing", None


def _send_resolved_static_file(static_folder: str, absolute_file: str) -> Any:
    """Serve a file already known to live inside ``static_folder``."""
    static_root = os.path.realpath(static_folder)
    relative = os.path.relpath(absolute_file, static_root)
    if relative.startswith("..") or os.path.isabs(relative):
        return "Not Found", 404
    return send_from_directory(static_root, relative)


try:  # pragma: no cover - exercised indirectly in tests
    from flask import Flask, jsonify, send_from_directory  # type: ignore
    _USING_FLASK = True
except ModuleNotFoundError:  # pragma: no cover - exercised indirectly in tests
    _USING_FLASK = False

    class SimpleResponse:
        """Minimal response object compatible with the subset used in tests."""

        def __init__(
            self,
            body: Any = b"",
            status: int = 200,
            headers: Optional[Dict[str, str]] = None,
            *,
            json_body: bool = False,
        ) -> None:
            self.status_code = status
            self.headers: Dict[str, str] = dict(headers or {})
            self._json: Optional[Any] = body if json_body else None

            if isinstance(body, bytes):
                payload = body
            elif json_body:
                payload = json.dumps(body).encode("utf-8")
                self.headers.setdefault("Content-Type", "application/json")
            else:
                payload = str(body).encode("utf-8")

            self.headers.setdefault("Content-Length", str(len(payload)))
            self.data = payload
            self.content_type = self.headers.get("Content-Type", "")
            self.mimetype = self.content_type.split(";", 1)[0].strip()
            length = self.headers.get("Content-Length")
            self.content_length = int(length) if length is not None and str(length).isdigit() else None

        def get_json(self) -> Any:
            if self._json is None:
                raise ValueError("Response does not contain JSON data")
            return self._json

        def get_data(self, as_text: bool = False) -> Any:
            if as_text:
                return self.data.decode("utf-8")
            return self.data

    class MiniTestClient:
        def __init__(self, app: "MiniFlask") -> None:
            self._app = app

        def _request(self, method: str, path: str, data: Any = None) -> SimpleResponse:
            if not path.startswith("/"):
                path = f"/{path}"
            return self._app._dispatch_request(method, path, data)

        def get(self, path: str) -> SimpleResponse:
            return self._request("GET", path)

        def post(self, path: str, data: Any = None) -> SimpleResponse:
            return self._request("POST", path, data)

    class MiniFlask:
        """Very small subset of Flask for testing without the dependency."""

        def __init__(self, import_name: str, static_folder: Optional[str] = None) -> None:
            self.import_name = import_name
            self.static_folder = static_folder
            self.config: Dict[str, Any] = {}
            self._routes: List[Tuple[str, Tuple[str, ...], Dict[str, Any], Callable[..., Any]]] = []
            self._teardowns: List[Callable[[Optional[BaseException]], Any]] = []

        def route(
            self,
            rule: str,
            methods: Optional[Iterable[str]] = None,
            defaults: Optional[Dict[str, Any]] = None,
        ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
                self._routes.append((rule, tuple(methods or ["GET"]), defaults or {}, func))
                return func

            return decorator

        def test_client(self) -> MiniTestClient:
            return MiniTestClient(self)

        def teardown_appcontext(self, func: Callable[[Optional[BaseException]], Any]) -> Callable[[Optional[BaseException]], Any]:
            self._teardowns.append(func)
            return func

        def _dispatch_request(self, method: str, path: str, data: Any = None) -> SimpleResponse:
            exception: Optional[BaseException] = None
            try:
                for rule, methods, defaults, func in self._routes:  # type: ignore[attr-defined]
                    if method not in methods:
                        continue
                    match = self._match(rule, path)
                    if match is None:
                        continue
                    kwargs = {**defaults, **match}
                    try:
                        result = func(**kwargs) if kwargs else func()
                    except BaseException as exc:  # pragma: no cover - handled via finally
                        exception = exc
                        raise
                    return self._make_response(result)
                return SimpleResponse("Not Found", status=404)
            except BaseException as exc:
                exception = exc
                raise
            finally:
                for teardown in reversed(self._teardowns):
                    teardown(exception)

        @staticmethod
        def _match(rule: str, path: str) -> Optional[Dict[str, Any]]:
            if "<path:path>" not in rule:
                return {} if rule == path else None

            prefix = rule.split("<path:path>", 1)[0]
            if not path.startswith(prefix):
                return None
            remainder = path[len(prefix):]
            if remainder.startswith("/"):
                remainder = remainder[1:]
            return {"path": remainder}

        @staticmethod
        def _make_response(result: Any) -> SimpleResponse:
            if isinstance(result, SimpleResponse):
                return result

            body = result
            status = 200
            headers: Optional[Dict[str, str]] = None

            if isinstance(result, tuple):
                body = result[0]
                if len(result) > 1:
                    status = result[1]
                if len(result) > 2:
                    headers = result[2]

            return SimpleResponse(body, status=status, headers=headers)

        def run(self, host: str = "127.0.0.1", port: int = 5000) -> None:  # pragma: no cover - manual usage only
            raise RuntimeError(
                "The lightweight MiniFlask application cannot be served directly. "
                "Install Flask to enable the development server."
            )

    def Flask(import_name: str, static_folder: Optional[str] = None) -> MiniFlask:  # type: ignore[misc]
        return MiniFlask(import_name, static_folder=static_folder)

    def jsonify(*args: Any, **kwargs: Any) -> SimpleResponse:  # type: ignore[misc]
        if args and kwargs:
            raise TypeError("jsonify called with both args and kwargs")
        if len(args) == 1:
            payload = args[0]
        elif args:
            payload = list(args)
        else:
            payload = kwargs
        return SimpleResponse(payload, json_body=True)

    def send_from_directory(directory: str, filename: str) -> SimpleResponse:  # type: ignore[misc]
        kind, resolved = _classify_static_path(directory, filename)
        if kind != "file" or resolved is None:
            return SimpleResponse("File not found", status=404)
        with open(resolved, "rb") as fh:
            return SimpleResponse(fh.read(), status=200)


class DataManager:
    """Simple data manager stub with start/stop hooks."""

    def __init__(self):
        self.started = False

    def start(self):
        self.started = True

    def stop(self):
        self.started = False


def create_app():
    """Application factory for the Telegram alert service."""
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(__name__, static_folder=os.path.join(base_dir, 'static'))

    # Database directory
    db_dir = os.path.join(base_dir, 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['DB_DIR'] = db_dir

    data_manager = DataManager()
    data_manager.start()

    @app.route('/api/alerts/generate', methods=['POST'])
    def generate_and_send_alerts():
        # Placeholder implementation: no real alerts are generated yet.
        return jsonify({"status": "success", "alerts_generated": 0, "alerts_sent": 0})

    @app.route('/healthz')
    def health():
        return jsonify({"ok": True})

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        static_folder = app.static_folder
        if not static_folder or not os.path.isdir(static_folder):
            return "Static folder not configured", 404
        if path:
            kind, resolved = _classify_static_path(static_folder, path)
            if kind == "reject":
                return "Not Found", 404
            if kind == "file" and resolved:
                return _send_resolved_static_file(static_folder, resolved)
        index_kind, index_file = _classify_static_path(static_folder, "index.html")
        if index_kind == "file" and index_file:
            return _send_resolved_static_file(static_folder, index_file)
        return "index.html not found", 404

    @app.teardown_appcontext
    def cleanup(exception=None):
        if data_manager.started:
            data_manager.stop()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')))
