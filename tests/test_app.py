import os
import sys
from typing import Optional

import pytest

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import Flask, create_app


def test_healthz():
    flask_app = create_app()
    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_static_index_served(tmp_path):
    flask_app = create_app()
    static_folder = flask_app.static_folder
    os.makedirs(static_folder, exist_ok=True)
    index_path = os.path.join(static_folder, 'index.html')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write('ok')
    client = flask_app.test_client()
    resp = client.get('/')
    assert resp.status_code == 200
    os.remove(index_path)


def test_db_dir_exists():
    flask_app = create_app()
    assert os.path.isdir(flask_app.config['DB_DIR'])


def test_teardown_runs_after_request():
    flask_app = create_app()
    teardown_state = {"called": False, "exception": object()}

    @flask_app.teardown_appcontext
    def record(exc):
        teardown_state["called"] = True
        teardown_state["exception"] = exc

    client = flask_app.test_client()
    resp = client.get('/healthz')

    assert resp.status_code == 200
    assert teardown_state["called"] is True
    assert teardown_state["exception"] is None


def test_teardown_receives_exception():
    flask_app = Flask(__name__)
    if hasattr(flask_app, "config"):
        flask_app.config['TESTING'] = True
        flask_app.config['PROPAGATE_EXCEPTIONS'] = True
    if hasattr(flask_app, "testing"):
        flask_app.testing = True
    captured = {"called": False, "exception": None}

    @flask_app.route('/boom')
    def boom():
        raise RuntimeError('boom')

    @flask_app.teardown_appcontext
    def record(exc):
        captured["called"] = True
        captured["exception"] = exc

    client = flask_app.test_client()
    raised: Optional[BaseException] = None
    try:
        client.get('/boom')
    except RuntimeError as exc:  # pragma: no cover - depends on Flask availability
        raised = exc

    assert captured["called"] is True
    assert isinstance(captured["exception"], RuntimeError)
    if raised is not None:
        assert captured["exception"] is raised
