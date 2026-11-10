"""The shared manager survives requests and stops at process shutdown."""
import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class DataManagerLifecycleTests(unittest.TestCase):
    def check_lifecycle(self, fallback):
        spec = importlib.util.spec_from_file_location("lifecycle_app", ROOT / "app.py")
        module = importlib.util.module_from_spec(spec)
        if fallback:
            with patch.dict(sys.modules, {"flask": None}):
                spec.loader.exec_module(module)
        else:
            spec.loader.exec_module(module)
        managers = []
        original = module.DataManager

        class TrackingManager(original):
            def __init__(self):
                super().__init__()
                managers.append(self)

        with patch.object(module, "DataManager", TrackingManager), patch("atexit.register") as register:
            app = module.create_app()
        manager = managers[0]
        for route in ("/healthz", "/healthz", "/missing"):
            app.test_client().get(route)
            self.assertTrue(manager.started)
        register.assert_called_once()
        callback = register.call_args.args[0]
        callback()
        self.assertFalse(manager.started)
        callback()  # Shutdown is idempotent.
        self.assertFalse(manager.started)

    def test_fallback_lifecycle(self):
        self.check_lifecycle(True)

    def test_flask_lifecycle(self):
        try:
            import flask
        except ImportError:
            self.skipTest("Flask is not installed")
        self.check_lifecycle(False)


if __name__ == "__main__":
    unittest.main()
