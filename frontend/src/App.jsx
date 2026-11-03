import { useEffect, useMemo, useRef, useState } from 'react';
import Hero from './components/Hero.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import Legend from './components/Legend.jsx';
import SimulationCanvas from './components/SimulationCanvas.jsx';
import { createEarthquakeSimulation } from './simulation/engine.js';
import './App.css';

const DEFAULT_SETTINGS = {
  magnitude: 6.2,
  speed: 1.1,
  damping: 0.35,
  faults: 4
};

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const stop = createEarthquakeSimulation(canvas, settings);
    return () => {
      stop?.();
    };
  }, [settings]);

  const controls = useMemo(
    () => [
      {
        id: 'magnitude',
        label: 'Magnitude',
        min: 2,
        max: 9,
        step: 0.1,
        description: 'Controls the amplitude of the primary waves.',
        value: settings.magnitude
      },
      {
        id: 'speed',
        label: 'Propagation Speed',
        min: 0.3,
        max: 3,
        step: 0.1,
        description: 'Sets how quickly seismic fronts travel outward.',
        value: settings.speed
      },
      {
        id: 'damping',
        label: 'Damping',
        min: 0.1,
        max: 0.9,
        step: 0.05,
        description: 'Higher damping reduces resonance and dissipates energy sooner.',
        value: settings.damping
      },
      {
        id: 'faults',
        label: 'Active Faults',
        min: 1,
        max: 8,
        step: 1,
        description: 'Number of concurrent epicentres driving the simulation.',
        value: settings.faults
      }
    ],
    [settings]
  );

  const handleControlChange = (id, value) => {
    setSettings((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="app-shell">
      <Hero />
      <main className="layout">
        <section className="controls">
          <ControlPanel controls={controls} onChange={handleControlChange} />
          <Legend magnitude={settings.magnitude} damping={settings.damping} faults={settings.faults} />
        </section>
        <SimulationCanvas ref={canvasRef} />
      </main>
    </div>
  );
}
