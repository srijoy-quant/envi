/**
 * EnviroSense AR — Main Bootstrap
 * Wires DataManager + AREngine + CardRenderer + UIController together.
 */

(function () {
  'use strict';

  let dataManager, arEngine, cardRenderer, uiController;

  // ── SPLASH INIT SEQUENCE ───────────────────────────────────
  function runSplash() {
    const dbKeys = ['air','wx','nasa','veg','water','eco','geo','bio'];
    dbKeys.forEach((key, i) => {
      setTimeout(() => {
        const dot  = document.getElementById('d-' + key);
        const stat = document.getElementById('s-' + key);
        if (dot)  dot.classList.add('active');
        if (stat) { stat.textContent = 'Ready'; stat.style.color = '#00E5A0'; }
      }, 300 + i * 320);
    });
    setTimeout(() => {
      const btn = document.getElementById('enter-btn');
      if (btn) btn.classList.add('visible');
    }, 300 + 8 * 320 + 400);
  }

  // ── LAUNCH AR VIEW ─────────────────────────────────────────
  window.launchAR = async function () {
    // Hide splash
    const splash = document.getElementById('splash');
    if (splash) {
      splash.style.opacity = '0';
      splash.style.transition = 'opacity 0.4s';
      setTimeout(() => { splash.style.display = 'none'; }, 400);
    }

    // Show AR UI
    const arUI = document.getElementById('ar-ui');
    if (arUI) {
      arUI.style.display = 'block';
      setTimeout(() => arUI.classList.add('active'), 50);
    }

    // Build environment scene
    buildEnvScene();

    // Init modules
    uiController = new UIController(CONFIG);
    uiController.init();
    uiController.onLayerToggle = (key, visible) => {
      if (cardRenderer) {
        visible ? cardRenderer.show(key) : cardRenderer.hide(key);
      }
    };

    // Card renderer
    cardRenderer = new CardRenderer(arUI, CONFIG);
    cardRenderer.init();
    cardRenderer.onCardClick = (key) => {
      const data = dataManager?.cache[keyToCache(key)] || {};
      uiController.showDetail(key, data);
    };

    // Data manager
    dataManager = new DataManager(CONFIG);
    dataManager.on('update', ({ key, data }) => {
      cardRenderer.pulse(key);
      uiController.updateData(dataManager.cache);
    });

    // Get GPS if available, then init
    let lat = CONFIG.defaultLocation.lat;
    let lng = CONFIG.defaultLocation.lng;
    try {
      const pos = await dataManager.getDeviceLocation();
      lat = pos.lat; lng = pos.lng;
      console.log('[Main] GPS location obtained:', lat, lng);
    } catch (e) {
      console.info('[Main] GPS unavailable — using default location');
    }

    const cache = await dataManager.init(lat, lng);
    cardRenderer.updateAll(cache);
    uiController.updateData(cache);

    // AR Engine
    arEngine = new AREngine(CONFIG);

    // Start AR engine (camera/webcam)
    const canvas = document.getElementById('xr-canvas');
    await arEngine.start(canvas, arUI);

    // Add basic movement controls for webcam mode
    if (arEngine.mode === 'webcam') {
      let isDragging = false;
      let lastX = 0, lastY = 0;
      let yaw = 0, pitch = 0;

      function updateCamera() {
        if (arEngine.camera) {
          arEngine.camera.rotation.y = yaw;
          arEngine.camera.rotation.x = pitch;
        }
      }

      canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
      });
      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = (e.clientX - lastX) * 0.01;
        const dy = (e.clientY - lastY) * 0.01;
        yaw -= dx;
        pitch -= dy;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
        lastX = e.clientX;
        lastY = e.clientY;
        updateCamera();
      });
      window.addEventListener('mouseup', () => { isDragging = false; });

      // Touch controls
      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          isDragging = true;
          lastX = e.touches[0].clientX;
          lastY = e.touches[0].clientY;
        }
      });
      window.addEventListener('touchmove', (e) => {
        if (!isDragging || e.touches.length !== 1) return;
        const dx = (e.touches[0].clientX - lastX) * 0.01;
        const dy = (e.touches[0].clientY - lastY) * 0.01;
        yaw -= dx;
        pitch -= dy;
        pitch = Math.max(-Math.PI/2, Math.min(Math.PI/2, pitch));
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
        updateCamera();
      });
      window.addEventListener('touchend', () => { isDragging = false; });
    }
  };

  // ── REQUEST WebXR SESSION ──────────────────────────────────
  window.requestXR = async function () {
    uiController.setXRButtonState('active');
    const arUI = document.getElementById('ar-ui');
    try {
      const check = await AREngine.isSupported();
      if (!check.supported) {
        console.info('[Main] WebXR not supported:', check.reason);
        uiController.setXRButtonState('unsupported');
        return;
      }
      await arEngine.requestSession(arUI);
      arEngine.onHit = (matrix) => {
        // Update reticle position on hit-test
        const reticle = document.querySelector('.reticle');
        if (reticle) reticle.style.opacity = '1';
      };
      arEngine.onFrame = (time, frame, pose) => {
        // Per-frame updates could go here
      };
      uiController.setXRButtonState('active');
    } catch (e) {
      console.error('[Main] XR session failed:', e);
      uiController.setXRButtonState('error');
    }
  };

  // ── KEY MAPPING ────────────────────────────────────────────
  function keyToCache(cardKey) {
    const map = { air: 'air', wx: 'weather', nasa: 'nasa', veg: 'vegetation', water: 'water', eco: 'ecosystem', geo: 'location', bio: 'biodiversity' };
    return map[cardKey] || cardKey;
  }

  // ── SYNTHETIC ENV SCENE ────────────────────────────────────
  function buildEnvScene() {
    const scene = document.getElementById('env-scene');
    if (!scene) return;

    // Stars
    for (let i = 0; i < 60; i++) {
      const s  = document.createElement('div');
      const sz = (Math.random() * 1.5 + 0.5).toFixed(1);
      s.style.cssText = `
        position:absolute;
        width:${sz}px;height:${sz}px;
        border-radius:50%;background:#fff;
        top:${(Math.random() * 52).toFixed(1)}%;
        left:${(Math.random() * 100).toFixed(1)}%;
        animation:twinkle ${(Math.random()*3+2).toFixed(1)}s ease-in-out infinite ${(Math.random()*3).toFixed(1)}s;
        opacity:0.7;
      `;
      scene.appendChild(s);
    }

    // Tree silhouettes
    [7, 16, 25, 35, 65, 75, 85, 93].forEach(pct => {
      const t   = document.createElement('div');
      const h   = 40 + Math.random() * 30;
      const w   = h * 0.55;
      t.style.cssText = `position:absolute;bottom:44.5%;left:${pct}%`;
      t.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
        <polygon points="${w/2},2 ${w-2},${h*0.65} 2,${h*0.65}" fill="rgba(8,30,14,0.95)"/>
        <polygon points="${w/2},${h*0.3} ${w-1},${h*0.85} 1,${h*0.85}" fill="rgba(8,30,14,0.95)"/>
        <rect x="${w/2-3}" y="${h*0.85}" width="6" height="${h*0.15}" fill="rgba(8,30,14,0.95)"/>
      </svg>`;
      scene.appendChild(t);
    });

    // Distant hills
    const hills = document.createElement('div');
    hills.style.cssText = `position:absolute;bottom:44%;left:0;right:0;height:60px;`;
    hills.innerHTML = `<svg width="100%" height="60" viewBox="0 0 800 60" preserveAspectRatio="none">
      <path d="M0 60 Q100 20 200 40 Q300 55 400 30 Q500 10 600 35 Q700 55 800 25 L800 60Z" fill="rgba(5,20,10,0.9)"/>
    </svg>`;
    scene.appendChild(hills);
  }

  // ── DOM READY ──────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    runSplash();
  });

})();
