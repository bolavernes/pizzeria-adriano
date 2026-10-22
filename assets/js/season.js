/* Saison-Angebot: zugeklappt als Knopf, öffnet als Fenster über der unscharfen Seite */
import { esc } from './menu-core.js?v=20261022';
import { ILL } from './ills.js?v=20261022';

export function toggleHTML(s, count) {
  return `${ILL[s.icon] || ''}<span class="st-t"><b>${esc(s.title)}</b><small>${esc(s.subtitle || 'Saison')}${count ? ` · ${count} Gerichte` : ''}</small></span><span class="st-plus" aria-hidden="true">+</span>`;
}

export function wireDialog(dlg, openers) {
  if (!dlg) return () => {};
  const open = () => {
    dlg._last = document.activeElement; if (!dlg.open) dlg.showModal();
    dlg.querySelectorAll('video[data-src]').forEach((v) => { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); });
  };
  openers.forEach((b) => b && b.addEventListener('click', (e) => { e.preventDefault(); open(); }));
  if (!dlg.dataset.wired) {
    dlg.dataset.wired = '1';
    // Klick auf den unscharfen Hintergrund oder auf × schließt
    dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', () => { dlg.querySelectorAll('video').forEach((v) => v.pause()); dlg._last?.focus?.(); });
  }
  return open;
}
