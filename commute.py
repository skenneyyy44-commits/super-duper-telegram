import datetime
from typing import List, Dict

def _traffic_prediction(now: datetime.datetime) -> List[Dict[str, int]]:
    """Return a simple traffic speed prediction for the next hour."""
    points = []
    for minutes in range(0, 61, 15):
        time_label = (now + datetime.timedelta(minutes=minutes)).strftime('%H:%M')
        speed = max(10, 50 - (minutes // 15) * 5)
        points.append({"time": time_label, "speed_kmh": speed})
    return points

def generate_commute_data() -> Dict:
    """Simulate predictive commute data."""
    now = datetime.datetime.now().replace(second=0, microsecond=0)
    return {
        "route_name": "Your Evening Drive",
        "eta_minutes": 28,
        "eta_vs_average": 2,
        "weather": "Clear",
        "alerts": [
            {"message": "Minor delay near Sycamore Rd", "delay_min": 5},
            {"message": "All clear on Main St Bypass"},
        ],
        "traffic_prediction": _traffic_prediction(now),
        "historical_pattern": [
            {"time": "17:00", "speed_kmh": 45},
            {"time": "18:00", "speed_kmh": 40},
        ],
    }

__all__ = ["generate_commute_data"]
