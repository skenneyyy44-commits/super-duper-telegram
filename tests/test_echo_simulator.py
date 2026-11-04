"""The self-contained echo simulator must not replace the earthquake lab."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app


def test_earthquake_homepage_remains_primary():
    response = create_app().test_client().get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Earthquake Wave Laboratory" in html
    assert "/echo-simulator.html" in html


def test_echo_simulator_page_serves_independently():
    response = create_app().test_client().get("/echo-simulator.html")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Canvas Echocardiogram" in html
    assert "Educational simulation only" in html
    assert 'id="echo"' in html
