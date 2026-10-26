/* ===========================================================================
   AfterBell — film.js
   Film mode: index.html?film=1
   ===========================================================================
   Plays the whole demo video start to finish, hands-off, so it can be screen
   recorded with a live voiceover. It records nothing and plays no audio.

   HOW IT STAYS HONEST
   The REAL matching algorithm runs exactly once, at the moment the film
   starts, on Saturday's ride home and on Tuesday's trip. Every number, name,
   car and time in the captions is read out of that one real run. Every
   segment then restores a saved snapshot of the data and renders a REAL
   screen from screens.js, so no segment depends on what the segment before
   it happened to leave on the page.

   OTHER MODES
     ?film=1&seg=N    preview one segment on its own
     ?film=1&check=1  run every segment at 8x and print a PASS/FAIL report

   KEYS DURING PLAYBACK (optional, for practice)
     Space  pause / resume      Esc  stop and go back to the Play button
     C      captions on or off (on by default)
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

/* ===========================================================================
   CONFIG — every duration, every caption, every bit of pacing, in one place.
=========================================================================== */
const CONFIG = {
  /* >>> FILL THESE IN <<< the only two words not read from the data. */
  presenterName: '[NAME]',
  presenterGrade: '[GRADE]',

  blankStartMs: 2000,   // trimmable run-in
  holdLastMs: 3000,     // hold on the final frame
  transitionMs: 250,
  tapPulseMs: 620,
  maxRuntimeMs: 178000, // 2:58 hard cap, checked by the self-check

  // The stage is laid out at this logical size and scaled to fit any screen.
  stage: { width: 1240, height: 880 },

  chat: {
    gapMs: 1200,         // between messages
    typeBaseMs: 500,
    typePerCharMs: 20,
    typeMaxMs: 1500,
  },

  // Who the label above the phone names.
  people: {
    marcus: { id: 's19', role: 'Trumpets' },
    lisa: { id: 'p07', role: "Parent driver · Dev's neighbor" },
    moreno: { id: 'o-moreno', role: 'Band director' },
  },

  // seconds + caption for every segment. Chat segments time themselves.
  segments: {
    chat1: { seconds: null, person: 'marcus', caption: null },
    hook: {
      seconds: 11, person: 'marcus',
      caption: (f) =>
        `That's ${f.marcusFirst}. Without a ride home from tonight's contest, he'd have to ` +
        `skip it, and in marching band, one empty spot leaves a hole in the whole show.`,
    },
    title: {
      seconds: 16, person: null,
      caption: (f) =>
        `I'm ${f.presenterName}, a ${f.presenterGrade} at Braswell, and this is AfterBell: ` +
        `a free app that matches students who need rides to their activities with ` +
        `parent-approved drivers. It's for students, parents, and directors, and over ` +
        `100 students told me it's a great idea.`,
    },
    join: {
      seconds: 11, person: 'marcus',
      caption: (f) =>
        `${f.marcusFirst} gets AfterBell and joins his band with a code from his director. ` +
        `Students can't ride until a parent approves them, so his mom approves the request.`,
    },
    request: {
      seconds: 8, person: 'marcus',
      caption: () =>
        `He requests a ride home from Saturday's contest. While he waits, here's what's ` +
        `happening behind the scenes.`,
    },
    behind: { seconds: 2, person: null, caption: null },
    lisa: {
      seconds: 5, person: 'lisa',
      caption: (f) => `Dev's next-door neighbor, Lisa, offers ${f.lisaSeats} seats for tonight.`,
    },
    fill: {
      seconds: 17, person: 'moreno',
      caption: (f) =>
        `On the director's screen, ${f.total} students need a ride home tonight, and ` +
        `${f.before} have one. He taps Fill the Gaps. AfterBell's algorithm groups students ` +
        `by where and when they're going, clusters them by neighborhood, and assigns parent ` +
        `drivers while checking seats and distance.`,
    },
    gaps: {
      seconds: 10, person: 'moreno',
      caption: (f) =>
        `${f.unmatchedCount} students couldn't be matched, and AfterBell explains why: ` +
        `${f.shortReason}. So the director assigns them to ${f.chaperoneName}.`,
    },
    confirmed: {
      seconds: 7, person: 'marcus',
      caption: (f) =>
        `Back on ${f.marcusFirst}'s phone, his ride is confirmed with ${f.lisaFirst}, ` +
        `Dev's next-door neighbor.`,
    },
    handoff: {
      seconds: 10, person: 'marcus',
      caption: () =>
        `At pickup, they see the same code, so he never gets in the wrong car, and his mom ` +
        `is notified the moment he's picked up.`,
    },
    cross: {
      seconds: 10, person: null,
      caption: (f) =>
        `And it's not just band. On Tuesday, ${f.tuesdayDriver}'s car takes home a volleyball ` +
        `player, a theater student, and a cross country runner.`,
    },
    code: {
      seconds: 12, person: null,
      caption: () =>
        `It's built with HTML, CSS, and JavaScript. The algorithm groups requests by time and ` +
        `place, measures distance between neighborhoods with the haversine formula, and fills ` +
        `seats closest-first within three miles.`,
    },
    rules: {
      seconds: 12, person: null,
      caption: () =>
        `Only parent-approved adults can drive, and AfterBell stores neighborhoods, never home ` +
        `addresses. Building this taught me that the hardest part of an app isn't the code. ` +
        `It's the rules real people live by.`,
    },
    chat2: { seconds: null, person: 'marcus', caption: null },
    final: {
      seconds: 9, person: 'moreno',
      caption: () =>
        `AfterBell. Built by a Braswell student for every band, team, and cast that needs ` +
        `everyone there. Every spot filled.`,
    },
  },

  chats: {
    chat1: [
      ['Maya', 'bus gets back to braswell at 11:30 tonight', '4:12 PM'],
      ['Maya', 'everyone have a ride home?? reply here', '4:12 PM'],
      ['Maya', '…marcus?', '4:14 PM'],
      ['Marcus', 'my mom works nights 😭', '4:16 PM'],
      ['Marcus', 'i might have to skip area', '4:16 PM'],
      ['Maya', 'MARCUS YOU CANNOT SKIP AREA', '4:17 PM'],
      ['Dev', 'spot 14 would literally just be empty', '4:17 PM'],
      ['Ari', 'my mom’s car is already full 😭', '4:18 PM'],
      ['Maya', 'WHO IS DRIVING MARCUS', '4:18 PM'],
      ['Dev', 'bro just get AfterBell', '4:19 PM'],
      ['Dev', 'my neighbor drives band kids on it all the time', '4:19 PM'],
      ['Marcus', 'getting it rn', '4:20 PM'],
    ],
    chat2: [
      ['Marcus', 'made it home 🏠', '11:52 PM'],
      ['Marcus', 'got a ride with dev’s neighbor lol', '11:52 PM'],
      ['Dev', 'told you 😎', '11:53 PM'],
      ['Maya', 'MARCUS!!!', '11:53 PM'],
      ['Chris', 'spot 14 stays FILLED 🙏', '11:54 PM'],
    ],
  },
};

