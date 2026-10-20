/* Gold Gallery — a walk-through room for six works on the theme of gold.
   Plain script (no modules) so the folder also opens straight from disk.
   Requires: js/vendor/three.min.js (r149), js/textures.js, js/artworks.js */
(function () {
  "use strict";

  const WORKS = window.ARTWORKS;
  const EX = window.EXHIBITION;
  const TEX = window.TEXTURES || {};

  // ---------- Room dimensions (metres) ----------
  const ROOM = { minX: -10, maxX: 10, minZ: -7, maxZ: 7, h: 4.6 };
  const EYE = 1.6;
  const WALK = 2.6, RUN = 4.6;
  const READ_DIST = 5.5;

  const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (isTouch) document.body.classList.add("touch");

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const stage = $("stage"), loading = $("loading"), entrance = $("entrance"), enterBtn = $("enter-btn");
  const hudTitle = $("hud-title"), helpBtn = $("help-btn"), crosshair = $("crosshair"), hint = $("hint");
  const tour = $("tour"), joystick = $("joystick"), knob = $("joystick-knob");
  const panel = $("label");

  $("entrance-subtitle").textContent = EX.subtitle;
  $("entrance-intro").innerHTML = EX.intro.map((p) => `<p>${p}</p>`).join("");

  // ---------- Renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0e100f);
  scene.fog = new THREE.Fog(0x0e100f, 18, 34);

  const camera = new THREE.PerspectiveCamera(isTouch ? 70 : 62, window.innerWidth / window.innerHeight, 0.05, 60);
  camera.rotation.order = "YXZ";
  const player = { x: 0, z: 5.2, yaw: 0, pitch: -0.02 };

  // Soft studio environment so gold and brass read as metal.
  (function makeEnvironment() {
    const env = new THREE.Scene();
    const box = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10), new THREE.MeshBasicMaterial({ color: 0x3a3f3a, side: THREE.BackSide }));
    env.add(box);
    const lamp = (w, h, x, y, z, c) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
    };
    lamp(6, 1.2, 0, 2.9, 0, 0xfff1d6);
    lamp(3, 2, 4.9, 1, 0, 0xc9c2b0);
    lamp(3, 2, -4.9, 1, 1, 0x8d9a92);
    lamp(4, 1, 0, -2.9, 0, 0x5a4a35);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(env, 0.04).texture;
  })();

  // ---------- Canvas helpers ----------
  function canvasTex(w, h, draw, opts = {}) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
    return t;
  }
  function goldGradient(g, x0, x1) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, "#b8892b"); gr.addColorStop(0.25, "#f2dc95"); gr.addColorStop(0.45, "#a97b1e");
    gr.addColorStop(0.7, "#f2dc95"); gr.addColorStop(1, "#b8892b");
    return gr;
  }
  function wrap(g, text, x, y, maxW, lh) {
    const words = text.split(" "); let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); line = w; y += lh; }
      else line = test;
    }
    if (line) g.fillText(line, x, y);
    return y + lh;
  }
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  // ---------- Materials ----------
  const wallTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#33433f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = rand(); g.fillStyle = v > 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.035)";
      g.fillRect(rand() * w, rand() * h, 2, 2);
    }
  }, { repeat: [5, 1.4] });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.92, metalness: 0 });

  const floorTex = canvasTex(1024, 1024, (g, w, h) => {
    const rows = 8, ph = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rand() * 400;
      while (x < w) {
        const len = 380 + rand() * 320;
        const l = 26 + rand() * 7, sat = 34 + rand() * 8;
        g.fillStyle = `hsl(31, ${sat}%, ${l}%)`;
        g.fillRect(x, r * ph, len, ph);
        for (let k = 0; k < 18; k++) { // grain
          g.strokeStyle = `rgba(30,18,8,${0.05 + rand() * 0.07})`; g.lineWidth = 1 + rand() * 2;
          const yy = r * ph + rand() * ph; g.beginPath(); g.moveTo(x, yy);
          g.bezierCurveTo(x + len * 0.3, yy + rand() * 6 - 3, x + len * 0.6, yy + rand() * 6 - 3, x + len, yy + rand() * 4 - 2); g.stroke();
        }
        g.fillStyle = "rgba(10,6,3,0.55)"; g.fillRect(x, r * ph, 2, ph);
        x += len;
      }
      g.fillStyle = "rgba(10,6,3,0.6)"; g.fillRect(0, r * ph, w, 2);
    }
  }, { repeat: [5, 3.5] });
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.6 });

  const goldMat = new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 1, roughness: 0.32, envMapIntensity: 1.3 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0x9c7b3e, metalness: 1, roughness: 0.4 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xe7e2d6, roughness: 0.8 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.55 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x0d0b0a, roughness: 0.25, metalness: 0.1 });
  const matBoard = new THREE.MeshStandardMaterial({ color: 0xefe9da, roughness: 0.95 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.1, depthWrite: false, envMapIntensity: 1.5 });

  // ---------- Room shell ----------
  const W = ROOM.maxX - ROOM.minX, D = ROOM.maxZ - ROOM.minZ;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0x1b1f1d, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; scene.add(ceil);
  // Light slots in the ceiling
  const slotMat = new THREE.MeshBasicMaterial({ color: 0xfff0d2 });
  for (let x = -7.5; x <= 7.5; x += 5) for (let z = -4.5; z <= 4.5; z += 4.5) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.18), slotMat);
    s.rotation.x = Math.PI / 2; s.position.set(x, ROOM.h - 0.01, z); scene.add(s);
  }

  function wall(w, x, z, ry) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM.h), wallMat);
    m.position.set(x, ROOM.h / 2, z); m.rotation.y = ry; scene.add(m);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.03), darkWood);
    base.position.set(x, 0.06, z); base.rotation.y = ry; base.translateZ(0.015); scene.add(base);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.02), goldMat);
    band.position.set(x, 3.58, z); band.rotation.y = ry; band.translateZ(0.01); scene.add(band);
  }
  wall(W, 0, ROOM.minZ, 0);              // north, faces +z
  wall(W, 0, ROOM.maxZ, Math.PI);        // south, faces -z
  wall(D, ROOM.minX, 0, Math.PI / 2);    // west, faces +x
  wall(D, ROOM.maxX, 0, -Math.PI / 2);   // east, faces -x

  // Doorway on the south wall (the way in)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), new THREE.MeshBasicMaterial({ color: 0x070807 }));
  door.position.set(0, 1.5, ROOM.maxZ - 0.012); door.rotation.y = Math.PI; scene.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(2.36, 3.08, 0.03), darkWood);
  doorFrame.position.set(0, 1.54, ROOM.maxZ - 0.005); scene.add(doorFrame);
  door.position.z = ROOM.maxZ - 0.025;

  // Lighting
  scene.add(new THREE.HemisphereLight(0xf3ead6, 0x221d17, 0.42));
  scene.add(new THREE.AmbientLight(0xffffff, 0.06));
  function spot(x, y, z, tx, ty, tz, intensity = 1.4, angle = 0.42) {
    const s = new THREE.SpotLight(0xfff0d8, intensity, 0, angle, 0.65, 1);
    s.position.set(x, y, z); s.target.position.set(tx, ty, tz);
    scene.add(s); scene.add(s.target); return s;
  }

  // ---------- Exhibition graphics ----------
  const interactables = [];
  const billboards = [];
  const stations = []; // per work: { target: Vector3, view: {x,z,yaw,pitch} }

  function plane(w, h, mat) { return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); }
  function tagWork(obj, i) { obj.traverse((o) => { if (o.isMesh) { o.userData.work = i; interactables.push(o); } }); }

  // Place an object on a wall: wall = "W" | "N" | "E"; along = coordinate along the wall; y = height; off = distance out from the wall
  function onWall(obj, wallId, along, y, off = 0.02) {
    if (wallId === "W") { obj.position.set(ROOM.minX + off, y, along); obj.rotation.y = Math.PI / 2; }
    if (wallId === "N") { obj.position.set(along, y, ROOM.minZ + off); obj.rotation.y = 0; }
    if (wallId === "E") { obj.position.set(ROOM.maxX - off, y, along); obj.rotation.y = -Math.PI / 2; }
    scene.add(obj); return obj;
  }
  const wallNormal = { W: new THREE.Vector3(1, 0, 0), N: new THREE.Vector3(0, 0, 1), E: new THREE.Vector3(-1, 0, 0) };
  // "right" as seen by a visitor facing the wall
  const wallRight = { W: new THREE.Vector3(0, 0, -1), N: new THREE.Vector3(1, 0, 0), E: new THREE.Vector3(0, 0, 1) };

  function plaqueTexture(a) {
    return canvasTex(640, 420, (g, w, h) => {
      g.fillStyle = "#f3efe4"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#8a6512"; g.fillRect(0, 0, 8, h);
      g.fillStyle = "#6c6a60"; g.font = "500 22px 'IBM Plex Mono', monospace";
      g.fillText(String(a.n).padStart(2, "0") + "   " + a.date.toUpperCase(), 40, 56);
      g.fillStyle = "#8a6512"; g.font = "italic 400 34px 'Bodoni Moda', Georgia, serif";
      g.fillText(a.theme, 40, 108);
      g.fillStyle = "#1d1d1a"; g.font = "600 40px 'Bodoni Moda', Georgia, serif";
      let y = wrap(g, a.title, 40, 166, w - 80, 46);
      g.fillStyle = "#5d5b52"; g.font = "400 22px 'Public Sans', Arial, sans-serif";
      y = wrap(g, a.maker, 40, y + 6, w - 80, 30);
      g.fillStyle = "#8a6512"; g.font = "500 20px 'IBM Plex Mono', monospace";
      g.fillText(isTouch ? "TAP TO READ THE LABEL" : "PRESS E OR CLICK TO READ", 40, h - 34);
    });
  }
  function addPlaque(i, wallId, along, y = 1.42) {
    const m = plane(0.33, 0.2165, new THREE.MeshStandardMaterial({ map: plaqueTexture(WORKS[i]), roughness: 0.9 }));
    onWall(m, wallId, along, y, 0.025);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.2165, 0.012), plinthMat);
    onWall(back, wallId, along, y, 0.016);
    tagWork(m, i); return m;
  }
  function themeWord(i, wallId, along) {
    const a = WORKS[i];
    const t = canvasTex(1400, 300, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.font = "italic 400 150px 'Bodoni Moda', Georgia, serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = goldGradient(g, w * 0.15, w * 0.85);
      g.fillText(a.theme, w / 2, h / 2 + 6);
    });
    const m = plane(2.8, 0.6, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    onWall(m, wallId, along, 3.22, 0.02);
  }
  function station(i, target, wallId, dist, eyeY = EYE) {
    const n = wallNormal[wallId];
    const vx = target.x + n.x * dist, vz = target.z + n.z * dist;
    const yaw = Math.atan2(-(target.x - vx), -(target.z - vz));
    const pitch = Math.atan2(target.y - eyeY, dist) * 0.8;
    stations[i] = { target: target.clone(), view: { x: vx, z: vz, yaw, pitch } };
  }

  const loader = new THREE.TextureLoader();
  function loadTex(key) {
    return new Promise((resolve) => {
      const src = TEX[key];
      if (!src) { resolve(null); return; }
      loader.load(src, (t) => { t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); resolve(t); }, undefined, () => resolve(null));
    });
  }
  function photoMat(t, extra = {}) {
    return new THREE.MeshStandardMaterial(Object.assign({ map: t, color: t ? 0xffffff : 0x777777, roughness: 0.85 }, extra));
  }

  // A plinth with a glass case. The object inside is a cut-out photograph that turns to face you.
  function vitrine(i, tex, z, objW, objH, opts = {}) {
    const g = new THREE.Group();
    const px = ROOM.minX + 1.7;
    const ped = new THREE.Mesh(new THREE.BoxGeometry(0.62, 1.0, 0.62), plinthMat); ped.position.y = 0.5; g.add(ped);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), opts.deck || lacquer); deck.position.y = 1.01; g.add(deck);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.62, 0.6), glassMat); glass.position.y = 1.33; g.add(glass);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry), new THREE.LineBasicMaterial({ color: 0xb08a45, transparent: true, opacity: 0.7 }));
    edges.position.copy(glass.position); g.add(edges);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.62, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; g.add(shadow);
    const obj = new THREE.Mesh(new THREE.PlaneGeometry(objW, objH), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.6, metalness: opts.metal || 0, side: THREE.DoubleSide }));
    obj.position.y = 1.02 + (opts.lift || 0) + objH / 2; g.add(obj);
    billboards.push(obj);
    if (opts.stand) { // small riser for the coin
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, opts.lift, 0.16), lacquer); r.position.y = 1.02 + opts.lift / 2; g.add(r);
    }
    g.position.set(px, 0, z); scene.add(g);
    tagWork(g, i);
    colliders.push({ x: px, z, r: 0.6 });
    spot(px + 1.6, ROOM.h - 0.05, z, px, 1.3, z, 1.6, 0.32);
    const target = new THREE.Vector3(px, 1.3, z);
    station(i, target, "W", 1.9);
    themeWord(i, "W", z);
    // Label sits on the front of the plinth, tilted up for reading
    const pl = plane(0.33, 0.2165, new THREE.MeshStandardMaterial({ map: plaqueTexture(WORKS[i]), roughness: 0.9 }));
    pl.rotation.order = "YXZ"; pl.rotation.set(-0.35, Math.PI / 2, 0);
    pl.position.set(px + 0.37, 0.86, z); scene.add(pl); tagWork(pl, i);
  }

  const colliders = []; // circles
  const boxes = [];     // axis-aligned rectangles {minX,maxX,minZ,maxZ}

  // ---------- The title wall (north, centre) ----------
  function titleWall() {
    const t = canvasTex(2400, 980, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.textBaseline = "alphabetic";
      g.font = "800 330px 'Bodoni Moda', Georgia, serif";
      g.fillStyle = goldGradient(g, 60, 900);
      g.fillText(EX.title, 70, 320);
      g.fillStyle = "#ece7d7"; g.font = "italic 400 58px 'Bodoni Moda', Georgia, serif";
      wrap(g, EX.subtitle, 80, 420, 1000, 70);
      g.fillStyle = "#d9d4c4"; g.font = "400 33px 'Public Sans', Arial, sans-serif";
      let y = wrap(g, EX.intro[0], 1270, 120, 1060, 48);
      wrap(g, EX.intro[1], 1270, y + 22, 1060, 48);
      // To-scale timeline, 700 BCE – 1900 CE
      const x0 = 90, x1 = w - 90, ay = 830, Y0 = -700, Y1 = 1900;
      const X = (yr) => x0 + (yr - Y0) / (Y1 - Y0) * (x1 - x0);
      g.strokeStyle = "rgba(236,231,215,0.45)"; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, ay); g.lineTo(x1, ay); g.stroke();
      g.font = "500 26px 'IBM Plex Mono', monospace"; g.fillStyle = "rgba(236,231,215,0.7)"; g.textAlign = "center";
      [[-500, "500 BCE"], [1, "1 CE"], [500, "500"], [1000, "1000"], [1500, "1500"]].forEach(([yr, s]) => {
        g.fillRect(X(yr) - 1.5, ay, 3, 16); g.fillText(s, X(yr), ay + 52);
      });
      WORKS.forEach((a, k) => {
        const xa = X(a.yearStart), xb = X(a.yearEnd);
        g.fillStyle = goldGradient(g, xa - 20, xb + 20);
        g.beginPath(); g.roundRect ? g.roundRect(xa - 7, ay - 7, Math.max(14, xb - xa + 14), 14, 7) : g.rect(xa - 7, ay - 7, Math.max(14, xb - xa + 14), 14); g.fill();
        const cx = X(a.year), cy = ay - (k % 2 ? 70 : 120);
        g.strokeStyle = "#c99b36"; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy + 22); g.lineTo(cx, ay - 8); g.stroke();
        g.fillStyle = "#151816"; g.beginPath(); g.arc(cx, cy, 24, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#c99b36"; g.lineWidth = 2.5; g.stroke();
        g.fillStyle = "#f2dc95"; g.font = "500 24px 'IBM Plex Mono', monospace"; g.fillText(String(a.n), cx, cy + 8);
      });
      g.textAlign = "left"; g.fillStyle = "rgba(236,231,215,0.75)"; g.font = "500 24px 'IBM Plex Mono', monospace";
      g.fillText("THE SIX WORKS, DRAWN TO SCALE · HUNG CLOCKWISE FROM THE LEFT WALL", x0, ay - 190);
    });
    const m = plane(7.2, 2.94, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    onWall(m, "N", 0, 1.95, 0.02);
    spot(0, ROOM.h - 0.05, -4.2, 0, 1.9, ROOM.minZ, 0.9, 0.6);
  }

  // ---------- Build the six works ----------
  async function build() {
    const [tHorus, tCoin, tKwanum, tAmerica, tFans, tWhistler] = await Promise.all(
      ["horus", "coin", "kwanum", "america", "fans", "whistler"].map(loadTex)
    );

    titleWall();

    // 1 · Horus falcon (west wall, nearer the entrance)
    vitrine(0, tHorus, 2.6, 0.33, 0.532);
    // 2 · Akragas coin (west wall, farther in) — magnified
    vitrine(1, tCoin, -2.6, 0.5, 0.195, { lift: 0.12, metal: 0.3 });

    // 3 · Water-moon Avalokiteshvara: hanging scroll, north wall left
    {
      const i = 2, x = -6.2, mountW = 1.143, mountH = 2.743, bottom = 0.36;
      const g = new THREE.Group();
      const brocade = canvasTex(256, 512, (c, w, h) => {
        c.fillStyle = "#4e3f27"; c.fillRect(0, 0, w, h);
        c.fillStyle = "rgba(214,178,98,0.22)";
        for (let yy = 8; yy < h; yy += 24) for (let xx = (yy / 24) % 2 ? 12 : 0; xx < w; xx += 24) { c.beginPath(); c.arc(xx, yy, 3.2, 0, 7); c.fill(); }
      }, { repeat: [2, 5] });
      const mount = plane(mountW, mountH, new THREE.MeshStandardMaterial({ map: brocade, roughness: 0.8 }));
      g.add(mount);
      const inner = plane(0.9, 1.7, new THREE.MeshStandardMaterial({ color: 0xcdbf9a, roughness: 0.9 })); inner.position.set(0, -0.12, 0.002); g.add(inner);
      const paint = plane(0.825, 1.596, photoMat(tKwanum, { roughness: 0.75 })); paint.position.set(0, -0.12, 0.004); g.add(paint);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, mountW + 0.02, 16), darkWood); rod.rotation.z = Math.PI / 2; rod.position.set(0, mountH / 2, 0.02); g.add(rod);
      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, mountW + 0.12, 16), darkWood); roller.rotation.z = Math.PI / 2; roller.position.set(0, -mountH / 2, 0.03); g.add(roller);
      [-1, 1].forEach((s) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 16), goldMat); cap.rotation.z = Math.PI / 2; cap.position.set(s * (mountW / 2 + 0.07), -mountH / 2, 0.03); g.add(cap); });
      const cord = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.28, 0.004), new THREE.MeshStandardMaterial({ color: 0x2a2018 })); cord.position.set(0, mountH / 2 + 0.14, 0.01); g.add(cord);
      onWall(g, "N", x, bottom + mountH / 2, 0.03);
      tagWork(g, i);
      spot(x, ROOM.h - 0.05, -4.6, x, 1.7, ROOM.minZ, 1.5, 0.4);
      station(i, new THREE.Vector3(x, 1.65, ROOM.minZ), "N", 3.0);
      themeWord(i, "N", x);
      addPlaque(i, "N", x + 0.95);
    }

    // 4 · America print: framed under a mat, north wall right
    {
      const i = 3, x = 6.2, y = 1.55;
      const g = new THREE.Group();
      const fw = 0.66, fh = 0.56, d = 0.035, m = 0.035;
      const back = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.02), darkWood); g.add(back);
      const mat = plane(fw - 2 * m, fh - 2 * m, matBoard); mat.position.z = 0.011; g.add(mat);
      const pr = plane(0.40, 0.295, photoMat(tAmerica, { roughness: 0.9 })); pr.position.set(0, 0.012, 0.013); g.add(pr);
      [[0, fh / 2 - m / 2, fw, m], [0, -fh / 2 + m / 2, fw, m], [fw / 2 - m / 2, 0, m, fh], [-fw / 2 + m / 2, 0, m, fh]].forEach(([px, py, w, h]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkWood); b.position.set(px, py, d / 2); g.add(b);
      });
      onWall(g, "N", x, y, 0.02);
      tagWork(g, i);
      spot(x, ROOM.h - 0.05, -5.0, x, y, ROOM.minZ, 1.5, 0.3);
      station(i, new THREE.Vector3(x, y, ROOM.minZ), "N", 1.7);
      themeWord(i, "N", x);
      addPlaque(i, "N", x + 0.62);
    }

    // 5 · Fans on a Stream: six-panel folding screen standing in front of the east wall
    {
      const i = 4, z = -2.7, panels = 6, pw = 0.58, ph = 1.56, fold = 0.32;
      const g = new THREE.Group();
      const backMat = new THREE.MeshStandardMaterial({ color: 0xb79e6e, roughness: 0.9 });
      const edgeMat = lacquer;
      // Zigzag: panels alternate angle; track a running x along the screen
      let cx = 0; const pts = [];
      for (let k = 0; k < panels; k++) {
        const ang = k % 2 ? -fold : fold;
        const dx = Math.cos(ang) * pw, dz = Math.sin(ang) * pw;
        pts.push({ x0: cx, z0: k % 2 ? Math.sin(fold) * pw : 0, ang, dx, dz });
        cx += dx;
      }
      const totalW = cx;
      pts.forEach((p, k) => {
        const geo = new THREE.PlaneGeometry(pw, ph);
        const uv = geo.attributes.uv;
        for (let v = 0; v < uv.count; v++) uv.setX(v, (k + uv.getX(v)) / panels);
        const front = new THREE.Mesh(geo, photoMat(tFans, { roughness: 0.5, metalness: 0.15 }));
        const pg = new THREE.Group();
        front.position.set(pw / 2, ph / 2, 0.003); pg.add(front);
        const bk = plane(pw, ph, backMat); bk.rotation.y = Math.PI; bk.position.set(pw / 2, ph / 2, -0.003); pg.add(bk);
        const rim = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.025, 0.02), edgeMat); rim.position.set(pw / 2, ph, 0); pg.add(rim);
        const rim2 = rim.clone(); rim2.position.y = 0; pg.add(rim2);
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.02, ph, 0.02), edgeMat); side.position.set(0, ph / 2, 0); pg.add(side);
        pg.position.set(p.x0 - totalW / 2, 0.11, p.z0 - Math.sin(fold) * pw / 2);
        pg.rotation.y = -p.ang;
        g.add(pg);
      });
      const base = new THREE.Mesh(new THREE.BoxGeometry(totalW + 0.5, 0.11, 0.85), lacquer); base.position.set(0, 0.055, 0); g.add(base);
      g.position.set(ROOM.maxX - 0.75, 0, z); g.rotation.y = -Math.PI / 2; scene.add(g);
      tagWork(g, i);
      boxes.push({ minX: ROOM.maxX - 1.25, maxX: ROOM.maxX, minZ: z - totalW / 2 - 0.3, maxZ: z + totalW / 2 + 0.3 });
      spot(ROOM.maxX - 3.4, ROOM.h - 0.05, z - 1, ROOM.maxX - 0.75, 0.9, z - 0.8, 1.3, 0.42);
      spot(ROOM.maxX - 3.4, ROOM.h - 0.05, z + 1, ROOM.maxX - 0.75, 0.9, z + 0.8, 1.3, 0.42);
      station(i, new THREE.Vector3(ROOM.maxX - 0.75, 0.95, z), "E", 3.7);
      themeWord(i, "E", z);
      addPlaque(i, "E", z + totalW / 2 + 0.55, 1.2);
    }

    // 6 · Whistler: oil on canvas in a gilded frame, east wall near the entrance
    {
      const i = 5, z = 3.3, y = 1.6;
      const g = new THREE.Group();
      const cw = 0.622, ch = 0.47, fw = 0.883, fh = 0.727, d = 0.064;
      const canvas = plane(cw, ch, photoMat(tWhistler, { roughness: 0.6 })); canvas.position.z = 0.02; g.add(canvas);
      const liner = new THREE.Mesh(new THREE.BoxGeometry(cw + 0.03, ch + 0.03, 0.03), new THREE.MeshStandardMaterial({ color: 0x8a6a2e, metalness: 0.9, roughness: 0.5 })); liner.position.z = 0.003; g.add(liner);
      const bw = (fw - cw) / 2, bh = (fh - ch) / 2;
      [[0, ch / 2 + bh / 2, fw, bh], [0, -ch / 2 - bh / 2, fw, bh], [cw / 2 + bw / 2, 0, bw, ch], [-cw / 2 - bw / 2, 0, bw, ch]].forEach(([px, py, w, h]) => {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldMat); b.position.set(px, py, d / 2); g.add(b);
        // reeding: thin raised lines, a Whistler-frame habit
        for (let r = 1; r <= 3; r++) {
          const along = w > h;
          const line = new THREE.Mesh(new THREE.BoxGeometry(along ? w : 0.006, along ? 0.006 : h, 0.006), brassMat);
          const off = (r / 4 - 0.5) * (along ? h : w);
          line.position.set(px + (along ? 0 : off), py + (along ? off : 0), d + 0.003); g.add(line);
        }
      });
      onWall(g, "E", z, y, 0.02);
      tagWork(g, i);
      spot(ROOM.maxX - 2.2, ROOM.h - 0.05, z, ROOM.maxX, y, z, 1.4, 0.3);
      station(i, new THREE.Vector3(ROOM.maxX, y, z), "E", 2.1);
      themeWord(i, "E", z);
      addPlaque(i, "E", z + 0.85);
    }

    // A pair of benches along the room's spine, clear of the walking routes
    [[-2.8, 0.2], [2.8, 0.2]].forEach(([x, z]) => {
      const b = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.5), darkWood); top.position.y = 0.44; b.add(top);
      [-0.75, 0.75].forEach((lx) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.44), brassMat); l.position.set(lx, 0.21, 0); b.add(l); });
      b.position.set(x, 0, z); scene.add(b);
      boxes.push({ minX: x - 1.05, maxX: x + 1.05, minZ: z - 0.4, maxZ: z + 0.4 });
    });
  }

  // ---------- Movement & collisions ----------
  const keys = new Set();
  const PR = 0.3; // player radius
  function collide(x, z) {
    x = Math.min(ROOM.maxX - PR - 0.05, Math.max(ROOM.minX + PR + 0.05, x));
    z = Math.min(ROOM.maxZ - PR - 0.05, Math.max(ROOM.minZ + PR + 0.05, z));
    for (const c of colliders) {
      const dx = x - c.x, dz = z - c.z, dd = Math.hypot(dx, dz), min = c.r + PR;
      if (dd < min && dd > 1e-4) { x = c.x + dx / dd * min; z = c.z + dz / dd * min; }
    }
    for (const b of boxes) {
      if (x > b.minX - PR && x < b.maxX + PR && z > b.minZ - PR && z < b.maxZ + PR) {
        const pen = [x - (b.minX - PR), (b.maxX + PR) - x, z - (b.minZ - PR), (b.maxZ + PR) - z];
        const m = Math.min(...pen), k = pen.indexOf(m);
        if (k === 0) x = b.minX - PR; else if (k === 1) x = b.maxX + PR; else if (k === 2) z = b.minZ - PR; else z = b.maxZ + PR;
      }
    }
    return [x, z];
  }

  let glide = null; // { from, to, t, dur }
  function glideTo(i) {
    const s = stations[i]; if (!s) return;
    const from = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
    let dyaw = s.view.yaw - from.yaw; dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
    const dist = Math.hypot(s.view.x - from.x, s.view.z - from.z);
    glide = { from, to: { x: s.view.x, z: s.view.z, yaw: from.yaw + dyaw, pitch: s.view.pitch }, t: 0, dur: Math.min(2.6, 0.7 + dist * 0.16), i };
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // ---------- Look controls ----------
  let locked = false, dragging = false, dragMoved = 0, lastX = 0, lastY = 0, started = false;
  const canvasEl = renderer.domElement;
  function look(dx, dy, k = 0.0022) {
    player.yaw -= dx * k; player.pitch -= dy * k;
    player.pitch = Math.max(-1.2, Math.min(1.2, player.pitch));
    glide = null;
  }
  const pointerLockOK = "pointerLockElement" in document && !isTouch;
  function tryLock() {
    if (!pointerLockOK || !started || !panel.hidden) return;
    try { const p = canvasEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
  }
  document.addEventListener("pointerlockchange", () => {
    locked = document.pointerLockElement === canvasEl;
    crosshair.hidden = !(started && (locked || isTouch === false));
    if (!locked && started && panel.hidden) showHint("Click to look around · or drag with the mouse");
  });
  document.addEventListener("mousemove", (e) => {
    if (locked) look(e.movementX, e.movementY);
    else if (dragging) { look(e.clientX - lastX, e.clientY - lastY, 0.004); dragMoved += Math.abs(e.clientX - lastX) + Math.abs(e.clientY - lastY); lastX = e.clientX; lastY = e.clientY; }
  });
  canvasEl.addEventListener("mousedown", (e) => {
    if (!started || isTouch) return;
    if (locked) { interact(); return; }
    dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener("mouseup", (e) => {
    if (!dragging) return; dragging = false;
    if (dragMoved < 6) {
      const hit = pick(e.clientX, e.clientY);
      if (hit != null) openLabel(hit); else tryLock();
    }
  });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (!started) return;
    const k = e.key.toLowerCase();
    if (k === "escape" && !panel.hidden) { closeLabel(); return; }
    if (!panel.hidden && !/^[1-6]$/.test(k)) return;
    if (/^[1-6]$/.test(k)) { const i = +k - 1; glideTo(i); if (!panel.hidden) fillLabel(i); return; }
    if (k === "e" || k === "enter") { interact(); return; }
    keys.add(k);
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  // Touch: joystick (left) + drag-to-look (anywhere else) + tap to read
  const stick = { id: null, x: 0, y: 0, cx: 0, cy: 0 };
  const lookTouch = { id: null, x: 0, y: 0, moved: 0, t: 0 };
  joystick.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0]; const r = joystick.getBoundingClientRect();
    stick.id = t.identifier; stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; moveStick(t); e.preventDefault();
  }, { passive: false });
  function moveStick(t) {
    const max = joystick.clientWidth / 2 - 12;
    let dx = t.clientX - stick.cx, dy = t.clientY - stick.cy; const d = Math.hypot(dx, dy);
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    stick.x = dx / max; stick.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  canvasEl.addEventListener("touchstart", (e) => {
    if (!started) return;
    for (const t of e.changedTouches) if (lookTouch.id === null) { lookTouch.id = t.identifier; lookTouch.x = t.clientX; lookTouch.y = t.clientY; lookTouch.moved = 0; lookTouch.t = performance.now(); }
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("touchmove", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) moveStick(t);
      if (t.identifier === lookTouch.id) {
        const dx = t.clientX - lookTouch.x, dy = t.clientY - lookTouch.y;
        look(dx, dy, 0.005); lookTouch.moved += Math.abs(dx) + Math.abs(dy); lookTouch.x = t.clientX; lookTouch.y = t.clientY;
      }
    }
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = ""; }
      if (t.identifier === lookTouch.id) {
        if (lookTouch.moved < 10 && performance.now() - lookTouch.t < 400) { const hit = pick(t.clientX, t.clientY); if (hit != null) openLabel(hit); }
        lookTouch.id = null;
      }
    }
  });

  // ---------- Picking ----------
  const ray = new THREE.Raycaster(); ray.far = READ_DIST + 2;
  const ndc = new THREE.Vector2();
  function pickNDC(x, y) {
    ndc.set(x, y); ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(interactables, false);
    if (!hits.length || hits[0].distance > READ_DIST) return null;
    return hits[0].object.userData.work;
  }
  function pick(cx, cy) { return pickNDC((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1); }
  let aimed = null;
  function interact() { if (aimed != null) openLabel(aimed); }

  // ---------- Label panel ----------
  let current = 0;
  function fillLabel(i) {
    const a = WORKS[i]; current = i;
    $("label-n").textContent = String(a.n).padStart(2, "0") + " / 06";
    $("label-date").textContent = a.date;
    $("label-theme").textContent = a.theme;
    $("label-title").textContent = a.title;
    $("label-maker").textContent = a.maker;
    const img = $("label-img"); img.src = TEX[a.key] || a.image; img.alt = a.title;
    $("label-why").innerHTML = a.why.map((p) => `<p>${p}</p>`).join("");
    $("label-tomb").innerHTML = a.tomb.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const link = $("label-link"); link.href = a.url;
    $("label-prev").disabled = i === 0; $("label-next").disabled = i === WORKS.length - 1;
    panel.querySelector(".label-scroll").scrollTop = 0;
  }
  function openLabel(i) {
    fillLabel(i); panel.hidden = false; hint.hidden = true; keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    $("label-close").focus({ preventScroll: true });
  }
  function closeLabel() {
    panel.hidden = true;
    if (!isTouch) showHint("Click to keep walking");
  }
  $("label-close").addEventListener("click", closeLabel);
  $("label-prev").addEventListener("click", () => { if (current > 0) { fillLabel(current - 1); glideTo(current); } });
  $("label-next").addEventListener("click", () => { if (current < WORKS.length - 1) { fillLabel(current + 1); glideTo(current); } });

  let hintTimer = 0;
  function showHint(html, ms = 3500) {
    hint.innerHTML = html; hint.hidden = false; clearTimeout(hintTimer);
    if (ms) hintTimer = setTimeout(() => { hint.hidden = true; }, ms);
  }

  // ---------- Tour bar ----------
  tour.innerHTML = WORKS.map((a, i) => `<button type="button" data-i="${i}" title="${a.shortTitle}, ${a.date}"><span class="num">${a.n}</span><span class="yr">${a.date}</span></button>`).join("");
  tour.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const i = +b.dataset.i; glideTo(i);
    if (!panel.hidden) fillLabel(i);
  });
  const tourButtons = [...tour.querySelectorAll("button")];

  // ---------- Entrance / help ----------
  function enter() {
    started = true;
    entrance.hidden = true;
    hudTitle.hidden = false; helpBtn.hidden = false; tour.hidden = false;
    crosshair.hidden = isTouch; joystick.hidden = !isTouch;
    enterBtn.textContent = "Back to the gallery";
    tryLock();
    showHint(isTouch ? "Walk with the joystick · drag to look · tap a work" : "Walk with <b>WASD</b> · aim at a work and press <b>E</b>", 4500);
  }
  enterBtn.addEventListener("click", enter);
  helpBtn.addEventListener("click", () => {
    started = false; entrance.hidden = false; panel.hidden = true; hint.hidden = true;
    if (document.pointerLockElement) document.exitPointerLock();
  });

  // ---------- Resize ----------
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = isTouch && window.innerHeight > window.innerWidth ? 74 : (isTouch ? 66 : 62);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  window.dispatchEvent(new Event("resize"));

  // ---------- Loop ----------
  const clock = new THREE.Clock();
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), tmp = new THREE.Vector3();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);

    if (glide) {
      glide.t += dt / glide.dur; const k = ease(Math.min(1, glide.t));
      player.x = glide.from.x + (glide.to.x - glide.from.x) * k;
      player.z = glide.from.z + (glide.to.z - glide.from.z) * k;
      player.yaw = glide.from.yaw + (glide.to.yaw - glide.from.yaw) * k;
      player.pitch = glide.from.pitch + (glide.to.pitch - glide.from.pitch) * k;
      if (glide.t >= 1) glide = null;
    } else if (started && panel.hidden) {
      let mx = 0, mz = 0;
      if (keys.has("w") || keys.has("arrowup")) mz += 1;
      if (keys.has("s") || keys.has("arrowdown")) mz -= 1;
      if (keys.has("a")) mx -= 1;
      if (keys.has("d")) mx += 1;
      if (keys.has("arrowleft")) player.yaw += 1.8 * dt;
      if (keys.has("arrowright")) player.yaw -= 1.8 * dt;
      if (stick.id !== null) { mx += stick.x; mz -= stick.y; }
      const len = Math.hypot(mx, mz);
      if (len > 0.05) {
        const sp = (keys.has("shift") ? RUN : WALK) * Math.min(1, len);
        mx /= Math.max(1, len); mz /= Math.max(1, len);
        fwd.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
        right.set(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
        tmp.copy(fwd).multiplyScalar(mz).addScaledVector(right, mx).multiplyScalar(sp * dt);
        [player.x, player.z] = collide(player.x + tmp.x, player.z + tmp.z);
      }
    }

    const bob = 0;
    camera.position.set(player.x, EYE + bob, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);

    // Cut-out objects in the vitrines turn slowly to face the visitor (around the vertical axis only)
    for (const b of billboards) {
      b.getWorldPosition(tmp);
      const target = Math.atan2(camera.position.x - tmp.x, camera.position.z - tmp.z);
      const diff = Math.atan2(Math.sin(target - b.rotation.y), Math.cos(target - b.rotation.y));
      b.rotation.y += diff * Math.min(1, dt * 6);
    }

    // Aim detection
    if (started && panel.hidden && !isTouch) {
      const a = pickNDC(0, 0);
      if (a !== aimed) {
        aimed = a;
        crosshair.classList.toggle("on", a != null);
        if (a != null) { clearTimeout(hintTimer); hint.innerHTML = `<b>E</b> or click · read “${WORKS[a].shortTitle}”`; hint.hidden = false; }
        else if (/read “/.test(hint.innerHTML)) hint.hidden = true;
      }
    }

    // Highlight the nearest work in the tour bar
    let near = -1, best = 4.2;
    stations.forEach((s, i) => { const d = Math.hypot(player.x - s.view.x, player.z - s.view.z); if (d < best) { best = d; near = i; } });
    tourButtons.forEach((b, i) => b.classList.toggle("near", i === near));

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  // ---------- Boot ----------
  const fontReady = document.fonts && document.fonts.load
    ? Promise.race([
        Promise.all([
          document.fonts.load("800 100px 'Bodoni Moda'"), document.fonts.load("italic 400 100px 'Bodoni Moda'"),
          document.fonts.load("600 40px 'Bodoni Moda'"), document.fonts.load("400 30px 'Public Sans'"),
          document.fonts.load("500 20px 'IBM Plex Mono'")
        ]),
        new Promise((r) => setTimeout(r, 3000))
      ]).catch(() => {})
    : Promise.resolve();

  fontReady.then(build).then(() => {
    loading.hidden = true;
    enterBtn.disabled = false;
    // Start looking at the title wall from just inside the door
    player.x = 0; player.z = 5.2; player.yaw = 0; player.pitch = 0.02;
    requestAnimationFrame(frame);
  }).catch((err) => {
    loading.textContent = "The gallery could not load: " + err.message;
    console.error(err);
  });

  // Exposed for testing
  window.GALLERY = { glideTo, openLabel, player, stations };
})();
