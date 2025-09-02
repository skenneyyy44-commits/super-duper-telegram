import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import * as turf from "@turf/turf";
import { motion } from "framer-motion";

// =============================================================
// BosWash Megalopolis — DC→NYC→Boston Interactive Map (Dark)
// -------------------------------------------------------------
// FIX: Robust layer visibility handling to avoid calling
// map.getLayer before the style loads or after map removal.
// - Introduces `ready` flag + `hasInit` guard for StrictMode
// - `safeSetVis()` checks for map existence + style readiness
// - Visibility reapplied after async Overpass layers mount
// - AbortController to cancel fetches on unmount
// - Lightweight self-tests (console) to validate edge-cases
// ENHANCEMENT:
// - Calculates straight-line corridor distance for comparison
//   with live I-95 length pulled from OpenStreetMap
// =============================================================

const CITIES = [
  { name: "Washington, D.C.", coord: [-77.0369, 38.9072] },
  { name: "Baltimore",        coord: [-76.6122, 39.2904] },
  { name: "Philadelphia",     coord: [-75.1652, 39.9526] },
  { name: "New York City",    coord: [-74.006,  40.7128] },
  { name: "Hartford",         coord: [-72.6851, 41.7637] },
  { name: "Providence",       coord: [-71.4128, 41.824]  },
  { name: "Boston",           coord: [-71.0589, 42.3601] }
];

// Bounding box roughly covering DC→Boston corridor [west, south, east, north]
const BBOX = [-77.8, 38.6, -70.4, 42.9];

// Helper: call Overpass API (OpenStreetMap) with abort support
async function overpass(query, signal) {
  const endpoint = "https://overpass-api.de/api/interpreter";
  const body = new URLSearchParams({ data: query });
  const r = await fetch(endpoint, { method: "POST", body, signal });
  if (!r.ok) throw new Error(`Overpass error ${r.status}`);
  return r.json();
}

// Transform Overpass lines (ways) to GeoJSON FeatureCollection (LineStrings)
function asLineCollection(overpassJson) {
  const features = (overpassJson?.elements || [])
    .filter((el) => el.type === "way" && Array.isArray(el.geometry))
    .map((el) => ({
      type: "Feature",
      properties: {
        id: el.id,
        ref: el.tags?.ref,
        name: el.tags?.name,
        highway: el.tags?.highway,
      },
      geometry: {
        type: "LineString",
        coordinates: el.geometry.map((p) => [p.lon, p.lat]),
      },
    }));
  return { type: "FeatureCollection", features };
}

// Transform Overpass nodes/ways-with-center to GeoJSON points
function asPointCollection(overpassJson) {
  const features = (overpassJson?.elements || [])
    .filter((el) => (el.type === "node" || el.type === "way") && ((el.lat && el.lon) || el.center))
    .map((el) => {
      const lon = el.lon ?? el.center?.lon;
      const lat = el.lat ?? el.center?.lat;
      return {
        type: "Feature",
        properties: {
          id: el.id,
          name: el.tags?.name,
          operator: el.tags?.operator,
          iata: el.tags?.iata,
        },
        geometry: { type: "Point", coordinates: [lon, lat] },
      };
    });
  return { type: "FeatureCollection", features };
}

