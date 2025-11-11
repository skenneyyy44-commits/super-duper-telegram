const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const magnitudeInput = document.getElementById('magnitude');
const waveSpeedInput = document.getElementById('waveSpeed');
const dampingInput = document.getElementById('damping');
const faultInput = document.getElementById('faultCount');
const valueLabels = document.querySelectorAll('.value');
const triggerButton = document.getElementById('trigger');
const aftershockButton = document.getElementById('aftershock');
const resetButton = document.getElementById('reset');
const buildings = Array.from(document.querySelectorAll('.building'));
const pgaLabel = document.getElementById('pga');
const energyLabel = document.getElementById('energy');
const ruptureLabel = document.getElementById('rupture');

const GRID_WIDTH = 200;
const GRID_HEIGHT = 120;
const SCALE_X = canvas.width / GRID_WIDTH;
const SCALE_Y = canvas.height / GRID_HEIGHT;
const DT = 0.016;
const DX = 1;

class RNG {
  constructor(seed = 1337) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
  nextRange(min, max) {
    return min + (max - min) * this.next();
  }
}

class SpectralNoise {
  constructor(seed = 42) {
    this.rng = new RNG(seed);
    this.gradients = new Map();
  }

  gradient(ix, iy) {
    const key = `${ix},${iy}`;
    if (!this.gradients.has(key)) {
      const angle = this.rng.nextRange(0, Math.PI * 2);
      this.gradients.set(key, [Math.cos(angle), Math.sin(angle)]);
    }
    return this.gradients.get(key);
  }

  dot(ix, iy, x, y) {
    const g = this.gradient(ix, iy);
    const dx = x - ix;
    const dy = y - iy;
    return g[0] * dx + g[1] * dy;
  }

  fade(t) {
    return ((6 * t - 15) * t + 10) * t * t * t;
  }

  perlin(x, y) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;

    const sx = this.fade(x - x0);
    const sy = this.fade(y - y0);

    const n0 = this.dot(x0, y0, x, y);
    const n1 = this.dot(x1, y0, x, y);
    const ix0 = n0 + sx * (n1 - n0);

    const n2 = this.dot(x0, y1, x, y);
    const n3 = this.dot(x1, y1, x, y);
    const ix1 = n2 + sx * (n3 - n2);

    return ix0 + sy * (ix1 - ix0);
  }

  fbm(x, y, octaves = 5) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 0.9;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.perlin(x * frequency, y * frequency);
      frequency *= 2;
      amplitude *= 0.55;
    }
    return value;
  }
}

class FaultSystem {
  constructor(count, width, height, rng) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.setFaults(count);
  }

  setFaults(count) {
    this.faults = Array.from({ length: count }, () => ({
      cx: this.rng.nextRange(0.2, 0.8) * this.width,
      cy: this.rng.nextRange(0.2, 0.8) * this.height,
      angle: this.rng.nextRange(0, Math.PI),
      strength: this.rng.nextRange(0.6, 1.3),
    }));
  }

  energyBoost(x, y) {
    let value = 0;
    for (const fault of this.faults) {
      const dx = x - fault.cx;
      const dy = y - fault.cy;
      const dist = Math.abs(Math.cos(fault.angle) * dx + Math.sin(fault.angle) * dy);
      value += fault.strength * Math.exp(-dist * 0.02);
    }
    return value;
  }
}

