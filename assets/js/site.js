import { loadMenu, visibleSections, formatPrice, esc } from './menu-core.js?v=20261022';
import { toggleHTML, wireDialog } from './season.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Kopfzeile & mobiles Menü */
const head = document.getElementById('kopf');
const onScroll = () => head.classList.toggle('is-solid', scrollY > innerHeight * 0.6 || !document.getElementById('ofen'));
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
btn?.addEventListener('click', () => { const o = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? 'Navigation schließen' : 'Navigation öffnen'); });
nav?.addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', false); btn.setAttribute('aria-label', 'Navigation öffnen'); } });

/* Einblenden */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 80 + 'ms'; io.observe(el); });

/* Hero: Scroll-Fortschritt steuert Ofen und Texte */
const hero = document.getElementById('ofen');
const steps = [...document.querySelectorAll('.hero-step')];
const prog = document.getElementById('prog'), hint = document.getElementById('hint');
function progress() {
  const r = hero.getBoundingClientRect();
  const total = hero.offsetHeight - innerHeight;
  return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
}
/* Pic-Dump: beim „42 Pizzen“-Schritt fallen Pizzafotos nacheinander auf einen Stapel */
const dump = [...document.querySelectorAll('#picdump .pd')];
// [x %, y %, Drehung °, Breite vw] – Querformat (Ofen rechts) und Hochformat
const DUMP_L = [[50, 12, -8, 17], [72, 6, 6, 13], [60, 40, 4, 12], [82, 34, -7, 12], [46, 58, 7, 17], [68, 62, -5, 12], [86, 66, 9, 11], [56, 18, 11, 12], [76, 42, -3, 17], [44, 34, -12, 11], [64, 24, -6, 13], [88, 12, 5, 11]];
const DUMP_P = [[4, 9, -8, 46], [52, 7, 7, 38], [26, 18, 4, 34], [60, 26, -7, 34], [6, 34, 6, 44], [40, 38, -4, 34], [68, 44, 9, 28], [16, 12, 11, 30], [48, 20, -3, 46], [2, 24, -12, 30], [30, 30, -6, 36], [62, 10, 5, 30]];
function placeDump() {
  const P = innerWidth / innerHeight < 0.9 ? DUMP_P : DUMP_L;
  dump.forEach((f, i) => { const [x, y, r, w] = P[i % P.length]; f.style.setProperty('--x', x + '%'); f.style.setProperty('--y', y + '%'); f.style.setProperty('--r', r + 'deg'); f.style.setProperty('--w', w + 'vw'); });
}
if (dump.length) { placeDump(); addEventListener('resize', placeDump); }
function updateHero() {
  const p = progress();
  dump.forEach((f, i) => f.classList.toggle('is-in', p >= 0.72 + i * 0.019));
  steps.forEach((s) => s.classList.toggle('is-on', p >= +s.dataset.from && p < +s.dataset.to));
  if (prog) prog.style.height = (p * 100) + '%';
  if (hint) hint.style.opacity = p > 0.04 ? 0 : 1;
}
if (!reduced) { addEventListener('scroll', updateHero, { passive: true }); updateHero(); }

const canvas = document.getElementById('oven');
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
if (canvas && hasWebGL()) {
  canvas.classList.add('is-loading');
  import('./oven.js?v=20261022').then(({ mountOven }) => mountOven(canvas, {
    getProgress: progress, reducedMotion: reduced,
    modelUrl: new URL('../models/pizzaofen.glb?v=20261022', import.meta.url).href,
    onReady: () => canvas.classList.remove('is-loading'),
    shiftX: (w, h) => (w / h > 1.15 ? 0.15 : 0),
    shiftY: (w, h) => (w / h < 0.9 ? 0.2 * Math.min(1, (0.9 - w / h) / 0.3) : 0)
  })).catch(() => document.documentElement.classList.add('no-webgl'));
} else document.documentElement.classList.add('no-webgl');

