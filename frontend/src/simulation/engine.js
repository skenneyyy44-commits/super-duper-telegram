const TWO_PI = Math.PI * 2;

function createWaves(width, height, options) {
  const waves = [];
  const maxRadius = Math.hypot(width, height);

  for (let i = 0; i < options.faults; i += 1) {
    const theta = (i / options.faults) * TWO_PI + Math.random() * 0.3;
    const radius = Math.min(width, height) * (0.15 + Math.random() * 0.25);
    const cx = width / 2 + Math.cos(theta) * radius;
    const cy = height / 2 + Math.sin(theta) * radius;

    waves.push({
      cx,
      cy,
      radius: 0,
      amplitude: options.magnitude * (0.6 + Math.random() * 0.4),
      hueShift: Math.random() * 30,
      velocity: options.speed * (0.6 + Math.random() * 0.7),
      decay: options.damping * (0.015 + Math.random() * 0.03)
    });
  }

  return { waves, maxRadius };
}

export function createEarthquakeSimulation(canvas, options) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  let rafId;
  let destroyed = false;

  const state = {
    width: 0,
    height: 0,
    waves: [],
    maxRadius: 0,
    tick: 0
  };

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) {
      return;
    }
    state.width = Math.floor(clientWidth * dpr);
    state.height = Math.floor(clientHeight * dpr);
    canvas.width = state.width;
    canvas.height = state.height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const seeded = createWaves(state.width, state.height, options);
    state.waves = seeded.waves;
    state.maxRadius = seeded.maxRadius;
  }

  function step() {
    if (destroyed) return;
    rafId = requestAnimationFrame(step);
    render();
    state.tick += 1;
  }

  function render() {
    ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
    ctx.fillRect(0, 0, state.width, state.height);

    state.waves.forEach((wave, index) => {
      wave.radius += wave.velocity * 2.5;
      wave.amplitude *= 1 - wave.decay;

      if (wave.radius > state.maxRadius || wave.amplitude < 0.2) {
        const seeded = createWaves(state.width, state.height, {
          ...options,
          faults: 1
        });
        state.waves[index] = seeded.waves[0];
        return;
      }

      const gradient = ctx.createRadialGradient(
        wave.cx,
        wave.cy,
        Math.max(0, wave.radius - 20),
        wave.cx,
        wave.cy,
        wave.radius + 60
      );

      const intensity = Math.max(0.15, wave.amplitude / (options.magnitude * 1.8));
      gradient.addColorStop(
        0,
        `rgba(${40 + wave.hueShift}, ${140 + wave.hueShift}, 255, ${intensity})`
      );
      gradient.addColorStop(0.45, 'rgba(14, 165, 233, 0.25)');
      gradient.addColorStop(1, 'rgba(15, 23, 42, 0)');

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(wave.cx, wave.cy, wave.radius + 60, 0, TWO_PI);
      ctx.fill();

      const outlineAlpha = Math.min(0.5, intensity + 0.1);
      ctx.beginPath();
      ctx.strokeStyle = `rgba(236, 72, 153, ${outlineAlpha})`;
      ctx.lineWidth = Math.max(1.5, wave.amplitude * 0.4);
      ctx.setLineDash([12, 10]);
      ctx.arc(wave.cx, wave.cy, wave.radius, 0, TWO_PI);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    const overlayGradient = ctx.createRadialGradient(
      state.width / 2,
      state.height / 2,
      Math.min(state.width, state.height) * 0.05,
      state.width / 2,
      state.height / 2,
      Math.max(state.width, state.height) * 0.65
    );
    overlayGradient.addColorStop(0, 'rgba(15, 23, 42, 0)');
    overlayGradient.addColorStop(1, 'rgba(15, 23, 42, 0.35)');
    ctx.fillStyle = overlayGradient;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  resize();
  window.addEventListener('resize', resize);
  step();

  return function destroy() {
    destroyed = true;
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    window.removeEventListener('resize', resize);
  };
}
