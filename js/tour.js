/* ===========================================================================
   AfterBell — tour.js
   Tour mode: open index.html?tour=1
   ===========================================================================
   One long scroll of the REAL app. Every section renders a real screen from
   screens.js, with the real seed data, and every automatic action calls the
   same functions a real tap calls — requestRide, approveStudent, offerSeats,
   runFillTheGaps. Nothing here fakes a result or draws a stand-in screen. If
   the matching algorithm changed, this tour would change with it.

   Normal mode is untouched: without ?tour=1 none of this runs.
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { view } from './view.js';
import { buildRidePlanRows, ridePlanFilename } from './export.js';
import { esc } from './ui.js';

const SATURDAY = 'e-band-sat';   // the contest the readiness demo runs on
const TUESDAY = 'e-vball-tue';   // the trip that produces a cross-activity car

/** Tour mode is a URL flag, so a normal visit is never affected. */
export function isTourMode() {
  return new URLSearchParams(location.search).get('tour') === '1';
}

/* ---------------------------------------------------------------------------
   SMALL HELPERS
--------------------------------------------------------------------------- */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Render a real screen as if a particular role were signed in.
 *
 * The screens read the current role out of state, so the tour borrows it for
 * the length of one render and hands it straight back. It sets the two fields
 * directly rather than calling setRole, because setRole also clears the last
 * Fill the Gaps result and the tour needs to keep that.
 */
function renderAs(role, fn) {
  const previousRole = S.state.role;
  const previousUser = S.state.userId;
  S.state.role = role;
  S.state.userId = S.DEMO_ACCOUNTS[role].id;
  try {
    return fn();
  } finally {
    S.state.role = previousRole;
    S.state.userId = previousUser;
  }
}

/**
 * Ids are unique per document, and the tour puts several screens on one page.
 * Prefix every id inside a section so two dials can coexist.
 */
function namespaceIds(root, prefix) {
  root.querySelectorAll('[id]').forEach((el) => {
    el.id = `${prefix}-${el.id}`;
  });
}

/** A soft circle pulse where a finger would tap. */
async function tapPulse(phone, target) {
  if (!target) return;
  const phoneBox = phone.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();

  const dot = document.createElement('span');
  dot.className = 'tour__pulse';
  dot.style.left = `${targetBox.left - phoneBox.left + targetBox.width / 2}px`;
  dot.style.top = `${targetBox.top - phoneBox.top + Math.min(targetBox.height / 2, 30)}px`;
  phone.appendChild(dot);

  await wait(reducedMotion() ? 120 : 620);
  dot.remove();
}

/**
 * Count a number up to a target, one step at a time.
 *
 * The number already on screen is the true one; counting up means winding it
 * back and walking it forward. So there is a guaranteed finisher: if the
 * interval is ever throttled part-way, the correct value still lands rather
 * than leaving a stale number on camera.
 */
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

/** Briefly draw attention to a set of elements, one after another. */
async function highlightEach(nodes, gap = 420) {
  for (const node of nodes) {
    node.classList.add('tour__flash');
    await wait(gap);
    node.classList.remove('tour__flash');
  }
}

/* ---------------------------------------------------------------------------
   RUNNING THE REAL ALGORITHM
   The tour runs it exactly once, for the two trips the video talks about, and
   every later section reads from that one real result.
--------------------------------------------------------------------------- */
let saturdayResult = null;
let hasMatched = false;
let pollTimer = null;

function ensureMatched() {
  if (hasMatched) return saturdayResult;
  hasMatched = true;

  // Section 1 starts by withdrawing Jalen's Saturday request, because the
  // story is "a student with no ride asks for one". If the viewer jumps
  // straight to a later section, put it back first, so the algorithm sees
  // the same 16 waiting students either way.
  const stillThere = S.state.data.requests.some(
    (r) => r.studentId === 's19' && r.eventId === SATURDAY
  );
  if (!stillThere) S.requestRide('s19', SATURDAY);

  saturdayResult = S.runFillTheGaps(SATURDAY);
  S.runFillTheGaps(TUESDAY); // produces the cross-activity car

  // Leave the Saturday report as the current one, so the organizer screen
  // renders the summary for the trip this tour is about.
  S.state.lastFill = saturdayResult;
  return saturdayResult;
}

