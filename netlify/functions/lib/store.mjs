// Speicher für die Speisekarte: Netlify Blobs (live) oder ein lokaler Ordner (Entwicklung)
import { promises as fs } from 'node:fs';
import path from 'node:path';

function fileStore(dir) {
  const f = (key) => path.join(dir, encodeURIComponent(key) + '.json');
  return {
    async get(key) { try { return JSON.parse(await fs.readFile(f(key), 'utf8')); } catch { return null; } },
    async setJSON(key, val) { await fs.mkdir(dir, { recursive: true }); await fs.writeFile(f(key), JSON.stringify(val)); },
    async delete(key) { try { await fs.unlink(f(key)); } catch { } },
    async list(prefix = '') {
      try { return (await fs.readdir(dir)).map((n) => decodeURIComponent(n.replace(/\.json$/, ''))).filter((k) => k.startsWith(prefix)).sort(); }
      catch { return []; }
    }
  };
}

let cached;
export async function getMenuStore() {
  if (cached) return cached;
  if (process.env.LOCAL_STORE_DIR) return (cached = fileStore(process.env.LOCAL_STORE_DIR));
  const { getStore } = await import('@netlify/blobs');
  const s = getStore({ name: 'adriano-menu', consistency: 'strong' });
  cached = {
    get: (key) => s.get(key, { type: 'json' }),
    setJSON: (key, val) => s.setJSON(key, val),
    delete: (key) => s.delete(key),
    async list(prefix = '') { const { blobs } = await s.list({ prefix }); return blobs.map((b) => b.key).sort(); }
  };
  return cached;
}
