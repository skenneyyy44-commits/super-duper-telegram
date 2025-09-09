import os
from flask import Flask, jsonify
from earthquake_map import plot_quakes


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

    @app.route('/')
    def map_view():
        """Display the earthquake map."""
        return plot_quakes()

    @app.teardown_appcontext
    def cleanup(exception=None):
        if data_manager.started:
            data_manager.stop()

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(host=os.getenv('HOST', '0.0.0.0'), port=int(os.getenv('PORT', '5000')))
