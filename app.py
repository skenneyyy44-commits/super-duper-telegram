import json
import os
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

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
            self.headers: Dict[str, str] = headers or {}
            self._json: Optional[Any] = body if json_body else None

            if isinstance(body, bytes):
                payload = body
            elif json_body:
                payload = json.dumps(body).encode("utf-8")
            else:
                payload = str(body).encode("utf-8")

            self.data = payload

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
            for rule, methods, defaults, func in self._routes:  # type: ignore[attr-defined]
                if method not in methods:
                    continue
                match = self._match(rule, path)
                if match is None:
                    continue
                kwargs = {**defaults, **match}
                result = func(**kwargs) if kwargs else func()
                return self._make_response(result)
            return SimpleResponse("Not Found", status=404)

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
        file_path = os.path.join(directory, filename)
        if not os.path.isfile(file_path):
            return SimpleResponse("File not found", status=404)
        with open(file_path, "rb") as fh:
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
        requested = os.path.join(static_folder, path)
        if path and os.path.exists(requested):
            return send_from_directory(static_folder, path)
        index_path = os.path.join(static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder, 'index.html')
        return "index.html not found", 404

    @app.teardown_appcontext
    def cleanup(exception=None):
        if data_manager.started:
            data_manager.stop()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')))
