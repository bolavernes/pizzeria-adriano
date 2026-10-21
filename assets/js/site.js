import { loadMenu, visibleSections, formatPrice, esc } from './menu-core.js';
import { ILL } from './ills.js';

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
  import('./oven.js').then(({ mountOven }) => mountOven(canvas, {
    getProgress: progress, reducedMotion: reduced,
    modelUrl: new URL('../models/pizzaofen.glb', import.meta.url).href,
    onReady: () => canvas.classList.remove('is-loading'),
    shiftX: (w, h) => (w / h > 1.15 ? 0.2 : 0),
    shiftY: (w, h) => (w / h < 0.9 ? 0.2 : 0)
  })).catch(() => document.documentElement.classList.add('no-webgl'));
} else document.documentElement.classList.add('no-webgl');

/* Karte: Kategorien & Saison aus den echten Daten */
loadMenu().then(({ menu }) => {
  const secs = visibleSections(menu);
  const list = document.getElementById('cat-list');
  if (list) list.innerHTML = secs.filter((s) => s.style !== 'season').map((s) => `
    <li><a href="speisekarte/#${esc(s.id)}">${ILL[s.icon] || ''}<span class="t">${esc(s.title)}</span><span class="s">${esc(s.subtitle || '')}</span></a></li>`).join('');
  const season = secs.find((s) => s.style === 'season');
  const box = document.getElementById('season');
  if (season && box) {
    const items = season.groups.flatMap((g) => g.items);
    box.innerHTML = `<h3>${ILL[season.icon] || ''}${esc(season.title)}</h3><p class="when">${esc(season.subtitle || '')}</p>
      <ul>${items.map((i) => `<li><span class="n">${esc(i.name)}</span><span class="p">${esc(formatPrice(i.price, i.pricePrefix))}</span>${i.desc ? `<div class="d">${esc(i.desc)}</div>` : ''}</li>`).join('')}</ul>
      <a class="link" href="speisekarte/#${esc(season.id)}">In der Speisekarte ansehen</a>`;
    box.hidden = false;
  }
  const pizza = secs.find((s) => s.id === 'pizza');
  if (pizza) {
    const n = pizza.groups.filter((g) => !/zutat|teilen/i.test(g.title || '')).reduce((a, g) => a + g.items.length, 0);
    document.querySelectorAll('[data-count="pizza"]').forEach((el) => el.textContent = n);
  }
});

/* Galerie: Pfeile scrollen um ein Foto */
const gal = document.getElementById('gallery');
document.querySelectorAll('.gbtn').forEach((b) => b.addEventListener('click', () => {
  const step = gal.querySelector('.g-item')?.getBoundingClientRect().width || 300;
  gal.scrollBy({ left: +b.dataset.dir * (step + 20), behavior: reduced ? 'auto' : 'smooth' });
}));
