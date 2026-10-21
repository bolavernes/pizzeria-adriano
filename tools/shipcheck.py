#!/usr/bin/env python3
# shipcheck - statische Pruefung eines fertigen Website-Ordners (nur stdlib)
import sys, os, re, json, glob
from html.parser import HTMLParser

class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []; self.title = ''; self.headings = []; self.jsonld = []
        self._in_title = False; self._h = None; self._script = None
    def handle_starttag(self, tag, attrs):
        d = dict(attrs); self.tags.append((tag, d))
        if tag == 'title': self._in_title = True
        if tag in ('h1','h2','h3','h4','h5','h6'): self._h = [int(tag[1]), '']
        if tag == 'script' and d.get('type') == 'application/ld+json': self._script = ''
    def handle_endtag(self, tag):
        if tag == 'title': self._in_title = False
        if tag in ('h1','h2','h3','h4','h5','h6') and self._h:
            self.headings.append((self._h[0], self._h[1].strip())); self._h = None
        if tag == 'script' and self._script is not None:
            self.jsonld.append(self._script); self._script = None
    def handle_data(self, data):
        if self._in_title: self.title += data
        if self._h is not None: self._h[1] += data
        if self._script is not None: self._script += data

def meta(doc, **kw):
    for tag, a in doc.tags:
        if tag != 'meta': continue
        if all(a.get(k, '').lower() == v.lower() for k, v in kw.items()):
            return a.get('content', '').strip()
    return None

def links(doc, rel):
    return [a for t, a in doc.tags if t == 'link' and rel in a.get('rel', '').lower().split()]

def check_page(path, doc, F):
    p = os.path.relpath(path)
    def add(sev, msg): F.append((sev, p, msg))
    html_attrs = next((a for t, a in doc.tags if t == 'html'), {})
    if not html_attrs.get('lang'): add('A', 'kein lang-Attribut am <html> (Screenreader, Übersetzung)')
    t = doc.title.strip()
    if not t: add('A', 'kein <title>')
    elif len(t) > 62: add('B', f'Title {len(t)} Zeichen — wird in Google abgeschnitten')
    desc = meta(doc, name='description')
    if not desc: add('A', 'keine meta description')
    elif not 50 <= len(desc) <= 165: add('B', f'meta description {len(desc)} Zeichen (Ziel 50–165)')
    if not meta(doc, name='viewport'): add('A', 'kein viewport-Meta — Seite ist auf dem Handy kaputt')
    if not links(doc, 'canonical'): add('B', 'kein canonical')
    for prop in ('og:title', 'og:description', 'og:image', 'og:url'):
        v = meta(doc, property=prop)
        if not v: add('B', f'{prop} fehlt — Link sieht in WhatsApp/Social nackt aus')
        elif prop in ('og:image', 'og:url') and not v.startswith('http'):
            add('A', f'{prop} ist relativ ({v}) — muss absolute URL sein')
    if not links(doc, 'icon'): add('B', 'kein Favicon verlinkt')
    h1 = [h for h in doc.headings if h[0] == 1]
    if not h1: add('A', 'kein H1')
    elif len(h1) > 1: add('B', f'{len(h1)} H1-Tags: {[h[1][:30] for h in h1]}')
    lv = [h[0] for h in doc.headings]
    for a, b in zip(lv, lv[1:]):
        if b > a + 1: add('C', f'Überschriften-Sprung H{a} → H{b}')
    for tag, a in doc.tags:
        if tag == 'img':
            src = a.get('src', '?')
            if 'alt' not in a: add('A', f'img ohne alt-Attribut: {src}')
            if not (a.get('width') and a.get('height')) and not a.get('style'):
                add('C', f'img ohne width/height — Layout springt beim Laden: {src}')
        if tag == 'a':
            href = a.get('href', '')
            if a.get('target') == '_blank' and 'noopener' not in a.get('rel', ''):
                add('C', f'target=_blank ohne rel="noopener": {href}')
            if href.startswith('http://'): add('A', f'unsicherer http-Link: {href}')
            if href in ('#', '', 'javascript:void(0)'): add('B', 'Link ohne Ziel (href="#")')
        if tag in ('input', 'textarea', 'select'):
            if a.get('type') not in ('hidden', 'submit', 'button') and not (a.get('id') or a.get('aria-label')):
                add('B', f'Formularfeld ohne id/aria-label (kein Label zuordenbar): {a.get("name", "?")}')
    for raw in doc.jsonld:
        try: json.loads(raw)
        except Exception as e: add('A', f'JSON-LD ist kaputt: {e}')
    if not doc.jsonld: add('C', 'keine strukturierten Daten (JSON-LD)')
    txt = open(path, encoding='utf-8', errors='ignore').read().lower()
    for word in ('lorem ipsum', 'todo', 'platzhalter', 'xxx@', 'beispiel.at'):
        if word in txt: add('A', f'Platzhalter im Text gefunden: "{word}"')
    return txt

