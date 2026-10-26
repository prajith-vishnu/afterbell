/* ===========================================================================
   AfterBell — app.js
   Router, bottom tab bar, the demo role switcher, and every button.
   ===========================================================================
   Read the URL hash, ask screens.js for an HTML string, put it on the page,
   let Lucide swap in the icons and map.js draw any maps. Clicks are handled
   by ONE listener on the document that reads `data-action`.
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { esc, icon, notice } from './ui.js';
import { view } from './view.js';
import { drawAllMaps } from './map.js';
import { downloadRidePlan } from './export.js';
import { isTourMode, startTour } from './tour.js';
import { isPresentationMode, startPresentation } from './presentation.js';
import { isFilmMode, startFilmMode } from './film.js';

/* ---------------------------------------------------------------------------
   TABS
   The same four tabs for everyone. "Home" resolves to whatever home means
   for the role you are in.
--------------------------------------------------------------------------- */
const TABS = [
  { href: '#/home', label: 'Home', icon: 'house', match: ['home', 'event', 'pick', 'request', 'matching', 'organizer', 'cross', 'how'] },
  { href: '#/updates', label: 'Rides', icon: 'bell', match: ['updates', 'ride'] },
  { href: '#/activities', label: 'Activities', icon: 'users', match: ['activities'] },
  { href: '#/account', label: 'Account', icon: 'circle-user', match: ['account'] },
];

/** One line of confirmation after an action. */
let flash = null;

/* ---------------------------------------------------------------------------
   RENDER
--------------------------------------------------------------------------- */
function renderDemoBar() {
  const bar = document.getElementById('demobar');
  bar.innerHTML =
    `<span class="demobar__label">Demo</span>` +
    Object.entries(S.DEMO_ACCOUNTS)
      .map(
        ([role, account]) => `<button class="rolechip" role="tab"
          aria-selected="${role === S.state.role}" data-action="set-role" data-role="${esc(role)}"
          title="${esc(account.caption)}">${esc(account.label)}</button>`
      )
      .join('');
}

