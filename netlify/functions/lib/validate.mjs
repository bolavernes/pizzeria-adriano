// Prüft und bereinigt eine Speisekarte, bevor sie gespeichert wird
class Invalid extends Error { constructor(m) { super(m); this.status = 400; } }
const AL = new Set('ABCDEFGHLMNOPR'.split(''));
const str = (v, max) => (v === undefined || v === null) ? undefined : String(v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max) || undefined;
const id = (v, i) => (String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60)) || 'eintrag-' + i;

export function cleanMenu(input, base) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.sections)) throw new Invalid('Ungültige Speisekarte');
  if (input.sections.length > 40) throw new Invalid('Zu viele Kategorien');
  let count = 0; const seen = new Set();
  const uniq = (x) => { let k = x, n = 2; while (seen.has(k)) k = `${x}-${n++}`; seen.add(k); return k; };
  const sections = input.sections.map((s, si) => ({
    id: uniq(id(s.id, si)),
    title: str(s.title, 80) || 'Ohne Titel',
    subtitle: str(s.subtitle, 120) || '',
    note: str(s.note, 400),
    style: s.style === 'season' ? 'season' : undefined,
    icon: str(s.icon, 20),
    compact: s.compact ? true : undefined,
    hidden: s.hidden ? true : undefined,
    newPage: s.newPage ? true : undefined,
    groups: (Array.isArray(s.groups) ? s.groups : []).slice(0, 20).map((g) => ({
      title: str(g.title, 80) || null,
      note: str(g.note, 400), tip: str(g.tip, 200),
      items: (Array.isArray(g.items) ? g.items : []).slice(0, 120).map((i, ii) => {
        if (++count > 600) throw new Invalid('Zu viele Gerichte');
        const price = (i.price === null || i.price === undefined || i.price === '') ? NaN : Number(i.price);
        return {
          id: uniq(id(i.id || i.name, `${si}-${ii}`)),
          name: str(i.name, 120) || 'Neues Gericht',
          price: isFinite(price) && price >= 0 && price < 10000 ? Math.round(price * 100) / 100 : null,
          pricePrefix: i.pricePrefix === 'je' ? 'je' : undefined,
          desc: str(i.desc, 500),
          allergens: [...new Set(String(i.allergens || '').toUpperCase().split(''))].filter((c) => AL.has(c)).sort().join(''),
          vegetarian: i.vegetarian ? true : undefined,
          vegan: i.vegan ? true : undefined,
          spicy: i.spicy ? true : undefined,
          badge: str(i.badge, 40),
          highlight: str(i.highlight, 60),
          hidden: i.hidden ? true : undefined
        };
      })
    }))
  }));
  return {
    schema: 1,
    updatedAt: new Date().toISOString(),
    footer: str(input.footer, 200) || base?.footer || '',
    allergens: base?.allergens || input.allergens,
    allergensLong: base?.allergensLong || input.allergensLong,
    print: { targetPages: Math.min(8, Math.max(1, parseInt(input.print?.targetPages) || 4)) },
    sections: JSON.parse(JSON.stringify(sections)) // entfernt undefined
  };
}
