"""Regression tests for Flask and MiniFlask teardown behavior.

The teardown fix is already present on main; these tests recover the coverage
from the older conflicting PR #18 without replacing current implementation.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as main_app


def _load_miniflask(monkeypatch):
    spec = importlib.util.spec_from_file_location("fallback_teardown_regression", main_app.__file__)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    with monkeypatch.context() as isolated:
        isolated.setitem(sys.modules, "flask", None)
        spec.loader.exec_module(module)
    return module


def test_miniflask_teardown_after_success_and_404(monkeypatch):
    module = _load_miniflask(monkeypatch)
    app = module.MiniFlask(__name__)
    calls = []

    @app.route("/ok")
    def ok():
        return "OK"

    @app.teardown_appcontext
    def first(error):
        calls.append(("first", error))

    @app.teardown_appcontext
    def second(error):
        calls.append(("second", error))

    client = app.test_client()
    assert client.get("/ok").status_code == 200
    assert client.get("/missing").status_code == 404
    assert calls == [
        ("second", None),
        ("first", None),
        ("second", None),
        ("first", None),
    ]


def test_miniflask_teardown_receives_raised_exception(monkeypatch):
    module = _load_miniflask(monkeypatch)
    app = module.MiniFlask(__name__)
    errors = []

    @app.route("/boom")
    def boom():
        raise RuntimeError("teardown regression")

    @app.teardown_appcontext
    def record(error):
        errors.append(error)

    with pytest.raises(RuntimeError, match="teardown regression") as raised:
        app.test_client().get("/boom")
    assert errors == [raised.value]


def test_flask_teardown_receives_raised_exception():
    flask = pytest.importorskip("flask")
    app = flask.Flask(__name__)
    app.config.update(TESTING=True, PROPAGATE_EXCEPTIONS=True)
    errors = []

    @app.route("/boom")
    def boom():
        raise RuntimeError("flask teardown regression")

    @app.teardown_appcontext
    def record(error):
        errors.append(error)

    with pytest.raises(RuntimeError, match="flask teardown regression") as raised:
        app.test_client().get("/boom")
    assert errors == [raised.value]
