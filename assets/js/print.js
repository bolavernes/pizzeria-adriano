// Druckversion: setzt die Karte automatisch auf A4-Seiten
import { loadMenu, visibleSections, formatPrice, esc, formatDate } from './menu-core.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

const $ = (id) => document.getElementById(id);
// Logo als Vektor einbetten (druckt gestochen scharf, Farbe über CSS)
const svgText = (n) => fetch(new URL(`../img/${n}`, import.meta.url)).then((r) => r.text()).catch(() => '');
const [LOGO_FULL, LOGO_WORD] = await Promise.all([svgText('logo-adriano-lockup.svg'), svgText('logo-adriano.svg')]);
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
  return `<div class="ft"><div class="gh"></div><div class="fa">Allergene: ${al}</div><div class="fr"><span>* fleischlos</span><span class="pn">${n}</span><span>${esc(MENU.footer || '')}</span></div></div>`;
}
function newPage(n, first, season) {
  const pg = document.createElement('section'); pg.className = 'page';
  pg.innerHTML = (first ? `<header class="mast"><h1 class="mlogo">${LOGO_FULL || 'Adriano'}</h1><div class="tl">${ILL.oliveL}<span>Holzofenpizza · Pasta · Pesce · Wallensteinstraße 54</span>${ILL.olive}</div><div class="gh"></div></header>` : `<div class="rh"><span class="rlogo">${LOGO_WORD || 'Adriano'}</span><div class="gh"></div></div>`)
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
      if (g.title) out.push({ html: `<h3 class="gt">${esc(g.title)}</h3>`, keep: true, gt: true });
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
    const endMin = end;
    // Feste Regel gegen verwaiste Überschriften: eine Kategorie beginnt nur dort, wo auch ein guter Teil ihrer Gerichte Platz hat.
    // Kleine Kategorien (bis 8 Gerichte) bleiben ganz zusammen, große nehmen mindestens 40 % (min. 4) Gerichte mit.
    // Zwischentitel (z. B. „Gnocchi“) bleiben mit mindestens 2 Gerichten zusammen.
    if (blk.sec || blk.gt) {
      let total = 0; for (let k = b + 1; k < list.length && !list[k].spacer && !(blk.gt && list[k].gt); k++) if (!list[k].keep && !list[k].spacer) total++;
      const need = blk.sec ? (total <= 8 ? total : Math.max(4, Math.ceil(total * 0.4))) : Math.min(2, total);
      let got = 0, k = b;
      while (k + 1 < list.length && got < need) { k++; if (list[k].spacer) { k--; break; } if (!list[k].keep) got++; }
      end = Math.max(end, k);
    }
    let unit = list.slice(b, end + 1);
    const place = () => {
      const col = cols[ci]; const nodes = [];
      for (const u of unit) { tmp.innerHTML = u.html; const el = tmp.firstElementChild; col.append(el); nodes.push(el); }
      if (col.scrollHeight > col.clientHeight + 1) { nodes.forEach((x) => x.remove()); return false; }
      return true;
    };
    if (blk.spacer && !cols[ci].childElementCount) continue;
    if (!place()) {
      if (blk.spacer) continue;
      // Hurenkind vermeiden: bleiben nur 1–2 Gerichte für die neue Spalte, wandern die letzten Gerichte davor mit
      let carry = [];
      if (!blk.keep) {
        let rest = 0; for (let k = b; k < list.length && !list[k].spacer; k++) if (!list[k].keep) rest++;
        if (rest <= 2) {
          const kids = [...cols[ci].children]; const tail = [];
          for (let k = kids.length - 1; k >= 0 && tail.length < 3 - rest; k--) { const e = kids[k]; if (e.classList.contains('it') || e.classList.contains('sig')) tail.unshift(e); else break; }
          // Zwischentitel direkt davor wandert mit
          let prev = tail.length ? tail[0].previousElementSibling : null;
          while (prev && (prev.classList.contains('gt') || prev.classList.contains('note'))) { tail.unshift(prev); prev = prev.previousElementSibling; }
          if (tail.length && tail.length < kids.length) carry = tail;
        }
      }
      carry.forEach((e) => e.remove());
      nextCol();
      carry.forEach((e) => cols[ci].append(e));
      let ok = place();
      if (!ok && end > endMin) { end = endMin; unit = list.slice(b, end + 1); ok = place(); }
      if (!ok) { // passt nicht einmal in eine leere Spalte: trotzdem setzen
        for (const u of unit) { tmp.innerHTML = u.html; cols[ci].append(tmp.firstElementChild); }
      }
    }
    b = end;
  }
  return n;
}
function widow() {
  return [...document.querySelectorAll('.col')].some((c) => {
    const kids = [...c.children]; if (!kids.length || kids[0].classList.contains('sh')) return false;
    let n = 0; for (const k of kids) { if (k.classList.contains('sh') || k.classList.contains('spacer')) break; if (k.classList.contains('it') || k.classList.contains('sig')) n++; }
    const rest = kids.slice(n).some((k) => k.classList.contains('it') || k.classList.contains('sh'));
    return n > 0 && n <= 2 && (rest || kids.length <= 3);
  });
}
function fit() {
  let pages = layout();
  if (!manual) {
    while (pages > target && scale > 0.72) { scale = Math.round((scale - 0.03) * 100) / 100; pages = layout(); }
    // Hurenkinder vermeiden: höchstens zwei Gerichte allein oben in einer Spalte → Schrift minimal verkleinern
    for (let t = 0; t < 4 && widow() && scale > 0.72; t++) { scale = Math.round((scale - 0.01) * 100) / 100; pages = layout(); }
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