/** The car from the real results carrying the most different activities. */
function mostMixedRide() {
  return S.state.data.rides
    .map((ride) => ({
      ride,
      activities: new Set(S.ridersInRide(ride).map((r) => r.activityId)).size,
      riders: ride.riderIds.length,
    }))
    .filter((entry) => entry.activities > 1)
    .sort((a, b) => b.activities - a.activities || b.riders - a.riders)[0]?.ride;
}

/* ---------------------------------------------------------------------------
   THE SECTIONS
   Each one: a real screen, and an action that drives it with real functions.
--------------------------------------------------------------------------- */
const SECTIONS = [
  {
    id: 'ask',
    title: 'A student with no ride asks for one',
    note: 'Jalen is in the marching band. The buses do not run late enough to get him home from Saturday’s contest.',
    render: () => renderAs('student', () => Screens.studentHome()),
    setup: () => {
      // The starting state for the story, set with the real action.
      S.cancelRequest('s19', SATURDAY);
    },
    async play(section, phone, rerender) {
      const row = phone.querySelector(`[data-href="#/event/${SATURDAY}"]`);
      await tapPulse(phone, row);
      S.requestRide('s19', SATURDAY);
      rerender();
    },
  },

  {
    id: 'parent',
    title: 'A parent approves, and offers seats',
    note: 'A student cannot be put in anyone’s car until a parent approves the account. Dana approves Aaliyah, then offers three seats of her own.',
    render: () => renderAs('parent', () => Screens.parentView()),
    async play(section, phone, rerender) {
      const approve = phone.querySelector('[data-action="approve"]');
      await tapPulse(phone, approve);
      S.approveStudent(approve.dataset.student);
      rerender();

      await wait(450);

      const toggle = phone.querySelector('[data-action="toggle-offer"]');
      await tapPulse(phone, toggle);
      S.offerSeats(S.DEMO_ACCOUNTS.parent.id, toggle.dataset.event, 3);
      rerender();

      // The seat count counts up to the three seats that were just offered.
      const seatNode = phone.querySelector('[data-seatcount]');
      countUp(seatNode, 0, 3, 160);
    },
  },

  {
    id: 'before',
    title: 'The director sees who can actually get there',
    note: 'One tick per member of the roster. Filled means they have a ride home. This is the real count, before any matching has run.',
    render: () => renderAs('organizer', () => Screens.organizer(SATURDAY)),
  },

  {
    id: 'fill',
    title: 'Fill the Gaps runs the real algorithm',
    note: 'Bucket by trip, cluster by neighbourhood, then fill each driver’s seats with the nearest riders — inside seat capacity, the Texas provisional passenger limit, the midnight curfew, and a three-mile detour cap.',
    render: () => renderAs('organizer', () => Screens.organizer(SATURDAY)),
    async play(section, phone, rerender) {
      const before = S.readinessFor(SATURDAY).covered;

      const button = phone.querySelector('[data-action="fill-gaps"]');
      await tapPulse(phone, button);

      const result = ensureMatched();
      rerender();

      const after = S.readinessFor(SATURDAY).covered;
      const dialNumber = phone.querySelector('.dial__num');

      if (reducedMotion()) {
        if (dialNumber) dialNumber.textContent = String(after);
        return;
      }

      // The ticks fill in the order the algorithm seated those students, so
      // the animation is its real decision order played back.
      result.matchedStudentIds.forEach((studentId, i) => {
        const tick = phone.querySelector(`.dial__tick[data-student="${studentId}"]`);
        if (!tick) return;
        tick.style.animationDelay = `${i * 40}ms`;
        tick.classList.add('is-filling');
      });
      countUp(dialNumber, before, after);
    },
  },

  {
    id: 'shared',
    lazy: true,
    title: 'One car, more than one activity',
    note: 'Nobody organised this car. The algorithm grouped these students because they leave from the same place inside the same fifteen minutes — the activity is deliberately not part of that key.',
    prepare: () => ensureMatched(),
    render: () => {
      const ride = mostMixedRide();
      return ride
        ? renderAs('student', () => Screens.rideCard(ride.id))
        : '<section class="ab-card"><p class="ab-label">No shared car in this run.</p></section>';
    },
    async play(section, phone) {
      await highlightEach([...phone.querySelectorAll('.person__act')]);
    },
  },

  {
    id: 'gaps',
    lazy: true,
    title: 'And it says who it could not help, and why',
    note: 'Two students are left. The algorithm does not shrug — it names the rule that stopped it, so the director knows exactly what to go find.',
    prepare: () => ensureMatched(),
    render: () => renderAs('organizer', () => Screens.rosterGapsCard(SATURDAY)),
  },

  {
    id: 'handoff',
    lazy: true,
    title: 'The same three digits on both phones',
    note: 'So a student never gets into the wrong car. The code comes from the car’s id, so the rider and the driver always compute the same number.',
    wide: true,
    prepare: () => ensureMatched(),
    panes: () => {
      const ride = S.state.data.rides.find((r) => r.riderIds.includes('s19')) ||
        S.state.data.rides[0];
      const rider = S.personById(ride.riderIds[0]);
      const driver = S.personById(ride.driverId);
      return [
        { label: `Rider — ${rider.firstName} ${rider.lastInitial}.`, html: renderAs('student', () => Screens.rideCard(ride.id)) },
        { label: `Driver — ${driver.firstName} ${driver.lastInitial}.`, html: renderAs('driver', () => Screens.rideCard(ride.id)) },
      ];
    },
    async play(section, phone) {
      await highlightEach([...section.querySelectorAll('.handoff__code')], 900);
    },
  },

  {
    id: 'export',
    lazy: true,
    title: 'And the director walks out with the plan',
    note: 'One CSV: who is in whose car, the pickup time, the handoff code \u2014 and the students it could not seat, with the reason, because a plan that quietly drops them is the problem this app exists to fix.',
    prepare: () => ensureMatched(),
    render: () => {
      // The real rows the real export writes. Nothing is retyped here.
      const rows = buildRidePlanRows(SATURDAY);
      const columns = ['Student', 'Group/Section', 'Driver', 'Car', 'Handoff Code', 'Status'];
      const preview = [...rows.filter((r) => !r.Driver).slice(0, 2), ...rows.filter((r) => r.Driver).slice(0, 5)];

      return `<section class="pad" style="padding-top:20px;padding-bottom:20px">
        <p class="label">${esc(ridePlanFilename(SATURDAY))}</p>
        <p class="row__meta" style="margin:8px 0 14px">${rows.length} students in the file.</p>
        <div class="csvwrap">
          <table class="csv">
            <thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
            <tbody>
              ${preview
                .map(
                  (row) => `<tr>${columns
                    .map((c) => `<td>${esc(row[c] || '\u2014')}</td>`)
                    .join('')}</tr>`
                )
                .join('')}
            </tbody>
          </table>
        </div>
        <button class="btn" style="margin-top:16px" data-action="export-plan"
                data-event="${esc(SATURDAY)}">Export ride plan</button>
      </section>`;
    },
    async play(section, phone) {
      const button = phone.querySelector('[data-action="export-plan"]');
      await tapPulse(phone, button);
    },
  },
];

