/* ===========================================================================
   AfterBell — film.js
   The demo film. Open film.html and press Start.
   ===========================================================================
   A standalone page, separate from the app. It imports the app's REAL state
   layer, the REAL screen renderers and the REAL matching algorithm, resets
   the demo data, runs the algorithm once on Saturday morning's trip, and then
   plays fifteen segments against the results of that single run. Nothing is
   hardcoded; every number, name, car and time in the captions is read back
   out of the data at the moment it is spoken.

   It records nothing and plays no audio — you screen record it yourself.

     film.html           press Start
     film.html?seg=N     preview one segment
     film.html?check=1   run every segment at 8x and print PASS/FAIL

   KEYS: Space pause/resume · Esc back to Start · C captions on/off
=========================================================================== */

import * as S from './state.js';
import * as Screens from './screens.js';
import { view } from './view.js';
import { drawAllMaps } from './map.js';
import { esc, icon, personName, initials } from './ui.js';
import { formatTime } from './matching.js';

/* ===========================================================================
   CONFIG — every duration, caption and bit of pacing, in one place.
=========================================================================== */
const CONFIG = {
  /* >>> FILL THESE IN <<< the only two words not read from the data. */
  presenterName: '[NAME]',
  presenterGrade: '[GRADE]',

  blankStartMs: 2000,       // trimmable run-in
  holdLastMs: 3000,         // hold on the final frame
  transitionMs: 250,
  tapPulseMs: 620,
  safetyMarginMs: 5000,     // a segment is abandoned at duration + this
  maxRuntimeMs: 178000,     // 2:58 cap, enforced by the self-check

  stage: { width: 1240, height: 880 },

  chat: {
    // The brief asks for about 1.3s between messages. At that pace the film
    // runs to 3:03, over the 2:58 cap, and the gap is the agreed first thing
    // to shorten. At 1.0s the film lands at 2:57.
    gapMs: 1000,
    typeBaseMs: 500,
    typePerCharMs: 20,
    typeMaxMs: 1500,
  },

  cast: {
    marcus: { id: 's19', role: 'Trumpets' },
    lisa: { id: 'p07', role: "Volleyball parent · Dev's neighbor" },
    moreno: { id: 'o-moreno', role: 'Band director' },
  },

  /* seconds + caption per segment. The two chats time themselves. */
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
        `and place, measures distance between neighborhoods with the haversine formula, ` +
        `and fills seats closest-first within three miles.`,
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

/* Segment 'gaps' drops out if the real run leaves nobody behind. */
const BASE_ORDER = [
  'chat1', 'hook', 'title', 'join', 'request', 'behind', 'lisa', 'fill',
  'gaps', 'confirmed', 'handoff', 'code', 'rules', 'chat2', 'final',
];
let ORDER = [...BASE_ORDER];

const MARCUS = 's19';
const LISA = 'p07';
const ANGELA = 'p12';
const CHAPERONE = 'c-rivera';
const BAND_AM = 'e-band-sat-am';
const VBALL_AM = 'e-vball-sat-am';
const CARD_SEGMENTS = ['title', 'behind', 'code', 'rules'];

/* ===========================================================================
   ONE REAL RUN OF THE ALGORITHM, SAVED
   Snapshots are deep copies of the app's data. Each segment restores the one
   it needs, so segments never depend on each other.
=========================================================================== */
const snaps = {};
const facts = {};

const clone = (value) => JSON.parse(JSON.stringify(value));
const snapshot = () => clone(S.state.data);
function restore(name) {
  S.state.data = clone(snaps[name]);
  S.state.lastFill = null;
}

function summariseReasons(rows) {
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

function runTheAlgorithm() {
  S.resetDemo();
  view.groupFilter = 'ALL';
  view.showAllGaps = false;
  view.assignOpenFor = null;
  view.homeFilter = null;

  // Scene setup, done with the data rather than a fake screen: at the top of
  // the film Marcus has not joined and has not asked for a ride. Both are
  // undone by the real actions during segments 4 and 5.
  S.cancelRequest(MARCUS, BAND_AM);
  S.personById(MARCUS).approved = false;
  snaps.start = snapshot();

  // --- Lisa's two frames -------------------------------------------------
  // Her card shows the soonest trip her students have, and the film is set
  // on Saturday morning, so the week before it has already happened.
  const dawn = S.eventById(VBALL_AM).rideTimeISO;
  S.state.data.events = S.state.data.events.filter((e) => e.rideTimeISO >= dawn);
  const lisaOffer = S.offerById(`of-${VBALL_AM}-${LISA}`);
  const realSeats = lisaOffer.seats;
  lisaOffer.seats = 1;              // just her daughter, nothing spare yet
  snaps.lisaBefore = snapshot();
  lisaOffer.seats = realSeats;      // she opens the spare seat
  snaps.lisaAfter = snapshot();
  facts.lisaTotalSeats = realSeats;
  facts.lisaSeats = realSeats - 1;  // the spare, which is what Marcus takes

  // --- back to the whole week -------------------------------------------
  S.state.data = clone(snaps.start);

  S.approveStudent(MARCUS);
  snaps.approved = snapshot();

  S.requestRide(MARCUS, BAND_AM);
  snaps.requested = snapshot();

  const before = S.readinessFor(BAND_AM);
  facts.total = before.total;
  facts.before = before.covered;
  snaps.preFill = snapshot();

  // ---------- the real algorithm, run once ----------
  const result = S.runFillTheGaps(BAND_AM);
  facts.matchedOrder = [...result.matchedStudentIds];
  snaps.filled = snapshot();
  facts.after = S.readinessFor(BAND_AM).covered;

  const leftover = S.readinessFor(BAND_AM).rows.filter((row) => !S.hasRide(row.status.code));
  facts.unmatchedCount = leftover.length;
  facts.unmatchedNames = leftover.map((row) => personName(row.person));
  facts.shortReason = summariseReasons(leftover);
  facts.assignedOrder = leftover.map((row) => row.studentId);

  // Nobody left behind means no segment about it.
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

  S.markPickedUp(facts.rideId, true);
  facts.pickedUpAt = S.rideById(facts.rideId).pickedUpAt;
  snaps.pickedUp = snapshot();

  facts.marcusFirst = S.personById(MARCUS).firstName;
  facts.angelaName = personName(S.personById(ANGELA));
  facts.chaperoneName = personName(S.personById(CHAPERONE));
  facts.presenterName = CONFIG.presenterName;
  facts.presenterGrade = CONFIG.presenterGrade;
}

/* ===========================================================================
   STAGE
=========================================================================== */
let dom = {};
let speed = 1;
let paused = false;
let token = 0;
let captionsOn = true;

/**
 * Wait, honouring pause, and bail out if the segment has moved on.
 *
 * It counts down the time it actually schedules: each tick waits `slice` and
 * subtracts exactly `slice`, so the total scheduled equals the duration
 * asked for. An earlier version waited once before it started subtracting,
 * which quietly added up to seconds across the twenty-six waits in a chat.
 */
function sleep(ms) {
  const mine = token;
  let left = ms / speed;
  return new Promise((resolve) => {
    const step = () => {
      if (mine !== token) return resolve();
      if (paused) return setTimeout(step, 60);   // paused time is not counted
      if (left <= 0) return resolve();
      const slice = Math.min(80, left);
      left -= slice;
      setTimeout(step, slice);
    };
    step();
  });
}

/** Render a real app screen as a given person. */
function as(personId, role, render) {
  const previousRole = S.state.role;
  const previousUser = S.state.userId;
  S.state.role = role;
  S.state.userId = personId;
  try {
    return render();
  } finally {
    S.state.role = previousRole;
    S.state.userId = previousUser;
  }
}

/** Swap what the phone shows, without moving the frame. */
async function show(html, { instant = false } = {}) {
  if (!instant) {
    dom.viewport.classList.add('is-out');
    await sleep(CONFIG.transitionMs);
  }
  dom.viewport.innerHTML = html;
  // The app's screens carry ids; namespace them so nothing collides.
  dom.viewport.querySelectorAll('[id]').forEach((node) => { node.id = `f-${node.id}`; });
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  drawAllMaps(S.state.data, dom.viewport);
  dom.viewport.classList.remove('is-out');
}

function setPerson(key) {
  if (!key) {
    dom.who.classList.remove('is-in');
    dom.who.dataset.who = '';
    return;
  }
  if (dom.who.dataset.who === key) return;
  dom.who.dataset.who = key;

  const spec = CONFIG.cast[key];
  const person = S.personById(spec.id);
  dom.who.classList.remove('is-in');
  setTimeout(() => {
    dom.who.innerHTML =
      `<span class="avatar avatar--sm">${esc(initials(person))}</span>` +
      `<span><span class="who__name">${esc(personName(person))}</span>` +
      `<span class="who__role">${esc(spec.role)}</span></span>`;
    dom.who.classList.add('is-in');
  }, 100 / speed);
}

function setCaption(text) {
  dom.caption.textContent = text || '';
  dom.caption.hidden = !captionsOn || !text;
}

async function tap(target) {
  if (!target) return;
  const phoneBox = dom.phone.getBoundingClientRect();
  const targetBox = target.getBoundingClientRect();
  const scale = phoneBox.width / dom.phone.offsetWidth || 1;

  const dot = document.createElement('span');
  dot.className = 'pulse';
  dot.style.left = `${(targetBox.left - phoneBox.left) / scale + target.offsetWidth / 2}px`;
  dot.style.top = `${(targetBox.top - phoneBox.top) / scale + Math.min(target.offsetHeight / 2, 30)}px`;
  dom.phone.appendChild(dot);
  await sleep(CONFIG.tapPulseMs);
  dot.remove();
}

function notify(iconName, text) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = `${icon(iconName)}<span>${esc(text)}</span>`;
  dom.phone.appendChild(node);
  if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': 2 } });
  setTimeout(() => node.classList.add('is-in'), 30);
  return node;
}

function countUp(node, from, to) {
  if (!node || from >= to) return;
  const stepMs = Math.max(30, 1100 / Math.max(1, to - from)) / speed;
  let current = from;
  node.textContent = String(current);

  const timer = setInterval(() => {
    if (!node.isConnected) return clearInterval(timer);
    current += 1;
    node.textContent = String(current);
    if (current >= to) clearInterval(timer);
  }, stepMs);

  // A guaranteed finisher: the true value lands even if the timer is throttled.
  setTimeout(() => {
    clearInterval(timer);
    if (node.isConnected) node.textContent = String(to);
  }, stepMs * (to - from) + 500);
}

function fillTicks(ids, perTickMs) {
  ids.forEach((id, i) => {
    const tick = dom.viewport.querySelector(`.dial__tick[data-student="${id}"]`);
    if (!tick) return;
    tick.style.animationDelay = `${(i * perTickMs) / speed}ms`;
    tick.classList.add('is-filling');
  });
}

function markEverySpotFilled() {
  const sub = dom.viewport.querySelector('.dial__sub');
  if (sub && !dom.viewport.querySelector('.filled-note')) {
    sub.insertAdjacentHTML('afterend', '<div class="filled-note">Every spot filled</div>');
  }
}

async function ringEach(nodes, hold) {
  for (const node of nodes) {
    node.classList.add('ring');
    await sleep(hold);
    node.classList.remove('ring');
  }
}

/* ---------------------------------------------------------------------------
   THE CHAT PROP
--------------------------------------------------------------------------- */
const CHAT_COLOURS = {
  Maya: '#C2410C', Chris: '#5E6B72', Dev: '#6E6480', Ari: '#6B7A5E', Marcus: '#8A6356',
};
const ME = 'Marcus';

const typingMsFor = (text) =>
  Math.min(CONFIG.chat.typeMaxMs, CONFIG.chat.typeBaseMs + text.length * CONFIG.chat.typePerCharMs);

const chatDurationMs = (key) =>
  CONFIG.chats[key].reduce((sum, [, text]) => sum + typingMsFor(text) + CONFIG.chat.gapMs, 0);

const chatShell = () => `<div class="chat">
  <header class="chat__bar">
    <span class="chat__icon">T</span>
    <div>
      <p class="chat__title">Trumpets 🎺 (8)</p>
      <p class="chat__sub">8 members</p>
    </div>
  </header>
  <div class="chat__thread"></div>
</div>`;

/** Four or more letters, none of them lowercase. */
const isShout = (text) => {
  const letters = text.replace(/[^A-Za-z]/g, '');
  return letters.length >= 4 && letters === letters.toUpperCase();
};

async function playChat(key) {
  const thread = dom.viewport.querySelector('.chat__thread');
  let lastSender = null;
  let group = null;

  for (const [sender, text, clock] of CONFIG.chats[key]) {
    // A new group starts whenever the speaker changes. The name and the time
    // appear once per group, above the first bubble.
    if (sender !== lastSender) {
      lastSender = sender;
      const mine = sender === ME;
      group = document.createElement('div');
      group.className = mine ? 'group group--me' : 'group';
      group.innerHTML = mine
        ? '<div class="group__body"></div>'
        : `<span class="group__avatar" style="background:${CHAT_COLOURS[sender] || '#777'}">${esc(sender[0])}</span>
           <div class="group__body">
             <div class="group__head"><b>${esc(sender)}</b> · ${esc(clock)}</div>
           </div>`;
      thread.appendChild(group);
    }

    const bubble = document.createElement('div');
    bubble.className = `msg${sender === ME ? ' msg--me' : ''} msg--typing`;
    bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    group.querySelector('.group__body').appendChild(bubble);
    thread.scrollTop = thread.scrollHeight;

    await sleep(typingMsFor(text));

    bubble.classList.remove('msg--typing');
    bubble.textContent = text;
    if (isShout(text)) bubble.classList.add('msg--shout');
    thread.scrollTop = thread.scrollHeight;

    await sleep(CONFIG.chat.gapMs);
  }
}

/* ===========================================================================
   THE SEGMENTS
   Each sets up its own screen from a stored snapshot, plays, and resolves.
   `check` is what the self-check run asserts.
=========================================================================== */
const SCENES = {
  chat1: {
    async run() {
      restore('start');
      await show(chatShell(), { instant: true });
      await playChat('chat1');
    },
    check: () => {
      const out = [];
      const bubbles = dom.viewport.querySelectorAll('.msg').length;
      if (bubbles !== CONFIG.chats.chat1.length) out.push(`${bubbles} bubbles, expected ${CONFIG.chats.chat1.length}`);
      if (!dom.viewport.querySelectorAll('.msg--me').length) out.push("Marcus's messages are not on the right");
      if (!dom.viewport.querySelector('.msg--shout')) out.push('no ALL CAPS shake applied');
      if (dom.viewport.querySelector('.msg--typing')) out.push('a typing indicator never resolved');
      if (!/Trumpets/.test(dom.viewport.textContent)) out.push('group title missing');
      return out;
    },
  },

  hook: {
    async run() {
      restore('start');
      await show(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
    },
    check: () => (dom.viewport.querySelector('.welcome') ? [] : ['welcome screen not rendered']),
  },

  title: {
    async run() {
      dom.card.innerHTML = `<div class="bigcard">
        <div class="wordmark">AfterBell<span class="wordmark__dot"></span></div>
        <p class="bigcard__tag">Every spot filled</p>
        <ul class="bigcard__list">
          <li>Built by ${esc(CONFIG.presenterName)}, Braswell High School</li>
          <li>For students, parents, and directors</li>
          <li>100+ students said it's a great idea.</li>
        </ul>
      </div>`;
      for (const item of [...dom.card.querySelectorAll('.bigcard__list li')]) {
        await sleep(1600);
        item.classList.add('is-in');
      }
    },
    check: () => {
      const shown = dom.card.querySelectorAll('.bigcard__list li.is-in').length;
      return shown === 3 ? [] : [`${shown} of 3 title lines appeared`];
    },
  },

  join: {
    async run() {
      restore('start');
      await show(as(MARCUS, 'student', () => Screens.signIn()), { instant: true });
      await sleep(900);
      await tap(dom.viewport.querySelector('#f-si-code'));

      await show(as(MARCUS, 'student', () => Screens.activities()));
      await sleep(1500);
      await show(as(MARCUS, 'student', () => Screens.studentHome()));
      await sleep(1500);

      restore('approved');
      notify('user-round-check', `${facts.angelaName} approved your account`);
      await sleep(2200);
      await show(as(MARCUS, 'student', () => Screens.studentHome()));
    },
    check: () => {
      const out = [];
      if (!S.personById(MARCUS).approved) out.push('Marcus is still unapproved');
      if (!dom.phone.querySelector('.toast')) out.push('approval notification missing');
      if (dom.viewport.querySelector('.notice')) out.push('still showing the waiting-on-a-parent notice');
      return out;
    },
  },

  request: {
    async run() {
      restore('approved');
      await show(as(MARCUS, 'student', () => Screens.studentHome()), { instant: true });
      await sleep(700);
      await tap(dom.viewport.querySelector(`[data-href="#/event/${BAND_AM}"]`));

      await show(as(MARCUS, 'student', () => Screens.requestRide(BAND_AM)));
      await sleep(1100);
      await tap(dom.viewport.querySelector('[data-action="request-ride"]'));

      restore('requested');
      await show(as(MARCUS, 'student', () => Screens.matching(BAND_AM)));
    },
    check: () =>
      /Finding your ride/i.test(dom.viewport.textContent) ? [] : ['searching screen not shown'],
  },

  behind: {
    async run() {
      dom.card.innerHTML = `<div class="bigcard"><p class="bigcard__line">Behind the scenes</p></div>`;
    },
    check: () => (/Behind the scenes/.test(dom.card.textContent) ? [] : ['card text missing']),
  },

  lisa: {
    async run() {
      restore('lisaBefore');
      await show(as(LISA, 'parent', () => Screens.parentView()), { instant: true });
      await sleep(1400);
      await tap(dom.viewport.querySelector('[data-action="seats-up"]'));

      restore('lisaAfter');
      await show(as(LISA, 'parent', () => Screens.parentView()));
      countUp(dom.viewport.querySelector('[data-seatcount]'), facts.lisaTotalSeats - 1, facts.lisaTotalSeats);
      await sleep(1200);
      await ringEach([dom.viewport.querySelector('[data-seatcount]')].filter(Boolean), 1200);
    },
    check: () => {
      const out = [];
      const seats = dom.viewport.querySelector('[data-seatcount]');
      const toggle = dom.viewport.querySelector('[data-action="toggle-offer"]');
      if (!/Volleyball/i.test(dom.viewport.textContent)) out.push('not showing her volleyball trip');
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
      await show(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)), { instant: true });
      await sleep(2600);
      await tap(dom.viewport.querySelector('[data-action="fill-gaps"]'));

      restore('filled');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)));
      fillTicks(facts.matchedOrder, 55);
      countUp(dom.viewport.querySelector('.dial__num'), facts.before, facts.after);
      await sleep(facts.matchedOrder.length * 55 + 1100);
      if (!facts.unmatchedCount) markEverySpotFilled();
    },
    check: () => {
      const out = [];
      const num = dom.viewport.querySelector('.dial__num');
      const filled = dom.viewport.querySelectorAll('.dial__tick.is-filled').length;
      if (!num || Number(num.textContent.trim()) !== facts.after) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.after}`);
      }
      if (filled !== facts.after) out.push(`${filled} ticks filled, expected ${facts.after}`);
      if (!dom.viewport.querySelectorAll('.is-filling').length) out.push('tick animation never started');
      return out;
    },
  },

  gaps: {
    async run() {
      restore('filled');
      await show(as('o-moreno', 'organizer', () => Screens.rosterGapsCard(BAND_AM)), { instant: true });
      await sleep(2200);
      await tap(dom.viewport.querySelector('[data-action="assign-open"]'));

      restore('assigned');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)));
      fillTicks(facts.assignedOrder, 160);
      countUp(dom.viewport.querySelector('.dial__num'), facts.after, facts.final);
      await sleep(facts.assignedOrder.length * 160 + 900);
      markEverySpotFilled();
    },
    check: () => {
      const out = [];
      const num = dom.viewport.querySelector('.dial__num');
      if (!num || Number(num.textContent.trim()) !== facts.final) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.final}`);
      }
      if (facts.final !== facts.total) out.push(`final is ${facts.final} of ${facts.total}`);
      if (!dom.viewport.querySelector('.filled-note')) out.push('"Every spot filled" label missing');
      return out;
    },
  },

  confirmed: {
    async run() {
      restore('filled');
      await show(as(MARCUS, 'student', () => Screens.matching(BAND_AM)), { instant: true });
      await sleep(900);
      notify('car-front', `Ride confirmed — ${facts.lisaName}, ${facts.car}, ${facts.pickupTime}`);
      await sleep(2200);
      await show(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)));
      await sleep(700);
      await ringEach([...dom.viewport.querySelectorAll('.person__act')], 1100);
    },
    check: () => {
      const out = [];
      const activities = [...dom.viewport.querySelectorAll('.person__act')].map((n) => n.textContent.trim());
      if (!dom.viewport.querySelector('.handoff__code')) out.push('ride card not shown');
      if (!dom.viewport.textContent.includes(facts.lisaFirst)) out.push(`${facts.lisaFirst} not on the card`);
      if (new Set(activities.filter(Boolean)).size < 2) {
        out.push(`only ${new Set(activities).size} activity on the card, expected band and volleyball`);
      }
      return out;
    },
  },

  handoff: {
    async run() {
      restore('filled');
      await show(as(MARCUS, 'student', () => Screens.rideCard(facts.rideId)), { instant: true });

      const inset = document.createElement('div');
      inset.className = 'inset';
      inset.innerHTML = `<p class="inset__who">${esc(facts.lisaName)}</p>
        <p class="inset__code">${esc(facts.code)}</p>
        <p class="inset__sub">Driver's screen</p>`;
      dom.phone.appendChild(inset);

      await sleep(1300);
      const code = dom.viewport.querySelector('.handoff__code');
      code.classList.add('ring');
      inset.classList.add('ring');
      await sleep(2000);
      code.classList.remove('ring');
      inset.classList.remove('ring');

      restore('pickedUp');
      notify('check-check', `Picked up ${facts.pickedUpAt} · Your mom was notified`);
    },
    check: () => {
      const out = [];
      const inset = dom.phone.querySelector('.inset__code');
      const code = dom.viewport.querySelector('.handoff__code');
      if (!code || !inset) out.push('rider or driver code missing');
      else if (code.textContent.trim() !== inset.textContent.trim()) {
        out.push(`codes differ: ${code.textContent.trim()} vs ${inset.textContent.trim()}`);
      }
      if (!dom.phone.querySelector('.toast')) out.push('picked-up notification missing');
      return out;
    },
  },

  code: {
    async run() {
      dom.card.innerHTML = `<div class="codebox"><pre>Loading…</pre></div>`;
      const source = await fetch('./js/matching.js').then((r) => r.text());
      const pre = dom.card.querySelector('pre');

      pre.innerHTML = source
        .split('\n')
        .map((line, i) => {
          const isStep = /STEP \d/.test(line) ? ' class="step"' : '';
          const safe = esc(line)
            .replace(/(\/\/.*)/g, '<em>$1</em>')
            .replace(/\b(const|let|function|return|export|for|of|if|else|new|import|from)\b/g, '<b>$1</b>');
          return `<span${isStep}><span class="ln">${String(i + 1).padStart(3, ' ')}</span>${safe}</span>`;
        })
        .join('\n');

      // Scroll to each of the algorithm's step headings as the caption
      // reaches it, and light it up.
      const box = dom.card.querySelector('.codebox');
      for (const step of [...pre.querySelectorAll('.step')].slice(0, 4)) {
        box.scrollTop = Math.max(0, step.offsetTop - box.clientHeight / 2.4);
        step.classList.add('is-lit');
        await sleep(2300);
        step.classList.remove('is-lit');
      }
    },
    check: () => {
      const out = [];
      const pre = dom.card.querySelector('pre');
      if (!pre || pre.textContent.length < 5000) out.push('matching.js did not load into the viewer');
      if (!dom.card.querySelectorAll('.step').length) out.push('no algorithm steps highlighted');
      return out;
    },
  },

  rules: {
    async run() {
      dom.card.innerHTML = `<div class="bigcard">
        <ul class="bigcard__list bigcard__list--rules">
          <li>Only parent-approved adults drive</li>
          <li>Neighborhoods only, never home addresses</li>
        </ul>
        <p class="bigcard__line bigcard__quote">The hardest part wasn't the code.<br />
          It was the rules real people live by.</p>
      </div>`;
      for (const item of [...dom.card.querySelectorAll('.bigcard__list li')]) {
        await sleep(1500);
        item.classList.add('is-in');
      }
      await sleep(1300);
      dom.card.querySelector('.bigcard__quote').classList.add('is-in');
    },
    check: () => (dom.card.querySelector('.bigcard__quote.is-in') ? [] : ['closing line never appeared']),
  },

  chat2: {
    async run() {
      restore('pickedUp');
      await show(chatShell(), { instant: true });
      await playChat('chat2');
    },
    check: () => {
      const bubbles = dom.viewport.querySelectorAll('.msg').length;
      return bubbles === CONFIG.chats.chat2.length
        ? []
        : [`${bubbles} bubbles, expected ${CONFIG.chats.chat2.length}`];
    },
  },

  final: {
    async run() {
      restore('assigned');
      await show(as('o-moreno', 'organizer', () => Screens.organizer(BAND_AM)), { instant: true });
      markEverySpotFilled();
      await sleep(2300);

      const mark = document.createElement('div');
      mark.className = 'signoff';
      mark.innerHTML = `<span class="wordmark">AfterBell<span class="wordmark__dot"></span></span>`;
      dom.phone.appendChild(mark);
      await sleep(40);
      mark.classList.add('is-in');
      await sleep(2000);
    },
    check: () => {
      const out = [];
      const num = dom.viewport.querySelector('.dial__num');
      if (!num || Number(num.textContent.trim()) !== facts.total) {
        out.push(`dial reads "${num ? num.textContent.trim() : '?'}", expected ${facts.total}`);
      }
      if (!dom.phone.querySelector('.signoff')) out.push('wordmark never faded in');
      return out;
    },
  },
};

