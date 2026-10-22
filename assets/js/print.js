// Druckversion: setzt die Karte automatisch auf A4-Seiten
import { loadMenu, visibleSections, formatPrice, esc, formatDate } from './menu-core.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

const $ = (id) => document.getElementById(id);
let MENU, scale = 1, target = 4, manual = false;

function meta(i) {
  return (i.spicy ? ' <span class="tag">scharf</span>' : '') + (i.vegan ? ' <span class="tag">vegan</span>' : '') +
    (i.badge ? ` <span class="bdg">${esc(i.badge)}</span>` : '') + (i.allergens ? ` <span class="al">${esc(i.allergens)}</span>` : '');
}
const star = (i, s) => (i.vegetarian && s.id !== 'pizza' && s.id !== 'senza-carne' ? '*' : '');
function itemHTML(i, s) {
  const p = `<span class="pr">${esc(formatPrice(i.price, i.pricePrefix))}</span>`;
  let h;
  if (s.compact) h = `<div class="it ip"><span class="nm">${esc(i.name)}${star(i, s)}</span>${meta(i)}${i.desc ? ` <span class="inl">${esc(i.desc)}</span>` : ''}${p}</div>`;
  else h = i.desc ? `<div class="it"><div class="nm">${esc(i.name)}${star(i, s)}${meta(i)}</div><div class="ds">${esc(i.desc)}${p}</div></div>`
    : `<div class="it"><div class="nm">${esc(i.name)}${star(i, s)}${meta(i)}${p}</div></div>`;
  return i.highlight ? `<div class="sig"><div class="sigk">${esc(i.highlight)}</div>${h}</div>` : h;
}
function footer(n) {
  const al = Object.entries(MENU.allergens || {}).map(([k, v]) => `<b>${esc(k)}</b> ${esc(v)}`).join(' · ');
  return `<div class="ft"><div class="fa">Allergene: ${al}</div><div class="fr"><span>* fleischlos</span><span class="pn">${n}</span><span>${esc(MENU.footer || '')}</span></div></div>`;
}
function newPage(n, first, season) {
  const pg = document.createElement('section'); pg.className = 'page';
  pg.innerHTML = (first ? `<header class="mast"><div class="kick">Pizzeria · Ristorante</div><h1>Adriano</h1><div class="tl">${ILL.oliveL}<span>Holzofenpizza · Pasta · Pesce</span>${ILL.olive}</div></header>` : '<div class="rh">Pizzeria Adriano</div>')
    + (first && season ? season : '') + '<div class="cols"><div class="col"></div><div class="col"></div></div>' + footer(n);
  $('pages').append(pg);
  return [...pg.querySelectorAll('.col')];
}
function blocks(secs) {
  // Liste von Blöcken; keep=true hält den Block mit dem nächsten zusammen
  const out = [];
  for (const s of secs) {
    if (s.style === 'season') continue;
    out.push({ html: `<div class="sh"><h2>${esc(s.title)}</h2>${s.subtitle ? `<span class="sub">${esc(s.subtitle)}</span>` : ''}<div class="orn">${ILL[s.icon] || ''}</div></div>`, keep: true, newPage: s.newPage, sec: true });
    if (s.note) out.push({ html: `<p class="note">${esc(s.note)}</p>`, keep: true });
    for (const g of s.groups) {
      if (g.title) out.push({ html: `<h3 class="gt">${esc(g.title)}</h3>`, keep: true });
      g.items.forEach((i, idx) => out.push({ html: itemHTML(i, s) + (idx === g.items.length - 1 && g.note ? `<p class="note">${esc(g.note)}</p>` : '') }));
      if (g.tip) out.push({ html: `<p class="tip">${esc(g.tip)}</p>` });
    }
    out.push({ html: '<div class="spacer"></div>', spacer: true });
  }
  return out;
}
function layout() {
  document.documentElement.style.setProperty('--s', scale);
  $('pages').innerHTML = '';
  const secs = visibleSections(MENU);
  const se = secs.find((s) => s.style === 'season');
  const season = se ? `<section class="season"><div class="sk">${esc(se.subtitle || '')}</div><h2>${ILL[se.icon] || ''}${esc(se.title)}</h2><div class="kg">${se.groups.flatMap((g) => g.items).map((i) => itemHTML(i, se)).join('')}</div></section>` : '';
  let n = 1, cols = newPage(n, true, season), ci = 0;
  const tmp = document.createElement('div');
  const list = blocks(secs);
  const nextCol = () => { ci++; if (ci > 1) { n++; cols = newPage(n, false); ci = 0; } };
  for (let b = 0; b < list.length; b++) {
    const blk = list[b];
    if (blk.newPage && (ci > 0 || cols[0].childElementCount)) { n++; cols = newPage(n, false); ci = 0; }
    // Block plus alle "keep"-Nachfolger als Einheit setzen
    let end = b; while (list[end].keep && end + 1 < list.length) end++;
    const unit = list.slice(b, end + 1);
    const place = () => {
      const col = cols[ci]; const nodes = [];
      for (const u of unit) { tmp.innerHTML = u.html; const el = tmp.firstElementChild; col.append(el); nodes.push(el); }
      if (col.scrollHeight > col.clientHeight + 1) { nodes.forEach((x) => x.remove()); return false; }
      return true;
    };
    if (blk.spacer && !cols[ci].childElementCount) continue;
    if (!place()) {
      if (blk.spacer) continue;
      nextCol();
      if (!place()) { // passt nicht einmal in eine leere Spalte: trotzdem setzen
        for (const u of unit) { tmp.innerHTML = u.html; cols[ci].append(tmp.firstElementChild); }
      }
    }
    b = end;
  }
  return n;
}
function fit() {
  let pages = layout();
  if (!manual) {
    while (pages > target && scale > 0.72) { scale = Math.round((scale - 0.03) * 100) / 100; pages = layout(); }
  }
  $('info').textContent = `${pages} Seite${pages > 1 ? 'n' : ''} · Schrift ${Math.round(scale * 100)} %` + (MENU.updatedAt ? ' · Stand ' + formatDate(MENU.updatedAt) : '') + (pages > target ? ' – zu lang für das Seitenziel, bitte Ziel erhöhen' : '');
}

const draft = new URLSearchParams(location.search).has('entwurf') ? (() => { try { return JSON.parse(localStorage.getItem('adriano-print-draft')); } catch { return null; } })() : null;
(draft ? Promise.resolve({ menu: draft }) : loadMenu()).then(({ menu }) => {
  MENU = menu; target = menu.print?.targetPages || 4; $('target').value = String(target);
  document.fonts?.ready.then(fit) ?? fit();
});
$('smaller').onclick = () => { manual = true; scale = Math.max(0.6, scale - 0.03); fit(); };
$('bigger').onclick = () => { manual = true; scale = Math.min(1.3, scale + 0.03); fit(); };
$('target').onchange = (e) => { target = +e.target.value; manual = false; scale = 1; fit(); };
$('print').onclick = () => window.print();