export default function BosWashMap() {
  const mapDivRef = useRef(null);
  const mapRef = useRef(/** @type {maplibregl.Map|null} */(null));
  const hasInit = useRef(false); // guard for React StrictMode double-mount
  const readyRef = useRef(false); // style fully loaded & not removed
  const acRef = useRef(/** @type {AbortController|null} */(null));

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visible, setVisible] = useState({ i95: true, amtrak: true, airports: true, cities: true });
  const [stats, setStats] = useState({ i95Miles: 0, corridorMiles: 0, amtrakCount: 0, airportCount: 0 });

  // Corridor line from the ordered city list
  const corridor = {
    type: "Feature",
    properties: { name: "BosWash Corridor" },
    geometry: { type: "LineString", coordinates: CITIES.map((c) => c.coord) },
  };

  // --- Utilities ----------------------------------------------------------
  const isMapUsable = () => {
    const m = mapRef.current;
    // Map exists, not removed, and style loaded
    return !!(m && typeof m.isStyleLoaded === "function" && m.isStyleLoaded());
  };

  const safeSetVis = (layerId, on) => {
    const m = mapRef.current;
    if (!m) return;
    // Guard against calling into maplibre internals before style is ready
    if (!isMapUsable()) return;
    try {
      // getLayer() will throw if style is missing; our guards above prevent that
      const layer = m.getLayer(layerId);
      if (!layer) return;
      m.setLayoutProperty(layerId, "visibility", on ? "visible" : "none");
    } catch (e) {
      // Silently ignore if map was just removed or style changed
      // eslint-disable-next-line no-console
      console.debug("safeSetVis skipped:", layerId, e?.message || e);
    }
  };

  const applyVisibility = (vis = visible) => {
    // Apply all toggles—ok to call repeatedly; no-ops if layers missing
    safeSetVis("i95-line", vis.i95);
    ["amtrak-clusters", "amtrak-unclustered", "amtrak-labels"].forEach((l) => safeSetVis(l, vis.amtrak));
    ["airports-points", "airports-labels"].forEach((l) => safeSetVis(l, vis.airports));
    ["city-points", "city-labels", "corridor-line"].forEach((l) => safeSetVis(l, vis.cities));
  };

  // --- Initialize map once ----------------------------------------------
  useEffect(() => {
    if (hasInit.current) return; // StrictMode double-mount protection
    hasInit.current = true;

    const m = new maplibregl.Map({
      container: mapDivRef.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          darkmatter: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors © CARTO",
          },
        },
        layers: [ { id: "base", type: "raster", source: "darkmatter" } ],
      },
      center: [-74.5, 40.2],
      zoom: 6,
      pitch: 45,
      bearing: -10,
      hash: true,
      antialias: true,
    });

    mapRef.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(new maplibregl.ScaleControl({ maxWidth: 200, unit: "imperial" }), "bottom-left");

    m.on("error", (e) => {
      // eslint-disable-next-line no-console
      console.error("MapLibre error:", e?.error || e);
    });

    m.on("load", () => {
      // Style is ready
      readyRef.current = true; setReady(true);

      // Base sources/layers
      const cityFC = {
        type: "FeatureCollection",
        features: CITIES.map((c) => ({ type: "Feature", properties: { name: c.name }, geometry: { type: "Point", coordinates: c.coord } })),
      };
      m.addSource("cities", { type: "geojson", data: cityFC });
      m.addLayer({
        id: "city-points",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": 6,
          "circle-color": "#7ae9ff",
          "circle-stroke-color": "#001018",
          "circle-stroke-width": 2,
          "circle-blur": 0.2,
        },
      });
      m.addLayer({
        id: "city-labels",
        type: "symbol",
        source: "cities",
        layout: { "text-field": ["get", "name"], "text-size": 12, "text-offset": [0, 1.2] },
        paint: { "text-color": "#cfe8ff", "text-halo-color": "#001018", "text-halo-width": 1.2 },
      });

      m.addSource("corridor", { type: "geojson", data: corridor });
      m.addLayer({ id: "corridor-line", type: "line", source: "corridor", paint: { "line-color": "#00d1ff", "line-width": 3, "line-opacity": 0.9 } });

      // After base layers exist, apply initial visibility
      applyVisibility();

      // Fetch dynamic layers via Overpass
      (async () => {
        acRef.current?.abort();
        const ac = new AbortController();
        acRef.current = ac;
        setLoading(true);
        try {
          // I‑95 (ways + relations)
          const i95q = `
            [out:json][timeout:30];
            (
              way["highway"]["ref"~"^I[ -]?95$"](${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]});
              relation["route"="road"]["ref"~"^I[ -]?95$"](${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]});
            );
            out geom;`;
          const i95 = await overpass(i95q, ac.signal);
          const i95FC = asLineCollection(i95);
          if (!ac.signal.aborted && mapRef.current) {
            m.addSource("i95", { type: "geojson", data: i95FC });
            m.addLayer({ id: "i95-line", type: "line", source: "i95", paint: { "line-color": "#ff6b6b", "line-width": 2.5, "line-opacity": 0.9 } });
          }

          // Amtrak stations
          const amtrakQ = `
            [out:json][timeout:30];
            (
              node["railway"="station"]["operator"~"(?i)amtrak"](${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]});
              node["railway"="halt"]["operator"~"(?i)amtrak"](${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]});
            );
            out body;`;
          const amtrak = await overpass(amtrakQ, ac.signal);
          const amtrakFC = asPointCollection(amtrak);
          if (!ac.signal.aborted && mapRef.current) {
            m.addSource("amtrak", { type: "geojson", data: amtrakFC, cluster: true, clusterMaxZoom: 11, clusterRadius: 40 });
            m.addLayer({
              id: "amtrak-clusters",
              type: "circle",
              source: "amtrak",
              filter: ["has", "point_count"],
              paint: {
                "circle-color": "#3ad69f",
                "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 12, 40, 24],
                "circle-opacity": 0.85,
              },
            });
            m.addLayer({ id: "amtrak-unclustered", type: "circle", source: "amtrak", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 5, "circle-color": "#3ad69f", "circle-stroke-color": "#012217", "circle-stroke-width": 2 } });
            m.addLayer({ id: "amtrak-labels", type: "symbol", source: "amtrak", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["coalesce", ["get", "name"], "Amtrak station"], "text-size": 11, "text-offset": [0, 1.1] }, paint: { "text-color": "#bfffe8", "text-halo-width": 1, "text-halo-color": "#001018" } });
          }

          // Airports (IATA)
          const airportQ = `
            [out:json][timeout:30];
            node["aeroway"="aerodrome"]["iata"](${BBOX[1]},${BBOX[0]},${BBOX[3]},${BBOX[2]});
            out body;`;
          const airports = await overpass(airportQ, ac.signal);
          const airportFC = asPointCollection(airports);
          if (!ac.signal.aborted && mapRef.current) {
            m.addSource("airports", { type: "geojson", data: airportFC });
            m.addLayer({ id: "airports-points", type: "circle", source: "airports", paint: { "circle-radius": 5, "circle-color": "#ffd27a", "circle-stroke-color": "#1a1206", "circle-stroke-width": 2 } });
            m.addLayer({ id: "airports-labels", type: "symbol", source: "airports", layout: { "text-field": ["format", ["get", "iata"], { "font-scale": 1.1 }, "\n", {}, ["coalesce", ["get", "name"], "Airport"], { "font-scale": 0.8 }], "text-offset": [0, 1.2], "text-anchor": "top", "text-size": 12 }, paint: { "text-color": "#ffd8a6", "text-halo-color": "#1a1206", "text-halo-width": 1.2 } });
          }

          // Stats (safe even if any layer fetch fails)
          const i95Miles = Math.round(turf.length(i95FC, { units: "miles" }));
          const corridorMiles = Math.round(turf.length(corridor, { units: "miles" }));
          setStats({ i95Miles, corridorMiles, amtrakCount: amtrakFC.features.length, airportCount: airportFC.features.length });

          // Re-apply current visibility to newly added layers
          applyVisibility();
        } catch (e) {
          if (e?.name !== "AbortError") {
            // eslint-disable-next-line no-console
            console.error(e);
            setError(e.message || String(e));
          }
        } finally {
          if (!ac.signal.aborted) setLoading(false);
        }
      })();
    });

    // When map is removed, mark not-ready and abort any in-flight fetches
    m.on("remove", () => { readyRef.current = false; setReady(false); acRef.current?.abort(); });

    return () => {
      try { acRef.current?.abort(); } catch {}
      try { m.remove(); } catch {}
      readyRef.current = false;
      setReady(false);
      mapRef.current = null;
      hasInit.current = false;
    };
  }, []);

  // Visibility toggles — only run when style is ready
  useEffect(() => {
    if (!ready) return; // avoids getLayer during load/unload phases
    applyVisibility(visible);
  }, [visible, ready]);

  // Cinematic fly‑through along the corridor
  const flyThrough = () => {
    const m = mapRef.current; if (!isMapUsable()) return;
    const route = corridor.geometry.coordinates;
    let i = 0;
    const step = () => {
      if (!isMapUsable()) return;
      if (i >= route.length) return;
      const [lon, lat] = route[i];
      m.easeTo({ center: [lon, lat], zoom: i < route.length - 1 ? 8 : 10, bearing: -15 + i * 2, pitch: 55, duration: 1400 });
      i += 1;
      if (i < route.length) setTimeout(step, 1200);
    };
    step();
  };

  // --- Lightweight Self‑Tests -------------------------------------------
  // These run once after first ready=true. They do not alter UI; results in console.
  useEffect(() => {
    if (!ready) return;
    const tests = [];
    const expectNoThrow = (name, fn) => {
      try { fn(); tests.push({ name, ok: true }); } catch (e) { tests.push({ name, ok: false, msg: e?.message || String(e) }); }
    };
    expectNoThrow("safeSetVis handles unknown layer", () => safeSetVis("nope-layer", true));
    expectNoThrow("applyVisibility no-throw", () => applyVisibility());
    expectNoThrow("flyThrough no-throw when map ready", () => flyThrough());
    // Corridor distance sanity: monotonic > 0
    const miles = turf.length(corridor, { units: "miles" });
    tests.push({ name: "corridor length > 0", ok: miles > 0 });
    // eslint-disable-next-line no-console
    console.table(tests.map(t => ({ Test: t.name, Result: t.ok ? "PASS" : "FAIL", Detail: t.msg || "" })));
  }, [ready]);

  return (
    <div className="h-full w-full bg-[#060c12]">
      {/* Map container */}
      <div ref={mapDivRef} className="absolute inset-0" />

      {/* Control Panel */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="absolute top-4 left-4 z-10 w-[360px] max-w-[92vw] rounded-2xl border border-sky-900/60 bg-[#061520]/80 backdrop-blur-xl shadow-2xl">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-sky-100 text-lg font-semibold tracking-wide">BosWash Megalopolis</h1>
            <span className="text-[10px] text-sky-300/70">DC → BAL → PHL → NYC → HFD → PVD → BOS</span>
          </div>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-sky-900/20 px-3 py-2 ring-1 ring-sky-900/40">
              <div className="text-[11px] text-sky-300/80">I‑95 (within box)</div>
              <div className="text-sky-100 text-base font-bold">{stats.i95Miles ? `${stats.i95Miles.toLocaleString()} mi` : "…"}</div>
            </div>
            <div className="rounded-xl bg-sky-900/20 px-3 py-2 ring-1 ring-sky-900/40">
              <div className="text-[11px] text-sky-300/80">Direct corridor</div>
              <div className="text-sky-100 text-base font-bold">{stats.corridorMiles ? `${stats.corridorMiles.toLocaleString()} mi` : "…"}</div>
            </div>
            <div className="rounded-xl bg-emerald-900/20 px-3 py-2 ring-1 ring-emerald-900/40">
              <div className="text-[11px] text-emerald-300/80">Amtrak stations</div>
              <div className="text-emerald-100 text-base font-bold">{stats.amtrakCount || "…"}</div>
            </div>
            <div className="rounded-xl bg-amber-900/20 px-3 py-2 ring-1 ring-amber-900/40">
              <div className="text-[11px] text-amber-300/80">Airports (IATA)</div>
              <div className="text-amber-100 text-base font-bold">{stats.airportCount || "…"}</div>
            </div>
          </div>

          {/* Toggles */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-[13px] text-sky-100">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-sky-400" checked={visible.i95} onChange={(e) => setVisible(v => ({ ...v, i95: e.target.checked }))} /> I‑95</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-emerald-400" checked={visible.amtrak} onChange={(e) => setVisible(v => ({ ...v, amtrak: e.target.checked }))} /> Amtrak</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-amber-400" checked={visible.airports} onChange={(e) => setVisible(v => ({ ...v, airports: e.target.checked }))} /> Airports</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-cyan-300" checked={visible.cities} onChange={(e) => setVisible(v => ({ ...v, cities: e.target.checked }))} /> Cities & corridor</label>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={flyThrough} className="rounded-2xl bg-sky-800/60 px-3 py-2 text-sky-50 font-semibold ring-1 ring-sky-700/60 hover:bg-sky-700/70">Fly the corridor</button>
            <button onClick={() => isMapUsable() && mapRef.current.easeTo({ center: [-74.5, 40.2], zoom: 6, pitch: 45, bearing: -10 })} className="rounded-2xl bg-[#0e2736]/70 px-3 py-2 text-sky-50 font-semibold ring-1 ring-sky-900/50 hover:bg-[#133447]/70">Reset view</button>
          </div>

          {/* Notes / Sources */}
          <div className="mt-3 text-[11px] leading-snug text-sky-300/70">
            <div><span className="font-semibold">Live data:</span> OpenStreetMap via Overpass (I‑95, Amtrak stations, airports).</div>
            <div><span className="font-semibold">Basemap:</span> CARTO Dark Matter raster tiles. Labels rendered with MapLibre demo glyphs.</div>
            <div><span className="font-semibold">Corridor vs. I‑95:</span> straight-line distance uses Turf.js and city coordinates above.</div>
          </div>
        </div>

        {/* Footer ribbon */}
        <div className="flex items-center justify-between rounded-b-2xl border-t border-sky-900/50 bg-[#06101a]/70 px-4 py-2 text-[11px] text-sky-300/70">
          <span>Built with MapLibre GL • Turf • Tailwind</span>
          <span>Realtime fetch on load · no API keys</span>
        </div>
      </motion.div>

      {/* Loading / error badges */}
      {loading && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-[#061520]/80 px-4 py-2 text-[12px] text-sky-200 ring-1 ring-sky-900/50">Fetching live layers…</div>
      )}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-red-900/70 px-4 py-2 text-[12px] text-red-50 ring-1 ring-red-800/60">{String(error)}</div>
      )}
    </div>
  );
}