/* The order the film plays in. */
const ORDER = [
  'chat1', 'hook', 'title', 'join', 'request', 'behind', 'lisa', 'fill',
  'gaps', 'confirmed', 'handoff', 'cross', 'code', 'rules', 'chat2', 'final',
];

const MARCUS = 's19';
const LISA = 'p07';
const ANGELA = 'p12';
const CHAPERONE = 'c-rivera';
const SATURDAY = 'e-band-sat';
const TUESDAY = 'e-vball-tue';

/* ===========================================================================
   STEP 1 — RUN THE REAL ALGORITHM ONCE, AND SAVE WHAT IT DID
   ===========================================================================
   Snapshots are plain deep copies of the app's data. A segment restores the
   one it needs, so segments are independent and can be previewed or checked
   in any order.
=========================================================================== */
const snaps = {};
const facts = {};

const copy = (value) => JSON.parse(JSON.stringify(value));
const snapshot = () => copy(S.state.data);
function restore(name) {
  S.state.data = copy(snaps[name]);
  S.state.lastFill = null;
}

function shortReasonFor(rows) {
  const phrases = new Set(
    rows.map((row) => {
      const text = row.status.reason || '';
      if (/detour limit/i.test(text)) return 'they live too far from every parent offering seats';
      if (/is full/i.test(text)) return 'every nearby car is already full';
      return 'no driver is going their way';
    })
  );
  return [...phrases].join(', and ');
}

