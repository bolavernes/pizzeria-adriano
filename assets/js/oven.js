// Pizzeria Adriano – 3D-Holzofen
// Nachempfunden dem echten Ofen im Lokal: Kuppel aus hellem Sandstein mit einzelnen
// roten Ziegeln, gemauerter Ziegelbogen um die Öffnung, Relief-Medaillon, Holzlager im Sockel.
// Scroll dreht den Ofen und fährt die Kamera an die Öffnung; Ziehen dreht frei.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from '../vendor/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/addons/postprocessing/OutputPass.js';

const TAU = Math.PI * 2;
const rand = mulberry32(54); // feste Saat: der Ofen sieht bei jedem Laden gleich aus
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const r = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ---------- Texturen (prozedural, keine Downloads) ---------- */
function grainTexture(size = 256, lo = 190, hi = 255, blobs = 140) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = lo + Math.random() * (hi - lo);
    img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.98; img.data[i * 4 + 2] = v * 0.95; img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < blobs; i++) { // Poren & Flecken
    g.fillStyle = `rgba(${90 + Math.random() * 60},${70 + Math.random() * 40},${50 + Math.random() * 30},${Math.random() * 0.18})`;
    g.beginPath(); g.arc(Math.random() * size, Math.random() * size, Math.random() * 6 + 1, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function woodEndTexture() {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, s, s);
  for (let i = 12; i > 0; i--) {
    g.strokeStyle = i % 2 ? 'rgba(60,38,20,.55)' : 'rgba(160,118,78,.5)';
    g.lineWidth = 2.5; g.beginPath(); g.arc(s / 2 + Math.random() * 3, s / 2 + Math.random() * 3, i * 5, 0, TAU); g.stroke();
  }
  g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s * .9, s * .25); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture(inner = 'rgba(255,170,80,1)', outer = 'rgba(255,90,20,0)') {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pizzaTexture() {
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#c98a45'; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();            // Rand
  g.fillStyle = '#b8321e'; g.beginPath(); g.arc(128, 128, 108, 0, TAU); g.fill();            // Tomate
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(250,236,200,${.75 + Math.random() * .25})`; g.beginPath(); g.arc(128 + (Math.random() - .5) * 170, 128 + (Math.random() - .5) * 170, 10 + Math.random() * 16, 0, TAU); g.fill(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = '#3f6b2a'; g.beginPath(); g.ellipse(128 + (Math.random() - .5) * 160, 128 + (Math.random() - .5) * 160, 7, 4, Math.random() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,30,10,.35)'; g.beginPath(); g.arc(Math.random() * s, Math.random() * s, 2, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- GLSL ---------- */
const NOISE = /* glsl */`
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }`;

function flameMaterial(seed, speed = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uSpeed: { value: speed }, uPower: { value: 1 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uSeed, uSpeed, uPower; varying vec2 vUv;
      ${NOISE}
      void main(){
        vec2 uv = vUv;
        float t = uTime*uSpeed;
        float n  = fbm(vec2(uv.x*3.2 + uSeed, uv.y*2.4 - t*1.9));
        float n2 = fbm(vec2(uv.x*6.0 - uSeed, uv.y*4.0 - t*3.1));
        float sway = (noise(vec2(t*0.7+uSeed, uv.y*1.5)) - 0.5) * 0.22 * uv.y;
        float width = mix(0.42, 0.04, pow(uv.y, 0.9));
        float d = abs(uv.x - 0.5 - sway) / width;
        float body = 1.0 - smoothstep(0.35, 1.05, d + (n - 0.5) * 0.9);
        float top  = 1.0 - smoothstep(0.35, 0.98, uv.y + (n2 - 0.5) * 0.35);
        float base = smoothstep(0.0, 0.08, uv.y);
        float m = clamp(body * top * base * uPower, 0.0, 1.0);
        vec3 deep = vec3(0.55, 0.06, 0.01);
        vec3 mid  = vec3(1.0, 0.38, 0.04);
        vec3 hot  = vec3(1.0, 0.86, 0.52);
        vec3 col = mix(deep, mid, smoothstep(0.05, 0.55, m));
        col = mix(col, hot, smoothstep(0.62, 1.0, m) * (1.0 - uv.y*0.6));
        gl_FragColor = vec4(col * (0.55 + m*1.05), m * 0.92);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}
function emberMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; varying vec2 vUv; varying vec3 vN; ${NOISE}
      void main(){
        float n = fbm(vUv*vec2(9.0,3.0) + vec2(0.0, uTime*0.15));
        float pulse = 0.65 + 0.35*sin(uTime*2.3 + n*9.0);
        float glow = pow(smoothstep(0.42, 0.9, n), 2.0) * pulse;
        vec3 coal = vec3(0.06, 0.035, 0.025);
        vec3 col = coal + vec3(1.0, 0.33, 0.06) * glow * 2.2;
        gl_FragColor = vec4(col, 1.0);
      }`
  });
}

