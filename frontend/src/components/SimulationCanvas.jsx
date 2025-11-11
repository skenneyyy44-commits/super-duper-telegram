import { forwardRef } from 'react';
import './SimulationCanvas.css';

const SimulationCanvas = forwardRef(function SimulationCanvas(_, ref) {
  return (
    <section className="canvas-panel" aria-labelledby="canvas-heading">
      <div className="canvas-panel__header">
        <h2 id="canvas-heading">Seismic field</h2>
        <p>Visualises procedural waves based on the selected parameters.</p>
      </div>
      <div className="canvas-panel__surface">
        <canvas ref={ref} role="img" aria-label="Seismic wave simulation" />
      </div>
    </section>
  );
});

export default SimulationCanvas;