function computeResults() {
  S.resetDemo();
  view.groupFilter = 'ALL';
  view.showAllGaps = false;
  view.assignOpenFor = null;
  view.homeFilter = null;

  // Scene setup, done with the data rather than with a fake screen: at the
  // top of the film Marcus has not joined and has not asked for a ride.
  S.cancelRequest(MARCUS, SATURDAY);
  S.personById(MARCUS).approved = false;
  snaps.start = snapshot();

  // Lisa's "offer seats" card points at the soonest trip her students have.
  // The film is set on Saturday, so for her segment the week before it has
  // already happened. Her seat count and her car are untouched.
  const saturdayTime = S.eventById(SATURDAY).rideTimeISO;
  S.state.data.events = S.state.data.events.filter((e) => e.rideTimeISO >= saturdayTime);
  snaps.lisaBefore = snapshot();
  const lisaOffer = S.offerById(`of-${SATURDAY}-${LISA}`) || S.offerById('of-sat-p07');
  facts.lisaSeats = lisaOffer ? lisaOffer.seats : 3;
  S.offerSeats(LISA, SATURDAY, facts.lisaSeats);
  snaps.lisaAfter = snapshot();

  // Back to the full week for everything else.
  S.state.data = copy(snaps.start);

  S.approveStudent(MARCUS);
  snaps.approved = snapshot();

  S.requestRide(MARCUS, SATURDAY);
  snaps.requested = snapshot();

  const before = S.readinessFor(SATURDAY);
  facts.total = before.total;
  facts.before = before.covered;
  snaps.preFill = snapshot();

  // ---- the real algorithm, run once ----
  const run = S.runFillTheGaps(SATURDAY);
  S.runFillTheGaps(TUESDAY);
  facts.matchedOrder = [...run.matchedStudentIds];
  snaps.filled = snapshot();
  facts.after = S.readinessFor(SATURDAY).covered;

  const leftover = S.readinessFor(SATURDAY)
    .rows.filter((row) => !S.hasRide(row.status.code));
  facts.unmatchedCount = leftover.length;
  facts.unmatchedNames = leftover.map((row) => personName(row.person));
  facts.shortReason = shortReasonFor(leftover);
  facts.assignedOrder = leftover.map((row) => row.studentId);

  for (const id of facts.assignedOrder) S.assignManually(id, SATURDAY, CHAPERONE);
  snaps.assigned = snapshot();
  facts.final = S.readinessFor(SATURDAY).covered;

  // Marcus's car, and the handoff code both phones show.
  const ride = S.state.data.rides.find((r) => r.riderIds.includes(MARCUS));
  const driver = S.personById(ride.driverId);
  facts.rideId = ride.id;
  facts.lisaName = personName(driver);
  facts.lisaFirst = driver.firstName;
  facts.car = [driver.carColor, driver.carModel].filter(Boolean).join(' ');
  facts.pickupTime = formatTime(S.offerById(ride.offerId).timeISO);
  facts.code = S.handoffCode(ride.id);

  S.markPickedUp(facts.rideId, true);
  facts.pickedUpAt = S.rideById(facts.rideId).pickedUpAt;
  snaps.pickedUp = snapshot();

  // Tuesday's car, the one carrying more than one activity.
  S.state.data = copy(snaps.assigned);
  const mixed = S.state.data.rides
    .map((r) => ({ r, n: new Set(S.ridersInRide(r).map((x) => x.activityId)).size }))
    .filter((e) => e.n > 1)
    .sort((a, b) => b.n - a.n)[0];
  facts.tuesdayRideId = mixed ? mixed.r.id : null;
  facts.tuesdayDriver = mixed ? personName(S.personById(mixed.r.driverId)) : '';

  facts.marcusFirst = S.personById(MARCUS).firstName;
  facts.marcusName = personName(S.personById(MARCUS));
  facts.angelaName = personName(S.personById(ANGELA));
  facts.chaperoneName = personName(S.personById(CHAPERONE));
  facts.presenterName = CONFIG.presenterName;
  facts.presenterGrade = CONFIG.presenterGrade;
}

/* ===========================================================================
   STEP 2 — THE STAGE
=========================================================================== */
let el = {};
let speed = 1;
let paused = false;
let runToken = 0;
let captionsOn = true;

function sleep(ms) {
  const mine = runToken;
  const scaled = ms / speed;
  return new Promise((resolve) => {
    let left = scaled;
    const tick = () => {
      if (mine !== runToken) return resolve();
      if (paused) return setTimeout(tick, 80);
      const slice = Math.min(80, left);
      left -= slice;
      if (left <= 0) return resolve();
      setTimeout(tick, slice);
    };
    setTimeout(tick, Math.min(80, scaled));
  });
}

/** Render a real screen as a given person. */
function as(personId, role, fn) {
  const r = S.state.role;
  const u = S.state.userId;
  S.state.role = role;
  S.state.userId = personId;
  try {
    return fn();
  } finally {
    S.state.role = r;
    S.state.userId = u;
  }
}

/** Put HTML on the phone, keeping the frame where it is. */
async function show(html, { instant = false } = {}) {
  if (!instant) {
    el.screen.classList.add('is-out');
    await sleep(CONFIG.transitionMs);
  }
  el.screen.innerHTML = html;
  el.screen.querySelectorAll('[id]').forEach((node) => { node.id = `film-${node.id}`; });
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  drawAllMaps(S.state.data, el.screen);
  el.screen.classList.remove('is-out');
}

function setPhoneVisible(visible) {
  el.phone.classList.toggle('is-hidden', !visible);
  el.card.classList.toggle('is-hidden', visible);
}

function setPerson(key) {
  if (!key) {
    el.label.classList.remove('is-in');
    el.label.dataset.who = '';
    return;
  }
  if (el.label.dataset.who === key) return;
  el.label.dataset.who = key;
  const spec = CONFIG.people[key];
  const person = S.personById(spec.id);
  el.label.classList.remove('is-in');
  setTimeout(() => {
    el.label.innerHTML =
      `<span class="avatar avatar--sm">${esc(initials(person))}</span>` +
      `<span><strong>${esc(personName(person))}</strong><span>${esc(spec.role)}</span></span>`;
    el.label.classList.add('is-in');
  }, 100 / speed);
}

function setCaption(text) {
  el.caption.textContent = text || '';
  el.caption.hidden = !captionsOn || !text;
}

async function tap(target, host = el.phone) {
  if (!target) return;
  const hb = host.getBoundingClientRect();
  const tb = target.getBoundingClientRect();
  const scale = hb.width / host.offsetWidth || 1;
  const dot = document.createElement('span');
  dot.className = 'film__pulse';
  dot.style.left = `${(tb.left - hb.left) / scale + target.offsetWidth / 2}px`;
  dot.style.top = `${(tb.top - hb.top) / scale + Math.min(target.offsetHeight / 2, 30)}px`;
  host.appendChild(dot);
  await sleep(CONFIG.tapPulseMs);
  dot.remove();
}

