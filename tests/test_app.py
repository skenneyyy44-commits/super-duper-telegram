import os
import sys
from unittest.mock import patch

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


@patch('earthquake_map.fetch_earthquake_data')
def test_map_view_with_malformed_data(mock_fetch_data):
    """
    Test that the map view handles malformed data from the API gracefully.
    """
    # This feature is missing the 'properties' key, which should cause a KeyError
    malformed_data = {
        'features': [
            {
                'geometry': {
                    'coordinates': [-122.3, 47.6, 10]
                }
            }
        ]
    }
    mock_fetch_data.return_value = malformed_data

    flask_app = create_app()
    client = flask_app.test_client()
    resp = client.get('/')
    assert resp.status_code == 200
    assert b"folium" in resp.data
