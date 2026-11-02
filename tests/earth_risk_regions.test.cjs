const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '..', 'earth_risk_sentinel.html'), 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1]).join('\n');

test('US East takes precedence in overlapping bounds without changing other belts', () => {
  const context = vm.createContext({ window: { addEventListener() {} } });
  vm.runInContext(script, context);
  const cases = [
    [32, -80, 'US East / Carolinas'],
    [30, -90, 'US East / Carolinas'],
    [35, -70, 'US East / Carolinas'],
    [40, -80, 'US East / Carolinas'],
    [29.9, -80, 'Mexico & Central America'],
    [19, -99, 'Mexico & Central America'],
    [18, -66, 'Caribbean / Puerto Rico'],
    [34, -118, 'US West / Alaska'],
    [38, 142, 'Japan & Kurils'],
    [-30, 0, 'Ring of Fire (global)'],
  ];
  for (const [lat, lon, expected] of cases) {
    assert.equal(context.classifyRegion(lat, lon), expected, `${lat}, ${lon}`);
  }

  context.features = cases.map(([lat, lon], id) => ({ id, geometry: { coordinates: [lon, lat, 10] } }));
  vm.runInContext("activeMode = 'US East / Carolinas'", context);
  assert.deepEqual(Array.from(context.getModeFilteredFeatures(context.features), (f) => f.id), [0, 1, 2, 3]);
  vm.runInContext("activeMode = 'Mexico & Central America'", context);
  assert.deepEqual(Array.from(context.getModeFilteredFeatures(context.features), (f) => f.id), [4, 5]);
  vm.runInContext("activeMode = 'GLOBAL'", context);
  assert.equal(context.getModeFilteredFeatures(context.features), context.features);
});