def main(root):
    pages = sorted(p for p in glob.glob(os.path.join(root, '**', '*.html'), recursive=True) if '/node_modules/' not in p and not p.endswith('oventest.html'))
    if not pages: print('Keine HTML-Dateien gefunden in', root); return 1
    F, titles, descs, alltext = [], {}, {}, ''
    for path in pages:
        doc = Doc(); doc.feed(open(path, encoding='utf-8', errors='ignore').read())
        alltext += check_page(path, doc, F)
        titles.setdefault(doc.title.strip(), []).append(os.path.relpath(path))
        d = meta(doc, name='description')
        if d: descs.setdefault(d, []).append(os.path.relpath(path))
    for t, ps in titles.items():
        if len(ps) > 1 and t: F.append(('A', ', '.join(ps), f'identischer Title auf mehreren Seiten: "{t[:50]}"'))
    for d, ps in descs.items():
        if len(ps) > 1: F.append(('B', ', '.join(ps), 'identische meta description auf mehreren Seiten'))
    have = lambda n: os.path.exists(os.path.join(root, n))
    if not have('robots.txt'): F.append(('B', 'Ordner', 'robots.txt fehlt'))
    if not have('sitemap.xml'): F.append(('B', 'Ordner', 'sitemap.xml fehlt'))
    if not any(have(n) for n in ('404.html', '404.htm')): F.append(('B', 'Ordner', 'keine 404-Seite'))
    if not any(have(n) for n in ('favicon.ico', 'favicon.svg', 'favicon.png')):
        F.append(('C', 'Ordner', 'keine Favicon-Datei im Ordner'))
    for junk in glob.glob(os.path.join(root, '**', '*'), recursive=True):
        if '/node_modules/' in junk: continue
        b = os.path.basename(junk)
        if b in ('.DS_Store', '.env', 'Thumbs.db') or b.endswith(('.map', '.psd', '.ai', '.sketch', '.bak')):
            F.append(('A', b, 'gehört nicht ins Deploy-Paket — löschen'))
        if os.path.isfile(junk) and os.path.getsize(junk) > 500_000 and junk.lower().endswith(('.jpg','.jpeg','.png','.gif')):
            F.append(('B', b, f'{os.path.getsize(junk)//1024} KB — Bild komprimieren (Ziel < 300 KB)'))
    low = alltext
    for word, why in (('impressum', 'Impressum'), ('datenschutz', 'Datenschutzerklärung')):
        if word not in low: F.append(('A', 'Website', f'{why} nirgends gefunden — in AT Pflicht'))
    order = {'A': 0, 'B': 1, 'C': 2}
    F.sort(key=lambda x: (order[x[0]], x[1]))
    label = {'A': 'BLOCKER', 'B': 'SOLLTE', 'C': 'OPTIONAL'}
    cur = None
    for sev, where, msg in F:
        if sev != cur: print(f'\n=== {label[sev]} ==='); cur = sev
        print(f'  [{where}] {msg}')
    print(f'\n{len(pages)} Seite(n) geprüft — '
          f"{sum(1 for f in F if f[0]=='A')} Blocker, "
          f"{sum(1 for f in F if f[0]=='B')} sollte, "
          f"{sum(1 for f in F if f[0]=='C')} optional")
    return 1 if any(f[0] == 'A' for f in F) else 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else '.'))
