import PropTypes from 'prop-types';
import './Legend.css';

const layers = [
  {
    key: 'pwave',
    title: 'P-waves',
    description: 'Fastest moving, lower amplitude ripples shown in teal fringes.'
  },
  {
    key: 'swave',
    title: 'S-waves',
    description: 'More destructive shear waves represented by magenta echoes.'
  },
  {
    key: 'damping',
    title: 'Damping field',
    description: 'Energy lost to terrain and structures. Higher damping fades waves sooner.'
  }
];

export default function Legend({ magnitude, damping, faults }) {
  return (
    <section className="panel legend" aria-labelledby="legend-heading">
      <div className="panel__header">
        <h2 id="legend-heading">Legend</h2>
        <p>
          Current scenario: magnitude <strong>{magnitude.toFixed(1)}</strong>, damping{' '}
          <strong>{(damping * 100).toFixed(0)}%</strong>, {faults} fault
          {faults === 1 ? '' : 's'} active.
        </p>
      </div>
      <ul className="legend__list">
        {layers.map((layer) => (
          <li key={layer.key} className={`legend__item legend__item--${layer.key}`}>
            <span className="legend__swatch" aria-hidden="true" />
            <div>
              <p className="legend__label">{layer.title}</p>
              <p className="legend__description">{layer.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

Legend.propTypes = {
  magnitude: PropTypes.number.isRequired,
  damping: PropTypes.number.isRequired,
  faults: PropTypes.number.isRequired
};
