/* ===========================================================================
   AfterBell — presentation.js
   Presentation mode: index.html?demo=1
   ===========================================================================
   A beat-by-beat walkthrough for recording. Every beat renders a REAL screen
   from screens.js against the REAL seed data, and every action calls the same
   function a real tap calls — requestRide, approveStudent, offerSeats,
   runFillTheGaps, assignManually, markPickedUp. Nothing is staged.

   KEYS
     Space / →   next beat: switch role and screen, then play its action once
     ←           previous beat, WITHOUT replaying its action
     R           reset all demo data and return to beat 1
     H           show or hide a tiny beat number in the corner

   Nothing else is on screen, so the recording is clean.
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { view } from './view.js';
import { drawAllMaps } from './map.js';
import { downloadRidePlan, buildRidePlanRows, ridePlanFilename } from './export.js';
import { esc, icon } from './ui.js';

const SATURDAY = 'e-band-sat';
const TUESDAY = 'e-vball-tue';

export function isPresentationMode() {
  return new URLSearchParams(location.search).get('demo') === '1';
}

/* ---------------------------------------------------------------------------
   HELPERS
--------------------------------------------------------------------------- */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let stage = null;          // the element holding the phone(s)
let beatIndex = 0;
let token = 0;             // cancels an in-flight beat when you move on
let saturdayFill = null;

function phoneEl(i = 0) {
  return stage.querySelectorAll('.pres__phone')[i] || null;
}

/** Render a real screen as a given role, then hand the role back. */
function renderAs(role, fn) {
  const prevRole = S.state.role;
  const prevUser = S.state.userId;
  S.state.role = role;
  S.state.userId = S.DEMO_ACCOUNTS[role] ? S.DEMO_ACCOUNTS[role].id : prevUser;
  try {
    return fn();
  } finally {
    S.state.role = prevRole;
    S.state.userId = prevUser;
  }
}

/** Render as a specific person, for the second parent and the driver view. */
function renderAsPerson(personId, role, fn) {
  const prevRole = S.state.role;
  const prevUser = S.state.userId;
  S.state.role = role;
  S.state.userId = personId;
  try {
    return fn();
  } finally {
    S.state.role = prevRole;
    S.state.userId = prevUser;
  }
}

/** A soft pulse where a finger would tap. */
async function tap(target, holder) {
  if (!target) return;
  const host = holder || target.closest('.pres__phone');
  if (!host) return;

  const hostBox = host.getBoundingClientRect();
  const box = target.getBoundingClientRect();

  const dot = document.createElement('span');
  dot.className = 'pres__pulse';
  dot.style.left = `${box.left - hostBox.left + box.width / 2}px`;
  dot.style.top = `${box.top - hostBox.top + Math.min(box.height / 2, 30)}px`;
  host.appendChild(dot);

  await wait(reduced() ? 100 : 620);
  dot.remove();
}

/** A 2px ring that fades after about 1.5s, to point the eye somewhere. */
function highlight(node) {
  if (!node) return;
  node.classList.add('pres__ring');
  setTimeout(() => node.classList.remove('pres__ring'), 1500);
}

async function highlightEach(nodes, gap = 700) {
  for (const node of nodes) {
    highlight(node);
    await wait(gap);
  }
}

/** Count a number up, with a guaranteed finisher. */
function countUp(node, from, to, stepMs = 45) {
  if (!node || from >= to) return;
  let current = from;
  node.textContent = String(current);
  const timer = setInterval(() => {
    if (!node.isConnected) return clearInterval(timer);
    current += 1;
    node.textContent = String(current);
    if (current >= to) clearInterval(timer);
  }, stepMs);
  setTimeout(() => {
    clearInterval(timer);
    if (node.isConnected) node.textContent = String(to);
  }, stepMs * (to - from) + 600);
}

/** Put one or more real screens on the stage. */
function mount(panes) {
  stage.innerHTML = panes
    .map(
      (pane, i) => `<div class="pres__frame">
        ${pane.label ? `<p class="pres__label">${esc(pane.label)}</p>` : ''}
        <div class="pres__phone"><div class="pres__screen" data-pane="${i}">${pane.html}</div></div>
      </div>`
    )
    .join('');

  // Ids must stay unique with two phones on screen.
  stage.querySelectorAll('.pres__screen').forEach((screen, i) => {
    screen.querySelectorAll('[id]').forEach((el) => {
      el.id = `p${i}-${el.id}`;
    });
  });

  stage.classList.toggle('pres__stage--pair', panes.length > 1);
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  drawAllMaps(S.state.data, stage);
}

