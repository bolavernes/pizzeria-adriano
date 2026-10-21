// Login: ein Passwort (Umgebungsvariable ADMIN_PASSWORD), Sitzung als signiertes Cookie
import crypto from 'node:crypto';

export const COOKIE = 'adriano_admin';
const MAX_AGE = 60 * 60 * 12; // 12 Stunden

function secret() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET fehlt oder ist kürzer als 32 Zeichen');
  return s;
}
const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => b64(crypto.createHmac('sha256', secret()).update(data).digest());

export function checkPassword(input) {
  const pw = process.env.ADMIN_PASSWORD || '';
  if (pw.length < 8) throw new Error('ADMIN_PASSWORD fehlt oder ist kürzer als 8 Zeichen');
  const a = crypto.createHash('sha256').update(String(input || '')).digest();
  const b = crypto.createHash('sha256').update(pw).digest();
  return crypto.timingSafeEqual(a, b);
}
export function issueCookie(secure = true) {
  const payload = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + MAX_AGE, n: crypto.randomBytes(8).toString('hex') }));
  const token = payload + '.' + sign(payload);
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${MAX_AGE}${secure ? '; Secure' : ''}`;
}
export function clearCookie(secure = true) { return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`; }
export function isAuthed(req) {
  const raw = (req.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(COOKIE + '='));
  if (!raw) return false;
  const [payload, sig] = raw.slice(COOKIE.length + 1).split('.');
  if (!payload || !sig) return false;
  const expect = sign(payload);
  if (expect.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now() / 1000; } catch { return false; }
}