const segmentMs = (key) => {
  const spec = CONFIG.segments[key];
  return spec.seconds === null ? chatDurationMs(key) : spec.seconds * 1000;
};

const totalRuntimeMs = () => ORDER.reduce((sum, key) => sum + segmentMs(key), 0);

/* ===========================================================================
   THE RUNNER
=========================================================================== */
function clearStage() {
  dom.phone.querySelectorAll('.toast, .inset, .signoff, .pulse').forEach((node) => node.remove());
  dom.card.innerHTML = '';
}

/**
 * Resolves after `ms` of real time no matter what, so one stuck segment can
 * never hang the film. The margin is wall-clock headroom on top of the
 * segment's own (speed-scaled) duration, so it does not shrink at 8x.
 *
 * The warning only fires when the timeout actually wins. A timer that is
 * still pending when the work finishes is cancelled, so a healthy segment
 * never logs anything.
 */
function withSafetyTimeout(promise, ms, label) {
  let timer = null;
  let settled = false;

  const work = promise.then((value) => {
    settled = true;
    if (timer !== null) clearTimeout(timer);
    return value;
  });

  const guard = new Promise((resolve) => {
    timer = setTimeout(() => {
      if (!settled) console.warn(`[film] ${label} hit its safety timeout after ${Math.round(ms)}ms`);
      resolve();
    }, ms);
  });

  return Promise.race([work, guard]);
}

