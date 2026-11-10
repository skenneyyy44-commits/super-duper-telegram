import json
import os
import sys
from pathlib import Path
from urllib.parse import quote

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import app as app_module

create_app = app_module.create_app

_FALLBACK_LOADS = 0


def _header(resp, name):
    headers = getattr(resp, "headers", {}) or {}
    if hasattr(headers, "get"):
        for candidate in (name, name.lower()):
            value = headers.get(candidate)
            if value is not None:
                return value
    try:
        items = list(headers.items())
    except AttributeError:
        items = []
    for key, value in items:
        if str(key).lower() == name.lower():
            return value
    return None


def _assert_json_response(resp, payload):
    assert resp.status_code == 200
    raw = resp.get_data()
    assert isinstance(raw, (bytes, bytearray)) and raw
    assert json.loads(raw) == payload
    assert resp.get_json() == payload
    content_type = _header(resp, "Content-Type")
    if content_type is None:
        content_type = getattr(resp, "content_type", None)
    assert content_type is not None
    assert str(content_type).split(";", 1)[0].strip().lower() == "application/json"
    length = _header(resp, "Content-Length")
    assert length is not None
    assert int(length) == len(raw)
    if getattr(resp, "content_length", None) is not None:
        assert int(resp.content_length) == len(raw)


def _load_fallback_app(monkeypatch):
    """Import app.py with Flask hidden so the in-repo response types are used."""
    global _FALLBACK_LOADS
    import importlib.util

    _FALLBACK_LOADS += 1
    spec = importlib.util.spec_from_file_location(
        f"fallback_app_{_FALLBACK_LOADS}", app_module.__file__
    )
    fallback_app = importlib.util.module_from_spec(spec)
    with monkeypatch.context() as isolated:
        isolated.setitem(sys.modules, "flask", None)
        assert spec.loader is not None
        spec.loader.exec_module(fallback_app)
    return fallback_app


def _prepare_static(tmp_path, flask_app):
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("INDEX", encoding="utf-8")
    (static_dir / "ok.txt").write_text("OK-FILE", encoding="utf-8")
    (static_dir / "nested").mkdir()
    secret = tmp_path / "secret.txt"
    secret.write_text("TOPSECRET", encoding="utf-8")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "note.txt").write_text("OUTSIDE-NOTE", encoding="utf-8")
    (static_dir / "escape.txt").symlink_to(secret)
    (static_dir / "escape_rel.txt").symlink_to(Path("..") / "secret.txt")
    (static_dir / "linked-dir").symlink_to(outside)
    (static_dir / "alias.txt").symlink_to(static_dir / "ok.txt")
    flask_app.static_folder = str(static_dir)
    return static_dir, secret


def _assert_blocked(client, path):
    resp = client.get(path)
    body = resp.get_data()
    assert resp.status_code == 404, (path, resp.status_code, body[:120])
    assert b"TOPSECRET" not in body
    assert b"OUTSIDE-NOTE" not in body


def test_healthz():
    flask_app = create_app()
    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_static_index_served(tmp_path):
    flask_app = create_app()
    real_index = os.path.join(flask_app.static_folder, 'index.html')
    before = None
    if os.path.isfile(real_index):
        with open(real_index, 'rb') as handle:
            before = handle.read()

    static_dir = tmp_path / 'static'
    static_dir.mkdir()
    index_path = static_dir / 'index.html'
    index_path.write_text('ok', encoding='utf-8')
    flask_app.static_folder = str(static_dir)

    client = flask_app.test_client()
    resp = client.get('/')
    assert resp.status_code == 200
    assert resp.get_data(as_text=True) == 'ok'
    assert index_path.read_text(encoding='utf-8') == 'ok'
    if before is not None:
        with open(real_index, 'rb') as handle:
            assert handle.read() == before


def test_db_dir_exists():
    flask_app = create_app()
    assert os.path.isdir(flask_app.config['DB_DIR'])


