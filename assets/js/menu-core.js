// Gemeinsame Logik für Speisekarte, Startseite, Admin und Druck
export const API_MENU = '/api/menu';
const FALLBACK = new URL('../../data/menu.json', import.meta.url);

/** Lädt die aktuelle Karte: zuerst vom Backend, sonst die mitgelieferte menu.json */
export async function loadMenu() {
  try {
    const r = await fetch(API_MENU, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return { menu: await r.json(), source: 'api' };
  } catch (e) { /* offline oder ohne Backend */ }
  const r = await fetch(FALLBACK, { cache: 'no-store' });
  return { menu: await r.json(), source: 'file' };
}

/** 12.9 -> "12,9" · 15 -> "15" · 15.5 -> "15,5" (ohne Nullen am Ende) */
export function formatPrice(n, prefix) {
  if (n === null || n === undefined || n === '' || isNaN(n)) return '';
  const v = Math.round(Number(n) * 100) / 100;
  let s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace('.', ',');
  return (prefix ? prefix + ' ' : '') + s;
}
export function parsePrice(str) {
  if (typeof str === 'number') return str;
  const v = parseFloat(String(str).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return isNaN(v) ? null : v;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function visibleSections(menu) {
  return (menu.sections || []).filter((s) => !s.hidden).map((s) => ({
    ...s, groups: (s.groups || []).map((g) => ({ ...g, items: (g.items || []).filter((i) => !i.hidden) })).filter((g) => g.items.length)
  })).filter((s) => s.groups.length);
}
export function allItems(menu) {
  const out = [];
  for (const s of visibleSections(menu)) for (const g of s.groups) for (const i of g.items) out.push({ ...i, section: s, group: g });
  return out;
}
export function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString('de-AT', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; }
}