/** Re-render the first pane from live state. */
function refresh(renderFn) {
  const screen = stage.querySelector('.pres__screen');
  if (!screen) return;
  screen.innerHTML = renderFn();
  screen.querySelectorAll('[id]').forEach((el) => {
    if (!el.id.startsWith('p0-')) el.id = `p0-${el.id}`;
  });
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  drawAllMaps(S.state.data, screen);
}

/** Run the real algorithm once, for the two trips this script covers. */
function ensureMatched() {
  if (saturdayFill) return saturdayFill;

  // Beat 2 withdraws Marcus's request as its starting state; if the presenter
  // skipped ahead, put it back so the algorithm sees the same waiting list.
  const present = S.state.data.requests.some(
    (r) => r.studentId === 's19' && r.eventId === SATURDAY
  );
  if (!present) S.requestRide('s19', SATURDAY);

  saturdayFill = S.runFillTheGaps(SATURDAY);
  S.runFillTheGaps(TUESDAY);          // produces the cross-activity car
  S.state.lastFill = saturdayFill;    // keep the Saturday report on screen
  return saturdayFill;
}

/** The car from the real results carrying the most different activities. */
function mostMixedRide() {
  return S.state.data.rides
    .map((ride) => ({
      ride,
      activities: new Set(S.ridersInRide(ride).map((r) => r.activityId)).size,
      riders: ride.riderIds.length,
    }))
    .filter((e) => e.activities > 1)
    .sort((a, b) => b.activities - a.activities || b.riders - a.riders)[0]?.ride;
}

