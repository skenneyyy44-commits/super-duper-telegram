import os
import subprocess
import sys
import unittest
from unittest.mock import patch

import matplotlib
matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt

from scripts import health_trends_animation as trends


class AnimationTests(unittest.TestCase):
    def test_all_values_fit_plot_limits(self):
        df = trends.build_dataframe()
        with patch.object(plt, "show"):
            trends.animate(df)
        axes = plt.gcf().axes
        for ax, column in zip(axes, df.columns):
            dates = mdates.date2num(df.index.to_pydatetime())
            self.assertLessEqual(ax.get_xlim()[0], min(dates))
            self.assertGreaterEqual(ax.get_xlim()[1], max(dates))
            values = df[column].dropna()
            self.assertLessEqual(ax.get_ylim()[0], values.min())
            self.assertGreaterEqual(ax.get_ylim()[1], values.max())
        plt.close("all")

    def test_import_respects_selected_backend(self):
        env = dict(os.environ, MPLBACKEND="svg")
        result = subprocess.run([sys.executable, "-c", "import scripts.health_trends_animation; import matplotlib; print(matplotlib.get_backend())"], env=env, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout.strip().lower(), "svg")


if __name__ == "__main__":
    unittest.main()
