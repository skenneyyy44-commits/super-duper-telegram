"""Plot recent earthquakes in Japan using Cartopy."""
import matplotlib.pyplot as plt
import cartopy.crs as ccrs
import cartopy.feature as cfeature

# Expanded dataset with coordinates (approximate lat/lon from USGS/JMA data)
quake_data = [
    {"region": "Southern Ibaraki (Kanto)", "magnitude": 4.3, "lat": 36.0, "lon": 140.3, "depth": 50, "intensity": 4},
    {"region": "Off Aomori (Tohoku)", "magnitude": 3.3, "lat": 40.9, "lon": 142.0, "depth": 20, "intensity": 1},
    {"region": "Amami-Ōshima (Ryukyu)", "magnitude": 3.1, "lat": 28.4, "lon": 129.6, "depth": 10, "intensity": 1},
    {"region": "Tokara Islands (Ryukyu)", "magnitude": 2.6, "lat": 29.3, "lon": 129.5, "depth": 10, "intensity": 1},
    {"region": "Izu Islands (SE Honshu)", "magnitude": 4.5, "lat": 33.1, "lon": 139.5, "depth": 40, "intensity": 2},
]

def plot_quakes():
    """Create a bubble map of recent earthquakes in Japan."""
    fig = plt.figure(figsize=(10, 12))
    ax = plt.axes(projection=ccrs.PlateCarree())
    ax.set_extent([127, 146, 24, 46], crs=ccrs.PlateCarree())

    # Add features
    ax.add_feature(cfeature.LAND, facecolor='lightgray')
    ax.add_feature(cfeature.COASTLINE)
    ax.add_feature(cfeature.BORDERS, linestyle=':')
    ax.add_feature(cfeature.OCEAN, facecolor='lightblue')
    ax.gridlines(draw_labels=True)

    # Plot quakes
    for quake in quake_data:
        ax.scatter(
            quake["lon"],
            quake["lat"],
            s=quake["magnitude"] * 60,
            color='red',
            alpha=0.6,
            edgecolor='black',
            transform=ccrs.PlateCarree(),
        )
        ax.text(
            quake["lon"] + 0.2,
            quake["lat"] + 0.2,
            f"M{quake['magnitude']} ({quake['region']})",
            fontsize=8,
            transform=ccrs.PlateCarree(),
        )

    plt.title(
        "Recent Earthquakes in Japan (last 24h)\n"
        "Bubble size = Magnitude, Labels = Region",
        fontsize=14,
    )
    plt.show()

if __name__ == "__main__":
    plot_quakes()
