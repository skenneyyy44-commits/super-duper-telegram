# Demos

This repository holds several small demos side by side: a Boston–Washington map, a houseplant tracker, a 3D physics sandbox, earthquake simulators, and an Earth Risk Sentinel dashboard.

## React seismic wave simulator

The React app in `frontend/` draws a procedural seismic wave field. Install and start it with:

```bash
cd frontend
npm install
npm run dev
```

Vite serves the dev UI at http://localhost:5173. `npm run build` writes the production bundle to `static/wave-simulator/`, which Flask serves at http://localhost:5000/wave-simulator/index.html. That folder is separate from the other files in `static/`, so a build does not remove the earthquake laboratory, the black-hole page, or the Earth Risk Sentinel dashboard.

## BosWash map

`src/BosWashMap.jsx` is a MapLibre GL + React map of the BosWash corridor from Washington, D.C. to Boston. On load it fetches live OpenStreetMap data (Interstate 95, Amtrak stations, and airports with IATA codes) and compares the straight-line corridor distance with the fetched I-95 length.

Render it from a React app that provides `maplibre-gl`, `@turf/turf`, and `framer-motion`:

```jsx
import BosWashMap from "./src/BosWashMap";

function App() {
  return <BosWashMap />;
}
```

The map loads data on mount. Each layer has a checkbox, and "Fly the corridor" plays a short camera path. While the live request is in flight the stat cards show "…". After a successful fetch they show the real numbers, including zero. If the request fails, the cards show "—" instead of zero, and the error is shown along the bottom of the map.

## Plant tracker

The greenhouse UI starts at `frontend/App.jsx`. That tree is separate from the Vite app in `frontend/src`. Mount it in a React app and install `firebase`, `lucide-react`, and Tailwind CSS.

Before the app loads, set these on `window`:

- `__firebase_config` — a JSON string of a Firebase web config, including `apiKey`
- `__app_id` — optional; defaults to `default-plant-tracker`
- `__initial_auth_token` — optional custom-auth token. If you omit it, the app signs in anonymously, so the Firebase project has to allow anonymous sign-in
- `__gemini_api_key` — used when a health-log photo is analyzed. `__geminiApiKey`, `__GEMINI_API_KEY`, and `__geminiKey` are also accepted

## Physix Lab

`physix-lab.html` is a self-contained 3D physics sandbox. From the repository root:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/physix-lab.html.

## Earthquake laboratory

`static/index.html` is the Flask-served Earthquake Wave Laboratory. `simulator.html` at the repository root is the Seismic Architecture Lab. With the static server above, open http://localhost:8080/simulator.html or http://localhost:8080/static/index.html. The Flask app also serves the laboratory at http://localhost:5000/.

## Bitcoin outlook dashboard

`static/bitcoin-outlook.html` contains the interactive Bitcoin dashboard with simulated price data. Open http://localhost:5000/bitcoin-outlook.html with Flask, or http://localhost:8080/static/bitcoin-outlook.html with the static server above.

## Earth Risk Sentinel

`earth_risk_sentinel.html` is a USGS earthquake dashboard with regional filters, an energy index, and a Leaflet map. With the same static server running, open http://localhost:8080/earth_risk_sentinel.html. Use the region buttons to limit the stats and the map to that belt. A real mean magnitude includes zero and negative values; missing magnitudes are left out.

## Tests

```bash
cd frontend && npm ci && npm run build
cd tests/health-log && npm ci && npm test
cd tests/map-stats && npm ci && npm test
node --test tests/seismic-dpr.test.mjs tests/test_physix_lab.cjs tests/earth_risk_regions.test.cjs
python3 -m pytest tests/ -q
```
