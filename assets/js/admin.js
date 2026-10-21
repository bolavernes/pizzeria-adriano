// Admin: Speisekarte bearbeiten
import { esc, formatPrice, parsePrice, formatDate } from './menu-core.js';

const $ = (id) => document.getElementById(id);
const AL = 'ABCDEFGHLMNOPR'.split('');
const ICONS = { pumpkin: 'Kürbis', olive: 'Olivenzweig', bowl: 'Suppe', leaf: 'Salatblatt', pasta: 'Pasta', tomato: 'Tomaten', oven: 'Holzofen', rosemary: 'Rosmarin', fish: 'Fisch', wheat: 'Ähre', espresso: 'Espresso', '': '– keine –' };
const svg = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3l18 18M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 14l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 10l6 6 6-6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};

/* ---------------- API (mit Demo-Modus ohne Backend) ---------------- */
let DEMO = false;
const LS = { draft: 'adriano-draft', demoMenu: 'adriano-demo-menu', demoVer: 'adriano-demo-versions', print: 'adriano-print-draft' };
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};
async function call(path, opts = {}) {
  const r = await fetch('/api/admin/' + path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opts });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || 'Fehler ' + r.status); e.status = r.status; throw e; }
  return data;
}
async function seed() { return (await fetch(new URL('../../data/menu.json', import.meta.url))).json(); }
const api = {
  async session() {
    try {
      const r = await fetch('/api/admin/session', { credentials: 'same-origin' });
      if (r.status === 404 || !(r.headers.get('content-type') || '').includes('json')) { DEMO = true; }
      else return (await r.json()).authed;
    } catch { DEMO = true; }
    return sessionStorage.getItem('adriano-demo-auth') === '1';
  },
  async login(pw) {
    if (DEMO) { if (pw !== 'demo') throw new Error('Passwort ist falsch. (Vorschau: demo)'); sessionStorage.setItem('adriano-demo-auth', '1'); return; }
    await call('login', { method: 'POST', body: JSON.stringify({ password: pw }) });
  },
  async logout() { if (DEMO) { sessionStorage.removeItem('adriano-demo-auth'); return; } await call('logout', { method: 'POST' }); },
  async get() { return DEMO ? (ls.get(LS.demoMenu) || await seed()) : call('menu'); },
  async save(m) {
    if (DEMO) {
      const prev = ls.get(LS.demoMenu); const v = ls.get(LS.demoVer) || [];
      if (prev) { v.unshift({ id: prev.updatedAt, at: prev.updatedAt, menu: prev }); ls.set(LS.demoVer, v.slice(0, 15)); }
      const out = { ...m, updatedAt: new Date().toISOString() }; ls.set(LS.demoMenu, out); return out;
    }
    return (await call('menu', { method: 'PUT', body: JSON.stringify(m) })).menu;
  },
  async versions() { return DEMO ? (ls.get(LS.demoVer) || []).map(({ id, at }) => ({ id, at })) : (await call('versions')).versions; },
  async restore(id) {
    if (DEMO) { const v = (ls.get(LS.demoVer) || []).find((x) => x.id === id); if (!v) throw new Error('Nicht gefunden'); return api.save(v.menu); }
    return (await call('restore', { method: 'POST', body: JSON.stringify({ id }) })).menu;
  }
};

/* ---------------- Zustand ---------------- */
let menu, savedJSON = '', sel = 0, q = '';
const undo = [];
let typingSnap = null;
const snapshot = () => { undo.push(JSON.stringify(menu)); if (undo.length > 60) undo.shift(); $('undo').disabled = false; };
function snapshotTyping() { if (!typingSnap) snapshot(); clearTimeout(typingSnap); typingSnap = setTimeout(() => typingSnap = null, 900); }
const isDirty = () => JSON.stringify(menu) !== savedJSON;
function changed() {
  const d = isDirty();
  $('save').disabled = !d;
  const st = $('status');
  st.classList.toggle('dirty', d);
  st.textContent = d ? 'Ungespeicherte Änderungen' : (menu.updatedAt ? 'Gespeichert · ' + formatDate(menu.updatedAt) + ', ' + new Date(menu.updatedAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }) : 'Gespeichert');
  if (d) ls.set(LS.draft, { at: new Date().toISOString(), base: menu.updatedAt, menu }); else ls.del(LS.draft);
  renderNav();
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2600); }
const newId = () => 'neu-' + Math.random().toString(36).slice(2, 8);

