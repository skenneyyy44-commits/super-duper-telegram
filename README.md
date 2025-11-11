# BosWash Map Demo

This repository contains a MapLibre GL + React demo visualizing the BosWash megalopolis corridor from Washington, D.C. to Boston. Live data layers are fetched from OpenStreetMap's Overpass API, including:

- Interstate 95 geometry
- Amtrak stations (clustered)
- Airports with IATA codes

The `src/BosWashMap.jsx` component handles style loading edge cases, cleans up network requests with `AbortController`, and compares the straight-line corridor distance against the fetched I‑95 length.

## Usage

Import the component into a React project:

```jsx
import BosWashMap from "./src/BosWashMap";

function App() {
  return <BosWashMap />;
}
```

The map automatically loads data on mount and provides toggles for each layer along with a "Fly the corridor" animation.

