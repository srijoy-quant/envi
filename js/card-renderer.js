/**
 * EnviroSense AR — Card Renderer
 * Creates, positions, updates, and animates all 8 AR data cards.
 * Works in both DOM-overlay (2D) mode and optional 3D world-space mode.
 */

class CardRenderer {
  constructor(container, config) {
    this.container  = container;   // DOM element to append cards into
    this.config     = config;
    this.cards      = {};           // { key: domElement }
    this.visible    = {};           // { key: boolean }
    this.leaderSvg  = null;
    this._updating  = false;

    // Card layout positions (% of viewport width/height)
    this.positions = {
      air:   { left: '4%',   top: '20%' },
      wx:    { right: '4%',  top: '20%' },
      nasa:  { left: '4%',   top: '46%' },
      veg:   { right: '4%',  top: '46%' },
      water: { left: '29%',  top: '22%' },
      eco:   { right: '28%', top: '22%' },
      geo:   { left: '4%',   top: '70%' },
      bio:   { right: '4%',  top: '70%' },
    };

    // Theme per card
    this.themes = {
      air:   { color: '#00E5A0', borderAlpha: '0.5', label: 'Air Quality',   source: 'OpenAQ'   },
      wx:    { color: '#4FC3F7', borderAlpha: '0.5', label: 'Weather',       source: 'OWM'      },
      nasa:  { color: '#FF9A3C', borderAlpha: '0.5', label: 'Land Surface',  source: 'NASA'     },
      veg:   { color: '#7BDB71', borderAlpha: '0.5', label: 'Vegetation',    source: 'GEE'      },
      water: { color: '#29B6F6', borderAlpha: '0.5', label: 'Water Quality', source: 'USGS'     },
      eco:   { color: '#B39DFF', borderAlpha: '0.5', label: 'Ecosystem',     source: 'UNEP'     },
      geo:   { color: '#A5D6A7', borderAlpha: '0.5', label: 'Location',      source: 'OSM'      },
      bio:   { color: '#FF6B6B', borderAlpha: '0.5', label: 'Biodiversity',  source: 'GBIF'     },
    };
  }

