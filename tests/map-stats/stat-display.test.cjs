const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const LOADING = '…';

const originalSetTimeout = global.setTimeout;
global.setTimeout = (fn, delay, ...args) => {
  if (delay >= 1000) return 0;
  return originalSetTimeout(fn, delay, ...args);
};

async function loadMap() {
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
                  if (this.layers[id]) this.layers[id][prop] = value;
                }
                easeTo() {}
                remove() { this.styleLoaded = false; }
              }
              class NavigationControl {}
              class ScaleControl {}
              export default { Map, NavigationControl, ScaleControl };
            ` };
          }
          if (args.path === '@turf/turf') {
            return { contents: `
              export function length(input) {
                if (input && input.type === 'FeatureCollection') return input.features && input.features.length ? 400 : 0;
                if (input && input.geometry && input.geometry.coordinates && input.geometry.coordinates.length) return 400;
                return 0;
              }
            ` };
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

function statText(renderer) {
  return renderer.root.findAll((node) => (
    typeof node.props?.className === 'string' && node.props.className.includes('text-base font-bold')
  )).map((node) => node.children.join(''));
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
    for (const resolve of batch) resolve();
  }
  throw new Error('Overpass fetches did not settle');
}

test('a finished count of zero is shown as zero, while loading stays a placeholder', async (t) => {
  const BosWashMap = await loadMap();
  const originalFetch = global.fetch;
  const originalError = console.error;
  const payloads = [
    { elements: [] },
    { elements: [] },
    { elements: [{ type: 'node', lat: 42.36, lon: -71.01, tags: { iata: 'BOS', name: 'Logan' } }] },
  ];
  let calls = 0;
  globalThis.__boswashFetches = [];
  global.fetch = (_url, opts) => new Promise((resolve, reject) => {
    if (opts?.signal?.aborted) {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
      return;
    }
    const body = payloads[Math.min(calls, payloads.length - 1)];
    calls += 1;
    globalThis.__boswashFetches.push(() => resolve({
      ok: true,
      json: async () => body,
    }));
  });
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
    }
  });

  await act(async () => {
    renderer = create(React.createElement(BosWashMap));
  });
  await act(async () => {
    globalThis.__boswashMap.emit('load');
  });
  assert.deepEqual(statText(renderer), [LOADING, LOADING, LOADING, LOADING]);

  await act(async () => {
    await drainFetches();
  });

  assert.deepEqual(statText(renderer), [
    `${(0).toLocaleString()} mi`,
    `${(400).toLocaleString()} mi`,
    (0).toLocaleString(),
    (1).toLocaleString(),
  ]);
});
