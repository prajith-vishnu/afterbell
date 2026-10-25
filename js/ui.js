/* ===========================================================================
   AfterBell — ui.js
   Tiny helpers for building HTML. No framework.
   ===========================================================================
   Each screen in screens.js returns a plain HTML string, app.js drops it into
   the page, and one delegated click handler reads `data-action` attributes.
   That is the whole architecture. It is about 20 lines of machinery instead of
   a framework, which means I can explain every line of it.
=========================================================================== */

import { formatTime } from './matching.js';

/**
 * Escape anything that came from data before putting it in HTML.
 * Even though all of this data is mine, escaping is the habit: the moment a
 * real student types their name in Stage 2, this is what stops that name from
 * being treated as markup.
 */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A Lucide icon. Lucide replaces these <i> tags after each render. */
export function icon(name, cls = 'i') {
  return `<i data-lucide="${esc(name)}" class="${esc(cls)}" aria-hidden="true"></i>`;
}

/** "MON 10/26" for the left column of the departure board. */
export function dayLabel(iso) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const y = Number(iso.slice(0, 4));
  const mo = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  // Date is only used for the weekday name, so UTC keeps it stable everywhere.
  const dow = days[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${dow} ${mo}/${d}`;
}

export { formatTime };

/**
 * "Jalen M." — the only name format this app ever displays, for anyone.
 * Staff are the one exception: they are already stored as a title plus a
 * surname ("Mr." + "Moreno"), which is how a student would actually say it,
 * so they do not get the trailing initial dot.
 */
export function personName(person) {
  if (!person) return 'Unknown';
  if (person.role === 'organizer') return `${person.firstName} ${person.lastInitial}`;
  return `${person.firstName} ${person.lastInitial}.`;
}

/* ---------------------------------------------------------------------------
   STATUS

   Four internal codes, three visual treatments. Every one carries a text
   label, and the three swatches differ in shape as well as color, so the
   status is readable without seeing color at all.
--------------------------------------------------------------------------- */
export const STATUS_TEXT = {
  confirmed: 'Ride confirmed',
  own: 'Own ride',          // on the roster but didn't need AfterBell
  waiting: 'Waiting for match',
  none: 'No ride yet',
};

export function statusChip(code, overrideText) {
  const variant = code === 'own' ? 'confirmed' : code;
  const text = overrideText || STATUS_TEXT[code] || code;
  return `<span class="chip chip--${esc(variant)}">
    <span class="swatch" aria-hidden="true"></span>${esc(text)}
  </span>`;
}

/** Small uppercase tag used to label which activity a rider is from. */
export function activityChip(label) {
  return `<span class="chip chip--activity">${esc(label)}</span>`;
}

/** A plain 1px-bordered progress meter. */
export function meter(done, total) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return `<div class="meter" role="img" aria-label="${done} of ${total} have rides">
    <div class="meter__fill" style="width:${pct}%"></div>
  </div>`;
}

/** CSS class for one roster square. */
export function spotClass(code) {
  if (code === 'confirmed' || code === 'own') return 'spot spot--confirmed';
  if (code === 'waiting') return 'spot spot--waiting';
  return 'spot';
}

/** A titled section with a hairline rule under the heading. */
export function block(title, bodyHtml, note = '') {
  return `<section class="block">
    <div class="block__head">
      <h2>${esc(title)}</h2>
      ${note ? `<span class="block__note">${esc(note)}</span>` : ''}
    </div>
    ${bodyHtml}
  </section>`;
}

/** A notice. Deliberately black-and-white: red in this app means "filled". */
export function notice(title, body, iconName = 'triangle-alert') {
  return `<div class="notice">
    ${icon(iconName)}
    <div>
      <div class="notice__title">${esc(title)}</div>
      ${body ? `<p>${esc(body)}</p>` : ''}
    </div>
  </div>`;
}

export function empty(html) {
  return `<div class="empty">${html}</div>`;
}
