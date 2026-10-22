import { loadMenu, visibleSections, formatPrice, esc } from './menu-core.js?v=20261022';
import { toggleHTML, wireDialog } from './season.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Kopfzeile & mobiles Menü */
const head = document.getElementById('kopf');
const onScroll = () => head.classList.toggle('is-solid', scrollY > innerHeight * 0.6 || !document.getElementById('ofen'));
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
btn?.addEventListener('click', () => { const o = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', o); btn.textContent = o ? 'Schließen' : 'Menü'; });
nav?.addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', false); btn.textContent = 'Menü'; } });

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
function updateHero() {
  const p = progress();
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
    box.innerHTML = `<button class="sd-close" type="button" data-close aria-label="Schließen">×</button>
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

/* Galerie: Reihen gleiten gegenläufig, gekoppelt an den Scroll */
const gsec = document.getElementById('kueche');
const rowsEl = [...document.querySelectorAll('.g-row')];
let gTick = false;
function moveRows() {
  gTick = false;
  const r = gsec.getBoundingClientRect();
  const p = (innerHeight - r.top) / (innerHeight + r.height); // 0 … 1, während die Galerie durchs Bild läuft
  rowsEl.forEach((row) => {
    const half = row.scrollWidth / 2, dir = +row.dataset.dir;
    const x = dir < 0 ? -p * half * 0.55 : -half * 0.55 + p * half * 0.55;
    row.style.transform = `translate3d(${x}px,0,0)`;
  });
}
if (gsec && !reduced) { addEventListener('scroll', () => { if (!gTick) { gTick = true; requestAnimationFrame(moveRows); } }, { passive: true }); addEventListener('resize', moveRows); moveRows(); }

/* Lightbox */
const lb = document.getElementById('lightbox');
const shots = JSON.parse(document.getElementById('gallery-data')?.textContent || '[]');
let cur = 0;
function show(i) { cur = (i + shots.length) % shots.length; const sh = shots[cur]; const img = document.getElementById('lb-img'); img.src = sh.src; img.alt = sh.alt; document.getElementById('lb-cap').textContent = sh.cap; }
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
