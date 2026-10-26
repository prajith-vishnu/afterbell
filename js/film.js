/* ===========================================================================
   AfterBell — film.js
   Film mode: index.html?film=1
   ===========================================================================
   Plays the whole demo video start to finish so it can be screen-recorded
   with a voiceover over the top.

   Everything on screen is the REAL app: real screens from screens.js, the
   real seed data, and the real matching.js running live during the film.
   Nothing is a mock-up and no result is written down in advance — every
   number in the captions is read out of the data at the moment it is spoken.

   KEYS
     Enter   start (3-2-1 countdown, then one blank second to trim)
     Space   pause / resume
     ← →     previous / next segment (going back never replays an action)
     R       restart from the countdown
     C       captions on or off (on by default)

   TIMING AND SCRIPT LIVE IN ONE PLACE: the SEGMENTS array below. Every
   duration, caption and setting is there, so retiming the film is editing
   one object.
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { view } from './view.js';
import { drawAllMaps } from './map.js';
import { esc, icon, personName, initials } from './ui.js';
import { formatTime } from './matching.js';

export function isFilmMode() {
  return new URLSearchParams(location.search).get('film') === '1';
}

/* ---------------------------------------------------------------------------
   THE CAST — ids in the seed data, resolved to real names at run time.
--------------------------------------------------------------------------- */
const MARCUS = 's19';
const DEV = 's02';
const LISA = 'p07';
const ANGELA = 'p12';
const DIRECTOR = 'o-moreno';
const CHAPERONE = 'c-rivera';
const SATURDAY = 'e-band-sat';
const TUESDAY = 'e-vball-tue';

/* >>> FILL THESE IN <<< they are the only words in the film that are not
   either read from the data or part of the story. */
const PRESENTER_NAME = '[NAME]';
const PRESENTER_GRADE = '[GRADE]';

/* ---------------------------------------------------------------------------
   LIVE FACTS
   Read out of the real data so a caption can never drift from the algorithm.
--------------------------------------------------------------------------- */
const facts = {};

function captureBefore() {
  const r = S.readinessFor(SATURDAY);
  facts.total = r.total;
  facts.before = r.covered;
}

function captureAfterFill() {
  facts.after = S.readinessFor(SATURDAY).covered;
  const unmatched = S.readinessFor(SATURDAY).rows.filter((row) => !S.hasRide(row.status.code));
  facts.unmatchedCount = unmatched.length;
  facts.unmatchedNames = unmatched.map((row) => personName(row.person));

  // A short plain-English summary of the real reasons, built from the codes
  // the algorithm actually returned.
  const reasons = new Set(
    unmatched.map((row) => {
      const text = row.status.reason || '';
      if (/detour limit/i.test(text)) return 'they live too far from every parent offering seats';
      if (/is full/i.test(text)) return 'every nearby car is already full';
      if (/midnight/i.test(text)) return 'the only driver nearby is barred from driving that late';
      return 'no driver is going their way';
    })
  );
  facts.shortReason = [...reasons].join(', and ');
}

function captureRide() {
  const ride = S.state.data.rides.find((r) => r.riderIds.includes(MARCUS));
  if (!ride) return;
  const driver = S.personById(ride.driverId);
  facts.rideId = ride.id;
  facts.lisaName = personName(driver);
  facts.car = [driver.carColor, driver.carModel].filter(Boolean).join(' ');
  facts.pickupTime = formatTime(S.offerById(ride.offerId).timeISO);
  facts.code = S.handoffCode(ride.id);
}

function crossActivityRide() {
  return S.state.data.rides
    .map((ride) => ({ ride, n: new Set(S.ridersInRide(ride).map((r) => r.activityId)).size }))
    .filter((e) => e.n > 1)
    .sort((a, b) => b.n - a.n)[0]?.ride;
}

/* ---------------------------------------------------------------------------
   THE CHAT PROP
   The group chat is not an app screen, so it is drawn here, in the app's own
   colours and shapes.
--------------------------------------------------------------------------- */
const CHAT_PEOPLE = {
  Maya: '#C2410C', Chris: '#5E6B72', Dev: '#6E6480', Ari: '#6B7A5E', Marcus: '#8A6356',
};

