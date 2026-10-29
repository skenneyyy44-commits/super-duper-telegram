const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const analysis = { plant_species: 'Pothos', health_summary: 'Healthy', potential_issues: [], care_recommendations: [] };
const image = 'data:image/png;base64,AA==';

// Render the actual component with React. Replace only external I/O and visual
// wrappers; no hooks, save handlers, state transitions, or JSX are copied here.
async function mount(t) {
  const writes = [];
  const pending = [];
  let closes = 0;
  const firestore = {};
  const timestamp = { seconds: 123 };
  const io = {
    collection: (db, location) => { assert.equal(db, firestore); return location; },
    addDoc: (location, data) => {
      writes.push({ location, data });
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    },
    Timestamp: { now: () => timestamp },
    fileToBase64: async () => image,
    getAiHealthAnalysis: async () => analysis,
    resolveAppId: () => 'test-app',
  };
  const bundled = await build({
    entryPoints: [path.join(__dirname, '../../frontend/components/plant/HealthLogModal.jsx')],
    bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic',
    plugins: [{ name: 'test-boundaries', setup(b) {
      b.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({ path: args.path, external: true }));
      b.onResolve({ filter: /^(firebase\/firestore|lucide-react)|\/(Modal|FileUploader|media|ai|firebase)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        export const {addDoc,collection,Timestamp,fileToBase64,getAiHealthAnalysis,resolveAppId}=globalThis.__healthLogIO;
        export const Modal=({children})=>children;
        export const FileUploader=()=>null;
        export const Bot=()=>null, Loader2=()=>null;
      ` }));
    } }],
  });
  globalThis.__healthLogIO = io;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, mod, mod.exports);
  delete globalThis.__healthLogIO;
  // React 19 deprecates this renderer; retain all other console errors.
  const originalError = console.error;
  const errors = [];
  console.error = (...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    errors.push(args);
  };
  let renderer;
  t.after(async () => {
    try { if (renderer) await act(async () => renderer.unmount()); }
    finally { console.error = originalError; }
    assert.ok(errors.every(args => args[0] === 'Failed to save health log'), 'unexpected React or component error');
  });
  await act(async () => {
    renderer = create(React.createElement(mod.exports.HealthLogModal, {
      firestore, userId: 'user', plantId: 'plant', onClose: () => closes++,
    }));
  });
  const button = label => renderer.root.findAllByType('button').find(node => node.children.includes(label));
  const message = () => JSON.stringify(renderer.toJSON());
  const prepare = async (analyze = false) => {
    await act(async () => renderer.root.find(node => node.props.onFileSelected).props.onFileSelected({}));
    await act(async () => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Brown leaf' } }));
    if (analyze) await act(async () => button(' Analyze with AI').props.onClick());
  };
  const save = async () => {
    let promise;
    await act(async () => { promise = button('Save to log').props.onClick(); });
    return { promise };
  };
  return { renderer, writes, pending, timestamp, button, message, prepare, save, closes: () => closes };
}

test('successful save writes the draft and closes only after persistence', async t => {
  const app = await mount(t);
  assert.equal(app.button('Save to log').props.disabled, true);
  await app.prepare();
  const { promise } = await app.save();
  assert.equal(app.closes(), 0);
  assert.equal(app.button('Cancel').props.disabled, true);
  assert.equal(app.renderer.root.findAllByType('button').at(-1).props.disabled, true);
  assert.deepEqual(app.writes, [{ location: '/artifacts/test-app/users/user/plants/plant/healthLogs', data: {
    userNotes: 'Brown leaf', imageBase64: image, aiAnalysis: null, createdAt: app.timestamp,
  } }]);
  await act(async () => { app.pending[0].resolve({ id: 'saved' }); await promise; });
  assert.equal(app.closes(), 1);
  assert.equal(app.button('Save to log').props.disabled, false);
});

test('failed save preserves photo, notes and analysis; retry clears error and succeeds', async t => {
  const app = await mount(t);
  await app.prepare(true);
  const first = await app.save();
  await act(async () => { app.pending[0].reject(new Error('Offline')); await first.promise; });
  assert.equal(app.closes(), 0);
  assert.match(app.message(), /Offline|Unable to save this log/);
  assert.equal(app.renderer.root.findByType('textarea').props.value, 'Brown leaf');
  assert.equal(app.renderer.root.find(node => node.props.onFileSelected).props.previewSrc, image);
  assert.match(app.message(), /Healthy/);
  assert.equal(app.button('Save to log').props.disabled, false);
  assert.equal(app.button('Cancel').props.disabled, false);
  const retry = await app.save();
  assert.doesNotMatch(app.message(), /Offline|Unable to save this log/);
  assert.equal(app.closes(), 0);
  assert.deepEqual(app.writes[1], app.writes[0]);
  assert.deepEqual(app.writes[1].data.aiAnalysis, analysis);
  await act(async () => { app.pending[1].resolve({ id: 'saved' }); await retry.promise; });
  assert.equal(app.closes(), 1);
});

test('save failure without an error message displays the fallback', async t => {
  const app = await mount(t);
  await app.prepare();
  const { promise } = await app.save();
  await act(async () => { app.pending[0].reject({ code: 'unavailable' }); await promise; });
  assert.match(app.message(), /Unable to save this log\. Please try again\./);
  assert.equal(app.closes(), 0);
});