/* Karte: Kategorien & Saison aus den echten Daten */
loadMenu().then(({ menu }) => {
  const rad = document.getElementById('pizzarad');
  if (rad) import('./pizzarad.js?v=20261022').then(({ mountPizzaRad }) => mountPizzaRad({ root: rad, menu, getProgress: progress, reduced }));
  const secs = visibleSections(menu);
  const list = document.getElementById('cat-list');
  if (list) {
    const count = (s) => s.groups.reduce((a, g) => a + g.items.length, 0);
    list.innerHTML = secs.filter((s) => s.style !== 'season').map((s, i) => `
    <li><a href="speisekarte/#${esc(s.id)}" data-photo="${esc(s.photo || '')}" data-cap="${esc(s.title)}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(s.title)}</span><span class="s">${esc(s.subtitle || '')}</span><span class="c">${count(s)}</span></a></li>`).join('');
    photoSwap(list);
  }
  const season = secs.find((s) => s.style === 'season');
  const box = document.getElementById('season'), sBtn = document.getElementById('season-btn'), sDlg = document.getElementById('season-dlg');
  if (season && box && sBtn && sDlg) {
    const items = season.groups.flatMap((g) => g.items);
    sBtn.innerHTML = toggleHTML(season, items.length);
    const sv = new URL('../video/pizza-zucca', import.meta.url).href;
    box.innerHTML = `<button class="sd-close" type="button" data-close aria-label="Schließen">×</button>
      <figure class="season-media"><video muted loop playsinline preload="none" poster="${sv}.webp" data-src="${sv}.mp4"></video></figure>
      <h3 id="season-h">${ILL[season.icon] || ''}${esc(season.title)}</h3><p class="when">${esc(season.subtitle || '')}</p>
      <ul>${items.map((i) => `<li><span class="n">${esc(i.name)}</span><span class="p">${esc(formatPrice(i.price, i.pricePrefix))}</span>${i.desc ? `<div class="d">${esc(i.desc)}</div>` : ''}</li>`).join('')}</ul>
      <a class="link" href="speisekarte/#${esc(season.id)}">In der Speisekarte ansehen</a>`;
    sBtn.hidden = false;
    wireDialog(sDlg, [sBtn]);
  }
  const pizza = secs.find((s) => s.id === 'pizza');
  if (pizza) {
    const n = pizza.groups.filter((g) => !/zutat|teilen/i.test(g.title || '')).reduce((a, g) => a + g.items.length, 0);
    document.querySelectorAll('[data-count="pizza"]').forEach((el) => el.textContent = n);
  }
});

/* Galerie: Reihen gleiten beim Runterscrollen gegenläufig weiter – und lassen sich seitlich wischen/ziehen */
const gsec = document.getElementById('kueche');
const tracks = [...document.querySelectorAll('.g-track')].map((el) => ({ el, row: el.firstElementChild, user: 0, auto: 0, ours: -1 }));
let gTick = false;
function moveRows() {
  gTick = false;
  const r = gsec.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (innerHeight - r.top) / (innerHeight + r.height)));
  tracks.forEach((t) => {
    const max = t.el.scrollWidth - t.el.clientWidth; if (max <= 0) return;
    const span = Math.min(max, t.row.scrollWidth * 0.3), dir = +t.row.dataset.dir;
    t.auto = reduced ? 0 : dir < 0 ? p * span : (1 - p) * span;
    const x = Math.round(Math.min(max, Math.max(0, t.auto + t.user)));
    if (Math.abs(t.el.scrollLeft - x) > 1) { t.ours = x; t.el.scrollLeft = x; }
  });
}
tracks.forEach((t) => {
  // eigenes Wischen merken, damit der Scroll-Lauf danach von dort weitergeht
  t.el.addEventListener('scroll', () => { if (Math.abs(t.el.scrollLeft - t.ours) <= 1) return; t.user = t.el.scrollLeft - t.auto; }, { passive: true });
  // Ziehen mit der Maus (Touch und Trackpad scrollen nativ)
  let down = false, sx = 0, sl = 0, moved = 0;
  t.el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') return; down = true; moved = 0; sx = e.clientX; sl = t.el.scrollLeft; t.el.classList.add('is-drag'); });
  addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - sx; moved = Math.max(moved, Math.abs(dx)); t.el.scrollLeft = sl - dx; });
  addEventListener('pointerup', () => { if (!down) return; down = false; t.el.classList.remove('is-drag'); });
  t.el.addEventListener('click', (e) => { if (moved > 6) { e.stopPropagation(); e.preventDefault(); moved = 0; } }, true);
  t.el.addEventListener('dragstart', (e) => e.preventDefault());
});
if (gsec) { addEventListener('scroll', () => { if (!gTick) { gTick = true; requestAnimationFrame(moveRows); } }, { passive: true }); addEventListener('resize', moveRows); moveRows(); }

