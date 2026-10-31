# Health Sentinel

Minimal React/Vite setup for the Health Sentinel dashboard. Provides buttons for CSV import, video OCR, and external data signals.

## Development

```bash
npm install
npm run dev
```

## Python utilities

An optional animation script visualizes weight, body composition, and pNN50 trends.

```bash
pip install pandas numpy matplotlib pillow
python scripts/health_trends_animation.py --out health_trends.gif
```

The `--out` flag saves the animation as a GIF; omit it to display the plot interactively.