def test_data_manager_survives_requests_and_stops_at_shutdown_using_fallback(monkeypatch):
    # Load a separate module with Flask unavailable; preserve the real backend.
    import importlib.util

    spec = importlib.util.spec_from_file_location("fallback_app", app_module.__file__)
    fallback_app = importlib.util.module_from_spec(spec)
    with monkeypatch.context() as isolated:
        isolated.setitem(sys.modules, "flask", None)
        spec.loader.exec_module(fallback_app)
    monkeypatch.setattr(fallback_app, "Flask", fallback_app.MiniFlask)

    tracked: list[fallback_app.DataManager] = []
    OriginalDataManager = fallback_app.DataManager

    class TrackingDataManager(OriginalDataManager):
        def __init__(self):
            super().__init__()
            tracked.append(self)

    monkeypatch.setattr(fallback_app, "DataManager", TrackingDataManager)

    shutdown_callbacks = []
    monkeypatch.setattr(fallback_app.atexit, "register", shutdown_callbacks.append)
    flask_app = fallback_app.create_app()
    assert tracked, "DataManager instance should be created"
    data_manager = tracked[0]
    assert data_manager.started is True

    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert data_manager.started is True
    assert client.get("/healthz").status_code == 200
    assert data_manager.started is True
    assert len(shutdown_callbacks) == 1
    shutdown_callbacks[0]()
    assert data_manager.started is False


def test_healthz_and_alerts_json_are_written():
    flask_app = create_app()
    client = flask_app.test_client()
    _assert_json_response(client.get("/healthz"), {"ok": True})
    _assert_json_response(
        client.post("/api/alerts/generate"),
        {"status": "success", "alerts_generated": 0, "alerts_sent": 0},
    )


def test_static_requests_cannot_escape_directory(tmp_path):
    flask_app = create_app()
    _prepare_static(tmp_path, flask_app)
    client = flask_app.test_client()

    ok = client.get("/ok.txt")
    assert ok.status_code == 200
    assert b"OK-FILE" in ok.get_data()

    alias = client.get("/alias.txt")
    assert alias.status_code == 200
    assert b"OK-FILE" in alias.get_data()

    missing = client.get("/missing-page")
    assert missing.status_code == 200
    assert b"INDEX" in missing.get_data()

    directory = client.get("/nested")
    assert directory.status_code == 404

    for path in (
        "/../secret.txt",
        "/%2e%2e/secret.txt",
        "/%2e%2e%2fsecret.txt",
        "/..%2fsecret.txt",
        "/%252e%252e%252fsecret.txt",
        "/..%5c..%5csecret.txt",
        "/escape.txt",
        "/escape_rel.txt",
        "/linked-dir/note.txt",
        "/nested/../../secret.txt",
    ):
        _assert_blocked(client, path)


def test_fallback_serializes_json_and_blocks_static_escape(tmp_path, monkeypatch):
    fallback_app = _load_fallback_app(monkeypatch)
    flask_app = fallback_app.create_app()
    static_dir, secret = _prepare_static(tmp_path, flask_app)
    client = flask_app.test_client()

    _assert_json_response(client.get("/healthz"), {"ok": True})
    _assert_json_response(
        client.post("/api/alerts/generate"),
        {"status": "success", "alerts_generated": 0, "alerts_sent": 0},
    )

    inside = client.get("/nested/../ok.txt")
    assert inside.status_code == 200
    assert inside.get_data() == b"OK-FILE"

    alias = client.get("/alias.txt")
    assert alias.status_code == 200
    assert alias.get_data() == b"OK-FILE"

    root = client.get("/")
    assert root.status_code == 200
    assert root.get_data() == b"INDEX"

    for path in (
        "/../secret.txt",
        "/../../secret.txt",
        "/nested/../../secret.txt",
        "/%2e%2e/secret.txt",
        "/%2e%2e%2fsecret.txt",
        "/..%2fsecret.txt",
        "/%252e%252e%252fsecret.txt",
        "/..%5c..%5csecret.txt",
        "/%2e%2e%5csecret.txt",
        "/" + quote(str(secret), safe=""),
        "/escape.txt",
        "/escape_rel.txt",
        "/linked-dir/note.txt",
        "/%00../secret.txt",
    ):
        _assert_blocked(client, path)

    absolute = fallback_app.send_from_directory(str(static_dir), str(secret))
    assert absolute.status_code == 404
    assert b"TOPSECRET" not in absolute.get_data()
    relative = fallback_app.send_from_directory(str(static_dir), "../secret.txt")
    assert relative.status_code == 404
    assert b"TOPSECRET" not in relative.get_data()
