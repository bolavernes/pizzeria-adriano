// GET /api/menu – öffentliche, aktuelle Speisekarte
import { getMenuStore } from './lib/store.mjs';
import { createRequire } from 'node:module';
const seed = createRequire(import.meta.url)('../../data/menu.json');

export default async () => {
  let menu = null;
  try { menu = await (await getMenuStore()).get('current'); } catch (e) { console.error('store', e); }
  return new Response(JSON.stringify(menu || seed), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate', 'netlify-cdn-cache-control': 'public, s-maxage=30, stale-while-revalidate=60' }
  });
};
export const config = { path: '/api/menu' };
