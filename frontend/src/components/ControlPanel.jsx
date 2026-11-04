import PropTypes from 'prop-types';
import './ControlPanel.css';

function formatValue(value, step) {
  const digits = Number.isInteger(step) ? 0 : 1;
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

export default function ControlPanel({ controls, onChange }) {
  return (
    <section className="panel" aria-labelledby="controls-heading">
      <div className="panel__header">
        <h2 id="controls-heading">Simulation controls</h2>
        <p>Experiment with the parameters that drive the wave field.</p>
      </div>
      <div className="panel__body">
        {controls.map(({ id, label, min, max, step, description, value }) => (
          <label key={id} className="control">
            <div className="control__header">
              <span className="control__label">{label}</span>
              <span className="control__value">{formatValue(value, step)}</span>
            </div>
            <input
              type="range"
              id={id}
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(event) => onChange(id, Number(event.target.value))}
              aria-describedby={`${id}-description`}
            />
            <p className="control__description" id={`${id}-description`}>
              {description}
            </p>
          </label>
        ))}
      </div>
    </section>
  );
}

ControlPanel.propTypes = {
  controls: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      min: PropTypes.number.isRequired,
      max: PropTypes.number.isRequired,
      step: PropTypes.number.isRequired,
      description: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired
    })
  ).isRequired,
  onChange: PropTypes.func.isRequired
};