function toast(iconName, text) {
  const node = document.createElement('div');
  node.className = 'film__toast';
  node.innerHTML = `${icon(iconName)}<span>${esc(text)}</span>`;
  el.phone.appendChild(node);
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  setTimeout(() => node.classList.add('is-in'), 30);
  return node;
}

function countUp(node, from, to) {
  if (!node || from >= to) return;
  const stepMs = Math.max(30, 900 / Math.max(1, to - from)) / speed;
  let n = from;
  node.textContent = String(n);
  const timer = setInterval(() => {
    if (!node.isConnected) return clearInterval(timer);
    n += 1;
    node.textContent = String(n);
    if (n >= to) clearInterval(timer);
  }, stepMs);
  setTimeout(() => {
    clearInterval(timer);
    if (node.isConnected) node.textContent = String(to);
  }, stepMs * (to - from) + 500);
}

function fillTicks(ids, perTickMs = 60) {
  ids.forEach((id, i) => {
    const tick = el.screen.querySelector(`.dial__tick[data-student="${id}"]`);
    if (!tick) return;
    tick.style.animationDelay = `${(i * perTickMs) / speed}ms`;
    tick.classList.add('is-filling');
  });
}

function everySpotFilled() {
  const sub = el.screen.querySelector('.dial__sub');
  if (sub && !el.screen.querySelector('.film__filled')) {
    sub.insertAdjacentHTML('afterend', '<div class="film__filled">Every spot filled</div>');
  }
}

/* --------------------------------------------------------------------------
   The chat prop. Marcus's own messages sit on the right with no name or
   avatar, the way your own messages look in any group chat.
   -------------------------------------------------------------------------- */
const CHAT_COLOURS = {
  Maya: '#C2410C', Chris: '#5E6B72', Dev: '#6E6480', Ari: '#6B7A5E', Marcus: '#8A6356',
};
const ME = 'Marcus';

const typingMsFor = (text) =>
  Math.min(CONFIG.chat.typeMaxMs, CONFIG.chat.typeBaseMs + text.length * CONFIG.chat.typePerCharMs);

function chatDurationMs(key) {
  return CONFIG.chats[key].reduce(
    (sum, [, text]) => sum + typingMsFor(text) + CONFIG.chat.gapMs,
    0
  );
}

function chatShell() {
  return `<div class="film__chat">
    <header class="film__chatbar">
      <span class="film__chatavatar">T</span>
      <div>
        <p class="film__chatname">Trumpets 🎺 (8)</p>
        <p class="film__chatsub">8 members</p>
      </div>
    </header>
    <div class="film__thread"></div>
  </div>`;
}

const isShout = (text) => {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
};

async function playChat(key) {
  const thread = el.screen.querySelector('.film__thread');
  let last = null;
  let run = null;

  for (const [sender, text, clock] of CONFIG.chats[key]) {
    if (sender !== last) {
      last = sender;
      const mine = sender === ME;
      run = document.createElement('div');
      run.className = `film__run${mine ? ' film__run--me' : ''}`;
      run.innerHTML = mine
        ? `<div class="film__runbody"><div class="film__runhead"><span>${esc(clock)}</span></div></div>`
        : `<span class="film__who" style="background:${CHAT_COLOURS[sender] || '#777'}">${esc(sender[0])}</span>
           <div class="film__runbody"><div class="film__runhead">
             <span>${esc(sender)}</span><span>${esc(clock)}</span></div></div>`;
      thread.appendChild(run);
    }

    const bubble = document.createElement('div');
    bubble.className = `film__bubble${sender === ME ? ' film__bubble--me' : ''} is-typing`;
    bubble.innerHTML = '<span class="film__dots"><i></i><i></i><i></i></span>';
    run.querySelector('.film__runbody').appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;

    await sleep(typingMsFor(text));

    bubble.classList.remove('is-typing');
    bubble.textContent = text;
    if (isShout(text)) bubble.classList.add('is-shout');
    thread.scrollTop = thread.scrollHeight;

    await sleep(CONFIG.chat.gapMs);
  }
}

