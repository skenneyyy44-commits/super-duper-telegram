import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import create_app


def test_healthz():
    flask_app = create_app()
    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_map_view_served():
    flask_app = create_app()
    client = flask_app.test_client()
    resp = client.get('/')
    assert resp.status_code == 200
    assert b"folium" in resp.data


def test_db_dir_exists():
    flask_app = create_app()
    assert os.path.isdir(flask_app.config['DB_DIR'])