/* ---------------------------------------------------------------------------
   BUILD AND RUN
--------------------------------------------------------------------------- */
export function startTour() {
  document.body.classList.add('is-tour');
  build();
}

/** Render a section's phone (or pair of phones) from the live state. */
function mountPanes(section, def) {
  const stage = section.querySelector('.tour__stage');
  stage.innerHTML = '';

  const panes = def.panes ? def.panes() : [{ label: null, html: def.render() }];

  panes.forEach((pane, paneIndex) => {
    const frame = document.createElement('div');
    frame.className = 'tour__frame';
    frame.innerHTML = `
      ${pane.label ? `<p class="tour__panelabel">${pane.label}</p>` : ''}
      <div class="tour__phone"><div class="tour__screen">${pane.html}</div></div>`;
    namespaceIds(frame, `${def.id}${paneIndex}`);
    stage.appendChild(frame);
  });

  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });
}

function build() {
  // Reset so a restart always tells the same story.
  S.resetDemo();
  view.groupFilter = 'ALL';
  view.showAllSpots = false;
  view.showAllGaps = false;
  saturdayResult = null;
  hasMatched = false;

  const main = document.getElementById('main');
  main.innerHTML = '';

  const tour = document.createElement('div');
  tour.className = 'tour';
  tour.innerHTML = `
    <header class="tour__intro">
      <p class="tour__kicker">AfterBell</p>
      <h1>every spot filled</h1>
      <p>Getting students to the things they signed up for, by grouping them by
      where they live and when their activity starts or ends — across every
      activity. Scroll.</p>
    </header>`;
  main.appendChild(tour);

  SECTIONS.forEach((def, index) => {
    if (def.setup) def.setup();

    const section = document.createElement('section');
    section.className = `tour__section${def.wide ? ' tour__section--wide' : ''}`;
    section.dataset.tour = def.id;

    section.innerHTML = `
      <div class="tour__meta">
        <span class="tour__num">${index + 1}</span>
        <div>
          <h2>${def.title}</h2>
          <p>${def.note}</p>
        </div>
      </div>
      <div class="tour__stage"></div>`;

    // Lazy sections stay empty until the viewer reaches them. That matters:
    // sections 5 to 7 need the algorithm to have run, and running it at build
    // time would mean sections 1 and 4 opened already showing the result.
    if (!def.lazy) mountPanes(section, def);

    tour.appendChild(section);

    // Re-render this section's first phone from the live state.
    section.__rerender = () => {
      const screen = section.querySelector('.tour__screen');
      screen.innerHTML = def.render();
      namespaceIds(screen, def.id);
      if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });
    };
  });

  const footer = document.createElement('div');
  footer.className = 'tour__end';
  footer.innerHTML = `
    <p>That is the whole product. One car, two activities, every spot filled.</p>
    <button class="ab-btn ab-btn--primary" id="tour-restart">Restart tour</button>`;
  tour.appendChild(footer);

  footer.querySelector('#tour-restart').addEventListener('click', () => {
    build();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 1.5 } });
  observe();
}