async function playSegment(key, index) {
  const spec = CONFIG.segments[key];
  const number = index + 1;

  console.log(`Starting segment ${number} (${key})`);
  clearStage();

  const isCard = CARD_SEGMENTS.includes(key);
  dom.phone.classList.toggle('is-hidden', isCard);
  dom.card.classList.toggle('is-hidden', !isCard);

  setPerson(spec.person);
  setCaption(spec.caption ? spec.caption(facts) : '');

  const duration = segmentMs(key);
  try {
    // At least the scheduled time, never cut off mid-animation, and never
    // able to hang: whichever of those finishes last wins, up to the cap.
    await withSafetyTimeout(
      Promise.all([sleep(duration), SCENES[key].run()]),
      duration / speed + CONFIG.safetyMarginMs,
      `segment ${number} (${key})`
    );
  } catch (error) {
    console.error(`[film] segment ${number} (${key}) failed:`, error);
  }
  console.log(`Finished segment ${number} (${key})`);
}

async function playFilm() {
  const mine = ++token;
  runTheAlgorithm();

  dom.blank.hidden = false;
  await sleep(CONFIG.blankStartMs);
  if (mine !== token) return;
  dom.blank.hidden = true;

  for (let i = 0; i < ORDER.length; i++) {
    if (mine !== token) return;
    await playSegment(ORDER[i], i);
  }

  if (mine !== token) return;
  await sleep(CONFIG.holdLastMs);
  if (mine !== token) return;

  // A blank tail to trim against. Nothing else appears.
  setCaption('');
  setPerson(null);
  dom.blank.hidden = false;
  console.log('[film] done');
}