class WaveSimulation {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.uPrev = new Float32Array(this.size);
    this.uCurrent = new Float32Array(this.size);
    this.uNext = new Float32Array(this.size);
    this.velocity = new Float32Array(this.size);
    this.terrain = new Float32Array(this.size);
    this.boundaryMask = new Float32Array(this.size);
    this.rng = new RNG(9001);
    this.noise = new SpectralNoise(12345);
    this.faultSystem = new FaultSystem(3, width, height, this.rng);
    this.time = 0;
    this.lastRupture = null;
    this.resetTerrain();
  }

  index(x, y) {
    return y * this.width + x;
  }

  resetTerrain() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = this.index(x, y);
        const nx = x / this.width;
        const ny = y / this.height;
        const height = this.noise.fbm(nx * 6, ny * 6) * 0.4;
        const ridge = Math.exp(-20 * Math.pow(nx - 0.5, 2));
        this.terrain[idx] = height + ridge * 0.2;
        const edge = Math.min(nx, ny, 1 - nx, 1 - ny);
        this.boundaryMask[idx] = Math.pow(edge, 0.3);
        this.uPrev[idx] = this.uCurrent[idx] = this.uNext[idx] = 0;
        this.velocity[idx] = 0;
      }
    }
    this.time = 0;
    this.lastRupture = null;
  }

  setFaultCount(count) {
    this.faultSystem.setFaults(count);
  }

  disturb(x, y, magnitude) {
    const radius = Math.max(8, magnitude * 1.2);
    for (let j = -radius; j <= radius; j++) {
      for (let i = -radius; i <= radius; i++) {
        const px = Math.floor(x + i);
        const py = Math.floor(y + j);
        if (px <= 1 || py <= 1 || px >= this.width - 1 || py >= this.height - 1) {
          continue;
        }
        const idx = this.index(px, py);
        const dist = Math.sqrt(i * i + j * j);
        if (dist > radius) continue;
        const falloff = Math.cos((dist / radius) * Math.PI) * 0.5 + 0.5;
        const energy = magnitude * falloff * (1 + this.faultSystem.energyBoost(px, py));
        this.uCurrent[idx] += energy;
      }
    }
    this.lastRupture = this.time;
  }

  step({ waveSpeed, damping }) {
    const c2 = waveSpeed * waveSpeed;
    const dampingFactor = 1 - damping;

    let peak = 0;
    let energy = 0;

    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        const idx = this.index(x, y);
        const laplacian =
          this.uCurrent[idx - 1] +
          this.uCurrent[idx + 1] +
          this.uCurrent[idx - this.width] +
          this.uCurrent[idx + this.width] -
          4 * this.uCurrent[idx];

        const terrainStiffness = 1 + this.terrain[idx] * 0.6;
        const boundary = Math.max(this.boundaryMask[idx], 0.2);

        const acceleration = (c2 * DT * DT * laplacian * terrainStiffness) / (DX * DX);
        const nextValue =
          dampingFactor * (2 * this.uCurrent[idx] - this.uPrev[idx]) + acceleration * boundary;

        this.uNext[idx] = nextValue;
        this.velocity[idx] = (nextValue - this.uPrev[idx]) / (2 * DT);

        const absVal = Math.abs(nextValue);
        if (absVal > peak) peak = absVal;
        energy += 0.5 * nextValue * nextValue;
      }
    }

    const temp = this.uPrev;
    this.uPrev = this.uCurrent;
    this.uCurrent = this.uNext;
    this.uNext = temp;

    this.time += DT;

    return {
      peak,
      energy: energy * 1e-3,
    };
  }
}

const sim = new WaveSimulation(GRID_WIDTH, GRID_HEIGHT);

function updateValueLabels() {
  valueLabels.forEach((span) => {
    const input = document.getElementById(span.dataset.for);
    let value = input.value;
    if (input === waveSpeedInput) {
      value = `${value} m/s`;
    }
    if (input === dampingInput) {
      value = Number(value).toFixed(3);
    }
    span.textContent = value;
  });
}

updateValueLabels();
valueLabels.forEach((span) => {
  const input = document.getElementById(span.dataset.for);
  input.addEventListener('input', updateValueLabels);
});

canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * GRID_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * GRID_HEIGHT;
  const magnitude = Number(magnitudeInput.value);
  sim.disturb(x, y, magnitude * 0.8);
});

