import { loadMenu, visibleSections, formatPrice, formatDate, esc } from './menu-core.js?v=20261022';
import { ILL } from './ills.js?v=20261022';
import { toggleHTML, wireDialog } from './season.js?v=20261022';
const IMG = (n, w) => new URL(`../img/foto/${n}-${w}.webp`, import.meta.url).href;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Kopfzeile (mobil) */
const btn = document.querySelector('.menu-btn'), nav = document.getElementById('nav');
btn?.addEventListener('click', () => { const o = nav.classList.toggle('is-open'); btn.setAttribute('aria-expanded', o); btn.textContent = o ? 'Schließen' : 'Menü'; });

const $ = (id) => document.getElementById(id);
const state = { q: '', veg: false, vegan: false, spicy: false, noAl: new Set() };
let MENU, SECS;

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function hl(text, q) {
  const t = esc(text); if (!q) return t;
  const i = norm(text).indexOf(q); if (i < 0) return t;
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}
function isVegan(i, s) { return i.vegan || (s.id === 'pizza' && i.vegetarian); }
function matches(i, s) {
  if (state.veg && !(i.vegetarian || i.vegan || s.id === 'senza-carne')) return false;
  if (state.vegan && !isVegan(i, s)) return false;
  if (state.spicy && !i.spicy) return false;
  if (state.noAl.size && i.allergens && [...state.noAl].some((a) => i.allergens.includes(a))) return false;
  if (state.q) { const hay = norm(i.name + ' ' + (i.desc || '')); if (!hay.includes(state.q)) return false; }
  return true;
}
function dish(i, s, compact) {
  const q = state.q;
  const al = (i.allergens || '').split('').filter(Boolean);
  const flags = [
    i.badge ? `<span class="flag badge">${esc(i.badge)}</span>` : '',
    i.spicy ? '<span class="flag spicy">scharf</span>' : '',
    i.vegan ? '<span class="flag vegan">vegan</span>' : '',
    (i.vegetarian && s.id !== 'pizza' && s.id !== 'senza-carne') ? '<span class="flag veg">fleischlos</span>' : ''
  ].join('');
  const price = `<span class="price">${esc(formatPrice(i.price, i.pricePrefix))}</span>`;
  const cls = ['dish', i.highlight ? 'is-highlight' : '', q && norm(i.name).includes(q) ? 'is-hit' : '', (state.noAl.size && !al.length) ? 'no-al-info' : ''].join(' ');
  return `<article class="${cls}" id="g-${esc(i.id)}" style="--d:${(dish.n = (dish.n || 0) + 1) % 6}">
    ${i.highlight ? `<span class="hl">${esc(i.highlight)}</span>` : ''}
    <div class="dish-head"><h3>${hl(i.name, q)}</h3>${flags}<span class="lead-dots" aria-hidden="true"></span>${price}</div>
    ${i.desc ? `<p class="dish-desc">${hl(i.desc, q)}</p>` : ''}
    <p class="dish-al">${al.map((a) => `<abbr title="${esc(MENU.allergensLong?.[a] || MENU.allergens?.[a] || a)}">${esc(a)}</abbr>`).join('')}</p>
  </article>`;
}
const active = () => !!(state.q || state.veg || state.vegan || state.spicy || state.noAl.size);
function secHTML(s, groups, idp = '') {
  return `<section class="mk-sec ${s.style === 'season' ? 'mk-season' : ''} ${s.compact ? 'compact' : ''}" ${idp ? '' : `id="${esc(s.id)}"`} aria-labelledby="h-${idp}${esc(s.id)}">
      ${idp ? '<button class="sd-close" type="button" data-close aria-label="Schließen">×</button>' : ''}
      <div class="mk-sec-head">${ILL[s.icon] || ''}<h2 id="h-${idp}${esc(s.id)}">${s.style === 'season' ? '' : `<span class="mk-no">${String(SECS.filter((x) => x.style !== 'season').indexOf(s) + 1).padStart(2, '0')}</span>`}${esc(s.title)}</h2>${s.subtitle ? `<span class="sub">${esc(s.subtitle)}</span>` : ''}</div>
      ${s.photo ? `<figure class="mk-photo"><img src="${IMG(s.photo, 1400)}" srcset="${IMG(s.photo, 800)} 800w, ${IMG(s.photo, 1400)} 1400w" sizes="(max-width: 760px) 100vw, 1200px" alt="" loading="lazy" decoding="async"></figure>` : ''}
      ${s.note ? `<p class="mk-sec-note">${esc(s.note)}</p>` : ''}${groups}</section>`;
}
let openSeason = () => {};
function render() {
  let shown = 0, seasonDlg = '';
  const html = SECS.map((s) => {
    const compact = !!s.compact;
    let count = 0;
    const groups = s.groups.map((g) => {
      const items = g.items.filter((i) => matches(i, s));
      shown += items.length; count += items.length;
      if (!items.length) return '';
      return `${g.title ? `<h3 class="mk-group-title">${esc(g.title)}</h3>` : ''}${g.note ? `<p class="mk-group-note">${esc(g.note)}</p>` : ''}
        <div class="mk-grid">${items.map((i) => dish(i, s, compact)).join('')}</div>${g.tip ? `<p class="mk-tip">${esc(g.tip)}</p>` : ''}`;
    }).join('');
    if (!groups) return '';
    // Saison: ohne Suche/Filter zugeklappt, öffnet als Fenster
    if (s.style === 'season' && !active()) {
      seasonDlg = secHTML(s, groups, 'dlg-');
      return `<section class="mk-sec mk-season-mini" id="${esc(s.id)}" aria-label="${esc(s.title)}"><button class="season-toggle" type="button" data-season aria-haspopup="dialog" aria-controls="season-dlg">${toggleHTML(s, count)}</button></section>`;
    }
    return secHTML(s, groups);
  }).join('');
  $('mk-sections').innerHTML = html;
  $('season-dlg').innerHTML = seasonDlg;
  openSeason = wireDialog($('season-dlg'), [...document.querySelectorAll('[data-season]')]);
  animate();
  $('mk-empty').hidden = shown > 0;
  const n = (state.veg + state.vegan + state.spicy) + state.noAl.size;
  $('mk-fcount').textContent = n ? n : '';
  renderCats();
}
function renderCats() {
  const present = [...document.querySelectorAll('#mk-sections .mk-sec')].map((s) => s.id);
  $('mk-cats').innerHTML = SECS.filter((s) => present.includes(s.id)).map((s) => `<a href="#${esc(s.id)}" data-id="${esc(s.id)}">${esc(s.title)}</a>`).join('');
  spy();
}
/* Bewegung: Illustrationen zeichnen sich, Gerichte gleiten herein, Fotos mit Parallaxe */
let inObs;
function animate() {
  if (reduced) return;
  document.querySelectorAll('#mk-sections .mk-sec-head .ill').forEach((svg) => svg.querySelectorAll('path, ellipse, circle, line').forEach((el) => {
    try { const L = el.getTotalLength(); el.style.strokeDasharray = L; el.style.strokeDashoffset = L; } catch { }
  }));
  inObs?.disconnect();
  inObs = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); inObs.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('#mk-sections .mk-sec-head, #mk-sections .dish, #mk-sections .mk-photo').forEach((el) => { el.classList.add('will-in'); inObs.observe(el); });
}
let pTick = false;
function parallax() {
  pTick = false;
  document.querySelectorAll('.mk-photo img').forEach((img) => {
    const r = img.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    img.style.transform = `translate3d(0, ${p * -60}px, 0) scale(1.12)`;
  });
}
if (!reduced) addEventListener('scroll', () => { if (!pTick) { pTick = true; requestAnimationFrame(parallax); } }, { passive: true });
function moveIndicator(a) {
  const bar = $('mk-cats'); let ind = bar.querySelector('.mk-ind');
  if (!ind) { ind = document.createElement('span'); ind.className = 'mk-ind'; bar.prepend(ind); }
  if (!a) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1; ind.style.width = a.offsetWidth + 'px'; ind.style.transform = `translateX(${a.offsetLeft}px)`;
}
let spyObs;
function spy() {
  spyObs?.disconnect();
  spyObs = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const a = $('mk-cats').querySelector(`[data-id="${e.target.id}"]`);
      $('mk-cats').querySelectorAll('a').forEach((x) => x.classList.toggle('is-active', x === a));
      moveIndicator(a);
      a?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }, { rootMargin: '-160px 0px -65% 0px' });
  document.querySelectorAll('#mk-sections .mk-sec').forEach((s) => spyObs.observe(s));
}

