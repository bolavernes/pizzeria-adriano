// Pizza-Drehrad im Hero: freigestellte Pizzen (Draufsicht) auf einem großen Rad.
// Drehen per Ziehen, Pfeiltasten oder Knöpfen; beim Scrollen dreht es langsam mit.
// Bilder und Zuordnung: <script id="pizzarad-data"> in index.html – Name, Belag und Preis kommen aus der Speisekarte.
import { formatPrice, esc } from './menu-core.js?v=20261022';

export function mountPizzaRad({ root, menu, getProgress, reduced }) {
  const data = JSON.parse(document.getElementById('pizzarad-data')?.textContent || '[]');
  const items = menu.sections.flatMap((s) => s.groups.flatMap((g) => g.items));
  const pizzas = data.map((d) => ({ ...d, item: items.find((i) => i.id === d.id) })).filter((d) => d.item);
  if (pizzas.length < 2) return;

  const wheel = root.querySelector('.pr-wheel'), info = root.querySelector('.pr-info');
  // Rad mit mindestens 8 Plätzen füllen (Pizzen wiederholen sich, Anzahl immer ein Vielfaches)
  const SLOTS = pizzas.length * Math.ceil(8 / pizzas.length);
  const STEP = 360 / SLOTS;
  wheel.innerHTML = Array.from({ length: SLOTS }, (_, k) => {
    const p = pizzas[k % pizzas.length];
    return `<div class="pr-slot" style="--a:${k * STEP}deg" data-k="${k}"><img src="${esc(p.img)}" alt="" draggable="false" loading="lazy" decoding="async"></div>`;
  }).join('');
  const slots = [...wheel.children];
  root.hidden = false;

  const pointerAngle = () => (innerWidth / innerHeight < 0.9 ? 90 : 180); // Handy: unten, sonst links
  let user = 0, vel = 0, dragging = false, lastA = 0, active = -1, snapTo = null;

  const center = () => { const r = wheel.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const angleAt = (e) => { const [cx, cy] = center(); return Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI; };
  const norm = (a) => ((a % 360) + 540) % 360 - 180;

  wheel.addEventListener('pointerdown', (e) => { dragging = true; snapTo = null; vel = 0; lastA = angleAt(e); wheel.setPointerCapture(e.pointerId); root.classList.add('is-drag'); });
  wheel.addEventListener('pointermove', (e) => { if (!dragging) return; const a = angleAt(e); const d = norm(a - lastA); lastA = a; user += d; vel = d; });
  const release = () => { if (!dragging) return; dragging = false; root.classList.remove('is-drag'); snap(vel * 6); };
  wheel.addEventListener('pointerup', release); wheel.addEventListener('pointercancel', release);
  wheel.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); } if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); } });
  root.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => step(+b.dataset.d)));

  let scrollRot = 0;
  const total = () => user + scrollRot;
  function snap(extra = 0) {
    // auf den nächsten Platz einrasten (mit etwas Schwung)
    const t = total() + extra;
    const k = Math.round((pointerAngle() - t) / STEP);
    snapTo = user + ((pointerAngle() - k * STEP) - t) + extra;
  }
  function step(d) { snapTo = (snapTo ?? user) - d * STEP; }

  function show(k) {
    const p = pizzas[k % pizzas.length], i = p.item;
    info.innerHTML = `<span class="pr-label">${esc(p.label || 'Aus dem Holzofen')}</span><h3 class="pr-name">${esc(i.name)}</h3>${i.desc ? `<p class="pr-desc">${esc(i.desc)}</p>` : ''}<span class="pr-price">${esc(formatPrice(i.price, i.pricePrefix))}</span><a class="pr-link" href="speisekarte/#g-${esc(i.id)}">Zur Pizza</a>`;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const p = getProgress();
    const on = p > 0.28 && p < 1.02;
    root.classList.toggle('is-on', on);
    if (!on) return;
    // Scroll dreht das Rad langsam mit (etwa sieben Pizzen über die beiden Schritte)
    scrollRot = reduced ? 0 : -(p - 0.3) * 300;
    if (!dragging && snapTo !== null) { const d = snapTo - user; user += d * Math.min(1, dt * 9); if (Math.abs(d) < 0.05) { user = snapTo; snapTo = null; } }
    const rot = total();
    wheel.style.transform = `rotate(${rot}deg)`;
    // nächster Platz am Zeiger = aktive Pizza
    const pa = pointerAngle();
    let best = 0, bd = 999;
    slots.forEach((s, k) => { const d = Math.abs(norm(k * STEP + rot - pa)); s.style.setProperty('--near', Math.max(0, 1 - d / STEP).toFixed(3)); if (d < bd) { bd = d; best = k; } });
    if (best !== active) { active = best; slots.forEach((s, k) => s.classList.toggle('is-active', k === best)); show(best); }
  }
  requestAnimationFrame(frame);
  // nach dem Scrollen sanft einrasten
  let st; addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(() => { if (!dragging) snap(); }, 180); }, { passive: true });
}
