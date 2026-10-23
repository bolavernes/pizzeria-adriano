// Entwurf 2 (dunkel): Hero mit Ofen, laufende Bilder, Saison-Special, Kategorien-Karten, Reels
import { loadMenu, visibleSections, formatPrice, esc } from './menu-core.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const IMG = (p) => new URL(`../img/${p}`, import.meta.url).href;

/* Kopfzeile & Burger */
const head = $('kopf');
const onScroll = () => head.classList.toggle('is-solid', scrollY > innerHeight * 0.5);
addEventListener('scroll', onScroll, { passive: true }); onScroll();
const btn = document.querySelector('.menu-btn'), nav = $('nav');
btn?.addEventListener('click', () => { const o = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', o); btn.setAttribute('aria-label', o ? 'Navigation schließen' : 'Navigation öffnen'); });
nav?.addEventListener('click', (e) => { if (e.target.tagName === 'A') { nav.classList.remove('is-open'); btn.setAttribute('aria-expanded', false); } });

/* Einblenden */
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* Ofen: startet nah am Feuer, fährt beim Wegscrollen heraus */
const canvas = $('oven');
const heroProgress = () => Math.min(1, Math.max(0, scrollY / (innerHeight * 0.9)));
function hasWebGL() { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
if (canvas && hasWebGL()) {
  canvas.classList.add('is-loading');
  import('./oven.js?v=20261022').then(({ mountOven }) => mountOven(canvas, {
    getProgress: () => heroProgress() * 0.6, reducedMotion: reduced,
    modelUrl: new URL('../models/pizzaofen.glb?v=20261022', import.meta.url).href,
    onReady: () => canvas.classList.remove('is-loading')
  })).catch(() => document.documentElement.classList.add('no-webgl'));
} else document.documentElement.classList.add('no-webgl');

/* Videos laufen nur, wenn sie zu sehen sind */
const vObs = new IntersectionObserver((es) => es.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; if (!reduced) v.play().catch(() => {}); } else v.pause();
}), { rootMargin: '150px' });
document.querySelectorAll('video[data-src]').forEach((v) => vObs.observe(v));

/* Laufende Bild-Reihen im Weinrot-Block, an den Scroll gekoppelt */
const about = document.querySelector('.v2-about');
const rows = [...document.querySelectorAll('.v2-trow')];
let tick = false;
function moveRows() {
  tick = false; if (!about) return;
  const r = about.getBoundingClientRect();
  const p = (innerHeight - r.top) / (innerHeight + r.height);
  rows.forEach((row) => { const half = row.scrollWidth / 2, dir = +row.dataset.dir; const x = dir < 0 ? -p * half * 0.5 : -half * 0.5 + p * half * 0.5; row.style.transform = `translate3d(${x}px,0,0)`; });
}
if (!reduced) { addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(moveRows); } }, { passive: true }); addEventListener('resize', moveRows); moveRows(); }

/* Kategorien-Karten: Pfeile scrollen um eine Karte */
const cards = $('v2-cards');
document.querySelectorAll('.v2-cards-nav [data-dir]').forEach((b) => b.addEventListener('click', () => {
  const w = cards.querySelector('.v2-card')?.offsetWidth || 260;
  cards.scrollBy({ left: +b.dataset.dir * (w + 18), behavior: reduced ? 'auto' : 'smooth' });
}));

// Fotos je Kategorie (eigene Fotos und Standbilder aus den Reels)
const PHOTO = {
  antipasti: 'v2/antipasti.webp', minestre: 'v2/minestre.webp', insalate: 'foto/salat-scampi-800.webp', paste: 'foto/spaghetti-muscheln-800.webp',
  'senza-carne': 'foto/pasta-pesto-800.webp', pizza: 'foto/pizza-rucola-800.webp', carne: 'foto/tafel-800.webp', pesce: 'v2/pesce.webp',
  beilagen: 'foto/tafel-800.webp', dolci: 'foto/tiramisu-800.webp'
};

loadMenu().then(({ menu }) => {
  const secs = visibleSections(menu);
  // Karten
  cards.innerHTML = secs.filter((s) => s.style !== 'season').map((s) => {
    const n = s.groups.reduce((a, g) => a + g.items.length, 0);
    const ph = PHOTO[s.id] || (s.photo ? `foto/${s.photo}-800.webp` : 'foto/tafel-800.webp');
    return `<a class="v2-card" href="../speisekarte/#${esc(s.id)}"><span class="ph"><img src="${IMG(ph)}" alt="" loading="lazy" decoding="async"></span>
      <span class="bd"><span class="nm">${esc(s.title)}</span><span class="sb">${esc(s.subtitle || '')}</span><span class="ct">${n} Gerichte</span><span class="mehr">Mehr</span></span></a>`;
  }).join('');
  // Saison-Special
  const se = secs.find((s) => s.style === 'season'), box = $('v2-season');
  if (se && box) {
    const items = se.groups.flatMap((g) => g.items);
    box.innerHTML = `<p class="script">Saison-Special</p>${ILL[se.icon] || ''}<h2>${esc(se.title)}</h2><p class="when">${esc(se.subtitle || '')} – solange es Kürbis und Sturm gibt.</p>
      <ul class="sp-list">${items.map((i) => `<li><span class="n">${esc(i.name)}</span><span class="p">${esc(formatPrice(i.price, i.pricePrefix))}</span>${i.desc ? `<span class="d">${esc(i.desc)}</span>` : ''}</li>`).join('')}</ul>
      <a class="pill" href="../speisekarte/#${esc(se.id)}">In der Speisekarte</a>`;
  } else document.querySelector('.v2-special')?.remove();
});

/* Karte erst nach Klick laden (Datenschutz) */
$('map-load')?.addEventListener('click', () => {
  $('map-box').innerHTML = '<iframe title="Pizzeria Adriano auf Google Maps" src="https://www.google.com/maps?q=Pizzeria+Adriano,+Wallensteinstra%C3%9Fe+54,+1200+Wien&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>';
});
