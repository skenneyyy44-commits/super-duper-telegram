"""Synthetic commute examples for UI demonstrations only.

This does not fetch traffic, routing, incidents, or weather information.
Consumers must label it as DEMO data and must not use it for navigation.
"""
from datetime import datetime, timedelta
from typing import Any, Dict


def generate_commute_demo(now: datetime | None = None) -> Dict[str, Any]:
    now = (now or datetime.now()).replace(second=0, microsecond=0)
    points = [
        {
            "time": (now + timedelta(minutes=offset)).strftime("%H:%M"),
            "speed_kmh": max(10, 50 - (offset // 15) * 5),
        }
        for offset in range(0, 61, 15)
    ]
    return {
        "mode": "demo",
        "live": False,
        "data_source": "synthetic",
        "disclaimer": "Illustrative sample only. Not actual traffic, routing, or weather.",
        "route_name": "Example evening commute",
        "eta_minutes": 28,
        "eta_vs_average": 2,
        "weather": "Simulated clear",
        "alerts": [
            {"message": "Example delay only — not a real incident", "delay_min": 5}
        ],
        "traffic_prediction": points,
        "historical_pattern": [
            {"time": "17:00", "speed_kmh": 45},
            {"time": "18:00", "speed_kmh": 40},
        ],
    }
