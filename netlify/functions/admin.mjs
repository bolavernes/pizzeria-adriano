// /api/admin/* – Login, Speichern, Versionen
import { getMenuStore } from './lib/store.mjs';
import { checkPassword, issueCookie, clearCookie, isAuthed } from './lib/auth.mjs';
import { cleanMenu } from './lib/validate.mjs';
import { createRequire } from 'node:module';
const seed = createRequire(import.meta.url)('../../data/menu.json');

const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const KEEP = 30; // so viele Versionen bleiben erhalten

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/admin\/?/, '');
  const secure = url.protocol === 'https:';
  try {
    const store = await getMenuStore();
    // Nur Anfragen von der eigenen Seite (CSRF-Schutz zusätzlich zu SameSite=Strict)
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== url.host) return json({ error: 'Ungültige Herkunft' }, 403);
    }

    if (route === 'login' && req.method === 'POST') {
      const ip = (req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'local').split(',')[0].trim();
      const key = 'ratelimit/' + ip.replace(/[^a-z0-9.:]/gi, '_');
      const rl = (await store.get(key)) || { n: 0, t: Date.now() };
      if (Date.now() - rl.t > 15 * 60 * 1000) { rl.n = 0; rl.t = Date.now(); }
      if (rl.n >= 8) return json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut probieren.' }, 429);
      const { password } = await req.json().catch(() => ({}));
      if (!checkPassword(password)) { rl.n++; await store.setJSON(key, rl); await new Promise((r) => setTimeout(r, 600)); return json({ error: 'Passwort ist falsch.' }, 401); }
      await store.delete(key);
      return json({ ok: true }, 200, { 'set-cookie': issueCookie(secure) });
    }
    if (route === 'logout' && req.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': clearCookie(secure) });
    if (route === 'session') return json({ authed: isAuthed(req) });

    if (!isAuthed(req)) return json({ error: 'Bitte anmelden.' }, 401);

    if (route === 'menu' && req.method === 'GET') return json((await store.get('current')) || seed);
    if (route === 'menu' && req.method === 'PUT') {
      const body = await req.text();
      if (body.length > 400_000) return json({ error: 'Zu groß' }, 413);
      const prev = await store.get('current');
      const clean = cleanMenu(JSON.parse(body), seed);
      if (prev) await store.setJSON('versions/' + (prev.updatedAt || new Date().toISOString()), prev);
      await store.setJSON('current', clean);
      const versions = await store.list('versions/');
      for (const old of versions.slice(0, Math.max(0, versions.length - KEEP))) await store.delete(old);
      return json({ ok: true, menu: clean });
    }
    if (route === 'versions' && req.method === 'GET') {
      const v = (await store.list('versions/')).reverse().map((k) => ({ id: k.slice(9), at: k.slice(9) }));
      return json({ versions: v });
    }
    if (route === 'restore' && req.method === 'POST') {
      const { id } = await req.json();
      const old = await store.get('versions/' + String(id));
      if (!old) return json({ error: 'Version nicht gefunden' }, 404);
      const cur = await store.get('current');
      if (cur) await store.setJSON('versions/' + (cur.updatedAt || new Date().toISOString()), cur);
      const restored = { ...old, updatedAt: new Date().toISOString() };
      await store.setJSON('current', restored);
      return json({ ok: true, menu: restored });
    }
    return json({ error: 'Nicht gefunden' }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof SyntaxError ? 'Ungültige Daten' : /ADMIN_PASSWORD|SESSION_SECRET/.test(e.message) ? 'Backend nicht eingerichtet: ' + e.message : (e.message || 'Fehler') }, e.status || (e instanceof SyntaxError ? 400 : 500));
  }
};
export const config = { path: '/api/admin/*' };
