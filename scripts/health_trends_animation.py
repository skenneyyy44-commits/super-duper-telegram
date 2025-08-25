#!/usr/bin/env python3
"""
Animate weight, body fat, body water, and pNN50 metrics.

Usage:
    python scripts/health_trends_animation.py [--out health_trends.gif]

When --out is provided, a GIF is saved instead of displaying the plot.
"""

import argparse
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Enables headless operation
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.animation import FuncAnimation


def build_dataframe():
    records = [
        {"date": "2025-04-30", "Weight": 140, "Body Fat": np.nan, "Body Water": 67.8, "pNN50": np.nan},
        {"date": "2025-05-17", "Weight": 142.2, "Body Fat": 8.6, "Body Water": 66.7, "pNN50": np.nan},
        {"date": "2025-05-26", "Weight": np.nan, "Body Fat": 9.1, "Body Water": 66.4, "pNN50": np.nan},
        {"date": "2025-07-24", "Weight": 140.4, "Body Fat": 9.6, "Body Water": 65.9, "pNN50": np.nan},
        {"date": "2025-08-19", "Weight": np.nan, "Body Fat": np.nan, "Body Water": np.nan, "pNN50": 6},
        {"date": "2025-08-25", "Weight": 140.6, "Body Fat": 10.5, "Body Water": 65.3, "pNN50": 1},
    ]
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").drop_duplicates(subset="date", keep="last").set_index("date")
    return df


def animate(df, out_path=None):
    fig, axes = plt.subplots(4, 1, figsize=(10, 10), sharex=True)
    metrics = [
        ("Weight", "Weight (lbs)"),
        ("Body Fat", "Body Fat (%)"),
        ("Body Water", "Body Water (%)"),
        ("pNN50", "pNN50 (%)"),
    ]

    lines = []
    for ax, (col, ylabel) in zip(axes, metrics):
        (line,) = ax.plot([], [], marker="o")
        ax.set_ylabel(ylabel)
        ax.grid(True)
        lines.append(line)

    locator = mdates.AutoDateLocator()
    axes[-1].xaxis.set_major_locator(locator)
    axes[-1].xaxis.set_major_formatter(mdates.ConciseDateFormatter(locator))
    fig.suptitle("Stephen's Health Trends: Animated")
    fig.tight_layout()

    def init():
        for ln in lines:
            ln.set_data([], [])
        return lines

    def update(frame):
        idx = frame + 1
        x = df.index[:idx]
        for ln, (col, _) in zip(lines, metrics):
            y = df[col].iloc[:idx]
            mask = ~y.isna()
            ln.set_data(x[mask], y[mask])
        return lines

    ani = FuncAnimation(fig, update, frames=len(df), init_func=init, interval=800, blit=False, repeat=False)

    if out_path:
        ani.save(out_path, writer="pillow", fps=1)
    else:
        plt.show()


def main():
    parser = argparse.ArgumentParser(description="Animate health metrics over time")
    parser.add_argument("--out", help="Path to save GIF instead of displaying")
    args = parser.parse_args()

    df = build_dataframe()
    animate(df, out_path=args.out)


if __name__ == "__main__":
    main()
