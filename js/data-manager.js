/**
 * EnviroSense AR — Data Manager
 * Handles all 8 database integrations with fallback simulation.
 */

class DataManager {
  constructor(config) {
    this.config = config;
    this.cache = {};
    this.listeners = {};
    this.location = { ...config.defaultLocation };
    this._intervals = {};
  }

  // ── INIT ─────────────────────────────────────────────────
  async init(lat, lng) {
    if (lat && lng) {
      this.location.lat = lat;
      this.location.lng = lng;
    }
    console.log('[DataManager] Initialising all feeds…');
    const results = await Promise.allSettled([
      this.fetchAir(),
      this.fetchWeather(),
      this.fetchNASA(),
      this.fetchVegetation(),
      this.fetchWater(),
      this.fetchEcosystem(),
      this.fetchLocation(),
      this.fetchBiodiversity(),
    ]);
    results.forEach((r, i) => {
      const names = ['air','weather','nasa','vegetation','water','ecosystem','location','biodiversity'];
      if (r.status === 'rejected') {
        console.warn(`[DataManager] ${names[i]} fetch failed — using simulation`, r.reason);
      }
    });
    this._startRefreshTimers();
    return this.cache;
  }

  // ── EVENTS ───────────────────────────────────────────────
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }
  _emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ── REFRESH TIMERS ────────────────────────────────────────
  _startRefreshTimers() {
    const map = {
      air:         () => this.fetchAir(),
      wx:          () => this.fetchWeather(),
      nasa:        () => this.fetchNASA(),
      veg:         () => this.fetchVegetation(),
      water:       () => this.fetchWater(),
      eco:         () => this.fetchEcosystem(),
      bio:         () => this.fetchBiodiversity(),
    };
    Object.entries(map).forEach(([key, fn]) => {
      const interval = this.config.refresh[key];
      if (interval > 0) {
        this._intervals[key] = setInterval(async () => {
          await fn();
          this._emit('update', { key, data: this.cache[key] });
        }, interval);
      }
    });
  }

  destroy() {
    Object.values(this._intervals).forEach(clearInterval);
  }

  // ── HELPER ────────────────────────────────────────────────
  _jitter(val, pct = 0.03) {
    if (!this.config.simulation.jitter) return val;
    return +(val * (1 + (Math.random() - 0.5) * pct)).toFixed(2);
  }

  async _fetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 1. OpenAQ — Air Quality
  // ─────────────────────────────────────────────────────────
  async fetchAir() {
    const { lat, lng } = this.location;
    const useSimulation = this.config.simulation.enabled;

    if (!useSimulation) {
      try {
        const url = `${this.config.endpoints.openaq}?coordinates=${lat},${lng}&radius=25000&limit=1`;
        const headers = this.config.keys.openaq
          ? { 'X-API-Key': this.config.keys.openaq }
          : {};
        const raw = await this._fetch(url, { headers });
        const loc = raw.results?.[0];
        if (loc) {
          const measUrl = `${this.config.endpoints.openaqMeas}?locationId=${loc.id}&limit=10&parameter=pm25,pm10,no2,o3,co`;
          const measRaw = await this._fetch(measUrl, { headers });
          const params = {};
          (measRaw.results || []).forEach(r => {
            params[r.parameter] = r.value;
          });
          const pm25 = params['pm25'] || 0;
          const aqi = this._pm25ToAqi(pm25);
          this.cache.air = {
            aqi, pm25,
            pm10: params['pm10'] || 0,
            no2:  params['no2']  || 0,
            o3:   params['o3']   || 0,
            co:   params['co']   || 0,
            status: this._aqiStatus(aqi),
            location: loc.name,
            timestamp: new Date().toISOString(),
          };
          return this.cache.air;
        }
      } catch (e) {
        console.warn('[OpenAQ] Falling back to simulation:', e.message);
      }
    }

    // Simulation fallback
    const aqi = this._jitter(78, 0.08);
    this.cache.air = {
      aqi: Math.round(aqi),
      pm25: this._jitter(18.4),
      pm10: this._jitter(32.1),
      no2:  this._jitter(24.7),
      o3:   this._jitter(62.3),
      co:   this._jitter(0.8, 0.05),
      so2:  this._jitter(4.2),
      status: this._aqiStatus(aqi),
      location: this.location.name,
      timestamp: new Date().toISOString(),
      simulated: true,
    };
    return this.cache.air;
  }

  _pm25ToAqi(pm25) {
    // EPA standard breakpoints
    const bp = [
      [0,12,0,50],[12.1,35.4,51,100],[35.5,55.4,101,150],
      [55.5,150.4,151,200],[150.5,250.4,201,300],[250.5,500.4,301,500]
    ];
    for (const [cl, ch, al, ah] of bp) {
      if (pm25 <= ch) return Math.round(((ah-al)/(ch-cl))*(pm25-cl)+al);
    }
    return 500;
  }

  _aqiStatus(aqi) {
    if (aqi <= 50)  return { label: 'Good',           color: '#00E5A0' };
    if (aqi <= 100) return { label: 'Moderate',       color: '#FFB830' };
    if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: '#FF9A3C' };
    if (aqi <= 200) return { label: 'Unhealthy',      color: '#FF6B6B' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: '#B39DFF' };
    return                 { label: 'Hazardous',      color: '#FF4444' };
  }

  // ─────────────────────────────────────────────────────────
  // 2. OpenWeatherMap — Weather & Climate
  // ─────────────────────────────────────────────────────────
  async fetchWeather() {
    const { lat, lng } = this.location;
    const key = this.config.keys.openweather;

    if (!this.config.simulation.enabled && key && key !== 'YOUR_OPENWEATHER_API_KEY') {
      try {
        const url = `${this.config.endpoints.openweather}?lat=${lat}&lon=${lng}&appid=${key}&units=metric`;
        const raw = await this._fetch(url);
        this.cache.weather = {
          temp:        Math.round(raw.main.temp),
          feelsLike:   Math.round(raw.main.feels_like),
          humidity:    raw.main.humidity,
          pressure:    raw.main.pressure,
          windSpeed:   raw.wind.speed,
          windDir:     this._windDir(raw.wind.deg),
          visibility:  (raw.visibility / 1000).toFixed(1),
          cloudCover:  raw.clouds.all,
          description: raw.weather[0].description,
          uvIndex:     null, // requires separate UV endpoint
          dewPoint:    this._dewPoint(raw.main.temp, raw.main.humidity),
          timestamp:   new Date().toISOString(),
        };
        return this.cache.weather;
      } catch (e) {
        console.warn('[OWM] Falling back to simulation:', e.message);
      }
    }

    this.cache.weather = {
      temp:        Math.round(this._jitter(34, 0.02)),
      feelsLike:   Math.round(this._jitter(38, 0.02)),
      humidity:    Math.round(this._jitter(72, 0.04)),
      pressure:    Math.round(this._jitter(1008, 0.005)),
      windSpeed:   +this._jitter(3.3, 0.1).toFixed(1),
      windDir:     'NE',
      visibility:  +this._jitter(8.4, 0.05).toFixed(1),
      cloudCover:  45,
      description: 'Partly cloudy',
      uvIndex:     8,
      dewPoint:    27,
      timestamp:   new Date().toISOString(),
      simulated:   true,
    };
    return this.cache.weather;
  }

  _windDir(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  _dewPoint(temp, hum) {
    return Math.round(temp - ((100 - hum) / 5));
  }

  // ─────────────────────────────────────────────────────────
  // 3. NASA Earthdata — Land Surface Temperature & Satellite
  // ─────────────────────────────────────────────────────────
  async fetchNASA() {
    const { lat, lng } = this.location;

    if (!this.config.simulation.enabled) {
      try {
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '-');
        const url = `${this.config.endpoints.nasaModis}?latitude=${lat}&longitude=${lng}&startDate=${today}&endDate=${today}&kmAboveBelow=0&kmLeftRight=0`;
        const headers = this.config.keys.nasa !== 'YOUR_NASA_API_KEY'
          ? { 'Authorization': `Bearer ${this.config.keys.nasa}` } : {};
        const raw = await this._fetch(url, { headers });
        const lst = raw.subset?.[0]?.data?.[0];
        this.cache.nasa = {
          lst:         lst ? (lst * 0.02 - 273.15).toFixed(1) : null,
          albedo:      0.18,
          emissivity:  0.97,
          source:      'MODIS Terra/Aqua',
          timestamp:   new Date().toISOString(),
        };
        return this.cache.nasa;
      } catch (e) {
        console.warn('[NASA] Falling back to simulation:', e.message);
      }
    }

    this.cache.nasa = {
      lst:          +this._jitter(38.4, 0.03).toFixed(1),
      albedo:       +this._jitter(0.18, 0.05).toFixed(3),
      emissivity:   0.97,
      droughtIndex: +this._jitter(0.32, 0.05).toFixed(2),
      fireRisk:     'Low',
      snowCover:    '0%',
      source:       'MODIS Terra/Aqua (simulated)',
      timestamp:    new Date().toISOString(),
      simulated:    true,
    };
    return this.cache.nasa;
  }

  // ─────────────────────────────────────────────────────────
  // 4. Google Earth Engine — NDVI, Vegetation, Land Use
  // ─────────────────────────────────────────────────────────
  async fetchVegetation() {
    // GEE REST API requires OAuth2 — simulation used here as default
    // For production: set up a service account and sign requests
    this.cache.vegetation = {
      ndvi:         +this._jitter(0.62, 0.04).toFixed(3),
      greenCover:   Math.round(this._jitter(62, 0.03)),
      deforestation: +this._jitter(8, 0.05).toFixed(1),
      soilMoisture: Math.round(this._jitter(55, 0.04)),
      cropHealth:   'Good',
      forestArea:   '14,200 ha',
      landUseChange: '-0.3% YoY',
      evi:          +this._jitter(0.51, 0.04).toFixed(3),  // Enhanced Vegetation Index
      lai:          +this._jitter(2.8, 0.05).toFixed(2),  // Leaf Area Index
      source:       'Google Earth Engine / Sentinel-2',
      timestamp:    new Date().toISOString(),
      simulated:    true,
    };
    return this.cache.vegetation;
  }

  // ─────────────────────────────────────────────────────────
  // 5. USGS Water Services — Water Quality & Flow
  // ─────────────────────────────────────────────────────────
  async fetchWater() {
    const { lat, lng } = this.location;

    if (!this.config.simulation.enabled) {
      try {
        // Find nearest USGS site
        const siteUrl = `${this.config.endpoints.usgsWater}?format=json&bBox=${lng-0.5},${lat-0.5},${lng+0.5},${lat+0.5}&parameterCd=00060,00300,00400,63680&siteStatus=active&siteType=ST`;
        const raw = await this._fetch(siteUrl);
        const sites = raw.value?.timeSeries;
        if (sites && sites.length > 0) {
          const params = {};
          sites.forEach(s => {
            const code = s.variable.variableCode[0].value;
            const val  = parseFloat(s.values[0]?.value[0]?.value);
            params[code] = isNaN(val) ? null : val;
          });
          this.cache.water = {
            flowRate:     params['00060'],  // Discharge (cfs)
            dissolvedO2:  params['00300'],  // DO (mg/L)
            ph:           params['00400'],  // pH
            turbidity:    params['63680'],  // Turbidity (FNU)
            conductivity: null,
            nitrates:     null,
            timestamp:    new Date().toISOString(),
          };
          return this.cache.water;
        }
      } catch (e) {
        console.warn('[USGS] Falling back to simulation:', e.message);
      }
    }

    this.cache.water = {
      ph:           +this._jitter(7.2, 0.02).toFixed(2),
      dissolvedO2:  +this._jitter(6.8, 0.03).toFixed(1),
      turbidity:    +this._jitter(4.2, 0.05).toFixed(1),
      flowRate:     Math.round(this._jitter(142, 0.05)),
      conductivity: Math.round(this._jitter(340, 0.04)),
      nitrates:     +this._jitter(2.1, 0.05).toFixed(2),
      temperature:  +this._jitter(26.4, 0.02).toFixed(1),
      tss:          +this._jitter(18.3, 0.06).toFixed(1),
      source:       'USGS Water Services (simulated)',
      timestamp:    new Date().toISOString(),
      simulated:    true,
    };
    return this.cache.water;
  }

  // ─────────────────────────────────────────────────────────
  // 6. UNEP WESR — Ecosystem Stress
  // ─────────────────────────────────────────────────────────
  async fetchEcosystem() {
    // UNEP WESR API — free, no key required
    if (!this.config.simulation.enabled) {
      try {
        const url = `${this.config.endpoints.unepWesr}/indicators?lat=${this.location.lat}&lng=${this.location.lng}`;
        const raw = await this._fetch(url);
        if (raw && raw.data) {
          this.cache.ecosystem = { ...raw.data, timestamp: new Date().toISOString() };
          return this.cache.ecosystem;
        }
      } catch (e) {
        console.warn('[UNEP] Falling back to simulation:', e.message);
      }
    }

    this.cache.ecosystem = {
      healthScore:       Math.round(this._jitter(62, 0.03)),
      climateVuln:       'High',
      climateVulnScore:  Math.round(this._jitter(68, 0.03)),
      carbonIntensity:   +this._jitter(2.4, 0.04).toFixed(2),
      biodivRisk:        'Medium',
      habitatLoss:       +this._jitter(3.2, 0.04).toFixed(1),
      wetlandHealth:     'Moderate',
      desertification:   'Low',
      co2ppm:            +this._jitter(421.4, 0.001).toFixed(1),
      source:            'UNEP WESR (simulated)',
      timestamp:         new Date().toISOString(),
      simulated:         true,
    };
    return this.cache.ecosystem;
  }

  // ─────────────────────────────────────────────────────────
  // 7. OpenStreetMap — Geospatial / Location
  // ─────────────────────────────────────────────────────────
  async fetchLocation() {
    const { lat, lng } = this.location;

    try {
      const url = `${this.config.endpoints.osmNominatim}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const raw = await this._fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'EnviroSenseAR/1.0' }
      });
      const addr = raw.address || {};
      this.cache.location = {
        lat, lng,
        displayName:  raw.display_name,
        city:         addr.city || addr.town || addr.village || 'Unknown',
        district:     addr.county || addr.district || '',
        state:        addr.state || '',
        country:      addr.country || '',
        postcode:     addr.postcode || '',
        osmType:      raw.type,
        osmId:        raw.osm_id,
        boundingBox:  raw.boundingbox,
        timestamp:    new Date().toISOString(),
      };
    } catch (e) {
      console.warn('[OSM] Falling back to defaults:', e.message);
      this.cache.location = {
        lat, lng,
        displayName: this.location.name,
        city:        'Bhubaneswar',
        district:    'Khorda',
        state:       'Odisha',
        country:     'India',
        elevation:   '45 m',
        landUse:     'Urban + Peri-urban',
        timezone:    'IST (UTC+5:30)',
        timestamp:   new Date().toISOString(),
        simulated:   true,
      };
    }
    return this.cache.location;
  }

  // ─────────────────────────────────────────────────────────
  // 8. GBIF — Biodiversity
  // ─────────────────────────────────────────────────────────
  async fetchBiodiversity() {
    const { lat, lng } = this.location;

    if (!this.config.simulation.enabled) {
      try {
        const radius = 0.5; // degrees (~50km)
        const url = `${this.config.endpoints.gbif}?decimalLatitude=${lat-radius},${lat+radius}&decimalLongitude=${lng-radius},${lng+radius}&limit=0&facet=kingdom&facetMincount=1`;
        const raw = await this._fetch(url);
        const total = raw.count || 0;
        const kingdoms = {};
        (raw.facets?.[0]?.counts || []).forEach(f => {
          kingdoms[f.name] = f.count;
        });
        this.cache.biodiversity = {
          totalSpecies: total,
          plantae:      kingdoms['Plantae']   || 0,
          animalia:     kingdoms['Animalia']  || 0,
          fungi:        kingdoms['Fungi']     || 0,
          aves:         null,
          endangered:   null,
          source:       'GBIF',
          timestamp:    new Date().toISOString(),
        };
        return this.cache.biodiversity;
      } catch (e) {
        console.warn('[GBIF] Falling back to simulation:', e.message);
      }
    }

    this.cache.biodiversity = {
      totalSpecies: Math.round(this._jitter(342, 0.02)),
      flora:        Math.round(this._jitter(156, 0.02)),
      avian:        Math.round(this._jitter(87, 0.02)),
      mammals:      Math.round(this._jitter(48, 0.02)),
      reptiles:     Math.round(this._jitter(32, 0.02)),
      aquatic:      Math.round(this._jitter(58, 0.02)),
      insects:      Math.round(this._jitter(210, 0.02)),
      endangered:   5,
      migratory:    Math.round(this._jitter(23, 0.03)),
      invasive:     3,
      source:       'GBIF (simulated)',
      timestamp:    new Date().toISOString(),
      simulated:    true,
    };
    return this.cache.biodiversity;
  }

  // ── UTILITY: Get all data snapshot ───────────────────────
  getSnapshot() {
    return { ...this.cache, fetchedAt: new Date().toISOString() };
  }

  // ── UTILITY: Get location from device GPS ─────────────────
  getDeviceLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }
}

if (typeof module !== 'undefined') module.exports = DataManager;
