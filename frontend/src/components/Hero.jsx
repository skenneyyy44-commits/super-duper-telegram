import './Hero.css';

export default function Hero() {
  return (
    <header className="hero">
      <div className="hero__content">
        <p className="hero__eyebrow">Realtime visualisation</p>
        <h1 className="hero__title">Japan Seismic Wave Lab</h1>
        <p className="hero__copy">
          Explore how seismic activity radiates through the archipelago. Adjust magnitude,
          propagation speed, damping and fault clusters to understand how different conditions
          influence the behaviour of primary and secondary waves.
        </p>
      </div>
    </header>
  );
}