/**
 * Play a section's action when it reaches the middle of the screen, once.
 *
 * Once is the point: scrolling back up during a take must not restart an
 * animation that is already on camera. The `played` flag is what guarantees
 * that, and it is why both triggers below can safely call the same function.
 */
function activate(section) {
  if (section.dataset.played) return;
  section.dataset.played = '1';

  const def = SECTIONS.find((d) => d.id === section.dataset.tour);
  if (!def) return;

  // A lazy section runs the algorithm and renders itself the first time it is
  // reached, so it always shows the live result.
  if (def.lazy) {
    if (def.prepare) def.prepare();
    mountPanes(section, def);
  }

  if (!def.play) return;

  setTimeout(() => {
    const phone = section.querySelector('.tour__phone');
    def.play(section, phone, section.__rerender);
  }, 600);
}

/** Has this section crossed the vertical middle of the window? */
function isCentred(section) {
  const box = section.getBoundingClientRect();
  const middle = window.innerHeight / 2;
  return box.top <= middle && box.bottom >= middle;
}

function checkAll() {
  document.querySelectorAll('.tour__section').forEach((section) => {
    if (isCentred(section)) activate(section);
  });
}

function observe() {
  // IntersectionObserver is the primary trigger: the root is squeezed to a
  // thin band across the middle of the window, so a section fires when it
  // scrolls into the centre.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activate(entry.target);
      }
    },
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
  );
  document.querySelectorAll('.tour__section').forEach((s) => observer.observe(s));

  // A timer doing the same check, as a backstop. Observer callbacks and
  // scroll events both ride on the rendering lifecycle, which gets throttled
  // in exactly the situations this mode is built for: a tab in the
  // background, or a window being captured by screen-recording software. A
  // quarter-second poll is cheap and never misses. Both paths call
  // activate(), and the `played` flag means whichever arrives second does
  // nothing at all.
  clearInterval(pollTimer);
  pollTimer = setInterval(checkAll, 250);

  checkAll();
}
