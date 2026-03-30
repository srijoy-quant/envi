

class AREngine {
  constructor(config) {
    this.config     = config;
    this.session    = null;
    this.refSpace   = null;
    this.hitTestSrc = null;
    this.renderer   = null;
    this.scene      = null;
    this.camera     = null;

    this.cards3D    = [];
    this.anchors    = new Map();

    this.isRunning  = false;
    this._raf       = null;

    this.mode       = "none"; // "xr" or "webcam"
    this.video      = null;
    this.webcamRunning = false;

    this.onHit   = null;
    this.onFrame = null;
  }

  // ── CHECK XR SUPPORT ──────────────────────────────────────
  static async isSupported() {
    if (!navigator.xr) return { supported: false };
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      return { supported };
    } catch {
      return { supported: false };
    }
  }

  // ── INIT THREE.JS ─────────────────────────────────────────
  _initThree(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.xr.enabled = true;

    // 🔥 IMPORTANT: allows camera to show
    this.renderer.setClearColor(0x000000, 0);

    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.01,
      100
    );

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));

    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(1, 2, 3);
    this.scene.add(light);
  }

  // ── START ENGINE (AUTO CAMERA SWITCH) ─────────────────────
  async start(canvas, overlayRoot) {
    this._initThree(canvas);

    const support = await AREngine.isSupported();

    if (support.supported) {
      console.log("✅ XR Mode");
      this.mode = "xr";
      await this._startXR(overlayRoot);
    } else {
      console.log("⚠️ Webcam Mode");
      this.mode = "webcam";
      await this._startWebcam();
    }
  }

  // ── XR MODE ───────────────────────────────────────────────
  async _startXR(overlayRoot) {
    this.session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["hit-test", "local"],
      optionalFeatures: ["dom-overlay"],
      domOverlay: { root: overlayRoot || document.body }
    });

    this.session.addEventListener("end", () => this._onSessionEnd());

    this.refSpace = await this.session.requestReferenceSpace("local");

    // Hit test
    try {
      const viewerSpace = await this.session.requestReferenceSpace("viewer");
      this.hitTestSrc = await this.session.requestHitTestSource({
        space: viewerSpace
      });
    } catch (e) {
      console.warn("Hit test not supported");
    }

    await this.renderer.xr.setSession(this.session);

    this.isRunning = true;
    this._startXRLoop();
  }

  _startXRLoop() {
    const loop = (time, frame) => {
      if (!this.isRunning) return;

      this._raf = this.session.requestAnimationFrame(loop);

      const pose = frame.getViewerPose(this.refSpace);

      // Hit test
      if (this.hitTestSrc && this.onHit) {
        const hits = frame.getHitTestResults(this.hitTestSrc);
        if (hits.length > 0) {
          const hitPose = hits[0].getPose(this.refSpace);
          if (hitPose) this.onHit(hitPose.transform.matrix);
        }
      }

      // Update anchors
      this.anchors.forEach((obj, anchor) => {
        try {
          const pose = frame.getPose(anchor.anchorSpace, this.refSpace);
          if (pose) {
            obj.matrix.fromArray(pose.transform.matrix);
            obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
          }
        } catch {}
      });

      if (this.onFrame) this.onFrame(time, frame, pose);

      this.renderer.render(this.scene, this.camera);
    };

    this._raf = this.session.requestAnimationFrame(loop);
  }

  // ── WEBCAM MODE ───────────────────────────────────────────
  async _startWebcam() {
    this.video = document.createElement("video");
    this.video.autoplay = true;
    this.video.playsInline = true;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: /Android|iPhone/.test(navigator.userAgent)
          ? "environment"
          : "user"
      }
    });

    this.video.srcObject = stream;

    Object.assign(this.video.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      zIndex: "-1"
    });

    document.body.appendChild(this.video);

    this.webcamRunning = true;
    this._startWebcamLoop();
  }

  _startWebcamLoop() {
    const loop = (time) => {
      if (!this.webcamRunning) return;

      if (this.onFrame) this.onFrame(time, null, null);

      this.renderer.render(this.scene, this.camera);

      this._raf = requestAnimationFrame(loop);
    };

    this._raf = requestAnimationFrame(loop);
  }

  // ── PLACE CARD ────────────────────────────────────────────
  placeCard3D(hitMatrix) {
    const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });

    const mesh = new THREE.Mesh(geo, mat);

    if (hitMatrix) {
      mesh.matrix.fromArray(hitMatrix);
      mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    } else {
      mesh.position.set(0, 0, -1);
    }

    this.scene.add(mesh);
    return mesh;
  }

  // ── STOP ──────────────────────────────────────────────────
  async endSession() {
    this.isRunning = false;
    this.webcamRunning = false;

    if (this._raf) cancelAnimationFrame(this._raf);

    await this.session?.end().catch(() => {});
  }

  _onSessionEnd() {
    this.isRunning = false;
    this.session = null;
  }
}

export default AREngine;