import assert from 'node:assert/strict';
import test from 'node:test';
import { createEarthquakeSimulation } from '../frontend/src/simulation/engine.js';

function mockCanvas(clientWidth, clientHeight) {
  const arcs = [];
  const canvas = {
    clientWidth,
    clientHeight,
    width: 0,
    height: 0,
    getContext() {
      return {
        setTransform() {},
        fillRect() {},
        beginPath() {},
        fill() {},
        stroke() {},
        setLineDash() {},
        arc(x, y, radius) {
          arcs.push({ x, y, radius });
        },
        createRadialGradient() {
          return { addColorStop() {} };
        },
      };
    },
  };
  return { canvas, arcs };
}

test('high-DPR canvases keep epicentres inside CSS pixels', () => {
  const random = Math.random;
  Math.random = () => 0;
  const listeners = [];
  const previousWindow = globalThis.window;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
  globalThis.window = {
    devicePixelRatio: 2,
    addEventListener(_type, fn) { listeners.push(fn); },
    removeEventListener() {},
  };
  globalThis.requestAnimationFrame = () => 1;
  const { canvas, arcs } = mockCanvas(600, 420);
  let stop;
  try {
    stop = createEarthquakeSimulation(canvas, {
      magnitude: 6,
      speed: 1,
      damping: 0.3,
      faults: 1,
    });
    assert.equal(canvas.width, 1200);
    assert.equal(canvas.height, 840);
    assert.ok(arcs.length > 0);
    for (const point of arcs) {
      assert.ok(point.x >= 0 && point.x <= 600, `x ${point.x} left the CSS canvas`);
      assert.ok(point.y >= 0 && point.y <= 420, `y ${point.y} left the CSS canvas`);
    }
    assert.equal(arcs[0].x, 363);
    assert.equal(arcs[0].y, 210);
  } finally {
    stop?.();
    Math.random = random;
    globalThis.window = previousWindow;
    globalThis.requestAnimationFrame = previousRaf;
    globalThis.cancelAnimationFrame = previousCancel;
  }
});
