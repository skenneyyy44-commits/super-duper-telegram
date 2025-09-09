import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(__file__)))
from app import create_app

def test_commute_endpoint():
    app = create_app()
    client = app.test_client()
    resp = client.get('/api/commute')
    assert resp.status_code == 200
    data = resp.get_json()
    for key in [
        'route_name',
        'eta_minutes',
        'eta_vs_average',
        'weather',
        'alerts',
        'traffic_prediction',
        'historical_pattern',
    ]:
        assert key in data
    assert isinstance(data['traffic_prediction'], list) and data['traffic_prediction']
