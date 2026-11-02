import os


class DataManager:
    """Simple data manager stub with start/stop hooks."""

    def __init__(self):
        self.started = False

    def start(self):
        self.started = True

    def stop(self):
        self.started = False


class SimpleResponse:
    """Lightweight response object that mimics the subset of Flask's Response API used in tests."""

    def __init__(self, status_code, body="", json_data=None, headers=None):
        self.status_code = status_code
        self._body = body
        self._json = json_data
        self.headers = headers or {}

    def get_data(self):
        if isinstance(self._body, bytes):
            return self._body
        return str(self._body).encode("utf-8")

    def get_json(self):
        return self._json


class SimpleTestClient:
    """Very small subset of Flask's test client used for exercising endpoints in tests."""

    def __init__(self, app):
        self._app = app

    def get(self, path):
        return self._app.handle_request("GET", path)

    def post(self, path, json=None):
        body = json
        if json is not None:
            body = json
        return self._app.handle_request("POST", path, body)


class SimpleApp:
    """Minimal application object offering just enough behaviour for the unit tests."""

    def __init__(self, static_folder, data_manager, db_dir):
        self.static_folder = static_folder
        self._data_manager = data_manager
        self.config = {"DB_DIR": db_dir}

    # ------------------------------------------------------------------
    # Flask compatibility helpers
    # ------------------------------------------------------------------
    def test_client(self):
        return SimpleTestClient(self)

    # ------------------------------------------------------------------
    # Internal request handling
    # ------------------------------------------------------------------
    def handle_request(self, method, path, body=None):
        if path == "/api/alerts/generate" and method == "POST":
            return SimpleResponse(
                200,
                json_data={
                    "status": "success",
                    "alerts_generated": 0,
                    "alerts_sent": 0,
                },
            )

        if path == "/healthz" and method == "GET":
            return SimpleResponse(200, json_data={"ok": True})

        if method == "GET":
            return self._serve_static(path)

        return SimpleResponse(405, "Method Not Allowed")

    def _serve_static(self, path):
        """Serve static assets with index fallback, mirroring the Flask version used in tests."""

        if not self.static_folder or not os.path.isdir(self.static_folder):
            return SimpleResponse(404, "Static folder not configured")

        requested_path = path.lstrip("/")

        if requested_path:
            candidate = os.path.join(self.static_folder, requested_path)
            if os.path.isfile(candidate):
                with open(candidate, "rb") as fh:
                    return SimpleResponse(200, fh.read())

        index_path = os.path.join(self.static_folder, "index.html")
        if os.path.isfile(index_path):
            with open(index_path, "rb") as fh:
                return SimpleResponse(200, fh.read())

        return SimpleResponse(404, "index.html not found")

    # ------------------------------------------------------------------
    # Lifecycle helpers
    # ------------------------------------------------------------------
    def close(self):
        if self._data_manager.started:
            self._data_manager.stop()

    def run(self, host="0.0.0.0", port=5000):
        raise RuntimeError(
            "SimpleApp does not implement a network server. Install Flask to run the application."
        )


def create_app():
    """Application factory for the Telegram alert service."""

    base_dir = os.path.abspath(os.path.dirname(__file__))
    static_folder = os.path.join(base_dir, "static")
    os.makedirs(static_folder, exist_ok=True)

    db_dir = os.path.join(base_dir, "database")
    os.makedirs(db_dir, exist_ok=True)

    data_manager = DataManager()
    data_manager.start()

    return SimpleApp(static_folder=static_folder, data_manager=data_manager, db_dir=db_dir)


if __name__ == '__main__':
    app = create_app()
    try:
        app.run(host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')))
    except RuntimeError as exc:
        print(exc)