/* Lightbox */
const lb = document.getElementById('lightbox');
const shots = JSON.parse(document.getElementById('gallery-data')?.textContent || '[]');
let cur = 0;
function show(i) {
  cur = (i + shots.length) % shots.length; const sh = shots[cur];
  const img = document.getElementById('lb-img'), vid = document.getElementById('lb-vid');
  if (sh.video) { img.hidden = true; vid.hidden = false; vid.poster = sh.src; vid.src = sh.video; vid.setAttribute('aria-label', sh.alt); vid.play().catch(() => {}); }
  else { vid.pause(); vid.removeAttribute('src'); vid.hidden = true; img.hidden = false; img.src = sh.src; img.alt = sh.alt; }
  document.getElementById('lb-cap').textContent = sh.cap;
}
lb?.addEventListener('close', () => { const v = document.getElementById('lb-vid'); v.pause(); });
document.getElementById('gallery')?.addEventListener('click', (e) => { const b = e.target.closest('.g-item'); if (!b) return; show(+b.dataset.i); lb.showModal(); });
lb?.addEventListener('click', (e) => { const b = e.target.closest('[data-lb]'); if (b) show(cur + +b.dataset.lb); else if (e.target === lb || e.target.tagName === 'FIGURE') lb.close(); });
lb?.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1); if (e.key === 'ArrowLeft') show(cur - 1); });

/* Kategorien: das Foto rechts wechselt weich zur gewählten Kategorie */
function photoSwap(list) {
  const fig = document.getElementById('karte-photo'); if (!fig) return;
  const A = fig.querySelector('.kp-a'), B = fig.querySelector('.kp-b'), cap = document.getElementById('karte-cap');
  const base = { src: A.currentSrc || A.src, cap: cap.textContent };
  let front = A, back = B, cur = base.src, t;
  const show = (src, text) => {
    if (src === cur) return; cur = src;
    back.onload = () => { back.classList.add('is-on'); front.classList.remove('is-on'); [front, back] = [back, front]; };
    back.src = src; cap.textContent = text;
  };
  const pick = (a) => { clearTimeout(t); const ph = a.dataset.photo; if (ph) show(new URL(`../img/foto/${ph}-800.webp`, import.meta.url).href, a.dataset.cap); };
  list.addEventListener('mouseover', (e) => { const a = e.target.closest('a'); if (a) pick(a); });
  list.addEventListener('focusin', (e) => { const a = e.target.closest('a'); if (a) pick(a); });
  list.addEventListener('mouseleave', () => { t = setTimeout(() => show(base.src, base.cap), 900); });
}

/* Stempel: wird beim ersten Sichtkontakt „aufgedrückt“ */
const stamp = document.querySelector('.karte .stamp');
if (stamp && !reduced) {
  stamp.classList.add('will-stamp');
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { setTimeout(() => { stamp.classList.remove('will-stamp'); stamp.classList.add('is-stamped'); }, 350); o.disconnect(); } }, { threshold: 0.6 }).observe(stamp);
}

/* Reels in der Galerie: laufen stumm, sobald sie im Bild sind */
const vidObs = new IntersectionObserver((es) => es.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduced) v.play().catch(() => {}); }
  else v.pause();
}), { rootMargin: '120px' });
document.querySelectorAll('video[data-src]').forEach((v) => vidObs.observe(v));

/* Karte erst nach Klick laden (Datenschutz) */
document.getElementById('map-load')?.addEventListener('click', () => {
  const box = document.getElementById('map-box');
  box.innerHTML = '<iframe title="Pizzeria Adriano auf Google Maps" src="https://www.google.com/maps?q=Pizzeria+Adriano,+Wallensteinstra%C3%9Fe+54,+1200+Wien&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
});
