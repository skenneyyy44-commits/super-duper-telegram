const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { create, act } = require('react-test-renderer');

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(t, log) {
  const bundled = await build({
    entryPoints: [path.join(__dirname, '../../frontend/components/plant/HealthLogEntry.jsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
    plugins: [{
      name: 'lucide',
      setup(b) {
        b.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({ path: args.path, external: true }));
        b.onResolve({ filter: /^lucide-react$/ }, (args) => ({ path: args.path, namespace: 'fixture' }));
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
          contents: `
            export const AlertTriangle = () => null;
            export const Bot = () => null;
            export const CheckCircle = () => null;
            export const ChevronDown = () => null;
            export const ChevronUp = () => null;
          `,
        }));
      },
    }],
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, mod, mod.exports);

  const originalError = console.error;
  console.error = (...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  };
  let renderer;
  t.after(async () => {
    try {
      if (renderer) await act(async () => renderer.unmount());
    } finally {
      console.error = originalError;
    }
  });
  await act(async () => {
    renderer = create(React.createElement(mod.exports.HealthLogEntry, { log }));
  });
  const expand = async () => {
    await act(async () => {
      renderer.root.findByType('button').props.onClick();
    });
  };
  return { text: () => JSON.stringify(renderer.toJSON()), expand };
}

const baseLog = {
  imageBase64: 'data:image/png;base64,AA==',
  userNotes: 'Leaves look dull',
  createdAt: { toDate: () => new Date('2024-06-01T15:00:00Z') },
};

test('expanding an analysis without issue or care lists does not crash', async (t) => {
  const app = await mount(t, {
    ...baseLog,
    aiAnalysis: { plant_species: 'Fern', health_summary: 'Dry tips' },
  });
  await app.expand();
  const text = app.text();
  assert.match(text, /Dry tips/);
  assert.match(text, /Fern/);
  assert.match(text, /No issues detected yet/);
  assert.match(text, /No recommendations available yet/);
});

test('a non-list issues value is shown as empty instead of throwing', async (t) => {
  const app = await mount(t, {
    ...baseLog,
    aiAnalysis: {
      health_summary: 'Unclear',
      potential_issues: 'mites',
      care_recommendations: null,
    },
  });
  await app.expand();
  const text = app.text();
  assert.match(text, /Unclear/);
  assert.match(text, /No issues detected yet/);
  assert.match(text, /No recommendations available yet/);
});

test('present issue and care lists are rendered', async (t) => {
  const app = await mount(t, {
    ...baseLog,
    aiAnalysis: {
      plant_species: 'Pothos',
      health_summary: 'Healthy',
      potential_issues: ['Brown spots'],
      care_recommendations: ['Water weekly'],
    },
  });
  await app.expand();
  const text = app.text();
  assert.match(text, /Brown spots/);
  assert.match(text, /Water weekly/);
  assert.doesNotMatch(text, /No issues detected yet/);
  assert.doesNotMatch(text, /No recommendations available yet/);
});

test('an entry with no analysis explains that none was captured', async (t) => {
  const app = await mount(t, { ...baseLog, aiAnalysis: null });
  await app.expand();
  assert.match(app.text(), /No AI analysis was captured for this entry/);
});