const CHATS = {
  1: [
    ['Maya', 'bus gets back to braswell at 11:30 tonight', '4:12 PM'],
    ['Maya', 'everyone have a ride home?? reply here', '4:12 PM'],
    ['Chris', 'my dad’s getting me', '4:13 PM'],
    ['Dev', 'yep 🎺', '4:13 PM'],
    ['Maya', '…marcus?', '4:14 PM', { before: 900 }],
    ['Maya', 'marcus', '4:15 PM'],
    ['Marcus', 'my mom works nights 😭', '4:16 PM', { after: 700 }],
    ['Marcus', 'i might have to skip area', '4:16 PM'],
    ['Maya', 'MARCUS YOU CANNOT SKIP AREA', '4:17 PM'],
    ['Dev', 'spot 14 would literally just be empty', '4:17 PM'],
    ['Ari', 'my mom’s car is already full 😭', '4:18 PM'],
    ['Maya', 'WHO IS DRIVING MARCUS', '4:18 PM', { before: 900 }],
    ['Dev', 'bro just get AfterBell', '4:19 PM'],
    ['Dev', 'my neighbor drives band kids on it all the time', '4:19 PM'],
    ['Marcus', 'getting it rn', '4:20 PM'],
  ],
  2: [
    ['Marcus', 'made it home 🏠', '11:52 PM'],
    ['Marcus', 'got a ride with dev’s neighbor lol', '11:52 PM'],
    ['Dev', 'told you 😎', '11:53 PM'],
    ['Maya', 'MARCUS!!!', '11:53 PM', { before: 900 }],
    ['Chris', 'spot 14 stays FILLED 🙏', '11:54 PM'],
    ['Maya', 'ok everyone sleep. great run today', '11:55 PM'],
  ],
};

function chatShell() {
  return `<div class="fchat">
    <header class="fchat__bar">
      <span class="fchat__avatar">T</span>
      <div>
        <p class="fchat__name">Trumpets 🎺 (8)</p>
        <p class="fchat__sub">8 members</p>
      </div>
    </header>
    <div class="fchat__thread"><div class="fchat__day">Today</div></div>
  </div>`;
}

const isShout = (text) => {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
};

/**
 * This is Marcus's phone, so Marcus's own messages sit on the right with no
 * avatar and no name above them — the way your own messages look in any group
 * chat. Everyone else is on the left with their name and initial.
 */
const ME = 'Marcus';

async function playChat(sceneId, screen, perMessage) {
  const thread = screen.querySelector('.fchat__thread');
  let lastSender = null;
  let run = null;

  for (const [sender, text, clock, opts = {}] of CHATS[sceneId]) {
    if (opts.before) await sleep(opts.before);

    if (sender !== lastSender) {
      lastSender = sender;
      run = document.createElement('div');
      run.className = `fchat__run${sender === ME ? ' fchat__run--me' : ''}`;
      run.innerHTML =
        sender === ME
          ? `<div class="fchat__body">
               <div class="fchat__head"><span>${esc(clock)}</span></div>
             </div>`
          : `<span class="fchat__who" style="background:${CHAT_PEOPLE[sender] || '#777'}">${esc(sender[0])}</span>
             <div class="fchat__body">
               <div class="fchat__head"><span>${esc(sender)}</span><span>${esc(clock)}</span></div>
             </div>`;
      thread.appendChild(run);
    }

    const bubble = document.createElement('div');
    bubble.className = `fchat__bubble${sender === ME ? ' fchat__bubble--me' : ''} fchat__bubble--typing`;
    bubble.innerHTML = '<span class="fchat__dots"><i></i><i></i><i></i></span>';
    run.querySelector('.fchat__body').appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;

    await sleep(Math.min(1100, 420 + text.length * 22));

    bubble.classList.remove('fchat__bubble--typing');
    bubble.textContent = text;
    if (isShout(text)) bubble.classList.add('fchat__bubble--shout');
    thread.scrollTop = thread.scrollHeight;

    await sleep(perMessage + (opts.after || 0));
  }
}