/* ---------- Ofen bauen ---------- */
function buildOven(opts) {
  const oven = new THREE.Group();
  const grain = grainTexture();
  const HEARTH_Y = 1.05;            // Oberkante Herdplatte
  const A = 1.12, B = 1.0;          // Kuppel-Radien (horizontal, vertikal)
  const ARCH = Object.assign({ inner: 0.36, outer: 0.58, spring: 0.22, face: 1.17, depth: 0.52 }, opts.arch || {});
  const dome = opts.dome !== false;

  const inMouth = (x, yRel, z, margin = 0) =>
    z > 0.25 && Math.abs(x) < ARCH.outer - margin && yRel < ARCH.spring + ARCH.outer - margin &&
    (yRel < ARCH.spring || Math.hypot(x, yRel - ARCH.spring) < ARCH.outer - margin);

  /* Sockel: Steinblock mit Nische für das Holz */
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xd9c8aa, map: grain, roughness: 0.92, bumpMap: grain, bumpScale: 0.6 });
  const brickMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grain, roughness: 0.88, bumpMap: grain, bumpScale: 0.5 });
  const W = 2.7, D = 2.6, H = HEARTH_Y - 0.1, NW = 1.3, NH = 0.66;
  const addBox = (w, h, d, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); oven.add(m); return m; };
  addBox((W - NW) / 2, H, D, -(NW / 2 + (W - NW) / 4), H / 2, 0, stoneMat);
  addBox((W - NW) / 2, H, D, (NW / 2 + (W - NW) / 4), H / 2, 0, stoneMat);
  addBox(NW, H - NH, D, 0, NH + (H - NH) / 2, 0, stoneMat);
  addBox(NW, NH, 0.1, 0, NH / 2, -0.75, new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 }));
  addBox(NW, NH, D / 2 - 0.8, 0, NH / 2, -(D / 2 + 0.8) / 2, stoneMat); // Rückseite geschlossen
  // Ziegelrahmen der Nische
  const brickColors = [0x7e3324, 0x8f3f2a, 0x6c2a1e, 0x9c4c33, 0x83392a, 0x612519];
  const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brickMat, 40);
  let fi = 0; const dummy = new THREE.Object3D(); const col = new THREE.Color();
  const placeBrick = (im, idx, x, y, z, sx, sy, sz, rz = 0, c) => {
    dummy.position.set(x, y, z); dummy.rotation.set(r(-.02, .02), r(-.02, .02), rz + r(-.025, .025)); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    im.setMatrixAt(idx, dummy.matrix); im.setColorAt(idx, col.set(c ?? pick(brickColors)).offsetHSL(0, 0, r(-.04, .04)));
  };
  for (let i = 0; i < 6; i++) { // Pfeiler links/rechts
    placeBrick(frame, fi++, -NW / 2 - 0.08, 0.06 + i * 0.112, D / 2 + 0.01, 0.17, 0.1, 0.14);
    placeBrick(frame, fi++, NW / 2 + 0.08, 0.06 + i * 0.112, D / 2 + 0.01, 0.17, 0.1, 0.14);
  }
  for (let i = 0; i < 7; i++) placeBrick(frame, fi++, -NW / 2 - 0.05 + 0.03 + i * ((NW + 0.1) / 7) + 0.09, NH + 0.06, D / 2 + 0.012, (NW + 0.1) / 7 - 0.015, 0.11, 0.15);
  frame.count = fi; frame.instanceMatrix.needsUpdate = true; frame.instanceColor.needsUpdate = true; oven.add(frame);
  // Holzscheite (Stirnseite sichtbar)
  const logGeo = new THREE.CylinderGeometry(1, 1, 1, 10); logGeo.rotateX(Math.PI / 2);
  const bark = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 1, map: grain });
  const endMat = new THREE.MeshStandardMaterial({ map: woodEndTexture(), roughness: 0.95 });
  const logs = new THREE.InstancedMesh(logGeo, [bark, endMat, endMat], 40);
  let li = 0;
  for (let row = 0; row < 4; row++) {
    const n = 8 - (row % 2);
    for (let k = 0; k < n; k++) {
      const rad = r(0.062, 0.078);
      dummy.position.set(-NW / 2 + 0.11 + k * ((NW - 0.2) / 7) + (row % 2) * 0.08, 0.075 + row * 0.14, D / 2 - 0.42 + r(-.04, .06));
      dummy.rotation.set(0, r(-.06, .06), r(0, TAU)); dummy.scale.set(rad, rad, 0.8); dummy.updateMatrix();
      logs.setMatrixAt(li++, dummy.matrix);
    }
  }
  logs.count = li; oven.add(logs);

  /* Herdplatte */
  const slab = addBox(W + 0.2, 0.1, D + 0.2, 0, HEARTH_Y - 0.05, 0, new THREE.MeshStandardMaterial({ color: 0xcdbb9e, map: grain, roughness: 0.7 }));
  slab.receiveShadow = true;

  if (dome) {
  /* Kuppel: Mörtelschale mit Öffnung */
  const shellGeo = holedHemisphere(A - 0.035, B - 0.035, (x, y, z) => inMouth(x, y, z, 0.07));
  const shell = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: 0xcdbb9c, roughness: 1, map: grain }));
  shell.position.y = HEARTH_Y; oven.add(shell);

  // Innenraum (von innen gesehen), vom Feuer beleuchtet
  const innerGeo = holedHemisphere(A - 0.16, B - 0.16, (x, y, z) => inMouth(x, y, z, 0.12));
  const inner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({ color: 0x5a2e1e, roughness: 0.95, side: THREE.BackSide, map: grain }));
  inner.position.y = HEARTH_Y; oven.add(inner);
  const floorIn = new THREE.Mesh(new THREE.CircleGeometry(A - 0.16, 40), new THREE.MeshStandardMaterial({ color: 0x4a2a1c, roughness: 1, map: grain }));
  floorIn.rotation.x = -Math.PI / 2; floorIn.position.y = HEARTH_Y + 0.003; oven.add(floorIn);

  // Steine der Kuppel
  const sand = [0xd8c7a5, 0xcdb48e, 0xe3d5bb, 0xc2a57f, 0xd6bf98, 0xb99a73, 0xe8dcc4];
  const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stoneMat.clone(), 900);
  stones.material.color.set(0xffffff);
  let si = 0;
  const center = new THREE.Vector3(0, HEARTH_Y, 0);
  const rings = 16;
  for (let i = 0; i < rings; i++) {
    const th = (i + 0.5) * (1.42 / rings);
    const ringR = A * Math.cos(th);
    const circ = TAU * ringR;
    const count = Math.max(8, Math.round(circ / r(0.17, 0.21)));
    const off = (i % 2) * 0.5 + r(-.1, .1);
    for (let k = 0; k < count; k++) {
      const ph = (k + off) / count * TAU;
      const x = ringR * Math.sin(ph), y = B * Math.sin(th), z = ringR * Math.cos(ph);
      if (inMouth(x, y, z, -0.02)) continue;
      const n = new THREE.Vector3(x / (A * A), y / (B * B), z / (A * A)).normalize();
      const p = new THREE.Vector3(x, y, z).add(center).addScaledVector(n, r(-0.005, 0.012));
      dummy.position.copy(p); dummy.lookAt(p.clone().add(n)); dummy.rotateZ(r(-.07, .07));
      dummy.scale.set((circ / count) * r(0.9, 0.96), (1.42 / rings) * B * r(0.86, 0.94), r(0.035, 0.055));
      dummy.updateMatrix(); stones.setMatrixAt(si, dummy.matrix);
      const isBrick = rand() < 0.11;
      stones.setColorAt(si, col.set(isBrick ? pick(brickColors) : pick(sand)).offsetHSL(0, r(-.02, .02), r(-.035, .035)));
      si++;
    }
  }
  stones.count = si; stones.instanceMatrix.needsUpdate = true; stones.instanceColor.needsUpdate = true; oven.add(stones);
  // Scheitelkappe
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 6, 0, TAU, 0, 0.22), new THREE.MeshStandardMaterial({ color: 0xd2bc98, map: grain, roughness: 0.9 }));
  cap.scale.set(A + 0.03, B + 0.03, A + 0.03); cap.position.y = HEARTH_Y; oven.add(cap);

  // Relief-Medaillon (wie im Lokal)
  const med = new THREE.Group();
  const medMat = new THREE.MeshStandardMaterial({ color: 0xc58d58, roughness: 0.6, metalness: 0.05, map: grain });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 40), medMat); disc.rotation.x = Math.PI / 2; med.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.022, 10, 48), medMat); med.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 40), medMat); ring2.position.z = 0.03; med.add(ring2);
  for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), medMat); const a = i / 12 * TAU; b.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0.03); med.add(b); }
  const mth = 0.78, mp = new THREE.Vector3(0, B * Math.sin(mth), A * Math.cos(mth));
  const mn = new THREE.Vector3(mp.x / (A * A), mp.y / (B * B), mp.z / (A * A)).normalize();
  med.position.copy(mp).add(center).addScaledVector(mn, 0.09); med.lookAt(med.position.clone().add(mn)); oven.add(med);

  // Ziegelbogen um die Öffnung (zwei Reihen + Schlussstein) und Laibung
  const arch = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), brickMat, 80);
  let ai = 0;
  const rows = [[ARCH.inner, ARCH.inner + 0.11, 13], [ARCH.inner + 0.115, ARCH.outer, 15]];
  rows.forEach(([r0, r1, n], ri) => {
    const rm = (r0 + r1) / 2, len = r1 - r0;
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) / n * Math.PI;
      const isKey = ri === 1 && k === (n - 1) / 2;
      dummy.position.set(Math.cos(a) * rm, HEARTH_Y + ARCH.spring + Math.sin(a) * rm, ARCH.face - ARCH.depth / 2 + (isKey ? 0.03 : 0));
      dummy.rotation.set(0, 0, a - Math.PI / 2 + r(-.02, .02));
      dummy.scale.set((Math.PI * rm / n) * 0.9, len * (isKey ? 1.18 : 0.96), ARCH.depth + (isKey ? 0.06 : 0));
      dummy.updateMatrix(); arch.setMatrixAt(ai, dummy.matrix);
      arch.setColorAt(ai, col.set(isKey ? 0xb4653f : pick(brickColors)).offsetHSL(0, 0, r(-.04, .04))); ai++;
    }
  });
  for (const s of [-1, 1]) for (let j = 0; j < 2; j++) {
    const w = ARCH.outer - ARCH.inner;
    dummy.position.set(s * (ARCH.inner + w / 2), HEARTH_Y + 0.055 + j * 0.112, ARCH.face - ARCH.depth / 2);
    dummy.rotation.set(0, 0, r(-.02, .02)); dummy.scale.set(w * 0.96, 0.1, ARCH.depth); dummy.updateMatrix();
    arch.setMatrixAt(ai, dummy.matrix); arch.setColorAt(ai, col.set(pick(brickColors))); ai++;
  }
  arch.count = ai; arch.instanceMatrix.needsUpdate = true; arch.instanceColor.needsUpdate = true; oven.add(arch);
  }

  /* Feuer: Glut, Scheite, Flammen, Pizza */
  const fire = new THREE.Group(); fire.position.copy(opts.fireAt || new THREE.Vector3(-0.12, HEARTH_Y, -0.42)); oven.add(fire);
  const ember = emberMaterial();
  for (let i = 0; i < 4; i++) {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, opts.logLen || 0.75, 10), ember);
    lg.rotation.set(Math.PI / 2, 0, (i - 1.5) * 0.5 + r(-.1, .1)); lg.position.set((i - 1.5) * 0.1, 0.07 + (i % 2) * 0.06, r(-.05, .05)); fire.add(lg);
  }
  const coals = new THREE.Mesh(new THREE.CircleGeometry(opts.logLen ? 0.3 : 0.42, 24), ember); coals.rotation.x = -Math.PI / 2; coals.position.y = 0.01; coals.scale.set(1, 0.7, 1); fire.add(coals);
  const flames = [];
  const flameSet = opts.lowPower ? 4 : 7;
  for (let i = 0; i < flameSet; i++) {
    const m = flameMaterial(i * 3.17, r(0.85, 1.25));
    const f = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
    const s = r(0.42, 0.7);
    f.scale.set(s * r(0.7, 0.95), s * r(1.15, 1.55), 1);
    f.position.set(r(-.28, .28), f.scale.y / 2 + 0.02, r(-.15, .15));
    f.userData.base = f.position.clone(); flames.push(f); fire.add(f);
  }
  const pizza = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 36), [new THREE.MeshStandardMaterial({ color: 0xc98a45, roughness: .8 }), new THREE.MeshStandardMaterial({ map: pizzaTexture(), roughness: .7 }), new THREE.MeshStandardMaterial({ color: 0xc98a45 })]);
  pizza.position.copy(opts.pizzaAt || new THREE.Vector3(0.22, HEARTH_Y + 0.015, 0.25)); if (!opts.noPizza) oven.add(pizza);

  // Licht vom Feuer
  const fireLight = new THREE.PointLight(0xff7a2a, 6, 3.2, 1.6); fireLight.position.copy(fire.position).add(new THREE.Vector3(0.02, 0.35, 0.12)); oven.add(fireLight);
  const mouthLight = new THREE.PointLight(0xff8a3a, 1.1, 3.2, 2); mouthLight.position.set(0, fire.position.y + 0.35, ARCH.face + 0.25); oven.add(mouthLight);
  // Glühen vor der Öffnung
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,140,60,.55)', 'rgba(255,80,20,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  if (dome) glow.position.set(0, HEARTH_Y + 0.32, ARCH.face + 0.02); else { glow.position.copy(fire.position).add(new THREE.Vector3(0, 0.3, -0.05)); glow.scale.setScalar(0.8); }
  oven.add(glow);

  // Funkenflug
  const N = opts.lowPower ? 80 : 170;
  const sparkGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), life = new Float32Array(N), vel = [];
  for (let i = 0; i < N; i++) { resetSpark(i, true); }
  function resetSpark(i, initial) {
    pos[i * 3] = fire.position.x + r(-.2, .2); pos[i * 3 + 1] = fire.position.y + r(.05, .3); pos[i * 3 + 2] = fire.position.z + r(-.1, .2);
    vel[i] = new THREE.Vector3(r(-.12, .12), r(.3, .75), r(.4, .95));
    life[i] = initial ? rand() : 0;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.05, map: glowTexture('rgba(255,220,150,1)', 'rgba(255,120,30,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffb060 }));
  oven.add(sparks);

  const smokeTex = glowTexture('rgba(190,175,160,.55)', 'rgba(120,110,100,0)');
  const smoke = [];
  const SN = opts.lowPower ? 8 : 16;
  for (let i = 0; i < SN; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.userData.t = i / SN; sp.userData.x = r(-.15, .15); sp.userData.rot = r(-.4, .4); oven.add(sp); smoke.push(sp);
  }
  const smokeTop = opts.smokeTop || (HEARTH_Y + 1.0);
  oven.userData = {
    HEARTH_Y, ARCH, flames, ember, fireLight, mouthLight, glow,
    update(t, dt, camera, stageRot = 0) {
      ember.uniforms.uTime.value = t;
      for (const f of flames) {
        f.material.uniforms.uTime.value = t;
        // Flammen drehen sich zur Kamera (nur um die Hochachse)
        const wp = f.getWorldPosition(new THREE.Vector3());
        f.rotation.y = Math.atan2(camera.position.x - wp.x, camera.position.z - wp.z) - stageRot;
      }
      const flick = 0.78 + 0.22 * Math.sin(t * 11.3) * Math.sin(t * 7.1 + 1.3) + 0.08 * Math.sin(t * 23.0);
      fireLight.intensity = 6.5 * flick; mouthLight.intensity = 1.1 * (0.85 + 0.15 * flick);
      glow.material.opacity = 0.75 + 0.25 * flick;
      for (let i = 0; i < N; i++) {
        life[i] += dt * 0.38;
        if (life[i] > 1 || pos[i * 3 + 2] > ARCH.face + 2.6) resetSpark(i);
        // Funken steigen, werden zur Öffnung gesogen, verlöschen
        const ins = pos[i * 3 + 2] < ARCH.face;
        pos[i * 3] += vel[i].x * dt;
        pos[i * 3 + 1] += vel[i].y * dt * (ins ? 0.45 : 1.0);
        pos[i * 3 + 2] += vel[i].z * dt;
        const yMax = HEARTH_Y + (ins ? ARCH.spring + ARCH.inner - 0.06 : 3.0);
        if (pos[i * 3 + 1] > yMax) pos[i * 3 + 1] = yMax;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      for (const sp of smoke) {
        const u = (sp.userData.t += dt * 0.09) % 1;
        // steigt bis unter das Gewölbe, zieht dann nach vorne aus der Öffnung
        const rise = Math.min(1, u * 1.6), out = Math.max(0, u * 1.6 - 1) / 0.6;
        sp.position.set(fire.position.x + sp.userData.x + Math.sin(t * .6 + sp.userData.rot * 9) * .06,
          THREE.MathUtils.lerp(fire.position.y + .35, smokeTop, rise) + out * .55,
          fire.position.z + out * (ARCH.face - fire.position.z + .9));
        const sc = 0.35 + u * 1.1; sp.scale.set(sc, sc, 1);
        sp.material.opacity = Math.sin(Math.PI * u) * 0.16;
        sp.material.rotation += dt * sp.userData.rot * 0.3;
      }
    }
  };
  return oven;
}

// Halbkugel (Ellipsoid) mit ausgeschnittener Öffnung
function holedHemisphere(a, b, cut) {
  const g = new THREE.SphereGeometry(1, 64, 24, 0, TAU, 0, Math.PI / 2).toNonIndexed();
  const p = g.attributes.position, uv = g.attributes.uv;
  const keepP = [], keepUV = [];
  for (let i = 0; i < p.count; i += 3) {
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < 3; j++) { cx += p.getX(i + j) * a; cy += p.getY(i + j) * b; cz += p.getZ(i + j) * a; }
    if (cut(cx / 3, cy / 3, cz / 3)) continue;
    for (let j = 0; j < 3; j++) { keepP.push(p.getX(i + j) * a, p.getY(i + j) * b, p.getZ(i + j) * a); keepUV.push(uv.getX(i + j) * 6, uv.getY(i + j) * 3); }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(keepUV, 2));
  out.computeVertexNormals();
  return out;
}

/* ---------- Szene ---------- */
export function mountOven(canvas, { getProgress = () => 0, reducedMotion = false, onReady, shiftX = () => 0, shiftY = () => 0, modelUrl = null } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const lowPower = Math.min(window.innerWidth, window.innerHeight) < 600 || (navigator.hardwareConcurrency || 4) <= 4;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  let composer = null, bloom = null;
  const css = getComputedStyle(document.documentElement);
  const night = new THREE.Color(css.getPropertyValue('--c-night').trim() || '#14100d');
  const scene = new THREE.Scene(); scene.background = night; scene.fog = new THREE.Fog(night, 9, 18);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);

  try {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), lowPower ? 0.42 : 0.5, 0.45, 0.92);
    composer.addPass(bloom); composer.addPass(new OutputPass());
  } catch (e) { composer = null; }
  scene.add(new THREE.HemisphereLight(0xffe6cc, 0x140c08, 0.45));
  const key = new THREE.DirectionalLight(0xfff1de, 1.55); key.position.set(-3.5, 6, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb3d6, 0.55); rim.position.set(4, 3, -5); scene.add(rim);

  // Boden mit warmem Lichtschein
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x1b1511, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,140,60,.28)', 'rgba(255,90,30,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.01, 2.2); scene.add(pool);

  const stage = new THREE.Group(); scene.add(stage);
  let oven = null, mode = 'glb';
  const KEY = {
    // Innenansicht: Kamera bleibt vor dem offenen Ofen, schwenkt sanft und fährt näher ans Feuer
    glb: { interior: true, sweep: 0.24, start: { d: 3.9, dp: 4.6, h: 2.3, ty: 1.6, tz: -0.12 }, end: { d: 2.55, dp: 3.2, h: 1.85, ty: 1.46, tz: -0.36 } },
    proc: { rot0: -0.85, start: { d: 8.2, dp: 13.5, h: 2.9, ty: 1.15, tz: 0 }, end: { d: 3.9, dp: 6.2, h: 1.55, ty: 1.28, tz: 0.9 } }
  };
  function useProcedural() { mode = 'proc'; oven = buildOven({ lowPower }); stage.add(oven); onReady && onReady(); }
  if (modelUrl) {
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(modelUrl, (gltf) => {
      // Modell: aufgeschnittener Ofen, Öffnung zeigt nach +z. Breite 1,155 -> 2,3 Einheiten
      const HEARTH_Y = 1.05, S = 2.3 / 1.155;
      const model = gltf.scene; model.scale.setScalar(S); model.position.set(0, HEARTH_Y + 0.425 * S, 0);
      const floorY = HEARTH_Y + (0.425 - 0.318) * S;
      oven = buildOven({
        lowPower, dome: false,
        fireAt: new THREE.Vector3(-0.08 * S, floorY, -0.17 * S), logLen: 0.44,
        noPizza: true,
        arch: { face: 0.97, spring: 0.62, inner: 0.5 }, smokeTop: HEARTH_Y + (0.425 + 0.15) * S
      });
      oven.add(model); stage.add(oven); onReady && onReady();
    }, undefined, () => useProcedural());
  } else useProcedural();

  // Ziegelbogen im Hintergrund – wie die Bögen im Gastraum
  scene.add(backArch());

  // Drehen per Ziehen (mit Trägheit)
  let drag = 0, dragVel = 0, dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; dragVel = dx * 0.006; drag += dragVel; });
  const end = () => { dragging = false; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  // Pfeiltasten (Canvas ist fokussierbar)
  canvas.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') { dragVel = -0.06; } if (e.key === 'ArrowRight') { dragVel = 0.06; } });

  const view = { w: 1, h: 1, sx: 0, sy: 0 };
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    view.w = w; view.h = h; view.sx = shiftX(w, h); view.sy = shiftY(w, h);
  }
  new ResizeObserver(resize).observe(canvas); resize();

  let visible = true, running = true, t = 0, last = performance.now(), smooth = 0, px = 0, pointerX = 0;
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pointerX = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0 }).observe(canvas);
  document.addEventListener('visibilitychange', () => { running = !document.hidden; last = performance.now(); });

  const target = new THREE.Vector3(), camPos = new THREE.Vector3();
  const ease = (x) => x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !running) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    const p = reducedMotion ? 0 : getProgress();
    smooth += (p - smooth) * Math.min(1, dt * 6);
    if (!dragging) { dragVel *= Math.pow(0.04, dt); drag += dragVel; }
    const idle = reducedMotion ? 0 : t * 0.05;
    // Eine volle Drehung über den Hero, Ende frontal
    const K = KEY[mode];
    let rot;
    if (K.interior) {
      // leichtes Schwenken: Scroll von links nach rechts, Maus kippt mit, in Ruhe pendelt es langsam
      drag = Math.max(-0.3, Math.min(0.3, drag));
      px += (pointerX - px) * Math.min(1, dt * 2.5);
      rot = (smooth - 0.5) * 2 * K.sweep + (reducedMotion ? 0 : Math.sin(t * 0.32) * 0.035) + drag + px * 0.07;
    } else {
      // Drehung über den Hero: von hinten bis die Öffnung frontal zeigt
      rot = K.rot0 + smooth * (TAU - K.rot0) + drag + idle * (1 - smooth);
    }
    stage.rotation.y = rot;
    // Kamera: Totale -> an die Ofenöffnung
    const k = KEY[mode].interior ? ease(smooth) : ease(Math.min(1, Math.max(0, (smooth - 0.55) / 0.45)));
    // Hochformat: stufenlos etwas zurück, damit die Öffnung ins Bild passt (Tablet kaum, Handy mehr)
    const pf = Math.min(1, Math.max(0, (0.9 - camera.aspect) / 0.42));
    const a = K.start, b = K.end, L = THREE.MathUtils.lerp;
    const dist = L(L(a.d, a.dp, pf), L(b.d, b.dp, pf), k);
    const height = L(a.h, b.h, k);
    target.set(0, L(a.ty, b.ty, k), L(a.tz, b.tz, k));
    camPos.set(0, height, dist);
    camera.position.copy(camPos); camera.lookAt(target);
    const f = 1 - k; // Versatz löst sich bei der Fahrt in die Öffnung auf
    if (view.sx || view.sy) camera.setViewOffset(view.w, view.h, -view.w * view.sx * f, view.h * view.sy * f, view.w, view.h);
    if (oven) oven.userData.update(t, dt, camera, stage.rotation.y);
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return { renderer, scene };
}