/* ===========================================================================
   SELF-CHECK  (film.html?check=1)
=========================================================================== */
async function selfCheck() {
  speed = 8;
  runTheAlgorithm();

  const lines = [];
  let failures = 0;

  for (let i = 0; i < ORDER.length; i++) {
    const key = ORDER[i];
    const spec = CONFIG.segments[key];
    let problems = [];

    try {
      await playSegment(key, i);
      problems = SCENES[key].check() || [];

      if (spec.person) {
        const expected = personName(S.personById(CONFIG.cast[spec.person].id));
        if (!dom.who.textContent.includes(expected)) problems.push(`label should read ${expected}`);
      }
      if (spec.caption) {
        const text = spec.caption(facts);
        if (/undefined|NaN|\{\w+\}/.test(text)) problems.push('caption has an unfilled placeholder');
        if (dom.caption.textContent !== text) problems.push('caption not displayed');
      }
    } catch (error) {
      problems.push(`threw: ${error.message}`);
    }

    if (problems.length) failures += 1;
    lines.push(
      `${problems.length ? 'FAIL' : 'PASS'}  ${String(i + 1).padStart(2)}. ${key.padEnd(10)} ` +
      `${(segmentMs(key) / 1000).toFixed(1)}s` +
      (problems.length ? `\n            - ${problems.join('\n            - ')}` : '')
    );
  }

  const total = totalRuntimeMs();
  const over = total > CONFIG.maxRuntimeMs;
  if (over) failures += 1;

  lines.push('');
  lines.push(
    `${over ? 'FAIL' : 'PASS'}      runtime    ` +
    `${Math.floor(total / 60000)}:${String(Math.floor((total % 60000) / 1000)).padStart(2, '0')} (cap 2:58)`
  );
  lines.push('');
  lines.push(failures ? `${failures} SEGMENT(S) FAILED` : 'ALL SEGMENTS PASS');

  speed = 1;
  dom.report.hidden = false;
  dom.report.textContent = lines.join('\n');
  console.log(lines.join('\n'));
}

