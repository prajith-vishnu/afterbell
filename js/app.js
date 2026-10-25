/* ===========================================================================
   AfterBell — app.js
   Router, the demo role switcher, button wiring, and the one animation.
   ===========================================================================
   The whole app is: read the URL hash, ask screens.js for an HTML string, put
   it on the page, let Lucide swap in the icons. Clicks are handled by ONE
   listener on <body> that reads `data-action`.
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { esc, icon, notice } from './ui.js';
import { view } from './view.js';
import { isTourMode, startTour } from './tour.js';

/* ---------------------------------------------------------------------------
   NAVIGATION — what each role sees in the sub-nav, and where they land.
--------------------------------------------------------------------------- */
const NAV = {
  student: [
    { href: '#/student', label: 'My week', icon: 'calendar-days' },
    { href: '#/rides', label: 'Ride cards', icon: 'id-card' },
    { href: '#/cross', label: 'Cross-activity', icon: 'shuffle' },
    { href: '#/how', label: 'How matching works', icon: 'route' },
  ],
  parent: [
    { href: '#/parent', label: 'My students', icon: 'users' },
    { href: '#/cross', label: 'Cross-activity', icon: 'shuffle' },
    { href: '#/how', label: 'How matching works', icon: 'route' },
  ],
  driver: [
    { href: '#/driver', label: 'Trips I am driving', icon: 'car-front' },
    { href: '#/cross', label: 'Cross-activity', icon: 'shuffle' },
    { href: '#/how', label: 'How matching works', icon: 'route' },
  ],
  organizer: [
    { href: '#/organizer', label: 'Ride readiness', icon: 'layout-grid' },
    { href: '#/cross', label: 'Cross-activity', icon: 'shuffle' },
    { href: '#/how', label: 'How matching works', icon: 'route' },
  ],
};

const HOME = { student: '#/student', parent: '#/parent', driver: '#/driver', organizer: '#/organizer' };

/** A one-line confirmation shown at the top of the screen after an action. */
let flash = null;

/* ---------------------------------------------------------------------------
   RENDER
--------------------------------------------------------------------------- */
function renderRoleSwitcher() {
  const tabs = document.getElementById('role-tabs');
  tabs.innerHTML = Object.entries(S.DEMO_ACCOUNTS)
    .map(
      ([role, account]) => `<button class="roleswitch__btn" role="tab"
        aria-selected="${role === S.state.role}"
        data-action="set-role" data-role="${esc(role)}"
        title="${esc(account.caption)}">${esc(account.label)}</button>`
    )
    .join('');
}

function renderSubnav() {
  const nav = document.getElementById('subnav');
  const here = location.hash || HOME[S.state.role];
  const account = S.DEMO_ACCOUNTS[S.state.role];

  nav.innerHTML = `<div class="subnav__inner">
    ${NAV[S.state.role]
      .map(
        (item) => `<a class="subnav__link" href="${esc(item.href)}"
          ${here.startsWith(item.href) ? 'aria-current="page"' : ''}>
          ${icon(item.icon)}${esc(item.label)}</a>`
      )
      .join('')}
    <span class="subnav__link" style="color:var(--ink-3);cursor:default">
      ${icon('circle-user')}${esc(account.caption)}
    </span>
    <a class="subnav__link" href="#/signin">${icon('log-out')}Sign-in screen</a>
  </div>`;
}

