const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn, delay, ...args) => {
  // The map's corridor fly-through schedules multi-second steps from a self-check.
  if (delay >= 1000) return 0;
  return originalSetTimeout(fn, delay, ...args);
};

async function loadComponent() {
  const bundled = await build({
    entryPoints: [path.join(__dirname, '../../src/BosWashMap.jsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
    plugins: [{
      name: 'test-boundaries',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
        b.onResolve({ filter: /^(maplibre-gl|@turf\/turf|framer-motion)$/ }, (args) => ({
          path: args.path,
          namespace: 'fixture',
        }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => {
          if (args.path === 'maplibre-gl') {
            return { contents: `
              class Map {
                constructor() {
                  this.layers = {};
                  this.handlers = {};
                  this.styleLoaded = false;
                  globalThis.__boswashMap = this;
                }
                on(type, cb) { (this.handlers[type] ||= []).push(cb); }
                emit(type) {
                  if (type === 'load') this.styleLoaded = true;
                  for (const cb of this.handlers[type] || []) cb();
                }
                isStyleLoaded() { return this.styleLoaded; }
                addControl() {}
                addSource() {}
                addLayer(layer) { this.layers[layer.id] = { visibility: null }; }
                getLayer(id) { return this.layers[id]; }
                setLayoutProperty(id, prop, value) {
                  if (!this.layers[id]) throw new Error('missing layer ' + id);
                  this.layers[id][prop] = value;
                }
                easeTo() {}
                remove() { this.styleLoaded = false; this.emit('remove'); }
              }
              class NavigationControl {}
              class ScaleControl {}
              export default { Map, NavigationControl, ScaleControl };
            ` };
          }
          if (args.path === '@turf/turf') {
            return { contents: 'export function length() { return 412; }' };
          }
          return { contents: 'export const motion = { div: "div" };' };
        });
      },
    }],
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports.default;
}

function okResponse() {
  return { ok: true, json: async () => ({ elements: [] }) };
}

async function drainFetches() {
  let idle = 0;
  for (let i = 0; i < 40; i += 1) {
    const pending = globalThis.__boswashFetches;
    if (!pending || pending.length === 0) {
      await Promise.resolve();
      idle += 1;
      if (idle >= 8) return;
      continue;
    }
    idle = 0;
    const batch = pending.splice(0);
    for (const resolve of batch) resolve(okResponse());
  }
  throw new Error('Overpass fetches did not settle');
}

async function mount(t, BosWashMap) {
  const originalFetch = global.fetch;
  const originalError = console.error;
  globalThis.__boswashFetches = [];
  globalThis.__boswashHoldFetch = true;
  global.fetch = (_url, opts) => {
    if (opts?.signal?.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      return Promise.reject(error);
    }
    if (!globalThis.__boswashHoldFetch) return Promise.resolve(okResponse());
    return new Promise((resolve) => {
      globalThis.__boswashFetches.push(resolve);
    });
  };
  console.error = (...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  };

  let renderer;
  t.after(async () => {
    try {
      if (renderer) await act(async () => renderer.unmount());
    } finally {
      global.fetch = originalFetch;
      console.error = originalError;
      delete globalThis.__boswashMap;
      delete globalThis.__boswashFetches;
      delete globalThis.__boswashHoldFetch;
    }
  });

  await act(async () => {
    renderer = create(React.createElement(BosWashMap));
  });
  const map = globalThis.__boswashMap;
  assert.ok(map, 'map was not constructed');

  const checkbox = (className) => renderer.root.findAllByType('input').find((node) => node.props.className === className);
  const toggle = async (className, checked) => {
    await act(async () => {
      checkbox(className).props.onChange({ target: { checked } });
    });
  };
  const finishLoad = async () => {
    globalThis.__boswashHoldFetch = false;
    await act(async () => {
      map.emit('load');
      await drainFetches();
    });
  };

  return { renderer, map, checkbox, toggle, finishLoad };
}

test('layer toggles made while Overpass data is loading still apply when the layers mount', async (t) => {
  const BosWashMap = await loadComponent();
  const app = await mount(t, BosWashMap);

  await act(async () => {
    app.map.emit('load');
  });
  assert.equal(globalThis.__boswashFetches.length > 0, true, 'expected a live Overpass request');
  assert.equal(app.map.layers['i95-line'], undefined);

  await app.toggle('accent-sky-400', false);
  await app.toggle('accent-amber-400', false);
  assert.equal(app.checkbox('accent-sky-400').props.checked, false);
  assert.equal(app.checkbox('accent-amber-400').props.checked, false);

  await act(async () => {
    await drainFetches();
  });

  assert.equal(app.map.layers['i95-line'].visibility, 'none');
  assert.equal(app.map.layers['airports-points'].visibility, 'none');
  assert.equal(app.map.layers['airports-labels'].visibility, 'none');
  assert.equal(app.map.layers['amtrak-clusters'].visibility, 'visible');
  assert.equal(app.map.layers['amtrak-unclustered'].visibility, 'visible');
  assert.equal(app.map.layers['amtrak-labels'].visibility, 'visible');
  assert.equal(app.map.layers['city-points'].visibility, 'visible');
});

test('toggling a layer after live data has loaded hides only that layer', async (t) => {
  const BosWashMap = await loadComponent();
  const app = await mount(t, BosWashMap);
  await app.finishLoad();

  assert.equal(app.map.layers['amtrak-clusters'].visibility, 'visible');
  await app.toggle('accent-emerald-400', false);

  assert.equal(app.map.layers['amtrak-clusters'].visibility, 'none');
  assert.equal(app.map.layers['amtrak-unclustered'].visibility, 'none');
  assert.equal(app.map.layers['amtrak-labels'].visibility, 'none');
  assert.equal(app.map.layers['i95-line'].visibility, 'visible');
  assert.equal(app.map.layers['airports-points'].visibility, 'visible');
  assert.equal(app.checkbox('accent-emerald-400').props.checked, false);
});
