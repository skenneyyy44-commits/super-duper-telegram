"""Commute data is available only as an explicitly labeled demo."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app


def test_commute_demo_endpoint_is_explicitly_synthetic():
    client = create_app().test_client()
    response = client.get("/api/commute/demo")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["mode"] == "demo"
    assert payload["live"] is False
    assert payload["data_source"] == "synthetic"
    assert "Not actual traffic" in payload["disclaimer"]
    assert len(payload["traffic_prediction"]) == 5
    assert payload["eta_minutes"] > 0


def test_commute_non_demo_path_is_not_a_fake_live_api():
    response = create_app().test_client().get("/api/commute")
    assert response.status_code != 200