/* ---------------- Rendering ---------------- */
function renderNav() {
  $('sec-nav').innerHTML = menu.sections.map((s, i) => {
    const n = s.groups.reduce((a, g) => a + g.items.length, 0);
    return `<div class="sn ${i === sel && !q ? 'is-active' : ''} ${s.hidden ? 'is-hidden' : ''}" data-nav="${i}" tabindex="0" role="button">
      <span class="t">${esc(s.title)}</span><span class="c">${n}</span>
      <button data-sup="${i}" title="Nach oben" aria-label="Kategorie nach oben">▲</button><button data-sdown="${i}" title="Nach unten" aria-label="Kategorie nach unten">▼</button></div>`;
  }).join('');
}
function itemRow(it, si, gi, ii) {
  const al = new Set((it.allergens || '').split(''));
  return `<div class="item ${it.hidden ? 'is-hidden' : ''}" data-s="${si}" data-g="${gi}" data-i="${ii}" draggable="false">
    <div class="handle" title="Ziehen zum Verschieben" data-handle>⋮⋮</div>
    <div class="i-main">
      <input class="i-name" data-if="name" value="${esc(it.name)}" aria-label="Name">
      <textarea class="i-desc" data-if="desc" rows="1" placeholder="Beschreibung (optional)" aria-label="Beschreibung">${esc(it.desc || '')}</textarea>
    </div>
    <div class="i-price">
      <select data-if="pricePrefix" aria-label="Preiszusatz"><option value="">–</option><option value="je" ${it.pricePrefix === 'je' ? 'selected' : ''}>je</option></select>
      <input data-if="price" value="${esc(formatPrice(it.price))}" inputmode="decimal" aria-label="Preis in Euro">
    </div>
    <div class="i-act">
      <button data-act="up" title="Nach oben" aria-label="Nach oben">${svg.up}</button>
      <button data-act="down" title="Nach unten" aria-label="Nach unten">${svg.down}</button>
      <button data-act="hide" title="${it.hidden ? 'Einblenden' : 'Ausblenden (z. B. ausverkauft)'}" aria-label="Sichtbarkeit">${it.hidden ? svg.eyeOff : svg.eye}</button>
      <button data-act="dup" title="Duplizieren" aria-label="Duplizieren">${svg.copy}</button>
      <button data-act="del" title="Löschen" aria-label="Löschen">${svg.trash}</button>
    </div>
    <div class="i-meta">
      <div class="als" role="group" aria-label="Allergene">${AL.map((a) => `<button class="al" data-al="${a}" aria-pressed="${al.has(a)}" title="${esc(menu.allergens?.[a] || a)}">${a}</button>`).join('')}</div>
      <div class="flags">
        <label><input type="checkbox" data-if="vegetarian" ${it.vegetarian ? 'checked' : ''}> fleischlos</label>
        <label><input type="checkbox" data-if="vegan" ${it.vegan ? 'checked' : ''}> vegan</label>
        <label><input type="checkbox" data-if="spicy" ${it.spicy ? 'checked' : ''}> scharf</label>
      </div>
      <div class="extra">
        <input data-if="badge" value="${esc(it.badge || '')}" placeholder="Hinweis, z. B. hausgemacht" aria-label="Hinweis">
        <input data-if="highlight" value="${esc(it.highlight || '')}" placeholder="Hervorheben als Kasten …" aria-label="Hervorhebung">
      </div>
    </div>
  </div>`;
}
function renderMain() {
  const main = $('main');
  const keepScroll = scrollY;
  if (q) {
    const nq = q.toLowerCase();
    let rows = '';
    menu.sections.forEach((s, si) => s.groups.forEach((g, gi) => g.items.forEach((it, ii) => {
      if ((it.name + ' ' + (it.desc || '')).toLowerCase().includes(nq)) rows += `<p class="f" style="margin:10px 0 2px">${esc(s.title)}${g.title ? ' · ' + esc(g.title) : ''}</p><div class="items">${itemRow(it, si, gi, ii)}</div>`;
    })));
    main.innerHTML = `<div class="search-hint">Suchergebnisse für „${esc(q)}“ – Änderungen wirken direkt auf die Karte.</div>${rows || '<p>Nichts gefunden.</p>'}`;
  } else {
    const s = menu.sections[sel]; if (!s) { main.innerHTML = ''; return; }
    main.innerHTML = `
      <section class="sec-form" data-s="${sel}">
        <h2>${esc(s.title)}</h2>
        <label class="f">Titel <input data-sf="title" value="${esc(s.title)}"></label>
        <label class="f">Untertitel <input data-sf="subtitle" value="${esc(s.subtitle || '')}"></label>
        <label class="f full">Hinweistext (optional) <input data-sf="note" value="${esc(s.note || '')}"></label>
        <label class="f">Illustration <select data-sf="icon">${Object.entries(ICONS).map(([k, v]) => `<option value="${k}" ${(s.icon || '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <div class="checks">
          <label><input type="checkbox" data-sf="hidden" ${s.hidden ? 'checked' : ''}> Kategorie ausblenden</label>
          <label><input type="checkbox" data-sf="season" ${s.style === 'season' ? 'checked' : ''}> Als Saison-Kasten zeigen</label>
          <label><input type="checkbox" data-sf="compact" ${s.compact ? 'checked' : ''}> Kompakte Liste (wie Pizzen)</label>
          <label><input type="checkbox" data-sf="newPage" ${s.newPage ? 'checked' : ''}> Im Druck auf neuer Seite beginnen</label>
        </div>
        <div class="sec-actions"><button class="b ghost small" data-sact="addgroup">+ Untergruppe</button><button class="b ghost small" data-sact="delsec">Kategorie löschen</button></div>
      </section>
      ${s.groups.map((g, gi) => `
        <div class="group" data-s="${sel}" data-g="${gi}">
          <div class="group-head">
            <label class="f">Untergruppe <input data-gf="title" value="${esc(g.title || '')}" placeholder="(ohne Überschrift)"></label>
            <label class="f">Hinweis <input data-gf="note" value="${esc(g.note || '')}"></label>
            <label class="f">Tipp unter der Gruppe <input data-gf="tip" value="${esc(g.tip || '')}" placeholder="z. B. Dazu passt …"></label>
            <button class="b ghost small" data-gact="delgroup" ${s.groups.length < 2 ? 'disabled' : ''}>Gruppe löschen</button>
          </div>
          <div class="items" data-drop="${gi}">${g.items.map((it, ii) => itemRow(it, sel, gi, ii)).join('')}</div>
          <button class="b ghost small add-item" data-gact="additem">+ Gericht hinzufügen</button>
        </div>`).join('')}`;
  }
  main.querySelectorAll('.i-desc').forEach(autosize);
  scrollTo(0, keepScroll);
}
function autosize(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }
function render() { renderNav(); renderMain(); }

/* ---------------- Bearbeiten ---------------- */
const itemAt = (el) => { const r = el.closest('.item'); return r && { s: +r.dataset.s, g: +r.dataset.g, i: +r.dataset.i, row: r, it: menu.sections[+r.dataset.s].groups[+r.dataset.g].items[+r.dataset.i] }; };

function onInput(e) {
  const t = e.target;
  if (t.dataset.if) {
    const x = itemAt(t); if (!x) return;
    const f = t.dataset.if;
    if (t.type === 'checkbox') { snapshot(); x.it[f] = t.checked || undefined; }
    else if (f === 'price') {
      const v = parsePrice(t.value); const ok = t.value.trim() === '' || v !== null;
      t.classList.toggle('bad', !ok); if (!ok) return; snapshotTyping(); x.it.price = t.value.trim() === '' ? null : v;
    } else { snapshotTyping(); x.it[f] = t.value || undefined; if (f === 'desc') autosize(t); }
    changed(); return;
  }
  if (t.dataset.sf) {
    const s = menu.sections[sel]; const f = t.dataset.sf;
    if (t.type === 'checkbox') {
      snapshot();
      if (f === 'season') s.style = t.checked ? 'season' : undefined; else s[f] = t.checked || undefined;
    } else { snapshotTyping(); s[f] = t.value || (f === 'title' ? 'Ohne Titel' : undefined); if (f === 'title') $('main').querySelector('.sec-form h2').textContent = t.value; }
    changed(); return;
  }
  if (t.dataset.gf) {
    const gEl = t.closest('.group'); const g = menu.sections[+gEl.dataset.s].groups[+gEl.dataset.g];
    snapshotTyping(); g[t.dataset.gf] = t.value || (t.dataset.gf === 'title' ? null : undefined); changed();
  }
}
async function onClick(e) {
  const t = e.target.closest('button, [data-nav]'); if (!t) return;
  if (t.dataset.al) {
    const x = itemAt(t); snapshot();
    const set = new Set((x.it.allergens || '').split('').filter(Boolean));
    set.has(t.dataset.al) ? set.delete(t.dataset.al) : set.add(t.dataset.al);
    x.it.allergens = AL.filter((a) => set.has(a)).join('');
    t.setAttribute('aria-pressed', set.has(t.dataset.al)); changed(); return;
  }
  if (t.dataset.act) {
    const x = itemAt(t); const list = menu.sections[x.s].groups[x.g].items;
    if (t.dataset.act === 'del') { if (!await confirmDlg(`„${x.it.name}“ wirklich löschen?`)) return; snapshot(); list.splice(x.i, 1); }
    else {
      snapshot();
      if (t.dataset.act === 'up' && x.i > 0) [list[x.i - 1], list[x.i]] = [list[x.i], list[x.i - 1]];
      if (t.dataset.act === 'down' && x.i < list.length - 1) [list[x.i + 1], list[x.i]] = [list[x.i], list[x.i + 1]];
      if (t.dataset.act === 'hide') x.it.hidden = !x.it.hidden || undefined;
      if (t.dataset.act === 'dup') list.splice(x.i + 1, 0, { ...structuredClone(x.it), id: newId(), name: x.it.name + ' (Kopie)', highlight: undefined });
    }
    changed(); renderMain(); return;
  }
  if (t.dataset.gact) {
    const gEl = t.closest('.group'); const s = menu.sections[+gEl.dataset.s]; const gi = +gEl.dataset.g;
    snapshot();
    if (t.dataset.gact === 'additem') { s.groups[gi].items.push({ id: newId(), name: 'Neues Gericht', price: null, allergens: '' }); changed(); renderMain(); const rows = $('main').querySelectorAll(`.group[data-g="${gi}"] .i-name`); const last = rows[rows.length - 1]; last?.focus(); last?.select(); return; }
    if (t.dataset.gact === 'delgroup') { if (s.groups[gi].items.length && !await confirmDlg('Untergruppe samt allen Gerichten löschen?')) { undo.pop(); return; } s.groups.splice(gi, 1); }
    changed(); renderMain(); return;
  }
  if (t.dataset.sact) {
    const s = menu.sections[sel];
    if (t.dataset.sact === 'addgroup') { snapshot(); s.groups.push({ title: 'Neue Untergruppe', items: [] }); }
    if (t.dataset.sact === 'delsec') { if (!await confirmDlg(`Kategorie „${s.title}“ mit allen Gerichten löschen?`)) return; snapshot(); menu.sections.splice(sel, 1); sel = Math.max(0, sel - 1); }
    changed(); render(); return;
  }
  if (t.dataset.sup || t.dataset.sdown) {
    e.stopPropagation(); const i = +(t.dataset.sup ?? t.dataset.sdown); const j = t.dataset.sup ? i - 1 : i + 1;
    if (j < 0 || j >= menu.sections.length) return; snapshot();
    [menu.sections[i], menu.sections[j]] = [menu.sections[j], menu.sections[i]]; if (sel === i) sel = j; else if (sel === j) sel = i;
    changed(); render(); return;
  }
  if (t.dataset.nav) { sel = +t.dataset.nav; q = ''; $('q').value = ''; render(); scrollTo(0, 0); }
}
function confirmDlg(text) {
  return new Promise((res) => {
    const d = $('dlg-confirm'); $('confirm-text').textContent = text; d.showModal();
    const done = (v) => { d.close(); $('confirm-yes').onclick = $('confirm-no').onclick = null; res(v); };
    $('confirm-yes').onclick = () => done(true); $('confirm-no').onclick = () => done(false); d.oncancel = () => done(false);
  });
}

/* Ziehen & Ablegen innerhalb einer Kategorie */
let dragFrom = null;
function setupDnD(main) {
  main.addEventListener('pointerdown', (e) => { const h = e.target.closest('[data-handle]'); if (h) h.closest('.item').draggable = true; });
  main.addEventListener('dragstart', (e) => { const x = itemAt(e.target); if (!x) return; dragFrom = x; x.row.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', x.it.id); });
  main.addEventListener('dragover', (e) => { const r = e.target.closest('.item'); if (!dragFrom || !r) return; e.preventDefault(); main.querySelectorAll('.drag-over').forEach((x) => x.classList.remove('drag-over')); r.classList.add('drag-over'); });
  main.addEventListener('drop', (e) => {
    const to = itemAt(e.target); if (!dragFrom || !to || to.s !== dragFrom.s) return; e.preventDefault(); snapshot();
    const src = menu.sections[dragFrom.s].groups[dragFrom.g].items; const [moved] = src.splice(dragFrom.i, 1);
    const dst = menu.sections[to.s].groups[to.g].items; let idx = to.i; if (dragFrom.g === to.g && dragFrom.i < to.i) idx--; dst.splice(Math.max(0, idx), 0, moved);
    dragFrom = null; changed(); renderMain();
  });
  main.addEventListener('dragend', () => { dragFrom = null; main.querySelectorAll('.item').forEach((r) => { r.draggable = false; r.classList.remove('is-dragging', 'drag-over'); }); });
}

/* ---------------- Speichern, Versionen, Druck ---------------- */
async function save() {
  if (!isDirty()) return;
  $('save').disabled = true; $('status').textContent = 'Speichere …';
  try {
    menu = await api.save(menu); savedJSON = JSON.stringify(menu); ls.del(LS.draft); changed(); renderMain(); toast('Gespeichert – die Karte ist online.');
  } catch (e) {
    $('save').disabled = false; $('status').textContent = 'Fehler: ' + e.message;
    if (e.status === 401) { toast('Sitzung abgelaufen – bitte neu anmelden. Ihre Änderungen bleiben als Entwurf erhalten.'); showLogin(); }
  }
}
async function showVersions() {
  const d = $('dlg-versions'); const ul = $('ver-list'); ul.innerHTML = '<li>Lade …</li>'; d.showModal();
  try {
    const v = await api.versions();
    ul.innerHTML = v.length ? v.map((x) => `<li><span>${esc(formatDate(x.at))}, ${esc(new Date(x.at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' }))}</span><button class="b small ghost" data-ver="${esc(x.id)}">Wiederherstellen</button></li>`).join('') : '<li>Noch keine älteren Versionen.</li>';
  } catch (e) { ul.innerHTML = `<li>${esc(e.message)}</li>`; }
}
$('ver-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-ver]'); if (!b) return;
  b.disabled = true; b.textContent = '…';
  try { menu = await api.restore(b.dataset.ver); savedJSON = JSON.stringify(menu); ls.del(LS.draft); $('dlg-versions').close(); render(); changed(); toast('Version wiederhergestellt.'); }
  catch (er) { b.textContent = er.message; }
});
function openPrint() { ls.set(LS.print, menu); window.open('druck/?entwurf=1', '_blank', 'noopener'); }

/* ---------------- Start ---------------- */
function showLogin() { $('app').hidden = true; $('login').hidden = false; $('pw').focus(); }
async function startEditor() {
  $('login').hidden = true; $('app').hidden = false;
  menu = await api.get(); savedJSON = JSON.stringify(menu);
  const draft = ls.get(LS.draft);
  if (draft && draft.menu && JSON.stringify(draft.menu) !== savedJSON) {
    $('restore').hidden = false; $('restore-at').textContent = formatDate(draft.at) + ', ' + new Date(draft.at).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
    $('restore-yes').onclick = () => { snapshot(); menu = draft.menu; $('restore').hidden = true; render(); changed(); };
    $('restore-no').onclick = () => { ls.del(LS.draft); $('restore').hidden = true; };
  }
  render(); changed();
}
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault(); $('login-err').textContent = '';
  try { await api.login($('pw').value); $('pw').value = ''; await startEditor(); }
  catch (er) { $('login-err').textContent = er.message; }
});
$('logout').addEventListener('click', async () => { if (isDirty() && !await confirmDlg('Es gibt ungespeicherte Änderungen. Trotzdem abmelden? (Der Entwurf bleibt in diesem Browser erhalten.)')) return; await api.logout(); showLogin(); });
$('save').addEventListener('click', save);
$('undo').addEventListener('click', () => { const s = undo.pop(); if (!s) return; menu = JSON.parse(s); if (sel >= menu.sections.length) sel = 0; render(); changed(); $('undo').disabled = !undo.length; });
$('btn-versions').addEventListener('click', showVersions);
$('btn-print').addEventListener('click', openPrint);
$('add-sec').addEventListener('click', () => { snapshot(); menu.sections.push({ id: newId(), title: 'Neue Kategorie', subtitle: '', groups: [{ title: null, items: [] }] }); sel = menu.sections.length - 1; changed(); render(); });
let qt; $('q').addEventListener('input', (e) => { clearTimeout(qt); qt = setTimeout(() => { q = e.target.value.trim(); render(); }, 150); });
const main = $('main'); main.addEventListener('input', onInput); main.addEventListener('change', (e) => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') onInput(e); });
document.addEventListener('click', onClick);
$('sec-nav').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.nav) e.target.click(); });
setupDnD(main);
addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); $('undo').click(); }
});
addEventListener('beforeunload', (e) => { if (menu && isDirty()) { e.preventDefault(); e.returnValue = ''; } });

(async () => {
  const authed = await api.session();
  $('demo-banner').hidden = !DEMO;
  authed ? startEditor() : showLogin();
})();
