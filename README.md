# EnviroSense AR — WebXR Environmental Statistics System

**Tagline:** See Local. Think Global. — Sense. Map. Act.

## Project Structure

```
envirosense-ar/
├── index.html              # Main entry point (splash + AR UI)
├── css/
│   ├── base.css            # Reset, variables, typography
│   ├── splash.css          # Splash/loading screen styles
│   ├── hud.css             # AR HUD, frames, overlays
│   └── cards.css           # Floating AR data cards
├── js/
│   ├── config.js           # API keys, endpoints, settings
│   ├── data-manager.js     # All 8 database fetch handlers
│   ├── ar-engine.js        # WebXR session, hit-test, anchors
│   ├── card-renderer.js    # AR card creation & positioning
│   ├── ui-controller.js    # HUD, panels, toggles
│   └── main.js             # App bootstrap & orchestration
├── assets/
│   └── icons.svg           # SVG icon sprite
└── README.md
```

## Database Integrations

| # | Database       | Purpose                          | API Type    |
|---|----------------|----------------------------------|-------------|
| 1 | OpenAQ         | Real-time air quality (AQI)     | REST/JSON   |
| 2 | OpenWeatherMap | Weather & climate data           | REST/JSON   |
| 3 | NASA Earthdata | Satellite, LST, NDVI             | REST/GeoJSON|
| 4 | Google Earth Engine | Vegetation, land use         | REST/JSON   |
| 5 | USGS Water Services | Water quality, flow rate    | REST/JSON   |
| 6 | UNEP WESR      | Ecosystem stress index           | REST/JSON   |
| 7 | OpenStreetMap  | Geospatial base layer            | REST/JSON   |
| 8 | GBIF           | Biodiversity, species data       | REST/JSON   |

## Setup

1. Add your API keys to `js/config.js`
2. Serve with any static server (e.g. `npx serve .`)
3. Open on an ARCore-enabled Android device in Chrome
4. For desktop: simulation mode activates automatically

## WebXR Requirements

- Android device with ARCore support
- Chrome 81+ (Android)
- HTTPS required for WebXR (use ngrok or similar for local dev)

## API Keys Needed

- `OPENWEATHER_API_KEY` — https://openweathermap.org/api
- `NASA_API_KEY`        — https://api.nasa.gov
- `OPENAQ_API_KEY`      — https://openaq.org (free, optional)
- GBIF, USGS, OSM, UNEP — all free, no key required
