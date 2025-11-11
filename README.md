# Super Duper Telegram

This repository contains a small Flask service that serves a React-based visualisation of
seismic wave propagation. The frontend is bundled with Vite and the production assets are
published to the `static/` directory that Flask exposes.

## Development

```bash
# Install dependencies and build the React bundle
cd frontend
npm install
npm run dev   # Start the Vite dev server
npm run build # Output production assets into ../static
```

During development, run the Flask app with `python app.py` and configure the frontend dev
server to proxy API calls if needed.

## Testing

The Python unit tests can be executed via:

```bash
pytest
```