function renderTabs() {
  const bar = document.getElementById('tabbar');
  const section = (location.hash || '#/home').replace(/^#\//, '').split('/')[0];

  bar.innerHTML = TABS.map(
    (tab) => `<a class="tab" href="${esc(tab.href)}"
      ${tab.match.includes(section) ? 'aria-current="page"' : ''}>
      ${icon(tab.icon)}<span>${esc(tab.label)}</span>
    </a>`
  ).join('');
}

/** Home means something different per role. */
function homeScreen() {
  switch (S.state.role) {
    case 'parent': return Screens.parentView();
    case 'driver': return Screens.driverView();
    case 'organizer': return Screens.organizer(null);
    default: return Screens.studentHome();
  }
}

function screenFor(hash) {
  const path = (hash || '').replace(/^#\/?/, '');
  const [head, param] = path.split('/');

  switch (head) {
    case 'signin': return Screens.signIn();
    case 'home': return homeScreen();
    case 'pick': return Screens.pickEvent();
    case 'request': return Screens.requestRide(param);
    case 'matching': return Screens.matching(param);
    case 'event': return Screens.eventDetail(param);
    case 'ride': return Screens.rideCard(param);
    case 'updates': return Screens.updates();
    case 'activities': return Screens.activities();
    case 'account': return param === 'delete' ? Screens.confirmDelete() : Screens.account();
    case 'cross': return Screens.crossActivity();
    case 'how': return Screens.howItWorks();
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
    default: return null;
  }
}

function render() {
  const main = document.getElementById('main');

  let html = screenFor(location.hash);
  if (html === null) {
    location.replace('#/home');
    return;
  }

  main.innerHTML =
    (flash ? `<div class="pad" style="padding-top:12px" role="status">${notice(flash, '', 'check')}</div>` : '') +
    html;
  flash = null;

  renderDemoBar();
  renderTabs();

  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  drawAllMaps(S.state.data, main);

  animateFill();
}

/* ---------------------------------------------------------------------------
   THE DIAL ANIMATION
   After Fill the Gaps, the newly matched ticks turn red one at a time in the
   exact order the algorithm seated those students, and the number counts up
   alongside them. The animation is the algorithm's decision order played back.
--------------------------------------------------------------------------- */
function animateFill() {
  const fill = S.state.lastFill;
  if (!fill || fill.animated) return;

  const dial = document.querySelector('.dial');
  if (!dial) return;
  fill.animated = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let counted = 0;

  fill.matchedStudentIds.forEach((studentId, i) => {
    const tick = dial.querySelector(`.dial__tick[data-student="${studentId}"]`);
    if (tick && !tick.classList.contains('is-dim')) counted += 1;
    if (reduced || !tick) return;
    tick.style.animationDelay = `${i * 40}ms`;
    tick.classList.add('is-filling');
  });

  if (!reduced) countUp(document.getElementById('dial-number'), counted);
}

/**
 * Wind the number back by `steps` and walk it forward again.
 * There is a guaranteed finisher: if the interval is throttled part way, the
 * correct value still lands rather than leaving a stale number on screen.
 */
function countUp(node, steps, stepMs = 45) {
  if (!node || steps <= 0) return;
  const target = Number(node.textContent.trim());
  if (!Number.isFinite(target)) return;

  let current = target - steps;
  node.textContent = String(current);

  const timer = setInterval(() => {
    if (!node.isConnected) return clearInterval(timer);
    current += 1;
    node.textContent = String(current);
    if (current >= target) clearInterval(timer);
  }, stepMs);

  setTimeout(() => {
    clearInterval(timer);
    if (node.isConnected) node.textContent = String(target);
  }, stepMs * steps + 600);
}

/* ---------------------------------------------------------------------------
   ACTIONS
--------------------------------------------------------------------------- */
document.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const eventId = target.dataset.event;

  switch (action) {
    case 'go':
      location.hash = target.dataset.href;
      return;

    case 'set-role':
      S.setRole(target.dataset.role);
      view.homeFilter = null;
      location.hash = '#/home';
      render();
      return;

    case 'demo-signin':
      flash = 'Stage 1 has no accounts yet — dropping you into the demo.';
      location.hash = '#/home';
      render();
      return;

    case 'request-ride': {
      const result = S.requestRide(S.state.userId, eventId);
      if (!result.ok) {
        flash = result.message;
        render();
        return;
      }
      // Show the searching state briefly, then land wherever the student
      // actually ended up — a car if one exists, the event if not.
      location.hash = `#/matching/${eventId}`;
      setTimeout(() => {
        const status = S.rideStatusFor(S.state.userId, eventId);
        location.hash =
          status.code === 'confirmed' ? `#/ride/${status.ride.id}` : `#/event/${eventId}`;
      }, 2200);
      return;
    }

    case 'cancel-request':
      flash = S.cancelRequest(S.state.userId, eventId).message;
      render();
      return;

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

    case 'toggle-offer': {
      const on = target.getAttribute('aria-checked') === 'true';
      S.offerSeats(S.state.userId, eventId, on ? 0 : 3);
      render();
      return;
    }

    case 'seats-up':
    case 'seats-down': {
      const offer = S.offerById(`of-${eventId}-${S.state.userId}`);
      const current = offer ? offer.seats : 0;
      const next = Math.max(0, Math.min(7, current + (action === 'seats-up' ? 1 : -1)));
      S.offerSeats(S.state.userId, eventId, next);
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
      if (location.hash.startsWith('#/organizer')) {
        const pinned = `#/organizer/${eventId}`;
        if (location.hash !== pinned) {
          location.hash = pinned;
          return;
        }
      }
      render();
      return;
    }

    case 'export-plan': {
      const result = downloadRidePlan(eventId);
      flash = `Downloaded ${result.filename} — ${result.rows} students.`;
      render();
      return;
    }

    case 'reset-demo':
      S.resetDemo();
      view.homeFilter = null;
      view.groupFilter = 'ALL';
      flash = 'Demo data reset.';
      render();
      return;

    case 'group-filter':
      view.groupFilter = target.dataset.group;
      render();
      return;

    case 'home-filter':
      view.homeFilter = view.homeFilter === target.dataset.kind ? null : target.dataset.kind;
      render();
      return;

    case 'ride-pref':
      view.ridePreference = target.dataset.pref;
      render();
      return;

    case 'assign-open':
      view.assignOpenFor =
        view.assignOpenFor === target.dataset.student ? null : target.dataset.student;
      render();
      return;

    case 'assign-to': {
      const result = S.assignManually(target.dataset.student, eventId, target.dataset.driver);
      view.assignOpenFor = null;
      flash = result.message;
      render();
      return;
    }

    case 'toggle-gaps':
      view.showAllGaps = !view.showAllGaps;
      render();
      return;

    case 'log-out':
      S.state.signedIn = false;
      location.hash = '#/signin';
      render();
      return;

    case 'delete-account':
      location.hash = '#/account/delete';
      return;

    case 'delete-confirm': {
      const result = S.deleteAccount(S.state.userId);
      // Back to a role that still exists, which in the demo is the organizer.
      S.setRole('organizer');
      flash = result.message;
      location.hash = '#/signin';
      render();
      return;
    }

    default:
      return;
  }
});

/** Dropdowns. */
document.addEventListener('change', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  if (target.dataset.action === 'pick-event') {
    S.state.lastFill = null;
    location.hash = `#/organizer/${target.value}`;
    return;
  }

  if (target.dataset.action === 'set-detour') {
    S.setMaxDetour(Number(target.value));
    flash = `Max detour is now ${target.value} miles. Run Fill the Gaps again to see the difference.`;
    render();
  }

  if (target.dataset.action === 'set-neighborhood') {
    flash = S.updateNeighborhood(S.state.userId, target.value).message;
    render();
  }
});

/* ---------------------------------------------------------------------------
   BOOT
   `?role=organizer` opens straight into a role, handy when recording.
   `?tour=1` hands the page over to tour mode instead of the router.
--------------------------------------------------------------------------- */
const roleParam = new URLSearchParams(location.search).get('role');
if (roleParam && S.DEMO_ACCOUNTS[roleParam]) S.setRole(roleParam);

if (isFilmMode()) {
  // The whole demo video, start to finish, for screen recording.
  startFilmMode();
} else if (isPresentationMode()) {
  // Beat-by-beat walkthrough for recording. Space advances.
  startPresentation();
} else if (isTourMode()) {
  startTour();
} else {
  window.addEventListener('hashchange', () => {
    render();
    window.scrollTo(0, 0);
  });
  render();
}
