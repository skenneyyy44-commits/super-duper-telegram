import folium
import requests
import webbrowser
import os
from datetime import datetime, timezone

USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson"

def fetch_earthquake_data():
    """Fetch earthquake data from the USGS GeoJSON feed."""
    try:
        response = requests.get(USGS_URL)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching earthquake data: {e}")
        return None

def get_marker_color(magnitude):
    """Return a color based on the earthquake magnitude."""
    if magnitude < 3.0:
        return 'green'
    elif magnitude < 5.0:
        return 'orange'
    else:
        return 'red'

def plot_quakes():
    """Create an interactive earthquake map using Folium."""
    data = fetch_earthquake_data()
    if not data:
        return "<h1>Error: Could not fetch earthquake data</h1>"

    # Create a map centered at a neutral location
    m = folium.Map(location=[0, 0], zoom_start=2)

    # Add markers for each earthquake
    for feature in data.get('features', []):
        properties = feature.get('properties')
        geometry = feature.get('geometry')

        if not all([properties, geometry]):
            continue

        coords = geometry.get('coordinates')
        mag = properties.get('mag')
        place = properties.get('place')
        time_ms = properties.get('time')

        if not all([coords, mag, place, time_ms]):
            continue

        # GeoJSON coordinates are [longitude, latitude, depth]
        lon, lat, depth = coords

        # Format the time for the popup
        time_str = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')

        # Create a popup with detailed information
        popup_html = f"""
        <b>Magnitude:</b> {mag}<br>
        <b>Location:</b> {place}<br>
        <b>Time:</b> {time_str}<br>
        <b>Depth:</b> {depth} km
        """
        popup = folium.Popup(popup_html, max_width=300)

        # Add a circle marker to the map
        folium.CircleMarker(
            location=[lat, lon],
            radius=mag * 2,  # Scale radius with magnitude
            popup=popup,
            color=get_marker_color(mag),
            fill=True,
            fill_color=get_marker_color(mag),
            fill_opacity=0.7
        ).add_to(m)

    # Return the map as an HTML string
    return m._repr_html_()

def main():
    """Generate the map and save it to an HTML file for local viewing."""
    html_map = plot_quakes()

    # Save to an HTML file
    file_path = "earthquake_map.html"
    with open(file_path, "w") as f:
        f.write(html_map)

    # Open in a web browser
    webbrowser.open('file://' + os.path.realpath(file_path))

if __name__ == "__main__":
    main()