/** Turn the URL hash into a screen. */
function screenFor(hash) {
  const path = (hash || '').replace(/^#\/?/, '');
  const [head, param] = path.split('/');

  switch (head) {
    case 'signin': return Screens.signIn();
    case 'student': return Screens.studentHome();
    case 'rides': return Screens.myRides();
    case 'event': return Screens.eventDetail(param);
    case 'ride': return Screens.rideCard(param);
    case 'parent': return Screens.parentView();
    case 'driver': return Screens.driverView();
    case 'organizer': {
      // Pin the chosen event into the URL so later re-renders stay put.
      if (!param) {
        const fallback = Screens.defaultOrganizerEventId();
        if (fallback) {
          location.replace(`#/organizer/${fallback}`);
          return Screens.organizer(fallback);
        }
      }
      return Screens.organizer(param);
    }
    case 'cross': return Screens.crossActivity();
    case 'how': return Screens.howItWorks();
    default: return null; // fall through to the role's home screen
  }
}

function render() {
  const main = document.getElementById('main');

  let html = screenFor(location.hash);
  if (html === null) {
    location.replace(HOME[S.state.role]);
    return;
  }

  main.innerHTML =
    (flash ? `<div role="status" style="margin-bottom:14px">${notice(flash, '', 'check')}</div>` : '') +
    html;
  flash = null;

  renderRoleSwitcher();
  renderSubnav();

  // Lucide replaces every <i data-lucide="..."> with an inline SVG.
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });

  animateFill();
}

/* ---------------------------------------------------------------------------
   THE ONE ANIMATION
   ---------------------------------------------------------------------------
   After Fill the Gaps runs, the newly matched ticks on the dial turn red one
   at a time, about 40ms apart, in the exact order the algorithm seated those
   students. Then the number in the middle of the dial counts up to its new
   value. So the animation is not decoration — it is the algorithm's decision
   order, played back.

   If the secondary square grid is open, its squares fill too.

   Honours prefers-reduced-motion: if the viewer has asked for less motion,
   the ticks and the number are simply already at their final state.
--------------------------------------------------------------------------- */
function animateFill() {
  const fill = S.state.lastFill;
  if (!fill || fill.animated) return;

  const dial = document.querySelector('.dial');
  const grid = document.getElementById('spots-grid');
  if (!dial && !grid) return; // not on a screen that shows the roster

  fill.animated = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ids = fill.matchedStudentIds;

  // How many of the newly seated students are actually counted in the number
  // on screen right now. With a group filter on, the rest are dimmed out.
  let counted = 0;

  ids.forEach((studentId, i) => {
    const tick = dial && dial.querySelector(`[data-student="${studentId}"]`);
    if (tick && !tick.classList.contains('is-dim')) counted += 1;

    if (reduced) return;

    if (tick) {
      tick.style.animationDelay = `${i * 40}ms`;
      tick.classList.add('is-filling');
    }
    const square = grid && grid.querySelector(`[data-student="${studentId}"]`);
    if (square) {
      square.style.animationDelay = `${i * 40}ms`;
      square.classList.add('spot--filling');
    }
  });

  if (!reduced) countUp(counted);
}

/**
 * Count the dial's number up to the value already rendered in it.
 *
 * `steps` is how many students were just seated, so the counter starts that
 * far back and ticks up one at a time, roughly in step with the ticks filling
 * in around it.
 *
 * This uses a plain timer rather than requestAnimationFrame on purpose: the
 * number only ever moves by one integer at a time, so there is nothing for a
 * frame-accurate loop to add, and a timer behaves the same everywhere.
 */
function countUp(steps, stepMs = 45) {
  const node = document.getElementById('dial-number');
  if (!node || steps <= 0) return;

  const target = Number(node.textContent.trim());
  if (!Number.isFinite(target)) return;

  let current = target - steps;
  node.textContent = String(current);

  const timer = setInterval(() => {
    // If the screen re-rendered underneath us, stop and leave the fresh
    // markup alone rather than writing into a detached node.
    if (!node.isConnected) {
      clearInterval(timer);
      return;
    }
    current += 1;
    node.textContent = String(current);
    if (current >= target) clearInterval(timer);
  }, stepMs);
}

