# Demos

This repository holds several small demos side by side: a Boston–Washington map, a houseplant tracker, a 3D physics sandbox, and an earthquake simulator.

## BosWash map

`src/BosWashMap.jsx` is a MapLibre GL + React map of the BosWash corridor from Washington, D.C. to Boston. On load it fetches live OpenStreetMap data (Interstate 95, Amtrak stations, and airports with IATA codes) and compares the straight-line corridor distance with the fetched I-95 length.

Render it from a React app that provides `maplibre-gl`, `@turf/turf`, and `framer-motion`:

```jsx
import BosWashMap from "./src/BosWashMap";

function App() {
  return <BosWashMap />;
}
```

The map loads data on mount. Each layer has a checkbox, and "Fly the corridor" plays a short camera path. While the live request is in flight the stat cards show "…". After it finishes they show the real numbers, including zero.

## Plant tracker

The greenhouse UI starts at `frontend/App.jsx`. This repo does not ship a bundler for it. Mount that component in a React app and install `firebase`, `lucide-react`, and Tailwind CSS (the screens use Tailwind utility classes).

Before the app loads, set these on `window`:

- `__firebase_config` — a JSON string of a Firebase web config, including `apiKey`
- `__app_id` — optional; defaults to `default-plant-tracker`
- `__initial_auth_token` — optional custom-auth token. If you omit it, the app signs in anonymously, so the Firebase project has to allow anonymous sign-in
- `__gemini_api_key` — used when a health-log photo is analyzed. `__geminiApiKey`, `__GEMINI_API_KEY`, and `__geminiKey` are also accepted

From the dashboard you can add a plant, open it, and save a health log. "Analyze with AI" sends the photo to Gemini using the image's own type (PNG, JPEG, and anything else in the data URL), along with the notes you typed.

## Physix Lab

`physix-lab.html` is a self-contained 3D physics sandbox (Three.js and cannon-es, loaded from the network). From the repository root:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/physix-lab.html. Choose a shape, press "Start solver", and click an empty part of the floor to drop one in. The preset buttons build a block pyramid, a domino spiral, a wrecking ball, or a zero-g orbit. Sliders change gravity, bounce, and friction.

## Earthquake simulator

`simulator.html` is the Seismic Architecture Lab, also a single page that pulls its libraries from the network. With the same static server running, open http://localhost:8080/simulator.html.

Shift-click the terrain to place the epicenter, then use the "Simulation Control" panel to set magnitude, depth, and which waves are enabled. "INITIATE EVENT" starts the quake. "RESET SCENE" puts the buildings back.

## Tests

```bash
cd tests/health-log && npm ci && npm test
cd tests/map-stats && npm ci && npm test
node --test tests/test_physix_lab.cjs
```
