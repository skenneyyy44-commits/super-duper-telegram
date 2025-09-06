import os
from flask import Flask, jsonify, send_from_directory
from commute import generate_commute_data


class DataManager:
    """Simple data manager stub with start/stop hooks."""

    def __init__(self):
        self.started = False

    def start(self):
        self.started = True

    def stop(self):
        self.started = False


def create_app():
    """Application factory for the Telegram alert service."""
    base_dir = os.path.abspath(os.path.dirname(__file__))
    app = Flask(__name__, static_folder=os.path.join(base_dir, 'static'))

    # Database directory
    db_dir = os.path.join(base_dir, 'database')
    os.makedirs(db_dir, exist_ok=True)
    app.config['DB_DIR'] = db_dir

    data_manager = DataManager()
    data_manager.start()

    @app.route('/api/alerts/generate', methods=['POST'])
    def generate_and_send_alerts():
        # Placeholder implementation: no real alerts are generated yet.
        return jsonify({"status": "success", "alerts_generated": 0, "alerts_sent": 0}), 200

    @app.route('/healthz')
    def health():
        return jsonify({"ok": True}), 200

    @app.route('/api/commute')
    def commute_summary():
        """Provide a simulated predictive commute summary."""
        return jsonify(generate_commute_data())

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        static_folder = app.static_folder
        if not static_folder or not os.path.isdir(static_folder):
            return "Static folder not configured", 404
        requested = os.path.join(static_folder, path)
        if path and os.path.exists(requested):
            return send_from_directory(static_folder, path)
        index_path = os.path.join(static_folder, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder, 'index.html')
        return "index.html not found", 404

    @app.teardown_appcontext
    def cleanup(exception=None):
        if data_manager.started:
            data_manager.stop()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')))
