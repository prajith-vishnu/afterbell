/* ===========================================================================
   AfterBell — ui.js
   Small helpers shared by every screen. No framework.
   ===========================================================================
   Screens return plain HTML strings, app.js puts them on the page, and one
   delegated click handler reads `data-action`. That is the whole machinery.
=========================================================================== */

import { formatTime } from './matching.js';

/** Escape data before it goes into HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A Lucide icon. Lucide swaps these for inline SVG after each render. */
export function icon(name, cls = 'i') {
  return `<i data-lucide="${esc(name)}" class="${esc(cls)}" aria-hidden="true"></i>`;
}

/** "MON 10/26" */
export function dayLabel(iso) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${days[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${mo}/${d}`;
}

export { formatTime };

/** "Jalen M." — the only name format this app displays. Staff keep their title. */
export function personName(person) {
  if (!person) return 'Unknown';
  // Staff and chaperones are stored as a title plus a surname, which is how
  // a student would actually say it, so they get no trailing initial dot.
  if (person.role === 'organizer' || person.role === 'chaperone') {
    return `${person.firstName} ${person.lastInitial}`;
  }
  return `${person.firstName} ${person.lastInitial}.`;
}

export function initials(person) {
  if (!person) return '?';
  return `${person.firstName[0]}${person.lastInitial[0]}`.toUpperCase();
}

export function avatar(person, cls = '') {
  return `<span class="avatar ${cls}" aria-hidden="true">${esc(initials(person))}</span>`;
}

/* ---------------------------------------------------------------------------
   STATUS
   Four internal codes, three looks. Every one carries a word, and the three
   dots differ in SHAPE as well as fill, so none of this depends on colour.
--------------------------------------------------------------------------- */
export const STATUS_TEXT = {
  confirmed: 'Ride confirmed',
  own: 'Own ride',
  waiting: 'Waiting for match',
  none: 'No ride yet',
};

export function statusPill(code, overrideText) {
  const variant = code === 'own' ? 'confirmed' : code;
  const text = overrideText || STATUS_TEXT[code] || code;
  return `<span class="status status--${esc(variant)}">
    <span class="status__dot" aria-hidden="true"></span>${esc(text)}
  </span>`;
}

/* ---------------------------------------------------------------------------
   LAYOUT BITS
--------------------------------------------------------------------------- */
export function head(kicker, title, sub = '') {
  return `<header class="head">
    ${kicker ? `<p class="head__kicker">${esc(kicker)}</p>` : ''}
    <h1>${esc(title)}</h1>
    ${sub ? `<p class="head__sub">${esc(sub)}</p>` : ''}
  </header>`;
}

export function notice(title, body, iconName = 'info') {
  return `<div class="notice">
    ${icon(iconName)}
    <div>
      <div class="notice__title">${esc(title)}</div>
      ${body ? `<p>${esc(body)}</p>` : ''}
    </div>
  </div>`;
}

export function emptyState(iconName, title, body) {
  return `<div class="empty">
    <div class="empty__icon">${icon(iconName)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
  </div>`;
}

/**
 * A map block. The options are serialised into the element and drawn by
 * map.js after the screen is on the page.
 */
export function mapBlock(options, cls = '') {
  return `<div class="mapwrap ${cls}">
    <div class="map" data-map='${esc(JSON.stringify(options))}'></div>
  </div>`;
}
