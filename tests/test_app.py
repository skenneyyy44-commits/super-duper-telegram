import os
import sys

# Ensure the repository root is on the Python path so ``import app`` works
sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import app


def test_healthz():
    flask_app = app.create_app()
    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}


def test_static_index_served(tmp_path):
    flask_app = app.create_app()
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
    flask_app = app.create_app()
    assert os.path.isdir(flask_app.config['DB_DIR'])