loadMenu().then(({ menu }) => {
  MENU = menu; SECS = visibleSections(menu);
  if (menu.updatedAt) $('mk-updated').textContent = 'Stand: ' + formatDate(menu.updatedAt);
  $('mk-al').innerHTML = Object.entries(menu.allergens || {}).map(([k, v]) => `<label class="tg"><input type="checkbox" data-al="${esc(k)}" aria-label="Ohne ${esc(v)}"> <b>${esc(k)}</b> ${esc(v)}</label>`).join('');
  $('mk-legend').innerHTML = `<h2>Allergeninformation</h2><dl>${Object.entries(menu.allergensLong || menu.allergens || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <p>Allergenkennzeichnung gemäß Codex-Empfehlung, jeweils inklusive daraus gewonnener Erzeugnisse. * fleischlos · ${esc(menu.footer || '')}</p>`;
  render();
  if (location.hash) {
    const t = document.getElementById(location.hash.slice(1));
    t?.scrollIntoView();
    if (t?.classList.contains('mk-season-mini')) openSeason();
  }
});

/* Bedienung */
let qt;
$('mk-q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { state.q = norm(e.target.value.trim()); render(); }, 120); });
$('mk-filter-btn').addEventListener('click', () => { const f = $('mk-filters'); f.hidden = !f.hidden; $('mk-filter-btn').setAttribute('aria-expanded', !f.hidden); });
$('mk-filters').addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.f) state[t.dataset.f] = t.checked;
  if (t.dataset.al) t.checked ? state.noAl.add(t.dataset.al) : state.noAl.delete(t.dataset.al);
  render();
});
function reset() { state.veg = state.vegan = state.spicy = false; state.noAl.clear(); state.q = ''; $('mk-q').value = ''; $('mk-filters').querySelectorAll('input').forEach((i) => i.checked = false); render(); }
$('mk-reset').addEventListener('click', reset); $('mk-reset2').addEventListener('click', reset);

/* Kategorie „Saison“ in der Leiste öffnet das Fenster */
$('mk-cats').addEventListener('click', (e) => {
  const a = e.target.closest('a'); if (!a) return;
  if (document.getElementById(a.dataset.id)?.classList.contains('mk-season-mini')) { e.preventDefault(); openSeason(); }
});
