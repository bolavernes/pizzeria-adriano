import { loadMenu, visibleSections, formatPrice, formatDate, esc } from './menu-core.js';
import { ILL } from './ills.js';

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
  return `<article class="${cls}" id="g-${esc(i.id)}">
    ${i.highlight ? `<span class="hl">${esc(i.highlight)}</span>` : ''}
    <div class="dish-head"><h3>${hl(i.name, q)}</h3>${flags}${!i.desc ? price : ''}</div>
    ${i.desc ? `<p class="dish-desc">${hl(i.desc, q)}${price}</p>` : ''}
    <p class="dish-al">${al.map((a) => `<abbr title="${esc(MENU.allergensLong?.[a] || MENU.allergens?.[a] || a)}">${esc(a)}</abbr>`).join('')}</p>
  </article>`;
}
function render() {
  let shown = 0;
  const html = SECS.map((s) => {
    const compact = !!s.compact;
    const groups = s.groups.map((g) => {
      const items = g.items.filter((i) => matches(i, s));
      shown += items.length;
      if (!items.length) return '';
      return `${g.title ? `<h3 class="mk-group-title">${esc(g.title)}</h3>` : ''}${g.note ? `<p class="mk-group-note">${esc(g.note)}</p>` : ''}
        <div class="mk-grid">${items.map((i) => dish(i, s, compact)).join('')}</div>${g.tip ? `<p class="mk-tip">${esc(g.tip)}</p>` : ''}`;
    }).join('');
    if (!groups) return '';
    return `<section class="mk-sec ${s.style === 'season' ? 'mk-season' : ''} ${compact ? 'compact' : ''}" id="${esc(s.id)}" aria-labelledby="h-${esc(s.id)}">
      <div class="mk-sec-head">${ILL[s.icon] || ''}<h2 id="h-${esc(s.id)}">${esc(s.title)}</h2>${s.subtitle ? `<span class="sub">${esc(s.subtitle)}</span>` : ''}</div>
      ${s.note ? `<p class="mk-sec-note">${esc(s.note)}</p>` : ''}${groups}</section>`;
  }).join('');
  $('mk-sections').innerHTML = html;
  $('mk-empty').hidden = shown > 0;
  const n = (state.veg + state.vegan + state.spicy) + state.noAl.size;
  $('mk-fcount').textContent = n ? n : '';
  renderCats();
}
function renderCats() {
  const present = [...document.querySelectorAll('.mk-sec')].map((s) => s.id);
  $('mk-cats').innerHTML = SECS.filter((s) => present.includes(s.id)).map((s) => `<a href="#${esc(s.id)}" data-id="${esc(s.id)}">${esc(s.title)}</a>`).join('');
  spy();
}
let spyObs;
function spy() {
  spyObs?.disconnect();
  spyObs = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      const a = $('mk-cats').querySelector(`[data-id="${e.target.id}"]`);
      $('mk-cats').querySelectorAll('a').forEach((x) => x.classList.toggle('is-active', x === a));
      a?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    });
  }, { rootMargin: '-160px 0px -65% 0px' });
  document.querySelectorAll('.mk-sec').forEach((s) => spyObs.observe(s));
}

loadMenu().then(({ menu }) => {
  MENU = menu; SECS = visibleSections(menu);
  if (menu.updatedAt) $('mk-updated').textContent = 'Stand: ' + formatDate(menu.updatedAt);
  $('mk-al').innerHTML = Object.entries(menu.allergens || {}).map(([k, v]) => `<label class="tg"><input type="checkbox" data-al="${esc(k)}" aria-label="Ohne ${esc(v)}"> <b>${esc(k)}</b> ${esc(v)}</label>`).join('');
  $('mk-legend').innerHTML = `<h2>Allergeninformation</h2><dl>${Object.entries(menu.allergensLong || menu.allergens || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <p>Allergenkennzeichnung gemäß Codex-Empfehlung, jeweils inklusive daraus gewonnener Erzeugnisse. * fleischlos · ${esc(menu.footer || '')}</p>`;
  render();
  if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
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
