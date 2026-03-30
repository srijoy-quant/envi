/**
 * EnviroSense AR — UI Controller
 * Manages all 2D HUD elements: top/bottom bars, detail panel,
 * layer toggles, alerts, compass, clock, and status indicators.
 */

class UIController {
  constructor(config) {
    this.config    = config;
    this.data      = {};
    this._clockInt = null;
    this._alertQ   = [];
  }

  // ── INIT ─────────────────────────────────────────────────
  init() {
    this._startClock();
    this._bindLayerToggles();
    this._bindDetailPanel();
  }

  // ── CLOCK ─────────────────────────────────────────────────
  _startClock() {
    const tick = () => {
      const el = document.getElementById('hud-time');
      if (!el) return;
      const now = new Date();
      const t = now.toLocaleTimeString('en-IN', {
        timeZone: this.config.defaultLocation.timezone,
        hour12: false
      });
      el.textContent = t + ' IST';
    };
    tick();
    this._clockInt = setInterval(tick, 1000);
  }

  // ── DATA UPDATE ───────────────────────────────────────────
  updateData(cache) {
    this.data = cache;
    this._updateStatusBar(cache);
    this._checkAlerts(cache);
  }

  _updateStatusBar(cache) {
    // Update coord display
    const coordEl = document.getElementById('hud-coords');
    if (coordEl && cache.location) {
      const { lat, lng, city, state } = cache.location;
      coordEl.textContent = `${Number(lat).toFixed(4)}°N ${Number(lng).toFixed(4)}°E · ${city || ''}, ${state || ''}`;
    }
  }

