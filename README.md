# super-duper-telegram

## Earth Risk Sentinel dashboard
The `earth_risk_sentinel.html` file hosts a single-page dashboard that visualizes real-time USGS earthquake feeds, summarizes regional activity, and renders an interactive Leaflet map. Open the file directly in a browser to explore the UI; no server runtime is required because all data fetching happens client-side.

## Development

### Requirements
* Python 3.11+
* `pip install -r requirements.txt` (if you plan to use the Python utilities in this repo)

### Running tests
All automated checks are powered by `pytest`:

```bash
pytest
```

This exercises the existing API/helpers and ensures future contributions keep the regression surface green.

### Linting
You can optionally run `ruff` (if installed) to lint the Python modules:

```bash
ruff check .
```
