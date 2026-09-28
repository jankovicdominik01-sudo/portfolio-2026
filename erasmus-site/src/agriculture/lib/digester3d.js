// Scene 15: a 3D cutaway of an anaerobic digester (Three.js).
// A quarter of the tank is cut away so you can see inside: substrate that
// slowly circulates, methane bubbles, the gas-holder dome inflating, and the
// flows out to the CHP unit, the upgrading column and the digestate store.
// Only renders while the scene is active; pixel ratio adapts to frame time.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, AmbientLight, DirectionalLight, PointLight, HemisphereLight,
  CylinderGeometry, CircleGeometry, PlaneGeometry, SphereGeometry, BoxGeometry, TorusGeometry, TubeGeometry,
  MeshStandardMaterial, MeshBasicMaterial, ShaderMaterial, Mesh, InstancedMesh, Object3D, Group, Vector3,
  CatmullRomCurve3, DoubleSide, AdditiveBlending
} from "three";

const CUT0 = Math.PI * 0.25, CUT = Math.PI * 1.5; // 270° of wall, the front quarter open

export function createDigester(canvas, labels, { quality = "high", getScale = () => 1, gsap }) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: quality === "high", alpha: true, powerPreference: "high-performance" });
  } catch (e) { return null; }
  const CW = canvas.clientWidth || 1300, CH = canvas.clientHeight || 1080;
  let dpr = Math.min(window.devicePixelRatio || 1, quality === "high" ? 1.5 : 1);
  function resize() {
    const s = getScale() * dpr;
    renderer.setPixelRatio(1);
    renderer.setSize(Math.round(CW * s), Math.round(CH * s), false);
  }
  resize();

  const scene = new Scene();
  scene.fog = new Fog(0x14100c, 18, 40);
  const cam = new PerspectiveCamera(32, CW / CH, 0.1, 100);
  // keep the model clear of the text column on the left: shift the picture right
  cam.setViewOffset(CW, CH, -330, 0, CW, CH);
  const view = { az: -0.55, el: 0.42, dist: 15.5, tx: 0.6, ty: 0.9, tz: 0 };
  function placeCamera(t) {
    const az = view.az + Math.sin(t * 0.12) * 0.08;
    cam.position.set(view.tx + Math.sin(az) * Math.cos(view.el) * view.dist, view.ty + Math.sin(view.el) * view.dist, view.tz + Math.cos(az) * Math.cos(view.el) * view.dist);
    cam.lookAt(view.tx, view.ty, view.tz);
  }

  scene.add(new HemisphereLight(0xd8e0ff, 0x2a1d12, 0.55));
  scene.add(new AmbientLight(0xffffff, 0.15));
  const sun = new DirectionalLight(0xfff1dc, 1.6); sun.position.set(6, 12, 9); scene.add(sun);
  const warm = new PointLight(0xff9a50, 0, 9, 1.6); warm.position.set(0, 0.2, 0); scene.add(warm);

  // ground
  const groundM = new MeshStandardMaterial({ color: 0x2a2118, roughness: 1 });
  const ground = new Mesh(new CircleGeometry(24, 64), groundM); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.6; scene.add(ground);

  // ---- tank walls ----
  const concrete = new MeshStandardMaterial({ color: 0x8d857a, roughness: 0.92, metalness: 0.02, side: DoubleSide });
  const inner = new MeshStandardMaterial({ color: 0x5b534a, roughness: 1, side: DoubleSide });
  const R = 3, T = 0.18, HH = 3.2;
  const outer = new Mesh(new CylinderGeometry(R, R, HH, 96, 1, true, CUT0, CUT), concrete); outer.position.y = 0; scene.add(outer);
  const innr = new Mesh(new CylinderGeometry(R - T, R - T, HH, 96, 1, true, CUT0, CUT), inner); scene.add(innr);
  [CUT0, CUT0 + CUT].forEach((a) => { // cut faces show wall thickness
    const p = new Mesh(new PlaneGeometry(T, HH), concrete);
    p.position.set(Math.sin(a) * (R - T / 2), 0, Math.cos(a) * (R - T / 2)); p.rotation.y = a + Math.PI / 2; scene.add(p);
  });
  const floor = new Mesh(new CircleGeometry(R, 64), inner); floor.rotation.x = -Math.PI / 2; floor.position.y = -HH / 2 + 0.01; scene.add(floor);

  // ---- substrate: noise shader, slow circulation ----
  const subU = { uTime: { value: 0 }, uMix: { value: 0.4 }, uHeat: { value: 0 } };
  const subM = new ShaderMaterial({
    uniforms: subU, side: DoubleSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform float uTime; uniform float uMix; uniform float uHeat; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float a = atan(vP.z, vP.x) + uTime*0.05*uMix;
        vec3 q = vec3(cos(a)*length(vP.xz), vP.y - uTime*0.08*uMix, sin(a)*length(vP.xz));
        float v = n(q*2.2)*.55 + n(q*5.3)*.3 + n(q*11.)*.15;
        vec3 dark = vec3(.16,.11,.07), mid = vec3(.36,.26,.15), light = vec3(.52,.40,.24);
        vec3 c = mix(dark, mid, smoothstep(.25,.7,v)); c = mix(c, light, smoothstep(.72,.95,v));
        c *= .75 + .35*smoothstep(-1.1, 1., vP.y);
        c += vec3(.42,.15,.03) * uHeat * smoothstep(1.7, 2.8, length(vP.xz)) * (.75 + .25*sin(uTime*2.));
        gl_FragColor = vec4(c, 1.);
      }`
  });
  const SH = 2.3, SY = -HH / 2 + SH / 2;
  const sub = new Mesh(new CylinderGeometry(R - T - 0.01, R - T - 0.01, SH, 96, 1, false, CUT0, CUT), subM); sub.position.y = SY; scene.add(sub);
  [CUT0, CUT0 + CUT].forEach((a) => {
    const p = new Mesh(new PlaneGeometry(R - T, SH), subM);
    p.position.set(Math.sin(a) * (R - T) / 2, SY, Math.cos(a) * (R - T) / 2); p.rotation.y = a + Math.PI / 2; scene.add(p);
  });

  // heating coil (warm glow in step 1)
  const coilM = new MeshStandardMaterial({ color: 0x7a3a1c, emissive: 0xff7a30, emissiveIntensity: 0, roughness: 0.5, metalness: 0.4 });
  for (let k = 0; k < 3; k++) { const c = new Mesh(new TorusGeometry(R - 0.45, 0.05, 8, 96, CUT), coilM); c.rotation.x = Math.PI / 2; c.position.y = -1.2 + k * 0.45; c.rotation.z = Math.PI / 2 - CUT0 - CUT; scene.add(c); }

  // stirrer
  const steel = new MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.8 });
  const stir = new Group(); scene.add(stir);
  const shaft = new Mesh(new CylinderGeometry(0.06, 0.06, 3.6, 12), steel); shaft.position.y = 0.2; stir.add(shaft);
  for (let k = 0; k < 3; k++) { const pdl = new Mesh(new BoxGeometry(1.5, 0.06, 0.28), steel); pdl.position.y = -1 + k * 0.08; pdl.rotation.y = (k * Math.PI * 2) / 3; stir.add(pdl); }

  // ---- gas dome (double membrane) ----
  const domeM = new MeshStandardMaterial({ color: 0xcfd5cf, roughness: 0.5, transparent: true, opacity: 0.4, side: DoubleSide, depthWrite: false });
  const dome = new Mesh(new SphereGeometry(R, 72, 24, CUT0, CUT, 0, Math.PI / 2), domeM);
  dome.position.y = HH / 2; dome.scale.y = 0.35; scene.add(dome);
  const gasM = new MeshBasicMaterial({ color: 0x7fb2ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  const gas = new Mesh(new SphereGeometry(R - 0.2, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), gasM);
  gas.position.y = HH / 2 - 0.9; gas.scale.y = 0.55; scene.add(gas);

  // ---- bubbles (instanced) ----
  const NB = quality === "high" ? 420 : 160;
  const bubM = new MeshBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0.9 });
  const bubbles = new InstancedMesh(new SphereGeometry(0.045, 8, 6), bubM, NB);
  const bd = Array.from({ length: NB }, () => ({ a: Math.random() * Math.PI * 2, r: Math.sqrt(Math.random()) * (R - 0.35), y: -HH / 2 + Math.random() * SH, v: 0.25 + Math.random() * 0.45, s: 0.6 + Math.random() * 1.1 }));
  scene.add(bubbles);
  const dummy = new Object3D();

  // ---- pipes and plant units ----
  const pipeM = new MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.7 });
  function pipe(pts, r = 0.1) { const c = new CatmullRomCurve3(pts.map((p) => new Vector3(...p))); scene.add(new Mesh(new TubeGeometry(c, 64, r, 10), pipeM)); return c; }
  const inlet = pipe([[-7.2, 0.2, 1.5], [-5.2, 0.2, 1.4], [-3.9, 0.1, 0.8], [-2.3, -0.2, 0.3]], 0.14);
  const hopper = new Mesh(new BoxGeometry(1.6, 1.3, 1.6), new MeshStandardMaterial({ color: 0x6b5d4a, roughness: 0.9 })); hopper.position.set(-7.6, -0.9, 1.5); scene.add(hopper);
  const gasPipe = pipe([[0, 2.55, 0], [0.8, 3.4, -0.5], [3.4, 3.4, -1.5], [5.4, 1.2, -1.8], [6.4, 0.2, -1.8]], 0.09);
  const upPipe = pipe([[3.4, 3.4, -1.5], [4.4, 3.0, -4.0], [4.6, 1.2, -4.6]], 0.08);
  const outPipe = pipe([[2.3, -1.3, -1.2], [4.0, -1.35, -0.6], [6.0, -1.4, 0.8], [7.2, -1.2, 1.8]], 0.13);
  const chp = new Group(); chp.position.set(7.1, -0.7, -1.8); scene.add(chp);
  const chpBox = new Mesh(new BoxGeometry(2.2, 1.8, 1.4), new MeshStandardMaterial({ color: 0x3f5a46, roughness: 0.6, metalness: 0.3 })); chp.add(chpBox);
  const stack = new Mesh(new CylinderGeometry(0.12, 0.12, 1.4, 12), steel); stack.position.set(0.6, 1.5, 0); chp.add(stack);
  const upg = new Mesh(new CylinderGeometry(0.5, 0.5, 3.2, 24), new MeshStandardMaterial({ color: 0x7d8792, roughness: 0.4, metalness: 0.6 })); upg.position.set(4.7, 0, -4.8); scene.add(upg);
  const store = new Mesh(new CylinderGeometry(1.8, 1.8, 1.0, 64, 1, true), concrete); store.position.set(8.4, -1.1, 2.6); scene.add(store);
  const storeTop = new Mesh(new CircleGeometry(1.75, 48), new MeshStandardMaterial({ color: 0x3b2a1a, roughness: 1 })); storeTop.rotation.x = -Math.PI / 2; storeTop.position.set(8.4, -0.75, 2.6); scene.add(storeTop);

  // flow particles along curves
  function flow(curve, n, color, size) {
    const m = new InstancedMesh(new SphereGeometry(size, 8, 6), new MeshBasicMaterial({ color, transparent: true, opacity: 0 }), n);
    const off = Array.from({ length: n }, (_, i) => i / n);
    scene.add(m);
    return { m, curve, off, speed: 0.12, on: 0 };
  }
  const flows = {
    in: flow(inlet, 26, 0x8a6440, 0.11),
    gas: flow(gasPipe, 30, 0x9cc4ff, 0.09),
    up: flow(upPipe, 16, 0xc8e0ff, 0.08),
    out: flow(outPipe, 26, 0x4a3522, 0.12)
  };
  const tmp = new Vector3();
  function updateFlows(dt) {
    Object.values(flows).forEach((f) => {
      f.m.material.opacity += ((f.on ? 0.95 : 0) - f.m.material.opacity) * Math.min(1, dt * 3);
      f.m.visible = f.m.material.opacity > 0.02;
      if (!f.m.visible) return;
      f.off.forEach((o, i) => {
        f.off[i] = (o + dt * f.speed) % 1;
        f.curve.getPointAt(f.off[i], tmp);
        dummy.position.copy(tmp); dummy.scale.setScalar(1); dummy.updateMatrix(); f.m.setMatrixAt(i, dummy.matrix);
      });
      f.m.instanceMatrix.needsUpdate = true;
    });
  }

  // ---- state driven by steps ----
  const st = { bubbles: 0, dome: 0.35, gas: 0, heat: 0, mix: 0.4 };
  const VIEWS = [
    { az: -0.95, el: 0.32, dist: 17.5, tx: -2.4, ty: 0.2, tz: 0.4 },
    { az: -0.35, el: 0.3, dist: 14.5, tx: 0, ty: -0.2, tz: 0 },
    { az: -0.3, el: 0.42, dist: 15.5, tx: 0, ty: 1.0, tz: 0 },
    { az: 0.35, el: 0.4, dist: 21, tx: 3.4, ty: 0.9, tz: -1.8 },
    { az: 0.6, el: 0.42, dist: 22, tx: 3.6, ty: -0.4, tz: 0.8 }
  ];
  const STATES = [
    { bubbles: 0.15, dome: 0.35, gas: 0, heat: 0, mix: 0.4, flows: ["in"] },
    { bubbles: 0.35, dome: 0.4, gas: 0.1, heat: 1, mix: 1, flows: ["in"] },
    { bubbles: 1, dome: 0.62, gas: 0.45, heat: 0.6, mix: 1, flows: [] },
    { bubbles: 1, dome: 0.62, gas: 0.45, heat: 0.4, mix: 1, flows: ["gas", "up"] },
    { bubbles: 1, dome: 0.6, gas: 0.4, heat: 0.4, mix: 1, flows: ["in", "gas", "up", "out"] }
  ];
  function setStep(i, instant) {
    const d = instant ? 0 : 1.8;
    gsap.to(view, { ...VIEWS[i], duration: d, ease: "power3.inOut" });
    const s = STATES[i];
    gsap.to(st, { bubbles: s.bubbles, dome: s.dome, gas: s.gas, heat: s.heat, mix: s.mix, duration: instant ? 0 : 1.6, ease: "power2.inOut" });
    Object.entries(flows).forEach(([k, f]) => (f.on = s.flows.includes(k)));
    labels.querySelectorAll("[data-step]").forEach((l) => l.classList.toggle("on", +l.dataset.step <= i));
    labels.querySelectorAll("[data-step]").forEach((l) => l.classList.toggle("now", +l.dataset.step === i));
  }

  // ---- label anchors (projected every frame) ----
  const anchors = {
    inlet: new Vector3(-6.2, 1.0, 1.5), heat: new Vector3(-1.6, -0.9, 1.6), gas: new Vector3(0, 2.9, 0.5),
    chp: new Vector3(7.1, 0.5, -1.8), upg: new Vector3(4.7, 1.9, -4.8), store: new Vector3(8.4, -0.4, 2.6)
  };
  const labelEls = [...labels.querySelectorAll("[data-anchor]")];
  const pv = new Vector3();
  function placeLabels() {
    labelEls.forEach((el) => {
      pv.copy(anchors[el.dataset.anchor]).project(cam);
      const x = ((pv.x + 1) / 2) * CW;
      el.style.transform = `translate(${x}px, ${((1 - pv.y) / 2) * CH}px)`;
      el.style.visibility = x < 700 || x > CW - 60 ? "hidden" : ""; // never over the text column
    });
  }

  // ---- loop with adaptive resolution ----
  let raf = 0, on = false, last = 0, t = 0, slow = 0, fast = 0;
  function frame(now) {
    if (!on) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; t += dt;
    if (dt > 0.024) { slow++; fast = 0; } else { fast++; slow = 0; }
    if (slow > 40 && dpr > 0.6) { dpr = Math.max(0.6, dpr - 0.2); resize(); slow = 0; }
    if (fast > 240 && dpr < Math.min(window.devicePixelRatio || 1, 1.5)) { dpr = Math.min(1.5, dpr + 0.1); resize(); fast = 0; }
    subU.uTime.value = t; subU.uMix.value = st.mix; subU.uHeat.value = st.heat;
    stir.rotation.y += dt * 0.5 * st.mix;
    coilM.emissiveIntensity = st.heat * (0.8 + Math.sin(t * 2) * 0.15);
    warm.intensity = st.heat * 5;
    dome.scale.y = st.dome + Math.sin(t * 0.8) * 0.01;
    gasM.opacity = st.gas * 0.35;
    gas.scale.y = 0.2 + st.dome * 0.9;
    const top = -HH / 2 + SH;
    bd.forEach((q, i) => {
      q.y += dt * q.v * (0.3 + st.bubbles);
      if (q.y > top) { q.y = -HH / 2 + 0.1; q.a = Math.random() * Math.PI * 2; }
      q.a += dt * 0.08 * st.mix;
      dummy.position.set(Math.cos(q.a) * q.r, q.y, Math.sin(q.a) * q.r);
      dummy.scale.setScalar(q.s * (i / NB < st.bubbles ? 1 : 0.0001));
      dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix);
    });
    bubbles.instanceMatrix.needsUpdate = true;
    updateFlows(dt);
    placeCamera(t);
    renderer.render(scene, cam);
    placeLabels();
    raf = requestAnimationFrame(frame);
  }
  return {
    start() { if (on) return; on = true; resize(); last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { on = false; cancelAnimationFrame(raf); },
    setStep,
    resize,
    renderOnce() { placeCamera(t); renderer.render(scene, cam); placeLabels(); }
  };
}