function backArch() {
  const g = new THREE.Group();
  const grain = grainTexture(128, 170, 230, 40);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: grain, roughness: 0.9 });
  const n = 34, R = 3.9, im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n + 40);
  const d = new THREE.Object3D(), c = new THREE.Color(); let i = 0;
  const cols = [0x6e2b1f, 0x7a3022, 0x8e3b2a, 0x5e241a];
  for (let k = 0; k < n; k++) {
    const a = (k + 0.5) / n * Math.PI;
    d.position.set(Math.cos(a) * R, 2.6 + Math.sin(a) * R, -4.6); d.rotation.set(0, 0, a - Math.PI / 2);
    d.scale.set(Math.PI * R / n * 0.9, 0.42, 0.3); d.updateMatrix(); im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set(pick(cols)).offsetHSL(0, 0, r(-.03, .03))); i++;
  }
  for (const s of [-1, 1]) for (let j = 0; j < 20; j++) {
    d.position.set(s * R, 0.07 + j * 0.13, -4.6); d.rotation.set(0, 0, 0); d.scale.set(0.42, 0.115, 0.3); d.updateMatrix();
    im.setMatrixAt(i, d.matrix); im.setColorAt(i, c.set(pick(cols))); i++;
  }
  im.count = i; g.add(im);
  return g;
}