/* ---------------------------------------------------------------------------
   ACTIONS — one listener for every button in the app.
--------------------------------------------------------------------------- */
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const eventId = target.dataset.event;

  switch (action) {
    case 'noop':
      return;

    case 'go':
      location.hash = target.dataset.href;
      return;

    case 'set-role':
      S.setRole(target.dataset.role);
      location.hash = HOME[S.state.role];
      render(); // in case the hash did not actually change
      return;

    case 'demo-signin':
      flash = 'Stage 1 has no accounts yet — dropping you into the demo.';
      location.hash = HOME[S.state.role];
      render();
      return;

    case 'request-ride': {
      const result = S.requestRide(S.state.userId, eventId);
      flash = result.message;
      render();
      return;
    }

    case 'cancel-request':
      flash = S.cancelRequest(S.state.userId, eventId).message;
      render();
      return;

    case 'offer-seats': {
      const input = document.getElementById(`seats-${eventId}`);
      const seats = Math.max(1, Math.min(7, Number(input.value) || 1));
      flash = S.offerSeats(S.state.userId, eventId, seats).message;
      render();
      return;
    }

    case 'approve':
      flash = S.approveStudent(target.dataset.student).message;
      render();
      return;

    case 'toggle-pickup': {
      const ride = S.rideById(target.dataset.ride);
      S.markPickedUp(ride.id, !ride.pickedUp);
      render();
      return;
    }

    case 'fill-gaps': {
      const report = S.runFillTheGaps(eventId);
      flash =
        `Fill the Gaps seated ${report.matchedStudentIds.length} on this roster` +
        (report.crossActivityCount
          ? `, plus ${report.crossActivityCount} from ${report.crossActivityNames.join(' and ')}.`
          : '.');
      // Organizers stay put so they can watch the squares fill. Anyone
      // pressing it from the cross-activity screen stays there too.
      render();
      return;
    }

    case 'reset-demo':
      S.resetDemo();
      flash = 'Demo data reset.';
      render();
      return;

    // ---- view-only controls added by the redesign ----------------------
    case 'back':
      history.back();
      return;

    case 'toggle-auto-alert':
      view.autoAlert = !view.autoAlert;
      render();
      return;

    case 'group-filter':
      view.groupFilter = target.dataset.group;
      render();
      return;

    case 'toggle-offer': {
      // Same action the event screen uses. Off means zero open seats, which
      // is exactly how the matcher reads "this car is not available".
      const toggle = target;
      const on = toggle.getAttribute('aria-checked') === 'true';
      S.offerSeats(S.state.userId, toggle.dataset.event, on ? 0 : 3);
      render();
      return;
    }

    case 'toggle-gaps':
      view.showAllGaps = !view.showAllGaps;
      render();
      return;

    case 'toggle-spots':
      view.showAllSpots = !view.showAllSpots;
      render();
      return;

    case 'spot': {
      // Clicking a square names the student, without re-rendering the grid
      // (which would wipe the fill animation mid-flight).
      const person = S.personById(target.dataset.student);
      const detail = document.getElementById('spot-detail');
      if (detail) {
        detail.textContent =
          `${target.getAttribute('aria-label')} · ${S.hoodName(person.neighborhoodId)} · grade ${person.grade}`;
      }
      return;
    }

    default:
      return;
  }
});

/** Dropdowns: the event picker and the detour setting. */
document.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'pick-event') {
    S.state.lastFill = null; // the old report belongs to the old event
    location.hash = `#/organizer/${target.value}`;
    render();
  }

  if (target.dataset.action === 'set-detour') {
    S.setMaxDetour(Number(target.value));
    flash = `Max detour is now ${target.value} miles. Run Fill the Gaps again to see the difference.`;
    render();
  }
});

/* ---------------------------------------------------------------------------
   BOOT
   ---------------------------------------------------------------------------
   `?role=organizer` opens the app straight into a role. Handy for recording
   the demo video: one link per role, no clicking around first.
--------------------------------------------------------------------------- */
const roleParam = new URLSearchParams(location.search).get('role');
if (roleParam && S.DEMO_ACCOUNTS[roleParam]) S.setRole(roleParam);

if (isTourMode()) {
  // Tour mode takes over the page: one long scroll of real screens, no
  // router, no role switcher. Normal mode never reaches this branch.
  startTour();
} else {
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });

  render();
}