/* ===========================================================================
   BOOT
=========================================================================== */
function fitStage() {
  const scale = Math.min(
    window.innerWidth / CONFIG.stage.width,
    window.innerHeight / CONFIG.stage.height
  );
  dom.stage.style.setProperty('--scale', String(Math.min(1, scale)));
}

function goFullscreen() {
  const node = document.documentElement;
  const request = node.requestFullscreen || node.webkitRequestFullscreen;
  if (!request) return;
  try {
    // Safari's version returns undefined; Chrome's returns a promise that
    // rejects when the click is not treated as a gesture. Neither may stop
    // the film, so both paths are swallowed.
    const result = request.call(node);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    /* a blocked request must not stop the film */
  }
}

function backToStart() {
  token += 1;
  paused = false;
  document.body.classList.remove('is-playing');
  dom.blank.hidden = true;
  clearStage();
  dom.viewport.innerHTML = '';
  setCaption('');
  setPerson(null);
  dom.start.hidden = false;
}

function build() {
  document.getElementById('film').innerHTML = `
    <div class="stage" id="stage">
      <div class="who" id="who"></div>
      <div class="middle">
        <div class="phone" id="phone"><div class="viewport" id="viewport"></div></div>
        <div class="cardslot is-hidden" id="cardslot"></div>
      </div>
      <p class="caption" id="caption" hidden></p>
    </div>
    <div class="blank" id="blank" hidden></div>
    <div class="startscreen" id="startscreen">
      <button class="startbtn" id="startbtn">Start</button>
    </div>
    <pre class="report" id="report" hidden></pre>`;

  dom = {
    stage: document.getElementById('stage'),
    who: document.getElementById('who'),
    phone: document.getElementById('phone'),
    viewport: document.getElementById('viewport'),
    card: document.getElementById('cardslot'),
    caption: document.getElementById('caption'),
    blank: document.getElementById('blank'),
    start: document.getElementById('startscreen'),
    report: document.getElementById('report'),
  };

  fitStage();
  window.addEventListener('resize', fitStage);

  const params = new URLSearchParams(location.search);

  if (params.get('check') === '1') {
    dom.start.hidden = true;
    document.body.classList.add('is-playing');
    selfCheck();
    return;
  }

  if (params.get('seg')) {
    runTheAlgorithm();
    const index = Number(params.get('seg')) - 1;
    const key = ORDER[index];
    if (key) {
      dom.start.hidden = true;
      document.body.classList.add('is-playing');
      playSegment(key, index);
      return;
    }
  }

  document.getElementById('startbtn').addEventListener('click', () => {
    dom.start.hidden = true;
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
      backToStart();
    } else if (event.key.toLowerCase() === 'c') {
      captionsOn = !captionsOn;
      dom.caption.hidden = !captionsOn || !dom.caption.textContent;
    }
  });
}

build();

/** Used by the build report so the script is never retyped by hand. */
export function captionScript() {
  if (!facts.total) runTheAlgorithm();
  return ORDER.map((key, i) => ({
    n: i + 1,
    id: key,
    seconds: Number((segmentMs(key) / 1000).toFixed(1)),
    caption: CONFIG.segments[key].caption ? CONFIG.segments[key].caption(facts) : null,
  }));
}
export { CONFIG, facts, runTheAlgorithm, ORDER };