triggerButton.addEventListener('click', () => {
  const magnitude = Number(magnitudeInput.value);
  const epicenter = {
    x: sim.rng.nextRange(0.2, 0.8) * GRID_WIDTH,
    y: sim.rng.nextRange(0.2, 0.8) * GRID_HEIGHT,
  };
  sim.disturb(epicenter.x, epicenter.y, magnitude);
});

aftershockButton.addEventListener('click', () => {
  const magnitude = Number(magnitudeInput.value) * 0.6;
  const epicenter = {
    x: sim.rng.nextRange(0.25, 0.75) * GRID_WIDTH,
    y: sim.rng.nextRange(0.25, 0.75) * GRID_HEIGHT,
  };
  sim.disturb(epicenter.x, epicenter.y, magnitude);
});

resetButton.addEventListener('click', () => {
  sim.resetTerrain();
  updateValueLabels();
});

faultInput.addEventListener('input', () => {
  const count = Number(faultInput.value);
  sim.setFaultCount(count);
  updateValueLabels();
});

function renderFrame() {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const waveSpeed = Number(waveSpeedInput.value);
  const damping = Number(dampingInput.value);

  const { peak, energy } = sim.step({ waveSpeed, damping });

  const colorScale = (value) => {
    const scaled = Math.max(-1, Math.min(1, value * 4));
    const heat = (scaled + 1) / 2;
    const r = Math.min(255, 255 * Math.pow(heat, 3));
    const g = 180 * Math.pow(1 - Math.abs(scaled), 2);
    const b = 255 * Math.pow(1 - heat, 2);
    return [r, g, b];
  };

  const shading = (x, y) => {
    const idx = sim.index(x, y);
    const slopeX = sim.terrain[idx + 1] - sim.terrain[idx - 1] || 0;
    const slopeY = sim.terrain[idx + sim.width] - sim.terrain[idx - sim.width] || 0;
    const intensity = 0.4 + Math.max(0, 1 - Math.sqrt(slopeX * slopeX + slopeY * slopeY) * 4);
    return intensity;
  };

  for (let y = 1; y < GRID_HEIGHT - 1; y++) {
    for (let x = 1; x < GRID_WIDTH - 1; x++) {
      const idx = sim.index(x, y);
      const value = sim.uCurrent[idx];
      const [r, g, b] = colorScale(value);
      const light = shading(x, y);
      const screenX = Math.floor(x * SCALE_X);
      const screenY = Math.floor(y * SCALE_Y);

      for (let py = 0; py < SCALE_Y; py++) {
        for (let px = 0; px < SCALE_X; px++) {
          const cx = screenX + px;
          const cy = screenY + py;
          const pixelIndex = (cy * canvas.width + cx) * 4;
          data[pixelIndex] = r * light;
          data[pixelIndex + 1] = g * light;
          data[pixelIndex + 2] = b * (0.7 + 0.3 * light);
          data[pixelIndex + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  const pga = peak * 0.05;
  const energyFlux = energy;
  pgaLabel.textContent = `${pga.toFixed(2)} g`;
  energyLabel.textContent = `${energyFlux.toFixed(2)} MJ`;
  if (sim.lastRupture !== null) {
    ruptureLabel.textContent = `${(sim.time - sim.lastRupture).toFixed(1)} s ago`;
  } else {
    ruptureLabel.textContent = '--';
  }

  const buildingResponse = Math.min(12, peak * 60);
  buildings.forEach((building, index) => {
    const heightUnits = Number(building.dataset.height);
    const baseHeight = 30 + heightUnits * 22;
    building.style.height = `${baseHeight}px`;
    const phase = sim.time * (1 + index * 0.2);
    const sway = Math.sin(phase) * buildingResponse * (0.3 + heightUnits / 10);
    building.style.transform = `translateY(${buildingResponse * -2}px) rotate(${sway}deg)`;
  });

  requestAnimationFrame(renderFrame);
}

renderFrame();
