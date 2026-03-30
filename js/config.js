/**
 * EnviroSense AR — Configuration
 * Replace placeholder values with your actual API keys.
 * NEVER commit real API keys to public repositories.
 */

const CONFIG = {

  // ── API KEYS ──────────────────────────────────────────────
  keys: {
    openweather: 'YOUR_OPENWEATHER_API_KEY',   // https://openweathermap.org/api
    nasa:        'YOUR_NASA_API_KEY',           // https://api.nasa.gov (DEMO_KEY works for testing)
    openaq:      '',                            // Optional — public endpoints work without key
    gbif:        '',                            // No key required
    usgs:        '',                            // No key required
    osm:         '',                            // No key required
    unep:        '',                            // No key required
    gee:         'YOUR_GEE_API_KEY',           // https://earthengine.google.com
  },

  // ── DEFAULT LOCATION (fallback if GPS unavailable) ────────
  defaultLocation: {
    lat: 20.2961,
    lng: 85.8245,
    name: 'Bhubaneswar, Odisha, India',
    timezone: 'Asia/Kolkata'
  },

  // ── API ENDPOINTS ─────────────────────────────────────────
  endpoints: {
    openaq:      'https://api.openaq.org/v3/locations',
    openaqMeas:  'https://api.openaq.org/v3/measurements',
    openweather: 'https://api.openweathermap.org/data/2.5/weather',
    openweatherF:'https://api.openweathermap.org/data/2.5/forecast',
    nasaModis:   'https://modis.ornl.gov/rst/api/v1/MOD11A1/subset',
    nasaFirms:   'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
    usgsWater:   'https://waterservices.usgs.gov/nwis/iv/',
    usgsGround:  'https://waterservices.usgs.gov/nwis/gwlevels/',
    gbif:        'https://api.gbif.org/v1/occurrence/search',
    gbifSpecies: 'https://api.gbif.org/v1/species/search',
    osmNominatim:'https://nominatim.openstreetmap.org/reverse',
    osmOverpass: 'https://overpass-api.de/api/interpreter',
    unepWesr:    'https://wesr.unep.org/api/v1',
    geeRest:     'https://earthengine.googleapis.com/v1alpha',
  },

  // ── REFRESH INTERVALS (milliseconds) ──────────────────────
  refresh: {
    air:    60000,    // OpenAQ     — 1 minute
    wx:     300000,   // OWM        — 5 minutes
    nasa:   3600000,  // NASA       — 1 hour  (satellite pass)
    veg:    3600000,  // GEE        — 1 hour
    water:  900000,   // USGS       — 15 minutes
    eco:    3600000,  // UNEP       — 1 hour
    geo:    0,        // OSM        — static (on load only)
    bio:    3600000,  // GBIF       — 1 hour
  },

  // ── AR SETTINGS ────────────────────────────────────────────
  ar: {
    hitTestEnabled: true,
    domOverlayEnabled: true,
    lightEstimationEnabled: true,
    depthSensingEnabled: false,    // Enable if device supports
    cardFloatRadius: 2.5,          // Metres from viewer
    cardScale: 0.4,                // World-space scale
    sessionMode: 'immersive-ar',
    requiredFeatures: ['hit-test', 'dom-overlay'],
    optionalFeatures: ['light-estimation', 'anchors'],
  },

  // ── THRESHOLDS (for colour-coding & alerts) ───────────────
  thresholds: {
    aqi: {
      good:      { max: 50,  color: '#00E5A0', label: 'Good' },
      moderate:  { max: 100, color: '#FFB830', label: 'Moderate' },
      sensitive: { max: 150, color: '#FF9A3C', label: 'Unhealthy (Sensitive)' },
      unhealthy: { max: 200, color: '#FF6B6B', label: 'Unhealthy' },
      very:      { max: 300, color: '#B39DFF', label: 'Very Unhealthy' },
      hazardous: { max: 500, color: '#FF6B6B', label: 'Hazardous' },
    },
    ph: {
      safe:    { min: 6.5, max: 8.5, color: '#00E5A0' },
      caution: { min: 6.0, max: 9.0, color: '#FFB830' },
    },
    ndvi: {
      bare:   { max: 0.1,  label: 'Bare soil',    color: '#FF6B6B' },
      sparse: { max: 0.3,  label: 'Sparse',       color: '#FFB830' },
      moderate:{ max: 0.6, label: 'Moderate',     color: '#7BDB71' },
      dense:  { max: 1.0,  label: 'Dense veg',    color: '#00E5A0' },
    },
  },

  // ── SIMULATION DATA (used when real APIs are unavailable) ──
  simulation: {
    enabled: true,   // Set false to force live API calls
    jitter:  true,   // Add random fluctuation to sim data
  },

};

// Freeze config to prevent accidental mutation
Object.freeze(CONFIG);
if (typeof module !== 'undefined') module.exports = CONFIG;