  // ── DETAIL PANEL ──────────────────────────────────────────
  _bindDetailPanel() {
    const closeBtn = document.getElementById('dp-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeDetail());

    // Close on outside click
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('detail-panel');
      if (!panel || !panel.classList.contains('open')) return;
      if (!panel.contains(e.target) && !e.target.closest('.ar-card')) {
        this.closeDetail();
      }
    });
  }

  showDetail(key, data) {
    const panel   = document.getElementById('detail-panel');
    const title   = document.getElementById('dp-title');
    const content = document.getElementById('dp-content');
    if (!panel || !title || !content) return;

    const themes = {
      air:   { label: 'Air Quality · OpenAQ',         color: '#00E5A0' },
      wx:    { label: 'Weather · OpenWeatherMap',      color: '#4FC3F7' },
      nasa:  { label: 'Land Surface · NASA Earthdata', color: '#FF9A3C' },
      veg:   { label: 'Vegetation · Google Earth Engine', color: '#7BDB71' },
      water: { label: 'Water Quality · USGS',          color: '#29B6F6' },
      eco:   { label: 'Ecosystem Stress · UNEP WESR',  color: '#B39DFF' },
      geo:   { label: 'Location · OpenStreetMap',      color: '#A5D6A7' },
      bio:   { label: 'Biodiversity · GBIF',           color: '#FF6B6B' },
    };

    const theme = themes[key] || { label: key, color: '#00E5A0' };
    title.textContent  = theme.label;
    title.style.color  = theme.color;

    const fieldLabels = {
      // Air
      aqi: 'AQI Index', pm25: 'PM2.5 (µg/m³)', pm10: 'PM10 (µg/m³)',
      no2: 'NO₂ (ppb)', o3: 'O₃ (ppb)', co: 'CO (ppm)', so2: 'SO₂ (ppb)',
      // Weather
      temp: 'Temperature (°C)', feelsLike: 'Feels Like (°C)', humidity: 'Humidity (%)',
      pressure: 'Pressure (hPa)', windSpeed: 'Wind Speed (m/s)', windDir: 'Wind Direction',
      visibility: 'Visibility (km)', cloudCover: 'Cloud Cover (%)', uvIndex: 'UV Index',
      dewPoint: 'Dew Point (°C)', description: 'Condition',
      // NASA
      lst: 'Land Surface Temp (°C)', albedo: 'Surface Albedo',
      emissivity: 'Emissivity', droughtIndex: 'Drought Index', fireRisk: 'Fire Risk',
      // Vegetation
      ndvi: 'NDVI Score', greenCover: 'Green Cover (%)', deforestation: 'Deforestation (%)',
      soilMoisture: 'Soil Moisture (%)', cropHealth: 'Crop Health',
      forestArea: 'Forest Area', evi: 'EVI', lai: 'Leaf Area Index',
      // Water
      ph: 'pH Level', dissolvedO2: 'Dissolved O₂ (mg/L)', turbidity: 'Turbidity (NTU)',
      flowRate: 'Flow Rate (m³/s)', conductivity: 'Conductivity (µS/cm)',
      nitrates: 'Nitrates (mg/L)', temperature: 'Water Temp (°C)',
      // Ecosystem
      healthScore: 'Ecosystem Health (%)', climateVuln: 'Climate Vulnerability',
      climateVulnScore: 'Vulnerability Score', carbonIntensity: 'Carbon Intensity (tCO₂/cap)',
      biodivRisk: 'Biodiversity Risk', habitatLoss: 'Habitat Loss (%)',
      co2ppm: 'Atmospheric CO₂ (ppm)', wetlandHealth: 'Wetland Health',
      // Location
      lat: 'Latitude', lng: 'Longitude', city: 'City',
      district: 'District', state: 'State', country: 'Country',
      elevation: 'Elevation', landUse: 'Land Use', timezone: 'Timezone',
      // Biodiversity
      totalSpecies: 'Total Species', flora: 'Flora Species', avian: 'Avian Species',
      mammals: 'Mammal Species', reptiles: 'Reptile Species', aquatic: 'Aquatic Species',
      insects: 'Insect Species', endangered: 'Endangered Species',
      migratory: 'Migratory Species', invasive: 'Invasive Species',
    };

    const skip = ['status','source','simulated','timestamp','displayName','osmType','osmId','boundingBox','postcode','tss'];

    let rows = '';
    Object.entries(data || {}).forEach(([k, v]) => {
      if (skip.includes(k) || v === null || v === undefined) return;
      const label = fieldLabels[k] || k.replace(/([A-Z])/g, ' $1').trim();
      const valStr = typeof v === 'object' ? (v.label || JSON.stringify(v)) : String(v);
      rows += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.05)">
          <span style="font-size:10px;color:rgba(255,255,255,0.4);font-family:'DM Sans',sans-serif">${label}</span>
          <span style="font-size:11px;font-weight:500;font-family:'Space Mono',monospace;color:${theme.color}">${valStr}</span>
        </div>`;
    });

    // Trend sparkline if available
    const trendData = this._getTrend(key);
    let sparkline = '';
    if (trendData) {
      const { values, labels } = trendData;
      const max = Math.max(...values), min = Math.min(...values);
      const range = max - min || 1;
      const bars = values.map((v, i) => {
        const h = Math.round(((v - min) / range) * 24 + 6);
        const isLast = i === values.length - 1;
        return `<div style="flex:1;height:${h}px;background:${theme.color};opacity:${isLast ? 1 : 0.35};border-radius:2px 2px 0 0;transition:height 0.5s"></div>`;
      }).join('');
      sparkline = `
        <div style="margin-top:12px">
          <div style="font-size:9px;color:rgba(255,255,255,0.3);font-family:'Space Mono',monospace;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.08em">7-period trend</div>
          <div style="display:flex;align-items:flex-end;gap:3px;height:32px">${bars}</div>
          <div style="display:flex;justify-content:space-between;font-size:8px;color:rgba(255,255,255,0.25);font-family:'Space Mono',monospace;margin-top:2px">
            <span>${labels[0]}</span><span>${labels[Math.floor(labels.length/2)]}</span><span>Now</span>
          </div>
        </div>`;
    }

    // Simulated badge
    const simBadge = (data || {}).simulated
      ? `<div style="margin-top:10px;padding:4px 8px;background:rgba(255,184,48,0.1);border:0.5px solid rgba(255,184,48,0.3);border-radius:4px;font-size:9px;color:#FFB830;font-family:'Space Mono',monospace">SIMULATION MODE — add API keys to config.js</div>`
      : '';

    content.innerHTML = rows + sparkline + simBadge;
    panel.classList.add('open');
  }

  closeDetail() {
    const panel = document.getElementById('detail-panel');
    if (panel) panel.classList.remove('open');
  }

  _getTrend(key) {
    const trends = {
      air:   { values: [65,70,74,72,78,80,78], labels: ['06h','09h','12h','15h','18h','21h','Now'] },
      wx:    { values: [30,31,33,34,35,34,34], labels: ['06h','09h','12h','15h','18h','21h','Now'] },
      nasa:  { values: [35,36,37,38,38,38,38], labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Now'] },
      veg:   { values: [0.58,0.59,0.60,0.61,0.61,0.62,0.62], labels: ['Jan','Feb','Mar','Apr','May','Jun','Now'] },
      water: { values: [7.0,7.1,7.1,7.2,7.2,7.2,7.2], labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Now'] },
      eco:   { values: [64,63,63,62,62,62,62], labels: ['Jan','Feb','Mar','Apr','May','Jun','Now'] },
      bio:   { values: [330,334,336,338,340,341,342], labels: ['Jan','Feb','Mar','Apr','May','Jun','Now'] },
    };
    return trends[key] || null;
  }

  // ── LAYER TOGGLES ─────────────────────────────────────────
  _bindLayerToggles() {
    document.querySelectorAll('.layer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.dataset.layer;
        const isOn  = btn.classList.contains('on');
        btn.classList.toggle('on',  !isOn);
        btn.classList.toggle('off',  isOn);
        if (this.onLayerToggle) this.onLayerToggle(layer, !isOn);
      });
    });
  }

  // ── ALERTS ────────────────────────────────────────────────
  _checkAlerts(cache) {
    const alerts = [];
    if (cache.air?.aqi > 100)
      alerts.push({ level: 'warn', msg: `Air quality unhealthy: AQI ${cache.air.aqi}` });
    if (cache.ecosystem?.climateVuln === 'High')
      alerts.push({ level: 'critical', msg: 'Climate vulnerability HIGH in this zone' });
    if (cache.water?.ph && (cache.water.ph < 6.5 || cache.water.ph > 8.5))
      alerts.push({ level: 'warn', msg: `Water pH out of safe range: ${cache.water.ph}` });
    if (cache.biodiversity?.endangered > 0)
      alerts.push({ level: 'info', msg: `${cache.biodiversity.endangered} endangered species in this area` });

    this._alertQ = alerts;
    this._showTopAlert(alerts[0]);
  }

  _showTopAlert(alert) {
    const el = document.getElementById('alert-badge');
    if (!el) return;
    if (!alert) { el.style.display = 'none'; return; }
    const colors = { critical: '#FF6B6B', warn: '#FFB830', info: '#4FC3F7' };
    el.style.display = 'block';
    el.style.borderColor = `${colors[alert.level]}80`;
    el.style.background  = `${colors[alert.level]}18`;
    el.style.color = colors[alert.level];
    el.querySelector('.alert-title').textContent = alert.level === 'critical' ? '⚠ CRITICAL' : alert.level === 'warn' ? '⚠ ALERT' : 'ℹ INFO';
    el.querySelector('.alert-msg').textContent = alert.msg;
  }

  // ── STATUS INDICATOR ──────────────────────────────────────
  setStatus(text, color = '#00E5A0') {
    const el = document.querySelector('.live-indicator span');
    if (el) { el.textContent = text; el.style.color = color; }
  }

  // ── XR BUTTON STATE ───────────────────────────────────────
  setXRButtonState(state) {
    const btn = document.getElementById('xr-btn');
    if (!btn) return;
    const states = {
      ready:      { text: 'ACTIVATE DEVICE AR (WebXR)', color: '#00E5A0', border: '#00E5A0' },
      active:     { text: 'AR SESSION ACTIVE ●',         color: '#00E5A0', border: '#00E5A0' },
      unsupported:{ text: 'AR UNAVAILABLE — SIMULATION', color: '#FFB830', border: '#FFB830' },
      error:      { text: 'XR ERROR — CHECK CONSOLE',    color: '#FF6B6B', border: '#FF6B6B' },
    };
    const s = states[state] || states.ready;
    btn.textContent     = s.text;
    btn.style.color     = s.color;
    btn.style.borderColor = s.border;
  }

  destroy() {
    clearInterval(this._clockInt);
  }
}

if (typeof module !== 'undefined') module.exports = UIController;