/* ---------------------------------------------------------------------------
   THE BEATS
--------------------------------------------------------------------------- */
const BEATS = [
  /* 1 */ {
    name: 'Organizer — the gap',
    panes: () => [{ html: renderAs('organizer', () => Screens.organizer(SATURDAY)) }],
    async play() {
      // Pulse the empty ticks twice, so the viewer sees what is missing.
      const empties = [...phoneEl().querySelectorAll('.dial__tick:not(.is-filled)')];
      for (let round = 0; round < 2; round++) {
        empties.forEach((t) => t.classList.add('is-pulsing'));
        await wait(620);
        empties.forEach((t) => t.classList.remove('is-pulsing'));
        await wait(320);
      }
    },
  },

  /* 2 */ {
    name: 'Student — asks for a ride',
    setup: () => S.cancelRequest('s19', SATURDAY),
    panes: () => [{ html: renderAs('student', () => Screens.studentHome()) }],
    async play() {
      const phone = phoneEl();
      await tap(phone.querySelector(`[data-href="#/event/${SATURDAY}"]`), phone);

      refresh(() => renderAs('student', () => Screens.requestRide(SATURDAY)));
      await wait(700);

      const button = phoneEl().querySelector('[data-action="request-ride"]');
      await tap(button, phoneEl());
      S.requestRide('s19', SATURDAY);

      refresh(() => renderAs('student', () => Screens.studentHome()));
      await wait(200);
      highlight(phoneEl().querySelector(`[data-href="#/event/${SATURDAY}"] .status`));
    },
  },

  /* 3 */ {
    name: 'Parents — approve, then offer seats',
    panes: () => [{ html: renderAs('parent', () => Screens.parentView()) }],
    async play() {
      const phone = phoneEl();
      const approve = phone.querySelector('[data-action="approve"]');
      if (approve) {
        await tap(approve, phone);
        S.approveStudent(approve.dataset.student);
        refresh(() => renderAs('parent', () => Screens.parentView()));
        await wait(600);
      }

      // The second parent is the one who actually drives this trip.
      const driverParent = S.state.data.rides.length
        ? S.personById('p07')
        : S.personById('p07');
      refresh(() => renderAsPerson(driverParent.id, 'parent', () => Screens.parentView()));
      await wait(500);

      const toggle = phoneEl().querySelector('[data-action="toggle-offer"]');
      if (toggle) {
        await tap(toggle, phoneEl());
        S.offerSeats(driverParent.id, toggle.dataset.event, 3);
        refresh(() => renderAsPerson(driverParent.id, 'parent', () => Screens.parentView()));
        countUp(phoneEl().querySelector('[data-seatcount]'), 0, 3, 170);
      }
    },
  },

  /* 4 */ {
    name: 'Fill the Gaps — the real algorithm',
    panes: () => [{ html: renderAs('organizer', () => Screens.organizer(SATURDAY)) }],
    async play() {
      const before = S.readinessFor(SATURDAY).covered;
      const phone = phoneEl();
      await tap(phone.querySelector('[data-action="fill-gaps"]'), phone);

      const result = ensureMatched();
      refresh(() => renderAs('organizer', () => Screens.organizer(SATURDAY)));

      const after = S.readinessFor(SATURDAY).covered;
      const number = phoneEl().querySelector('.dial__num');

      if (reduced()) {
        if (number) number.textContent = String(after);
        return;
      }
      result.matchedStudentIds.forEach((studentId, i) => {
        const tick = phoneEl().querySelector(`.dial__tick[data-student="${studentId}"]`);
        if (!tick) return;
        tick.style.animationDelay = `${i * 40}ms`;
        tick.classList.add('is-filling');
      });
      countUp(number, before, after);
    },
  },

  /* 5 */ {
    name: 'One car, more than one activity',
    prepare: () => ensureMatched(),
    panes: () => {
      const ride = mostMixedRide();
      return [{ html: ride ? renderAs('student', () => Screens.rideCard(ride.id)) : '' }];
    },
    async play() {
      await highlightEach([...phoneEl().querySelectorAll('.person__act')], 700);
    },
  },

  /* 6 */ {
    name: 'Who it could not help, and why',
    prepare: () => ensureMatched(),
    panes: () => [{ html: renderAs('organizer', () => Screens.rosterGapsCard(SATURDAY)) }],
    async play() {
      const rows = [...phoneEl().querySelectorAll('.row--static')];
      // The provisional-licence reason is the one worth lingering on.
      const curfew = rows.find((r) => /provisional|midnight/i.test(r.textContent));
      await wait(400);
      highlight(curfew || rows[0]);
    },
  },

  /* 7 */ {
    name: 'Organizer assigns a chaperone',
    prepare: () => ensureMatched(),
    panes: () => [{ html: renderAs('organizer', () => Screens.organizer(SATURDAY)) }],
    async play() {
      const unmatched = S.readinessFor(SATURDAY)
        .rows.filter((row) => !S.hasRide(row.status.code))
        .map((row) => row.studentId);

      const before = S.readinessFor(SATURDAY).covered;

      for (const studentId of unmatched) {
        view.assignOpenFor = studentId;
        refresh(() => renderAs('organizer', () => Screens.organizer(SATURDAY)));
        await wait(450);

        const pick = phoneEl().querySelector(
          `[data-action="assign-to"][data-student="${studentId}"][data-driver="c-rivera"]`
        );
        await tap(pick, phoneEl());
        S.assignManually(studentId, SATURDAY, 'c-rivera');
        view.assignOpenFor = null;
        await wait(250);
      }

      refresh(() => renderAs('organizer', () => Screens.organizer(SATURDAY)));
      const after = S.readinessFor(SATURDAY).covered;

      if (!reduced()) {
        unmatched.forEach((studentId, i) => {
          const tick = phoneEl().querySelector(`.dial__tick[data-student="${studentId}"]`);
          if (!tick) return;
          tick.style.animationDelay = `${i * 120}ms`;
          tick.classList.add('is-filling');
        });
      }
      countUp(phoneEl().querySelector('.dial__num'), before, after, 160);

      await wait(900);
      const sub = phoneEl().querySelector('.dial__sub');
      if (sub && after === S.readinessFor(SATURDAY).total) {
        sub.insertAdjacentHTML('afterend', '<div class="pres__filled">Every spot filled</div>');
      }
    },
  },

  /* 8 */ {
    name: 'Export the ride plan',
    prepare: () => ensureMatched(),
    panes: () => [{ html: renderAs('organizer', () => Screens.organizer(SATURDAY)) }],
    async play() {
      const phone = phoneEl();
      await tap(phone.querySelector('[data-action="export-plan"]'), phone);

      downloadRidePlan(SATURDAY);          // the real file really downloads
      showExportPreview();                 // and the viewer can see what is in it
    },
  },

  /* 9 */ {
    name: 'The same code on both phones',
    prepare: () => ensureMatched(),
    panes: () => {
      const ride =
        S.state.data.rides.find((r) => r.riderIds.includes('s19')) || S.state.data.rides[0];
      const rider = S.personById(ride.riderIds[0]);
      const driver = S.personById(ride.driverId);
      return [
        {
          label: `Rider — ${rider.firstName} ${rider.lastInitial}.`,
          html: renderAs('student', () => Screens.rideCard(ride.id)),
        },
        {
          label: `Driver — ${driver.firstName} ${driver.lastInitial}.`,
          html: renderAsPerson(driver.id, 'parent', () => Screens.rideCard(ride.id)),
        },
      ];
    },
    async play() {
      const codes = [...stage.querySelectorAll('.handoff__code')];
      await highlightEach(codes, 800);

      const ride =
        S.state.data.rides.find((r) => r.riderIds.includes('s19')) || S.state.data.rides[0];
      S.markPickedUp(ride.id, true);

      // The parent's notification is real: it comes out of the event log.
      const parent = S.state.data.people.find((p) => (p.childIds || []).includes('s19'));
      const second = stage.querySelectorAll('.pres__screen')[1];
      if (second && parent) {
        second.innerHTML = renderAsPerson(parent.id, 'parent', () => Screens.updates());
        if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
        await wait(300);
        highlight(second.querySelector('.row'));
      }
    },
  },

  /* 10 */ {
    name: 'What the app knows about you',
    panes: () => [{ html: renderAs('student', () => Screens.account()) }],
    async play() {
      await wait(300);
      highlight(phoneEl().querySelector('#p0-acct-hood') || phoneEl().querySelector('select'));
      await wait(900);
      highlight(phoneEl().querySelector('.setting--danger'));
    },
  },

  /* 11 */ {
    name: 'Every spot filled',
    prepare: () => ensureMatched(),
    panes: () => [{ html: renderAs('organizer', () => Screens.organizer(SATURDAY)) }],
    async play() {
      const r = S.readinessFor(SATURDAY);
      const sub = phoneEl().querySelector('.dial__sub');
      if (sub && r.covered === r.total) {
        sub.insertAdjacentHTML('afterend', '<div class="pres__filled">Every spot filled</div>');
      }
    },
  },
];