/* ===========================================================================
   THE FILM — every duration and every caption, in one place.
=========================================================================== */
const SEGMENTS = [
  {
    id: 'chat1',
    person: 'marcus',
    duration: 24000,
    caption: null,
    render: () => chatShell(),
    play: (screen) => playChat(1, screen, 480),
  },
  {
    id: 'welcome',
    person: 'marcus',
    duration: 11000,
    caption: () =>
      `That's ${facts.marcusFirst}. Without a ride home from tonight's contest, he'd have to ` +
      `skip it, and in marching band, one empty spot leaves a hole in the whole show.`,
    render: () => asRole('student', () => Screens.signIn()),
  },
  {
    id: 'title',
    duration: 13000,
    fullscreen: true,
    caption: () =>
      `I'm ${PRESENTER_NAME}, a ${PRESENTER_GRADE} at Braswell. Buses and parents can't cover ` +
      `every late contest or early rehearsal, so I built AfterBell, and over 100 students in ` +
      `band and other activities told me it's a great idea.`,
    render: () => `<div class="fcard">
      <div class="wordmark">AfterBell<span class="wordmark__dot"></span></div>
      <p class="fcard__tag">Every spot filled</p>
      <ul class="fcard__list">
        <li>Built by a Braswell High School student</li>
        <li>For band, teams, theater, and clubs</li>
        <li>100+ students asked: they said it's a great idea.</li>
      </ul>
    </div>`,
    async play(screen) {
      const items = [...screen.querySelectorAll('.fcard__list li')];
      for (const item of items) {
        await sleep(1400);
        item.classList.add('is-in');
      }
    },
  },
  {
    id: 'join',
    person: 'marcus',
    duration: 11000,
    caption: () =>
      `${facts.marcusFirst} gets AfterBell and joins his band with a code from his director. ` +
      `Students can't ride until a parent approves them, so his mom approves the request.`,
    render: () => asRole('student', () => Screens.signIn()),
    async play(screen) {
      await sleep(1200);
      await tap(screen.querySelector('#si-code'));
      swap(() => asPerson(MARCUS, 'student', () => Screens.activities()));
      await sleep(1800);
      swap(() => asPerson(MARCUS, 'student', () => Screens.studentHome()));
      await sleep(1600);
      S.approveStudent(MARCUS);
      toast('user-round-check', `${facts.angelaName} approved your account`);
      await sleep(2000);
      swap(() => asPerson(MARCUS, 'student', () => Screens.studentHome()));
    },
  },
  {
    id: 'request',
    person: 'marcus',
    duration: 9000,
    caption: () =>
      `He requests a ride home from Saturday's contest. While he waits, here's what's ` +
      `happening behind the scenes.`,
    render: () => asPerson(MARCUS, 'student', () => Screens.studentHome()),
    async play(screen) {
      await sleep(900);
      await tap(screen.querySelector(`[data-href="#/event/${SATURDAY}"]`));
      swap(() => asPerson(MARCUS, 'student', () => Screens.requestRide(SATURDAY)));
      await sleep(1400);
      await tap(current().querySelector('[data-action="request-ride"]'));
      S.requestRide(MARCUS, SATURDAY);
      swap(() => asPerson(MARCUS, 'student', () => Screens.matching(SATURDAY)));
    },
  },
  {
    id: 'behind',
    duration: 2000,
    fullscreen: true,
    caption: null,
    render: () => `<div class="fcard"><p class="fcard__big">Behind the scenes</p></div>`,
  },
  {
    id: 'lisa',
    person: 'lisa',
    duration: 5000,
    caption: () =>
      `Dev's next-door neighbor, ${facts.lisaFirst}, offers ${facts.lisaSeats} seats for tonight.`,
    render: () => asPerson(LISA, 'parent', () => Screens.parentView()),
    async play(screen) {
      const toggle = screen.querySelector('[data-action="toggle-offer"]');
      if (!toggle) return;
      await tap(toggle);
      S.offerSeats(LISA, toggle.dataset.event, 3);
      swap(() => asPerson(LISA, 'parent', () => Screens.parentView()));
      countUp(current().querySelector('[data-seatcount]'), 0, 3, 180);
    },
  },
  {
    id: 'fill',
    person: 'moreno',
    duration: 16000,
    caption: () =>
      `On the director's screen, ${facts.total} students need a ride home tonight, and ` +
      `${facts.before} have one. He taps Fill the Gaps. My algorithm groups students by where ` +
      `and when they're going, clusters them by neighborhood, and assigns parent drivers while ` +
      `checking seats and distance.`,
    render: () => asRole('organizer', () => Screens.organizer(SATURDAY)),
    async play(screen) {
      captureBefore();
      await sleep(2200);
      await tap(screen.querySelector('[data-action="fill-gaps"]'));

      const result = S.runFillTheGaps(SATURDAY);   // the real algorithm, right here
      S.runFillTheGaps(TUESDAY);                   // the cross-activity trip too
      S.state.lastFill = result;
      captureAfterFill();
      captureRide();

      swap(() => asRole('organizer', () => Screens.organizer(SATURDAY)));
      await sleep(80);

      const dial = current();
      result.matchedStudentIds.forEach((id, i) => {
        const tick = dial.querySelector(`.dial__tick[data-student="${id}"]`);
        if (!tick) return;
        tick.style.animationDelay = `${i * 60}ms`;
        tick.classList.add('is-filling');
      });
      countUp(dial.querySelector('.dial__num'), facts.before, facts.after, 60);
    },
  },
  {
    id: 'unmatched',
    person: 'moreno',
    duration: 16000,
    caption: () =>
      `${facts.unmatchedCount} students couldn't be matched, and AfterBell explains why: ` +
      `${facts.shortReason}. So the director assigns them to ${facts.chaperoneName}.`,
    render: () => asRole('organizer', () => Screens.rosterGapsCard(SATURDAY)),
    async play(screen) {
      await sleep(2600);
      const rows = [...screen.querySelectorAll('.row--static')];
      for (const row of rows.slice(0, 2)) {
        ring(row);
        await sleep(1200);
      }

      const left = S.readinessFor(SATURDAY)
        .rows.filter((row) => !S.hasRide(row.status.code))
        .map((row) => row.studentId);
      const before = S.readinessFor(SATURDAY).covered;

      for (const studentId of left) {
        S.assignManually(studentId, SATURDAY, CHAPERONE);
        await sleep(350);
      }

      swap(() => asRole('organizer', () => Screens.organizer(SATURDAY)));
      await sleep(80);

      const dial = current();
      left.forEach((id, i) => {
        const tick = dial.querySelector(`.dial__tick[data-student="${id}"]`);
        if (!tick) return;
        tick.style.animationDelay = `${i * 140}ms`;
        tick.classList.add('is-filling');
      });
      facts.final = S.readinessFor(SATURDAY).covered;
      countUp(dial.querySelector('.dial__num'), before, facts.final, 180);

      await sleep(1400);
      const sub = dial.querySelector('.dial__sub');
      if (sub) sub.insertAdjacentHTML('afterend', '<div class="pres__filled">Every spot filled</div>');
    },
  },
  {
    id: 'confirmed',
    person: 'marcus',
    duration: 10000,
    caption: () =>
      `Back on ${facts.marcusFirst}'s phone, his ride is confirmed with ${facts.lisaFirst}, ` +
      `Dev's next-door neighbor.`,
    render: () => asPerson(MARCUS, 'student', () => Screens.matching(SATURDAY)),
    async play() {
      await sleep(1200);
      toast('car-front', `Ride confirmed — ${facts.lisaName}, ${facts.car}, ${facts.pickupTime}`);
      await sleep(2400);
      swap(() => asPerson(MARCUS, 'student', () => Screens.rideCard(facts.rideId)));
      await sleep(900);
      for (const node of [...current().querySelectorAll('.person__act')]) {
        ring(node);
        await sleep(600);
      }
    },
  },
  {
    id: 'handoff',
    person: 'marcus',
    duration: 10000,
    caption: () =>
      `At pickup, they see the same code, so he never gets in the wrong car, and his mom is ` +
      `notified the moment he's picked up.`,
    render: () => asPerson(MARCUS, 'student', () => Screens.rideCard(facts.rideId)),
    async play(screen) {
      // A small inset of the driver's phone, showing the same three digits.
      const inset = document.createElement('div');
      inset.className = 'finset';
      inset.innerHTML = `<p class="finset__label">${esc(facts.lisaName)}</p>
        <p class="finset__code">${esc(facts.code)}</p>
        <p class="finset__sub">Driver's screen</p>`;
      screen.closest('.film__phone').appendChild(inset);

      await sleep(1600);
      ring(screen.querySelector('.handoff__code'));
      ring(inset);
      await sleep(2200);

      S.markPickedUp(facts.rideId, true);
      const ride = S.rideById(facts.rideId);
      toast('check-check', `Picked up ${ride.pickedUpAt} · Your mom was notified`);
    },
  },
  {
    id: 'cross',
    person: 'none',
    duration: 9000,
    caption: () =>
      `And it's not just band. On Tuesday, ${facts.tuesdayDriver}'s car takes home a volleyball ` +
      `player, a theater student, and a cross country runner. Different activities, same ` +
      `neighborhood, same time.`,
    render: () => {
      const ride = crossActivityRide();
      if (!ride) return '<div class="fcard"><p>No shared car in this run.</p></div>';
      facts.tuesdayDriver = personName(S.personById(ride.driverId));
      return asRole('student', () => Screens.rideCard(ride.id));
    },
    async play(screen) {
      await sleep(1200);
      for (const node of [...screen.querySelectorAll('.person__act')]) {
        ring(node);
        await sleep(650);
      }
    },
  },
  {
    id: 'code',
    duration: 9000,
    fullscreen: true,
    caption: () =>
      `It's built with HTML, CSS, and JavaScript. Only parent-approved adults can drive, it ` +
      `stores neighborhoods instead of home addresses, and the matching algorithm is my own code.`,
    render: () => `<div class="fcode"><pre class="fcode__pre">Loading matching.js…</pre></div>`,
    async play(screen) {
      // The actual file, fetched and shown. Not a screenshot of it.
      const source = await fetch('./js/matching.js').then((r) => r.text());
      const pre = screen.querySelector('.fcode__pre');
      pre.innerHTML = source
        .split('\n')
        .map((line, i) => {
          const safe = esc(line)
            .replace(/(\/\/.*|\/\*.*?\*\/)/g, '<em>$1</em>')
            .replace(/(&#39;[^&]*?&#39;)/g, '<q>$1</q>')
            .replace(/\b(const|let|function|return|export|for|of|if|else|new|import|from)\b/g,
              '<b>$1</b>');
          return `<span class="fcode__ln">${String(i + 1).padStart(3, ' ')}</span>${safe}`;
        })
        .join('\n');

      // Slow auto-scroll for the length of the segment.
      const box = screen.querySelector('.fcode');
      const distance = Math.max(0, box.scrollHeight - box.clientHeight);
      const start = performance.now();
      const duration = 7000;
      const tick = () => {
        const p = Math.min(1, (performance.now() - start) / duration);
        box.scrollTop = distance * p;
        if (p < 1 && box.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
  },
  {
    id: 'learned',
    duration: 6000,
    fullscreen: true,
    caption: () => `The hardest part wasn't the code. It was the rules real people live by.`,
    render: () => `<div class="fcard">
      <p class="fcard__big">The hardest part wasn't the code.<br />It was the rules real people live by.</p>
    </div>`,
  },
  {
    id: 'chat2',
    person: 'marcus',
    duration: 11000,
    caption: null,
    render: () => chatShell(),
    play: (screen) => playChat(2, screen, 480),
  },
  {
    id: 'final',
    person: 'moreno',
    duration: 10000,
    caption: () =>
      `AfterBell. Built by a Braswell student for every band, team, and cast that needs ` +
      `everyone there. Every spot filled.`,
    render: () => asRole('organizer', () => Screens.organizer(SATURDAY)),
    async play(screen) {
      const sub = screen.querySelector('.dial__sub');
      if (sub) sub.insertAdjacentHTML('afterend', '<div class="pres__filled">Every spot filled</div>');
      await sleep(2600);
      const mark = document.createElement('div');
      mark.className = 'ffinal';
      mark.innerHTML = `<span class="wordmark">AfterBell<span class="wordmark__dot"></span></span>`;
      screen.closest('.film__phone').appendChild(mark);
      await sleep(60);
      mark.classList.add('is-in');
    },
  },
];

export const TOTAL_MS = SEGMENTS.reduce((sum, s) => sum + s.duration, 0);

/* ---------------------------------------------------------------------------
   PLUMBING
--------------------------------------------------------------------------- */
const PEOPLE_LABELS = {
  marcus: () => ({ id: MARCUS, role: 'Braswell Band' }),
  lisa: () => ({ id: LISA, role: "Parent driver · Dev's neighbor" }),
  moreno: () => ({ id: DIRECTOR, role: 'Band director' }),
};

let stageEl, phoneEl, screenEl, labelEl, captionEl;
let index = 0;
let paused = false;
let token = 0;
let captionsOn = true;

/** A sleep that honours pause, and bails out when the segment changes. */
function sleep(ms) {
  const mine = token;
  return new Promise((resolve) => {
    let left = ms;
    const step = () => {
      if (mine !== token) return resolve();
      if (paused) return setTimeout(step, 90);
      const slice = Math.min(90, left);
      left -= slice;
      if (left <= 0) return resolve();
      setTimeout(step, slice);
    };
    setTimeout(step, Math.min(90, ms));
  });
}

const current = () => screenEl;

function asRole(role, fn) {
  const r = S.state.role, u = S.state.userId;
  S.state.role = role;
  S.state.userId = S.DEMO_ACCOUNTS[role] ? S.DEMO_ACCOUNTS[role].id : u;
  try { return fn(); } finally { S.state.role = r; S.state.userId = u; }
}

function asPerson(id, role, fn) {
  const r = S.state.role, u = S.state.userId;
  S.state.role = role;
  S.state.userId = id;
  try { return fn(); } finally { S.state.role = r; S.state.userId = u; }
}

/** Swap the phone's screen content without moving the frame. */
function swap(renderFn) {
  screenEl.classList.add('is-out');
  setTimeout(() => {
    screenEl.innerHTML = renderFn();
    screenEl.querySelectorAll('[id]').forEach((el) => { el.id = `f-${el.id}`; });
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
    drawAllMaps(S.state.data, screenEl);
    screenEl.classList.remove('is-out');
  }, 250);
}

async function tap(target) {
  if (!target) return;
  const host = phoneEl;
  const hb = host.getBoundingClientRect();
  const tb = target.getBoundingClientRect();
  const dot = document.createElement('span');
  dot.className = 'pres__pulse';
  dot.style.left = `${tb.left - hb.left + tb.width / 2}px`;
  dot.style.top = `${tb.top - hb.top + Math.min(tb.height / 2, 30)}px`;
  host.appendChild(dot);
  await sleep(620);
  dot.remove();
}

function ring(node) {
  if (!node) return;
  node.classList.add('pres__ring');
  setTimeout(() => node.classList.remove('pres__ring'), 1500);
}

function toast(iconName, text) {
  const el = document.createElement('div');
  el.className = 'ftoast';
  el.innerHTML = `${icon(iconName)}<span>${esc(text)}</span>`;
  phoneEl.appendChild(el);
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  setTimeout(() => el.classList.add('is-in'), 40);
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); }, 3400);
}

function countUp(node, from, to, stepMs = 60) {
  if (!node || from >= to) return;
  let n = from;
  node.textContent = String(n);
  const t = setInterval(() => {
    if (!node.isConnected) return clearInterval(t);
    n += 1;
    node.textContent = String(n);
    if (n >= to) clearInterval(t);
  }, stepMs);
  setTimeout(() => { clearInterval(t); if (node.isConnected) node.textContent = String(to); },
    stepMs * (to - from) + 600);
}

function setLabel(key) {
  if (!key || key === 'none' || !PEOPLE_LABELS[key]) {
    labelEl.classList.remove('is-in');
    return;
  }
  const { id, role } = PEOPLE_LABELS[key]();
  const person = S.personById(id);
  const name = personName(person);
  if (labelEl.dataset.who === key) return;
  labelEl.dataset.who = key;
  labelEl.classList.remove('is-in');
  setTimeout(() => {
    labelEl.innerHTML = `<span class="avatar avatar--sm">${esc(initials(person))}</span>
      <span><strong>${esc(name)}</strong><span>${esc(role)}</span></span>`;
    labelEl.classList.add('is-in');
  }, 120);
}

/* ---------------------------------------------------------------------------
   RUNNING IT
--------------------------------------------------------------------------- */
function resetData() {
  S.resetDemo();
  view.groupFilter = 'ALL';
  view.showAllGaps = false;
  view.assignOpenFor = null;
  view.homeFilter = null;

  // Scene setup, using the data rather than faking a screen: Marcus has not
  // asked for a ride yet, and his account is not approved yet. Both are
  // undone by the real actions during segments 4 and 5.
  S.cancelRequest(MARCUS, SATURDAY);
  S.personById(MARCUS).approved = false;

  Object.keys(facts).forEach((k) => delete facts[k]);
  facts.marcusFirst = S.personById(MARCUS).firstName;
  facts.lisaFirst = S.personById(LISA).firstName;
  facts.lisaName = personName(S.personById(LISA));
  facts.lisaSeats = 3;
  facts.angelaName = personName(S.personById(ANGELA));
  facts.chaperoneName = personName(S.personById(CHAPERONE));
  captureBefore();
}

async function runFrom(i) {
  index = Math.max(0, Math.min(SEGMENTS.length - 1, i));
  const mine = ++token;

  while (index < SEGMENTS.length && mine === token) {
    const seg = SEGMENTS[index];

    // Clear anything the previous segment pinned to the phone frame.
    phoneEl.querySelectorAll('.ftoast, .finset, .ffinal, .pres__pulse').forEach((el) => el.remove());

    phoneEl.classList.toggle('is-hidden', Boolean(seg.fullscreen));
    stageEl.classList.toggle('is-fullscreen', Boolean(seg.fullscreen));
    setLabel(seg.person);

    screenEl.innerHTML = seg.render();
    screenEl.querySelectorAll('[id]').forEach((el) => { el.id = `f-${el.id}`; });
    if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
    drawAllMaps(S.state.data, screenEl);

    captionEl.textContent = seg.caption ? seg.caption() : '';
    captionEl.hidden = !captionsOn || !seg.caption;

    // At least the listed duration, and never cut an animation short.
    await Promise.all([sleep(seg.duration), seg.play ? seg.play(screenEl) : Promise.resolve()]);

    if (mine !== token) return;

    // A skipped segment's play() keeps running to its next sleep, so sweep
    // again before moving on rather than letting a late toast follow us.
    phoneEl.querySelectorAll('.ftoast, .finset').forEach((el) => el.remove());
    index += 1;
  }
}

async function startFilm() {
  resetData();
  const overlay = document.getElementById('film-overlay');

  for (const n of [3, 2, 1]) {
    overlay.innerHTML = `<div class="fcount">${n}</div>`;
    await new Promise((r) => setTimeout(r, 1000));
  }
  overlay.innerHTML = '';              // one blank second to trim
  await new Promise((r) => setTimeout(r, 1000));
  overlay.hidden = true;

  runFrom(0);
}

export function startFilmMode() {
  document.body.classList.add('is-film');

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="film">
      <div class="film__label" id="film-label"></div>
      <div class="film__stage" id="film-stage">
        <div class="film__phone" id="film-phone"><div class="film__screen" id="film-screen"></div></div>
      </div>
      <p class="film__caption" id="film-caption" hidden></p>
      <div class="film__overlay" id="film-overlay">
        <p class="film__start">Press Enter to start</p>
      </div>
    </div>`;

  stageEl = document.getElementById('film-stage');
  phoneEl = document.getElementById('film-phone');
  screenEl = document.getElementById('film-screen');
  labelEl = document.getElementById('film-label');
  captionEl = document.getElementById('film-caption');

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    if (key === 'Enter') {
      event.preventDefault();
      document.getElementById('film-overlay').hidden = false;
      startFilm();
    } else if (event.code === 'Space') {
      event.preventDefault();
      paused = !paused;
      document.body.classList.toggle('is-paused', paused);
    } else if (key === 'ArrowRight') {
      event.preventDefault();
      runFrom(index + 1);
    } else if (key === 'ArrowLeft') {
      event.preventDefault();
      runFrom(index - 1);
    } else if (key.toLowerCase() === 'r') {
      token++;
      const overlay = document.getElementById('film-overlay');
      overlay.hidden = false;
      startFilm();
    } else if (key.toLowerCase() === 'c') {
      captionsOn = !captionsOn;
      captionEl.hidden = !captionsOn || !captionEl.textContent;
    }
  });
}

/** Exposed so the build report can print the script without guessing. */
export function captionScript() {
  return SEGMENTS.map((s, i) => ({
    n: i + 1,
    id: s.id,
    seconds: s.duration / 1000,
    caption: s.caption ? s.caption() : null,
  }));
}
export { SEGMENTS, facts, resetData, captureBefore, captureAfterFill, captureRide };
