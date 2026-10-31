const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');

async function loadAi() {
  const bundled = await build({
    entryPoints: [path.join(__dirname, '../../frontend/utils/ai.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
  });
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, mod, mod.exports);
  return mod.exports.getAiHealthAnalysis;
}

function geminiResponse(analysis) {
  return {
    ok: true,
    text: async () => '',
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(analysis) }] } }],
    }),
  };
}

async function withGemini(image, run) {
  const getAiHealthAnalysis = await loadAi();
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  let request = null;
  global.window = { __gemini_api_key: 'test-key' };
  global.fetch = async (url, options) => {
    request = { url, body: JSON.parse(options.body) };
    return geminiResponse({
      plant_species: 'Fern',
      health_summary: 'Dry tips',
      potential_issues: [],
      care_recommendations: ['Mist the leaves'],
    });
  };
  try {
    const analysis = await getAiHealthAnalysis({ base64Image: image, userNotes: 'Brown edges' });
    await run({ analysis, request });
  } finally {
    global.fetch = originalFetch;
    if (originalWindow === undefined) delete global.window;
    else global.window = originalWindow;
  }
}

test('a PNG data URL is sent to Gemini as image/png, not JPEG', async () => {
  await withGemini('data:image/png;base64,iVBORw0KGgo=', ({ analysis, request }) => {
    const inline = request.body.contents[0].parts[1].inlineData;
    assert.equal(inline.mimeType, 'image/png');
    assert.equal(inline.data, 'iVBORw0KGgo=');
    assert.equal(request.body.contents[0].parts[0].text, 'Brown edges');
    assert.equal(analysis.health_summary, 'Dry tips');
    assert.match(request.url, /[?&]key=test-key/);
  });
});

test('a JPEG data URL keeps image/jpeg', async () => {
  await withGemini('data:image/jpeg;base64,/9j/4AAQ', ({ request }) => {
    const inline = request.body.contents[0].parts[1].inlineData;
    assert.equal(inline.mimeType, 'image/jpeg');
    assert.equal(inline.data, '/9j/4AAQ');
  });
});

test('other image types are forwarded unchanged', async () => {
  await withGemini('data:image/webp;base64,UklGRg==', ({ request }) => {
    const inline = request.body.contents[0].parts[1].inlineData;
    assert.equal(inline.mimeType, 'image/webp');
    assert.equal(inline.data, 'UklGRg==');
  });
});

test('a photo without a data-URL prefix still defaults to JPEG', async () => {
  await withGemini('/9j/4AAQ', ({ request }) => {
    const inline = request.body.contents[0].parts[1].inlineData;
    assert.equal(inline.mimeType, 'image/jpeg');
    assert.equal(inline.data, '/9j/4AAQ');
  });
});