/* ---------------------------------------------------------------------------
   THE EXPORT PREVIEW SHEET
--------------------------------------------------------------------------- */
function showExportPreview() {
  const rows = buildRidePlanRows(SATURDAY);
  const columns = ['Student', 'Group/Section', 'Driver', 'Car', 'Handoff Code', 'Status'];
  const shown = rows.slice(0, 8);

  const sheet = document.createElement('div');
  sheet.className = 'pres__export';
  sheet.innerHTML = `
    <div class="pres__export-inner">
      <div class="sheet__handle"></div>
      <p class="label">${esc(ridePlanFilename(SATURDAY))}</p>
      <p class="row__meta" style="margin:6px 0 14px">${rows.length} students, including the ones with no ride.</p>
      <div class="csvwrap">
        <table class="csv">
          <thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${shown
            .map((row) => `<tr>${columns.map((c) => `<td>${esc(row[c] || '—')}</td>`).join('')}</tr>`)
            .join('')}</tbody>
        </table>
      </div>
      <button class="btn" style="margin-top:16px" id="pres-close-export">Close</button>
    </div>`;
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('is-open'));
  setTimeout(() => sheet.classList.add('is-open'), 40);

  sheet.querySelector('#pres-close-export').addEventListener('click', () => sheet.remove());
}

/* ---------------------------------------------------------------------------
   DRIVING THE DECK
--------------------------------------------------------------------------- */
function showBeat(i, { playAction = true } = {}) {
  beatIndex = Math.max(0, Math.min(BEATS.length - 1, i));
  const beat = BEATS[beatIndex];
  const mine = ++token;

  document.querySelectorAll('.pres__export').forEach((el) => el.remove());

  if (playAction && beat.setup) beat.setup();
  if (beat.prepare) beat.prepare();

  mount(beat.panes());
  updateBeatNumber();

  if (!playAction || !beat.play) return;

  setTimeout(() => {
    if (mine !== token) return;      // moved on before the action started
    beat.play();
  }, 450);
}

function updateBeatNumber() {
  const tag = document.getElementById('pres-beat');
  if (tag) tag.textContent = `${beatIndex + 1} / ${BEATS.length} · ${BEATS[beatIndex].name}`;
}

function resetAll() {
  S.resetDemo();
  view.groupFilter = 'ALL';
  view.showAllGaps = false;
  view.assignOpenFor = null;
  view.homeFilter = null;
  saturdayFill = null;
  showBeat(0);
}

export function startPresentation() {
  document.body.classList.add('is-presentation');

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="pres">
      <div class="pres__stage" id="pres-stage"></div>
      <div class="pres__beat" id="pres-beat" hidden></div>
    </div>`;
  stage = document.getElementById('pres-stage');

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.key === 'ArrowRight') {
      event.preventDefault();
      showBeat(beatIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showBeat(beatIndex - 1, { playAction: false });
    } else if (event.key.toLowerCase() === 'r') {
      resetAll();
    } else if (event.key.toLowerCase() === 'h') {
      const tag = document.getElementById('pres-beat');
      tag.hidden = !tag.hidden;
      updateBeatNumber();
    }
  });

  showBeat(0);
}

/** Exposed so the final report can state the real numbers. */
export const BEAT_COUNT = BEATS.length;
