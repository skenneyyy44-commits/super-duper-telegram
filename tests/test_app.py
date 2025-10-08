import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
import app as app_module

create_app = app_module.create_app


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


def test_data_manager_stops_after_request_using_fallback(monkeypatch):
    monkeypatch.setattr(app_module, "Flask", app_module.MiniFlask)

    tracked: list[app_module.DataManager] = []
    OriginalDataManager = app_module.DataManager

    class TrackingDataManager(OriginalDataManager):
        def __init__(self):
            super().__init__()
            tracked.append(self)

    monkeypatch.setattr(app_module, "DataManager", TrackingDataManager)

    flask_app = create_app()
    assert tracked, "DataManager instance should be created"
    data_manager = tracked[0]
    assert data_manager.started is True

    client = flask_app.test_client()
    resp = client.get('/healthz')
    assert resp.status_code == 200
    assert data_manager.started is False
