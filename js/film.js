/* ===========================================================================
   AfterBell — film.js
   Film mode: index.html?film=1
   ===========================================================================
   Plays the whole demo video start to finish, hands-off, so it can be screen
   recorded with a live voiceover. It records nothing and plays no audio.

   HOW IT STAYS HONEST
   The REAL matching algorithm runs exactly once, when the film starts, on
   Saturday morning's trip — the band's 6:05 rehearsal pickup and the
   volleyball team's 6:00 practice pickup, which land in the same 15-minute
   bucket. Every number, name, car and time in the captions is read out of
   that one run. Each segment then restores a saved snapshot and renders a
   REAL screen from screens.js, so no segment depends on what the segment
   before it left on the page.

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
   CONFIG — every duration, caption and bit of pacing, in one place.
=========================================================================== */
const CONFIG = {
  /* >>> FILL THESE IN <<< the only two words not read from the data. */
  presenterName: '[NAME]',
  presenterGrade: '[GRADE]',

  blankStartMs: 2000,
  holdLastMs: 3000,
  transitionMs: 250,
  tapPulseMs: 620,
  maxRuntimeMs: 178000,          // 2:58 hard cap, enforced by the self-check

  stage: { width: 1240, height: 880 },

  chat: {
    // The brief asks for about 1.3s between messages; at that pace the film
    // runs to 3:03. The gap is the first thing to shorten when it is over
    // the cap, so it sits just under a second and the film lands at 2:57.
    gapMs: 950,
    typeBaseMs: 500,
    typePerCharMs: 20,
    typeMaxMs: 1500,
  },

  people: {
    marcus: { id: 's19', role: 'Trumpets' },
    lisa: { id: 'p07', role: "Volleyball parent · Dev's neighbor" },
    moreno: { id: 'o-moreno', role: 'Band director' },
  },

  segments: {
    chat1: { seconds: null, person: 'marcus', caption: null },
    hook: {
      seconds: 12, person: 'marcus',
      caption: (f) =>
        `That's ${f.marcusFirst}. It's the morning of the biggest contest of the year, and ` +
        `without a ride to rehearsal, he can't march. In marching band, one empty spot ` +
        `leaves a hole in the whole show.`,
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
        `He requests a ride to the 6:30 rehearsal. While he waits, here's what's happening ` +
        `behind the scenes.`,
    },
    behind: { seconds: 2, person: null, caption: null },
    lisa: {
      seconds: 9, person: 'lisa',
      caption: (f) =>
        `Lisa, Dev's next-door neighbor, is already driving her daughter Jada to volleyball ` +
        `practice at the same time, and she has ` +
        `${f.lisaSeats === 1 ? 'one open seat' : `${f.lisaSeats} open seats`}.`,
    },
    fill: {
      seconds: 18, person: 'moreno',
      caption: (f) =>
        `On the band director's screen, ${f.total} marchers need a ride this morning, and ` +
        `${f.before} have one. He taps Fill the Gaps. AfterBell's algorithm looks at every ` +
        `activity, not just band. It groups everyone heading to the same place at the same ` +
        `time, clusters them by neighborhood, and assigns parent drivers while checking ` +
        `seats and distance.`,
    },
    gaps: {
      seconds: 10, person: 'moreno',
      caption: (f) =>
        `${f.unmatchedCount} couldn't be matched, and AfterBell explains why: ` +
        `${f.shortReason}. So the director assigns them to ${f.chaperoneName}.`,
    },
    confirmed: {
      seconds: 11, person: 'marcus',
      caption: (f) =>
        `Back on ${f.marcusFirst}'s phone, his ride is confirmed: ${f.lisaFirst} and Jada, ` +
        `on their way to volleyball. A band kid and a volleyball player. Different ` +
        `activities, same neighborhood, same time.`,
    },
    handoff: {
      seconds: 10, person: 'marcus',
      caption: () =>
        `At pickup, they see the same code, so he never gets in the wrong car, and his mom ` +
        `is notified the moment he's picked up.`,
    },
    code: {
      seconds: 12, person: null,
      caption: () =>
        `It's built with HTML, CSS, and JavaScript. The algorithm groups requests by time ` +
        `and place, measures distance between neighborhoods with the haversine formula, and ` +
        `fills seats closest-first within three miles.`,
    },
    rules: {
      seconds: 12, person: null,
      caption: () =>
        `Only parent-approved adults can drive, and AfterBell stores neighborhoods, never ` +
        `home addresses. Building this taught me that the hardest part of an app isn't the ` +
        `code. It's the rules real people live by.`,
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
      ['Maya', 'area rehearsal at 6:30, bus to the contest leaves at 9', '5:48 AM'],
      ['Maya', 'everyone up?? reply here', '5:48 AM'],
      ['Chris', 'here 😴', '5:49 AM'],
      ['Maya', '…marcus?', '5:51 AM'],
      ['Marcus', 'i’m up but i don’t have a ride 😭', '5:52 AM'],
      ['Marcus', 'my mom left for work at 5', '5:52 AM'],
      ['Maya', 'MARCUS IT’S AREA', '5:53 AM'],
      ['Dev', 'spot 14 can’t be empty at area bro', '5:53 AM'],
      ['Ari', 'my mom’s car is already full 😭', '5:54 AM'],
      ['Maya', 'WHO IS DRIVING MARCUS', '5:54 AM'],
      ['Dev', 'bro just get AfterBell', '5:55 AM'],
      ['Dev', 'my neighbor takes her daughter to volleyball at 6:30 and she drives people on it', '5:55 AM'],
      ['Marcus', 'getting it rn', '5:56 AM'],
    ],
    chat2: [
      ['Marcus', 'HERE 🏃', '6:27 AM'],
      ['Marcus', 'got a ride with dev’s neighbor and her daughter from volleyball lol', '6:27 AM'],
      ['Dev', 'told you 😎', '6:28 AM'],
      ['Maya', 'MARCUS!!!', '6:28 AM'],
      ['Chris', 'spot 14 is FILLED 🙏', '6:29 AM'],
      ['Maya', 'ok everyone on the field', '6:29 AM'],
    ],
  },
};