  // ── INIT ─────────────────────────────────────────────────
  init() {
    // Leader line SVG layer
    this.leaderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.leaderSvg.setAttribute('id', 'leader-svg');
    this.leaderSvg.style.cssText = 'position:absolute;inset:0;pointer-events:none;width:100%;height:100%;';
    this.container.appendChild(this.leaderSvg);

    // Create all cards
    Object.keys(this.themes).forEach(key => this._createCard(key));

    // Draw leader lines after layout
    setTimeout(() => this._drawLeaders(), 400);
    window.addEventListener('resize', () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => this._drawLeaders(), 200);
    });
  }

  // ── CREATE CARD DOM ───────────────────────────────────────
  _createCard(key) {
    const t   = this.themes[key];
    const pos = this.positions[key];

    const card = document.createElement('div');
    card.id    = `card-${key}`;
    card.className = `ar-card card-${key}`;
    card.style.cssText = this._positionCss(pos) + `
      position: absolute;
      background: rgba(5,10,14,0.88);
      border: 1px solid ${t.color}80;
      border-radius: 8px;
      padding: 10px 13px;
      min-width: 140px;
      pointer-events: all;
      cursor: pointer;
      transition: transform 0.3s, opacity 0.4s, box-shadow 0.3s;
      backdrop-filter: blur(6px);
      animation: card-appear 0.5s ease both;
      animation-delay: ${Object.keys(this.themes).indexOf(key) * 0.1}s;
    `;

    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-family:'Space Mono',monospace;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${t.color}">${t.label}</span>
        <span style="font-size:8px;opacity:0.4;font-family:'Space Mono',monospace;color:${t.color}">${t.source}</span>
      </div>
      <div id="cv-${key}-main" style="font-family:'Space Mono',monospace;font-size:22px;font-weight:700;color:${t.color};line-height:1">—</div>
      <div id="cv-${key}-sub"  style="font-size:10px;margin-top:3px;color:rgba(255,255,255,0.5)">Loading…</div>
      <div style="height:3px;border-radius:2px;margin-top:7px;overflow:hidden;background:rgba(255,255,255,0.08)">
        <div id="cv-${key}-bar" style="height:100%;border-radius:2px;background:${t.color};width:0%;transition:width 1s ease"></div>
      </div>
    `;

    // Hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'scale(1.05) translateY(-3px)';
      card.style.boxShadow = `0 0 20px ${t.color}40`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
    });

    card.addEventListener('click', () => {
      if (this.onCardClick) this.onCardClick(key);
    });

    this.container.appendChild(card);
    this.cards[key]   = card;
    this.visible[key] = true;
    return card;
  }

  _positionCss(pos) {
    return Object.entries(pos).map(([k,v]) => `${k}:${v}`).join(';') + ';';
  }

  // ── UPDATE CARD WITH DATA ─────────────────────────────────
  updateAll(cache) {
    if (this._updating) return;
    this._updating = true;
    try {
      if (cache.air)         this._updateAir(cache.air);
      if (cache.weather)     this._updateWeather(cache.weather);
      if (cache.nasa)        this._updateNASA(cache.nasa);
      if (cache.vegetation)  this._updateVegetation(cache.vegetation);
      if (cache.water)       this._updateWater(cache.water);
      if (cache.ecosystem)   this._updateEcosystem(cache.ecosystem);
      if (cache.location)    this._updateLocation(cache.location);
      if (cache.biodiversity)this._updateBiodiversity(cache.biodiversity);
    } finally {
      this._updating = false;
    }
  }

  _set(key, main, sub, barPct) {
    const mEl = document.getElementById(`cv-${key}-main`);
    const sEl = document.getElementById(`cv-${key}-sub`);
    const bEl = document.getElementById(`cv-${key}-bar`);
    if (mEl) mEl.innerHTML = main;
    if (sEl) sEl.innerHTML = sub;
    if (bEl) bEl.style.width = Math.min(100, Math.max(0, barPct)) + '%';
  }

  _updateAir(d) {
    const statusColor = d.status?.color || '#FFB830';
    this._set('air',
      `${d.aqi}<span style="font-size:11px;opacity:0.6;margin-left:3px">AQI</span>`,
      `<span style="color:${statusColor}">${d.status?.label || 'Moderate'}</span> · PM2.5: ${d.pm25} µg`,
      (d.aqi / 300) * 100
    );
  }

  _updateWeather(d) {
    this._set('wx',
      `${d.temp}<span style="font-size:11px;opacity:0.6;margin-left:3px">°C</span>`,
      `Humidity: ${d.humidity}% · Wind: ${d.windSpeed}m/s ${d.windDir}`,
      (d.temp / 50) * 100
    );
  }

  _updateNASA(d) {
    this._set('nasa',
      `${d.lst}<span style="font-size:11px;opacity:0.6;margin-left:3px">°C</span>`,
      `LST · Albedo: ${d.albedo} · ${d.source?.split(' ')[0] || 'MODIS'}`,
      (d.lst / 60) * 100
    );
  }

  _updateVegetation(d) {
    this._set('veg',
      `${d.ndvi}<span style="font-size:11px;opacity:0.6;margin-left:3px">NDVI</span>`,
      `Green cover: ${d.greenCover}% · EVI: ${d.evi}`,
      d.ndvi * 100
    );
  }

  _updateWater(d) {
    const phColor = (d.ph >= 6.5 && d.ph <= 8.5) ? '#00E5A0' : '#FF6B6B';
    this._set('water',
      `<span style="color:${phColor}">${d.ph}</span><span style="font-size:11px;opacity:0.6;margin-left:3px">pH</span>`,
      `DO: ${d.dissolvedO2} mg/L · Turbidity: ${d.turbidity} NTU`,
      (d.ph / 14) * 100
    );
  }

  _updateEcosystem(d) {
    const vulnColor = d.climateVuln === 'High' ? '#FF6B6B' : d.climateVuln === 'Medium' ? '#FFB830' : '#00E5A0';
    this._set('eco',
      `${d.healthScore}<span style="font-size:11px;opacity:0.6;margin-left:3px">%</span>`,
      `Climate vuln: <span style="color:${vulnColor}">${d.climateVuln}</span> · CO₂: ${d.co2ppm} ppm`,
      d.healthScore
    );
  }

  _updateLocation(d) {
    const lat  = typeof d.lat === 'number' ? d.lat.toFixed(4) : d.lat;
    const lng  = typeof d.lng === 'number' ? d.lng.toFixed(4) : d.lng;
    this._set('geo',
      `<span style="font-size:12px">${lat}°N<br>${lng}°E</span>`,
      `${d.city || ''}, ${d.state || ''}`,
      100
    );
  }

  _updateBiodiversity(d) {
    this._set('bio',
      `${d.totalSpecies}<span style="font-size:11px;opacity:0.6;margin-left:3px">spp</span>`,
      `<span style="color:#FF6B6B">${d.endangered} endangered</span> · ${d.avian || d.aves} bird spp`,
      (d.totalSpecies / 500) * 100
    );
  }

  // ── LEADER LINES ─────────────────────────────────────────
  _drawLeaders() {
    if (!this.leaderSvg) return;
    this.leaderSvg.innerHTML = '';
    const W = window.innerWidth, H = window.innerHeight;
    const cx = W * 0.5, cy = H * 0.52;

    Object.keys(this.cards).forEach(key => {
      if (!this.visible[key]) return;
      const el = this.cards[key];
      const r  = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top  + r.height / 2;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', ex); line.setAttribute('y1', ey);
      line.setAttribute('x2', cx); line.setAttribute('y2', cy);
      line.setAttribute('stroke', this.themes[key]?.color || '#00E5A0');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '4 4');
      line.setAttribute('opacity', '0.12');
      this.leaderSvg.appendChild(line);
    });
  }

  // ── VISIBILITY ────────────────────────────────────────────
  show(key) {
    const card = this.cards[key];
    if (!card) return;
    card.style.opacity = '1';
    card.style.pointerEvents = 'all';
    card.style.transform = '';
    this.visible[key] = true;
    this._drawLeaders();
  }

  hide(key) {
    const card = this.cards[key];
    if (!card) return;
    card.style.opacity = '0';
    card.style.pointerEvents = 'none';
    card.style.transform = 'scale(0.9)';
    this.visible[key] = false;
    this._drawLeaders();
  }

  toggle(key) {
    this.visible[key] ? this.hide(key) : this.show(key);
  }

  // ── PULSE ANIMATION (on data update) ─────────────────────
  pulse(key) {
    const card = this.cards[key];
    if (!card) return;
    const color = this.themes[key]?.color || '#00E5A0';
    card.style.boxShadow = `0 0 16px ${color}60`;
    setTimeout(() => { card.style.boxShadow = ''; }, 600);
  }
}

if (typeof module !== 'undefined') module.exports = CardRenderer;