/* ===========================================================================
   STEP 3 — THE SEGMENTS
   Each one restores its own snapshot, builds its screen, plays, and resolves.
   `check` is used by the self-check run.
=========================================================================== */
const SCENES = {
  chat1: {
    async run() {
      restore('start');
      await show(chatShell(), { instant: true });
      await playChat('chat1');
    },
    check: () => {
      const bubbles = el.screen.querySelectorAll('.film__bubble').length;
      const mine = el.screen.querySelectorAll('.film__bubble--me').length;
      const out = [];
      if (bubbles !== CONFIG.chats.chat1.length) out.push(`${bubbles} bubbles, expected ${CONFIG.chats.chat1.length}`);
      if (!mine) out.push("Marcus's own messages are not on the right");
      if (!el.screen.querySelector('.is-shout')) out.push('no ALL CAPS shake applied');
      if (el.screen.querySelector('.is-typing')) out.push('a typing indicator never resolved');
      return out;
    },
  },

  hook: {
    async run() {
      restore('start');
      await show(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
    },
    check: () => (el.screen.querySelector('.welcome') ? [] : ['welcome screen not rendered']),
  },

  title: {
    async run() {
      setPhoneVisible(false);
      el.card.innerHTML = `<div class="film__card">
        <div class="wordmark">AfterBell<span class="wordmark__dot"></span></div>
        <p class="film__tag">Every spot filled</p>
        <ul class="film__lines">
          <li>Built by ${esc(CONFIG.presenterName)}, Braswell High School</li>
          <li>For students, parents, and directors</li>
          <li>100+ students said it's a great idea.</li>
        </ul>
      </div>`;
      const items = [...el.card.querySelectorAll('.film__lines li')];
      for (const item of items) {
        await sleep(1600);
        item.classList.add('is-in');
      }
    },
    check: () => {
      const shown = el.card.querySelectorAll('.film__lines li.is-in').length;
      return shown === 3 ? [] : [`${shown} of 3 title lines appeared`];
    },
  },

  join: {
    async run() {
      restore('start');
      await show(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
      await sleep(900);
      await tap(el.screen.querySelector('#film-si-code'));

      await show(as(MARCUS, 'student', () => Screens.activities()));
      await sleep(1600);

      await show(as(MARCUS, 'student', () => Screens.studentHome()));
      await sleep(1600);

      restore('approved');
      toast('user-round-check', `${facts.angelaName} approved your account`);
      await sleep(2200);
      await show(as(MARCUS, 'student', () => Screens.studentHome()));
    },
    check: () => {
      const out = [];
      if (!S.personById(MARCUS).approved) out.push('Marcus is still unapproved');
      if (!el.phone.querySelector('.film__toast')) out.push('approval notification missing');
      if (el.screen.querySelector('.notice')) out.push('still showing the waiting-on-a-parent notice');
      return out;
    },
  },

  request: {
    async run() {
      restore('approved');
      await show(as(MARCUS, 'student', () => Screens.studentHome()), { instant: true });
      await sleep(800);
      await tap(el.screen.querySelector(`[data-href="#/event/${SATURDAY}"]`));

      await show(as(MARCUS, 'student', () => Screens.requestRide(SATURDAY)));
      await sleep(1200);
      await tap(el.screen.querySelector('[data-action="request-ride"]'));

      restore('requested');
      await show(as(MARCUS, 'student', () => Screens.matching(SATURDAY)));
    },
    check: () => {
      const out = [];
      if (!/Finding your ride/i.test(el.screen.textContent)) out.push('searching screen not shown');
      if (!el.screen.querySelector('.pin-search') && !el.screen.querySelector('.map')) {
        out.push('map with the pulsing ring missing');
      }
      return out;
    },
  },

  behind: {
    async run() {
      setPhoneVisible(false);
      el.card.innerHTML = `<div class="film__card"><p class="film__big">Behind the scenes</p></div>`;
    },
    check: () => (/Behind the scenes/.test(el.card.textContent) ? [] : ['card text missing']),
  },

  lisa: {
    async run() {
      restore('lisaBefore');
      await show(as(LISA, 'parent', () => Screens.parentView()), { instant: true });
      await sleep(700);
      const toggle = el.screen.querySelector('[data-action="toggle-offer"]');
      await tap(toggle);

      restore('lisaAfter');
      await show(as(LISA, 'parent', () => Screens.parentView()));
      countUp(el.screen.querySelector('[data-seatcount]'), 0, facts.lisaSeats);
    },
    check: () => {
      const seats = el.screen.querySelector('[data-seatcount]');
      const toggle = el.screen.querySelector('[data-action="toggle-offer"]');
      const out = [];
      if (!toggle || toggle.getAttribute('aria-checked') !== 'true') out.push('offer toggle is not on');
      if (!seats || Number(seats.textContent.trim()) !== facts.lisaSeats) {
        out.push(`seat count shows "${seats ? seats.textContent.trim() : '?'}", expected ${facts.lisaSeats}`);
      }
      return out;
    },
  },

  fill: {
    async run() {
      restore('preFill');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(SATURDAY)), { instant: true });
      await sleep(2400);
      await tap(el.screen.querySelector('[data-action="fill-gaps"]'));

      restore('filled');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(SATURDAY)));
      fillTicks(facts.matchedOrder, 60);
      countUp(el.screen.querySelector('.dial__num'), facts.before, facts.after);
      await sleep(facts.matchedOrder.length * 60 + 900);
    },
    check: () => {
      const num = el.screen.querySelector('.dial__num');
      const filled = el.screen.querySelectorAll('.dial__tick.is-filled').length;
      const out = [];
      if (!num || Number(num.textContent.trim()) !== facts.after) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.after}`);
      }
      if (filled !== facts.after) out.push(`${filled} ticks filled, expected ${facts.after}`);
      if (!el.screen.querySelectorAll('.is-filling').length) out.push('tick animation never started');
      return out;
    },
  },

  gaps: {
    async run() {
      restore('filled');
      await show(as('o-moreno', 'organizer', () => Screens.rosterGapsCard(SATURDAY)), { instant: true });
      await sleep(2000);
      await tap(el.screen.querySelector('[data-action="assign-open"]'));

      restore('assigned');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(SATURDAY)));
      fillTicks(facts.assignedOrder, 140);
      countUp(el.screen.querySelector('.dial__num'), facts.after, facts.final);
      await sleep(facts.assignedOrder.length * 140 + 900);
      everySpotFilled();
    },
    check: () => {
      const num = el.screen.querySelector('.dial__num');
      const out = [];
      if (!num || Number(num.textContent.trim()) !== facts.final) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.final}`);
      }
      if (facts.final !== facts.total) out.push(`final is ${facts.final} of ${facts.total}, not everyone`);
      if (!el.screen.querySelector('.film__filled')) out.push('"Every spot filled" label missing');
      return out;
    },
  },

  confirmed: {
    async run() {
      restore('filled');
      await show(as(MARCUS, 'student', () => Screens.matching(SATURDAY)), { instant: true });
      await sleep(900);
      toast('car-front', `Ride confirmed — ${facts.lisaName}, ${facts.car}, ${facts.pickupTime}`);
      await sleep(2000);
      await show(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)));
      await sleep(600);
      for (const node of [...el.screen.querySelectorAll('.person__act')]) {
        node.classList.add('film__ring');
        await sleep(420);
        node.classList.remove('film__ring');
      }
    },
    check: () => {
      const out = [];
      const text = el.screen.textContent;
      if (!el.screen.querySelector('.handoff__code')) out.push('ride card not shown');
      if (!text.includes(facts.lisaFirst)) out.push(`driver ${facts.lisaFirst} not on the card`);
      if (!text.includes(facts.car.split(' ').pop())) out.push('car model not on the card');
      return out;
    },
  },

  handoff: {
    async run() {
      restore('filled');
      await show(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)), { instant: true });

      const inset = document.createElement('div');
      inset.className = 'film__inset';
      inset.innerHTML = `<p class="film__insetlabel">${esc(facts.lisaName)}</p>
        <p class="film__insetcode">${esc(facts.code)}</p>
        <p class="film__insetsub">Driver's screen</p>`;
      el.phone.appendChild(inset);

      await sleep(1400);
      const code = el.screen.querySelector('.handoff__code');
      code.classList.add('film__ring');
      inset.classList.add('film__ring');
      await sleep(2000);
      code.classList.remove('film__ring');
      inset.classList.remove('film__ring');

      restore('pickedUp');
      toast('check-check', `Picked up ${facts.pickedUpAt} · Your mom was notified`);
    },
    check: () => {
      const out = [];
      const inset = el.phone.querySelector('.film__insetcode');
      const code = el.screen.querySelector('.handoff__code');
      if (!code || !inset) out.push('rider or driver code missing');
      else if (code.textContent.trim() !== inset.textContent.trim()) {
        out.push(`codes differ: ${code.textContent.trim()} vs ${inset.textContent.trim()}`);
      }
      if (!el.phone.querySelector('.film__toast')) out.push('picked-up notification missing');
      return out;
    },
  },

  cross: {
    async run() {
      restore('assigned');
      await show(as(MARCUS, 'student', () => Screens.rideCard(facts.tuesdayRideId)), { instant: true });
      await sleep(900);
      for (const node of [...el.screen.querySelectorAll('.person__act')]) {
        node.classList.add('film__ring');
        await sleep(500);
        node.classList.remove('film__ring');
      }
    },
    check: () => {
      const acts = [...el.screen.querySelectorAll('.person__act')].map((n) => n.textContent.trim());
      const unique = new Set(acts.filter(Boolean));
      return unique.size > 1 ? [] : [`only ${unique.size} activity in the car, expected more than one`];
    },
  },

  code: {
    async run() {
      setPhoneVisible(false);
      el.card.innerHTML = `<div class="film__code"><pre class="film__codepre">Loading…</pre></div>`;
      const source = await fetch('./js/matching.js').then((r) => r.text());
      const pre = el.card.querySelector('.film__codepre');

      pre.innerHTML = source
        .split('\n')
        .map((line, i) => {
          const marked = /STEP \d/.test(line) ? ' class="film__step"' : '';
          const safe = esc(line)
            .replace(/(\/\/.*)/g, '<em>$1</em>')
            .replace(/\b(const|let|function|return|export|for|of|if|else|new|import|from)\b/g, '<b>$1</b>');
          return `<span${marked}><span class="film__ln">${String(i + 1).padStart(3, ' ')}</span>${safe}</span>`;
        })
        .join('\n');

      // Scroll through, pausing on each STEP heading as the caption reaches it.
      const box = el.card.querySelector('.film__code');
      const steps = [...pre.querySelectorAll('.film__step')].slice(0, 4);
      for (const step of steps) {
        box.scrollTop = Math.max(0, step.offsetTop - box.clientHeight / 2.4);
        step.classList.add('is-lit');
        await sleep(2200);
        step.classList.remove('is-lit');
      }
    },
    check: () => {
      const pre = el.card.querySelector('.film__codepre');
      const out = [];
      if (!pre || pre.textContent.length < 5000) out.push('matching.js did not load into the viewer');
      if (!el.card.querySelectorAll('.film__step').length) out.push('no algorithm steps highlighted');
      return out;
    },
  },

  rules: {
    async run() {
      setPhoneVisible(false);
      el.card.innerHTML = `<div class="film__card">
        <ul class="film__lines film__lines--rules">
          <li>Only parent-approved adults drive</li>
          <li>Neighborhoods only, never home addresses</li>
        </ul>
        <p class="film__big film__quote">The hardest part wasn't the code.<br />
          It was the rules real people live by.</p>
      </div>`;
      const items = [...el.card.querySelectorAll('.film__lines li')];
      for (const item of items) {
        await sleep(1400);
        item.classList.add('is-in');
      }
      await sleep(1200);
      el.card.querySelector('.film__quote').classList.add('is-in');
    },
    check: () =>
      el.card.querySelector('.film__quote.is-in') ? [] : ['closing line never appeared'],
  },

  chat2: {
    async run() {
      restore('pickedUp');
      await show(chatShell(), { instant: true });
      await playChat('chat2');
    },
    check: () => {
      const bubbles = el.screen.querySelectorAll('.film__bubble').length;
      return bubbles === CONFIG.chats.chat2.length
        ? []
        : [`${bubbles} bubbles, expected ${CONFIG.chats.chat2.length}`];
    },
  },

  final: {
    async run() {
      restore('assigned');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(SATURDAY)), { instant: true });
      everySpotFilled();
      await sleep(2200);
      const mark = document.createElement('div');
      mark.className = 'film__final';
      mark.innerHTML = `<span class="wordmark">AfterBell<span class="wordmark__dot"></span></span>`;
      el.phone.appendChild(mark);
      await sleep(40);
      mark.classList.add('is-in');
      await sleep(2000);
    },
    check: () => {
      const num = el.screen.querySelector('.dial__num');
      const out = [];
      if (!num || Number(num.textContent.trim()) !== facts.total) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.total}`);
      }
      if (!el.phone.querySelector('.film__final')) out.push('wordmark never faded in');
      return out;
    },
  },
};

/** How long a segment is scheduled for, in ms. */
function segmentMs(key) {
  const spec = CONFIG.segments[key];
  if (spec.seconds === null) return chatDurationMs(key);
  return spec.seconds * 1000;
}

export function totalRuntimeMs() {
  return ORDER.reduce((sum, key) => sum + segmentMs(key), 0);
}

/* ===========================================================================
   STEP 4 — THE RUNNER
=========================================================================== */
function clearStage() {
  el.phone.querySelectorAll('.film__toast, .film__inset, .film__final, .film__pulse')
    .forEach((node) => node.remove());
  el.card.innerHTML = '';
}

async function playSegment(key) {
  const spec = CONFIG.segments[key];
  clearStage();
  setPhoneVisible(spec.person !== null || key === 'chat1' || key === 'chat2' || !!SCENES[key].usesPhone);
  // Card segments are the ones with no person and their own card markup.
  const cardSegments = ['title', 'behind', 'code', 'rules'];
  setPhoneVisible(!cardSegments.includes(key));

  setPerson(spec.person);
  setCaption(spec.caption ? spec.caption(facts) : '');

  // The segment gets at least its scheduled time, and is never cut off
  // mid-animation.
  await Promise.all([sleep(segmentMs(key)), SCENES[key].run()]);
}

async function playFilm() {
  const mine = ++runToken;
  computeResults();

  el.blank.hidden = false;
  await sleep(CONFIG.blankStartMs);
  if (mine !== runToken) return;
  el.blank.hidden = true;

  for (const key of ORDER) {
    if (mine !== runToken) return;
    await playSegment(key);
  }

  if (mine !== runToken) return;
  await sleep(CONFIG.holdLastMs);
  if (mine !== runToken) return;

  // A blank tail to trim against. Nothing else: no buttons, no text.
  setCaption('');
  el.blank.hidden = false;
}

/* ===========================================================================
   STEP 5 — SELF-CHECK  (?film=1&check=1)
=========================================================================== */
async function selfCheck() {
  speed = 8;
  const lines = [];
  let failures = 0;

  computeResults();

  for (const key of ORDER) {
    clearStage();
    const cardSegments = ['title', 'behind', 'code', 'rules'];
    setPhoneVisible(!cardSegments.includes(key));
    const spec = CONFIG.segments[key];
    setPerson(spec.person);
    setCaption(spec.caption ? spec.caption(facts) : '');

    let problems = [];
    try {
      await Promise.all([sleep(segmentMs(key)), SCENES[key].run()]);
      problems = SCENES[key].check() || [];

      // Shared checks, applied to every segment.
      if (spec.person) {
        const expected = personName(S.personById(CONFIG.people[spec.person].id));
        if (!el.label.textContent.includes(expected)) {
          problems.push(`person label should read ${expected}`);
        }
      }
      if (spec.caption) {
        const text = spec.caption(facts);
        if (/undefined|NaN|\{\w+\}/.test(text)) problems.push('caption has an unfilled placeholder');
        if (el.caption.textContent !== text) problems.push('caption not displayed');
      }
    } catch (error) {
      problems.push(`threw: ${error.message}`);
    }

    if (problems.length) failures += 1;
    lines.push(
      `${problems.length ? 'FAIL' : 'PASS'}  ${key.padEnd(10)} ` +
      `${(segmentMs(key) / 1000).toFixed(1)}s` +
      (problems.length ? `\n        - ${problems.join('\n        - ')}` : '')
    );
  }

  const total = totalRuntimeMs();
  const overCap = total > CONFIG.maxRuntimeMs;
  if (overCap) failures += 1;

  lines.push('');
  lines.push(
    `${overCap ? 'FAIL' : 'PASS'}  runtime    ` +
    `${Math.floor(total / 60000)}:${String(Math.round((total % 60000) / 1000)).padStart(2, '0')}` +
    ` (cap ${Math.floor(CONFIG.maxRuntimeMs / 60000)}:${String((CONFIG.maxRuntimeMs % 60000) / 1000).padStart(2, '0')})`
  );
  lines.push('');
  lines.push(failures ? `${failures} SEGMENT(S) FAILED` : 'ALL SEGMENTS PASS');

  speed = 1;
  el.report.hidden = false;
  el.report.textContent = lines.join('\n');
  return lines.join('\n');
}

/* ===========================================================================
   STEP 6 — BOOT
=========================================================================== */
function fitStage() {
  const scale = Math.min(
    window.innerWidth / CONFIG.stage.width,
    window.innerHeight / CONFIG.stage.height
  );
  el.stage.style.setProperty('--film-scale', String(Math.min(1, scale)));
}

function goFullscreen() {
  const node = document.documentElement;
  const request = node.requestFullscreen || node.webkitRequestFullscreen;
  if (request) {
    try { request.call(node); } catch { /* a blocked request must not stop the film */ }
  }
}

function stopFilm() {
  runToken += 1;
  paused = false;
  document.body.classList.remove('is-playing');
  el.blank.hidden = true;
  clearStage();
  el.screen.innerHTML = '';
  setCaption('');
  setPerson(null);
  el.start.hidden = false;
}

export function startFilmMode() {
  document.body.classList.add('is-film');

  document.getElementById('main').innerHTML = `
    <div class="film" id="film-root">
      <div class="film__stage" id="film-stage">
        <div class="film__label" id="film-label"></div>
        <div class="film__middle">
          <div class="film__phone" id="film-phone"><div class="film__screen" id="film-screen"></div></div>
          <div class="film__cardslot is-hidden" id="film-card"></div>
        </div>
        <p class="film__caption" id="film-caption" hidden></p>
      </div>
      <div class="film__blank" id="film-blank" hidden></div>
      <div class="film__startwrap" id="film-start">
        <button class="film__play" id="film-playbtn">Play</button>
      </div>
      <pre class="film__report" id="film-report" hidden></pre>
    </div>`;

  el = {
    stage: document.getElementById('film-stage'),
    label: document.getElementById('film-label'),
    phone: document.getElementById('film-phone'),
    screen: document.getElementById('film-screen'),
    card: document.getElementById('film-card'),
    caption: document.getElementById('film-caption'),
    blank: document.getElementById('film-blank'),
    start: document.getElementById('film-start'),
    report: document.getElementById('film-report'),
  };

  fitStage();
  window.addEventListener('resize', fitStage);

  const params = new URLSearchParams(location.search);

  if (params.get('check') === '1') {
    el.start.hidden = true;
    document.body.classList.add('is-playing');
    selfCheck();
    return;
  }

  if (params.get('seg')) {
    const index = Number(params.get('seg')) - 1;
    const key = ORDER[index];
    if (key) {
      el.start.hidden = true;
      document.body.classList.add('is-playing');
      computeResults();
      playSegment(key);
      return;
    }
  }

  document.getElementById('film-playbtn').addEventListener('click', () => {
    el.start.hidden = true;
    document.body.classList.add('is-playing');
    goFullscreen();
    playFilm();
  });

  document.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('is-playing')) return;
    if (event.code === 'Space') {
      event.preventDefault();
      paused = !paused;
    } else if (event.key === 'Escape') {
      stopFilm();
    } else if (event.key.toLowerCase() === 'c') {
      captionsOn = !captionsOn;
      el.caption.hidden = !captionsOn || !el.caption.textContent;
    }
  });
}

/** Used by the build report so the script is never retyped by hand. */
export function captionScript() {
  if (!facts.total) computeResults();
  return ORDER.map((key, i) => ({
    n: i + 1,
    id: key,
    seconds: Number((segmentMs(key) / 1000).toFixed(1)),
    caption: CONFIG.segments[key].caption ? CONFIG.segments[key].caption(facts) : null,
  }));
}
export { CONFIG, facts, computeResults };