/* The order the film plays in. `gaps` drops out if the real run leaves
   nobody behind. */
const BASE_ORDER = [
  'chat1', 'hook', 'title', 'join', 'request', 'behind', 'lisa', 'fill',
  'gaps', 'confirmed', 'handoff', 'code', 'rules', 'chat2', 'final',
];
let ORDER = [...BASE_ORDER];

const MARCUS = 's19';
const JADA = 's61';
const LISA = 'p07';
const ANGELA = 'p12';
const CHAPERONE = 'c-rivera';
const BAND_AM = 'e-band-sat-am';
const VBALL_AM = 'e-vball-sat-am';

/* ===========================================================================
   RUN THE REAL ALGORITHM ONCE, AND SAVE WHAT IT DID
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

  // Scene setup, done with the data rather than a fake screen: at the top of
  // the film Marcus has not joined and has not asked for a ride.
  S.cancelRequest(MARCUS, BAND_AM);
  S.personById(MARCUS).approved = false;
  snaps.start = snapshot();

  // ---- Lisa's two frames ------------------------------------------------
  // Her card shows the soonest trip her students have. The film is set on
  // Saturday morning, so the week before it has already happened.
  const dawn = S.eventById(VBALL_AM).rideTimeISO;
  S.state.data.events = S.state.data.events.filter((e) => e.rideTimeISO >= dawn);
  const offer = S.offerById(`of-${VBALL_AM}-${LISA}`);
  const realSeats = offer.seats;
  offer.seats = 1;                    // just Jada, nothing spare yet
  snaps.lisaBefore = snapshot();
  offer.seats = realSeats;            // she opens the spare seat
  snaps.lisaAfter = snapshot();
  facts.lisaTotalSeats = realSeats;
  facts.lisaSeats = realSeats - 1;    // the spare, which is what Marcus takes

  // ---- back to the whole week ------------------------------------------
  S.state.data = copy(snaps.start);

  S.approveStudent(MARCUS);
  snaps.approved = snapshot();

  S.requestRide(MARCUS, BAND_AM);
  snaps.requested = snapshot();

  const before = S.readinessFor(BAND_AM);
  facts.total = before.total;
  facts.before = before.covered;
  snaps.preFill = snapshot();

  // ---------- the real algorithm, run once ----------
  const run = S.runFillTheGaps(BAND_AM);
  facts.matchedOrder = [...run.matchedStudentIds];
  facts.crossActivityCount = run.crossActivityCount;
  snaps.filled = snapshot();
  facts.after = S.readinessFor(BAND_AM).covered;

  const leftover = S.readinessFor(BAND_AM).rows.filter((row) => !S.hasRide(row.status.code));
  facts.unmatchedCount = leftover.length;
  facts.unmatchedNames = leftover.map((row) => personName(row.person));
  facts.shortReason = shortReasonFor(leftover);
  facts.assignedOrder = leftover.map((row) => row.studentId);

  // No one left behind means no segment about it.
  ORDER = facts.unmatchedCount ? [...BASE_ORDER] : BASE_ORDER.filter((k) => k !== 'gaps');

  for (const id of facts.assignedOrder) S.assignManually(id, BAND_AM, CHAPERONE);
  snaps.assigned = snapshot();
  facts.final = S.readinessFor(BAND_AM).covered;

  // Marcus's car: the one a volleyball parent offered.
  const ride = S.state.data.rides.find((r) => r.riderIds.includes(MARCUS));
  const driver = S.personById(ride.driverId);
  facts.rideId = ride.id;
  facts.lisaName = personName(driver);
  facts.lisaFirst = driver.firstName;
  facts.car = [driver.carColor, driver.carModel].filter(Boolean).join(' ');
  facts.pickupTime = formatTime(S.offerById(ride.offerId).timeISO);
  facts.code = S.handoffCode(ride.id);
  facts.riderActivities = [...new Set(S.ridersInRide(ride).map((r) => r.activityLabel))];

  S.markPickedUp(facts.rideId, true);
  facts.pickedUpAt = S.rideById(facts.rideId).pickedUpAt;
  snaps.pickedUp = snapshot();

  facts.marcusFirst = S.personById(MARCUS).firstName;
  facts.angelaName = personName(S.personById(ANGELA));
  facts.chaperoneName = personName(S.personById(CHAPERONE));
  facts.jadaName = personName(S.personById(JADA));
  facts.presenterName = CONFIG.presenterName;
  facts.presenterGrade = CONFIG.presenterGrade;
}

/* ===========================================================================
   STAGE PLUMBING
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

async function showScreen(html, { instant = false } = {}) {
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

async function tap(target) {
  if (!target) return;
  const hb = el.phone.getBoundingClientRect();
  const tb = target.getBoundingClientRect();
  const scale = hb.width / el.phone.offsetWidth || 1;
  const dot = document.createElement('span');
  dot.className = 'film__pulse';
  dot.style.left = `${(tb.left - hb.left) / scale + target.offsetWidth / 2}px`;
  dot.style.top = `${(tb.top - hb.top) / scale + Math.min(target.offsetHeight / 2, 30)}px`;
  el.phone.appendChild(dot);
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
  const stepMs = Math.max(30, 1100 / Math.max(1, to - from)) / speed;
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

function fillTicks(ids, perTickMs) {
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

async function ringEach(nodes, hold) {
  for (const node of nodes) {
    node.classList.add('film__ring');
    await sleep(hold);
    node.classList.remove('film__ring');
  }
}

/* --------------------------------------------------------------------------
   The chat prop. Marcus's own messages sit on the right with no name and no
   avatar, the way your own messages look in any group chat.
   -------------------------------------------------------------------------- */
