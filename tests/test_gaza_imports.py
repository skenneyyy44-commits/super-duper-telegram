import ast
import os


ROOT = os.path.dirname(os.path.dirname(__file__))
SCRIPT = os.path.join(ROOT, "gaza_satboard_make_images.py")


def _imported_modules():
    tree = ast.parse(open(SCRIPT, encoding="utf-8").read())
    modules = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def test_gaza_script_does_not_require_unused_packages():
    modules = _imported_modules()
    assert "matplotlib_scalebar" not in modules
    assert "matplotlib_scalebar.scalebar" not in modules
    assert "rioxarray" not in modules
    assert "shapely.geometry" not in modules
    assert "shapely.ops" not in modules
    assert "pyproj" in modules
    assert "rasterio" in modules


def test_plot_title_survives_a_missing_capture_time():
    source = open(SCRIPT, encoding="utf-8").read()
    assert 'item.properties.get("datetime") or ""' in source
    assert '.get("datetime")[:10]' not in source
    assert ".get('datetime')[:10]" not in source