const CHAT_COLOURS = {
  Maya: '#C2410C', Chris: '#5E6B72', Dev: '#6E6480', Ari: '#6B7A5E', Marcus: '#8A6356',
};
const ME = 'Marcus';

const typingMsFor = (text) =>
  Math.min(CONFIG.chat.typeMaxMs, CONFIG.chat.typeBaseMs + text.length * CONFIG.chat.typePerCharMs);

const chatDurationMs = (key) =>
  CONFIG.chats[key].reduce((sum, [, text]) => sum + typingMsFor(text) + CONFIG.chat.gapMs, 0);

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
   THE SEGMENTS
=========================================================================== */
const CARD_SEGMENTS = ['title', 'behind', 'code', 'rules'];

const SCENES = {
  chat1: {
    async run() {
      restore('start');
      await showScreen(chatShell(), { instant: true });
      await playChat('chat1');
    },
    check: () => {
      const out = [];
      const bubbles = el.screen.querySelectorAll('.film__bubble').length;
      if (bubbles !== CONFIG.chats.chat1.length) out.push(`${bubbles} bubbles, expected ${CONFIG.chats.chat1.length}`);
      if (!el.screen.querySelectorAll('.film__bubble--me').length) out.push("Marcus's messages are not on the right");
      if (!el.screen.querySelector('.is-shout')) out.push('no ALL CAPS shake applied');
      if (el.screen.querySelector('.is-typing')) out.push('a typing indicator never resolved');
      return out;
    },
  },

  hook: {
    async run() {
      restore('start');
      await showScreen(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
    },
    check: () => (el.screen.querySelector('.welcome') ? [] : ['welcome screen not rendered']),
  },

  title: {
    async run() {
      el.card.innerHTML = `<div class="film__card">
        <div class="wordmark">AfterBell<span class="wordmark__dot"></span></div>
        <p class="film__tag">Every spot filled</p>
        <ul class="film__lines">
          <li>Built by ${esc(CONFIG.presenterName)}, Braswell High School</li>
          <li>For students, parents, and directors</li>
          <li>100+ students said it's a great idea.</li>
        </ul>
      </div>`;
      for (const item of [...el.card.querySelectorAll('.film__lines li')]) {
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
      await showScreen(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
      await sleep(900);
      await tap(el.screen.querySelector('#film-si-code'));

      await showScreen(as(MARCUS, 'student', () => Screens.activities()));
      await sleep(1500);
      await showScreen(as(MARCUS, 'student', () => Screens.studentHome()));
      await sleep(1500);

      restore('approved');
      toast('user-round-check', `${facts.angelaName} approved your account`);
      await sleep(2200);
      await showScreen(as(MARCUS, 'student', () => Screens.studentHome()));
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
      await showScreen(as(MARCUS, 'student', () => Screens.studentHome()), { instant: true });
      await sleep(700);
      await tap(el.screen.querySelector(`[data-href="#/event/${BAND_AM}"]`));

      await showScreen(as(MARCUS, 'student', () => Screens.requestRide(BAND_AM)));
      await sleep(1100);
      await tap(el.screen.querySelector('[data-action="request-ride"]'));

      restore('requested');
      await showScreen(as(MARCUS, 'student', () => Screens.matching(BAND_AM)));
    },
    check: () =>
      /Finding your ride/i.test(el.screen.textContent) ? [] : ['searching screen not shown'],
  },

  behind: {
    async run() {
      el.card.innerHTML = `<div class="film__card"><p class="film__big">Behind the scenes</p></div>`;
    },
    check: () => (/Behind the scenes/.test(el.card.textContent) ? [] : ['card text missing']),
  },

  lisa: {
    async run() {
      restore('lisaBefore');
      await showScreen(as(LISA, 'parent', () => Screens.parentView()), { instant: true });
      await sleep(1400);
      await tap(el.screen.querySelector('[data-action="seats-up"]'));

      restore('lisaAfter');
      await showScreen(as(LISA, 'parent', () => Screens.parentView()));
      countUp(el.screen.querySelector('[data-seatcount]'), facts.lisaTotalSeats - 1, facts.lisaTotalSeats);
      await sleep(1200);
      await ringEach([el.screen.querySelector('[data-seatcount]')].filter(Boolean), 1200);
    },
    check: () => {
      const out = [];
      const seats = el.screen.querySelector('[data-seatcount]');
      const toggle = el.screen.querySelector('[data-action="toggle-offer"]');
      if (!/Volleyball/i.test(el.screen.textContent)) out.push('not showing her volleyball trip');
      if (!toggle || toggle.getAttribute('aria-checked') !== 'true') out.push('offer toggle is not on');
      if (!seats || Number(seats.textContent.trim()) !== facts.lisaTotalSeats) {
        out.push(`seat count shows "${seats ? seats.textContent.trim() : '?'}", expected ${facts.lisaTotalSeats}`);
      }
      return out;
    },
  },

  fill: {
    async run() {
      restore('preFill');
      await showScreen(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)), { instant: true });
      await sleep(2600);
      await tap(el.screen.querySelector('[data-action="fill-gaps"]'));

      restore('filled');
      await showScreen(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)));
      fillTicks(facts.matchedOrder, 55);
      countUp(el.screen.querySelector('.dial__num'), facts.before, facts.after);
      await sleep(facts.matchedOrder.length * 55 + 1100);
      if (!facts.unmatchedCount) everySpotFilled();
    },
    check: () => {
      const out = [];
      const num = el.screen.querySelector('.dial__num');
      const filled = el.screen.querySelectorAll('.dial__tick.is-filled').length;
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
      await showScreen(as('o-moreno', 'organizer', () => Screens.rosterGapsCard(BAND_AM)), { instant: true });
      await sleep(2200);
      await tap(el.screen.querySelector('[data-action="assign-open"]'));

      restore('assigned');
      await showScreen(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)));
      fillTicks(facts.assignedOrder, 160);
      countUp(el.screen.querySelector('.dial__num'), facts.after, facts.final);
      await sleep(facts.assignedOrder.length * 160 + 900);
      everySpotFilled();
    },
    check: () => {
      const out = [];
      const num = el.screen.querySelector('.dial__num');
      if (!num || Number(num.textContent.trim()) !== facts.final) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.final}`);
      }
      if (facts.final !== facts.total) out.push(`final is ${facts.final} of ${facts.total}`);
      if (!el.screen.querySelector('.film__filled')) out.push('"Every spot filled" label missing');
      return out;
    },
  },

  confirmed: {
    async run() {
      restore('filled');
      await showScreen(as(MARCUS, 'student', () => Screens.matching(BAND_AM)), { instant: true });
      await sleep(900);
      toast('car-front', `Ride confirmed — ${facts.lisaName}, ${facts.car}, ${facts.pickupTime}`);
      await sleep(2200);
      await showScreen(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)));
      await sleep(700);
      await ringEach([...el.screen.querySelectorAll('.person__act')], 1100);
    },
    check: () => {
      const out = [];
      const acts = [...el.screen.querySelectorAll('.person__act')].map((n) => n.textContent.trim());
      if (!el.screen.querySelector('.handoff__code')) out.push('ride card not shown');
      if (!el.screen.textContent.includes(facts.lisaFirst)) out.push(`${facts.lisaFirst} not on the card`);
      if (new Set(acts.filter(Boolean)).size < 2) {
        out.push(`only ${new Set(acts).size} activity on the card, expected band and volleyball`);
      }
      return out;
    },
  },

  handoff: {
    async run() {
      restore('filled');
      await showScreen(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)), { instant: true });

      const inset = document.createElement('div');
      inset.className = 'film__inset';
      inset.innerHTML = `<p class="film__insetlabel">${esc(facts.lisaName)}</p>
        <p class="film__insetcode">${esc(facts.code)}</p>
        <p class="film__insetsub">Driver's screen</p>`;
      el.phone.appendChild(inset);

      await sleep(1300);
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

  code: {
    async run() {
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

      const box = el.card.querySelector('.film__code');
      const steps = [...pre.querySelectorAll('.film__step')].slice(0, 4);
      for (const step of steps) {
        box.scrollTop = Math.max(0, step.offsetTop - box.clientHeight / 2.4);
        step.classList.add('is-lit');
        await sleep(2300);
        step.classList.remove('is-lit');
      }
    },
    check: () => {
      const out = [];
      const pre = el.card.querySelector('.film__codepre');
      if (!pre || pre.textContent.length < 5000) out.push('matching.js did not load into the viewer');
      if (!el.card.querySelectorAll('.film__step').length) out.push('no algorithm steps highlighted');
      return out;
    },
  },

  rules: {
    async run() {
      el.card.innerHTML = `<div class="film__card">
        <ul class="film__lines film__lines--rules">
          <li>Only parent-approved adults drive</li>
          <li>Neighborhoods only, never home addresses</li>
        </ul>
        <p class="film__big film__quote">The hardest part wasn't the code.<br />
          It was the rules real people live by.</p>
      </div>`;
      for (const item of [...el.card.querySelectorAll('.film__lines li')]) {
        await sleep(1500);
        item.classList.add('is-in');
      }
      await sleep(1300);
      el.card.querySelector('.film__quote').classList.add('is-in');
    },
    check: () => (el.card.querySelector('.film__quote.is-in') ? [] : ['closing line never appeared']),
  },

  chat2: {
    async run() {
      restore('pickedUp');
      await showScreen(chatShell(), { instant: true });
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
      await showScreen(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)), { instant: true });
      everySpotFilled();
      await sleep(2300);
      const mark = document.createElement('div');
      mark.className = 'film__final';
      mark.innerHTML = `<span class="wordmark">AfterBell<span class="wordmark__dot"></span></span>`;
      el.phone.appendChild(mark);
      await sleep(40);
      mark.classList.add('is-in');
      await sleep(2000);
    },
    check: () => {
      const out = [];
      const num = el.screen.querySelector('.dial__num');
      if (!num || Number(num.textContent.trim()) !== facts.total) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.total}`);
      }
      if (!el.phone.querySelector('.film__final')) out.push('wordmark never faded in');
      return out;
    },
  },
};

const segmentMs = (key) => {
  const spec = CONFIG.segments[key];
  return spec.seconds === null ? chatDurationMs(key) : spec.seconds * 1000;
};

export const totalRuntimeMs = () => ORDER.reduce((sum, key) => sum + segmentMs(key), 0);

/* ===========================================================================
   THE RUNNER
=========================================================================== */
function clearStage() {
  el.phone.querySelectorAll('.film__toast, .film__inset, .film__final, .film__pulse')
    .forEach((node) => node.remove());
  el.card.innerHTML = '';
}

async function playSegment(key) {
  const spec = CONFIG.segments[key];
  clearStage();

  const isCard = CARD_SEGMENTS.includes(key);
  el.phone.classList.toggle('is-hidden', isCard);
  el.card.classList.toggle('is-hidden', !isCard);

  setPerson(spec.person);
  setCaption(spec.caption ? spec.caption(facts) : '');

  // At least the scheduled time, and never cut off mid-animation.
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

  setCaption('');
  el.blank.hidden = false;      // a blank tail to trim against. Nothing else.
}

/* ===========================================================================
   SELF-CHECK  (?film=1&check=1)
=========================================================================== */
async function selfCheck() {
  speed = 8;
  computeResults();

  const lines = [];
  let failures = 0;

  for (const key of ORDER) {
    const spec = CONFIG.segments[key];
    let problems = [];
    try {
      await playSegment(key);
      problems = SCENES[key].check() || [];

      if (spec.person) {
        const expected = personName(S.personById(CONFIG.people[spec.person].id));
        if (!el.label.textContent.includes(expected)) problems.push(`label should read ${expected}`);
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
      `${problems.length ? 'FAIL' : 'PASS'}  ${key.padEnd(10)} ${(segmentMs(key) / 1000).toFixed(1)}s` +
      (problems.length ? `\n        - ${problems.join('\n        - ')}` : '')
    );
  }

  const total = totalRuntimeMs();
  const over = total > CONFIG.maxRuntimeMs;
  if (over) failures += 1;

  lines.push('');
  lines.push(
    `${over ? 'FAIL' : 'PASS'}  runtime    ` +
    `${Math.floor(total / 60000)}:${String(Math.round((total % 60000) / 1000)).padStart(2, '0')} (cap 2:58)`
  );
  lines.push('');
  lines.push(failures ? `${failures} SEGMENT(S) FAILED` : 'ALL SEGMENTS PASS');

  speed = 1;
  el.report.hidden = false;
  el.report.textContent = lines.join('\n');
  return lines.join('\n');
}

/* ===========================================================================
   BOOT
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
    <div class="film">
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
    computeResults();
    const key = ORDER[Number(params.get('seg')) - 1];
    if (key) {
      el.start.hidden = true;
      document.body.classList.add('is-playing');
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

/** Used by the build report, so the script is never retyped by hand. */
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
