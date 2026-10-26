/* ===========================================================================
   AfterBell — matching.test.js
   Tests for the matching algorithm, with no browser and no Firebase.
   ===========================================================================
   Run them two ways:

     In a browser:  open tests.html
     In a terminal: node js/matching.test.js      (needs Node 18+)

   Most of these use tiny hand-made fixtures rather than the real seed data,
   so each one tests exactly one rule. The last group checks the demo numbers
   I quote in my video, so if I ever edit seed.js and break the demo, a test
   tells me instead of a judge.
=========================================================================== */

import {
  fillTheGaps, haversineMiles, crossesCurfew, buildBuckets,
  handoffCode, toMinutes, REASON,
} from './matching.js';
import { buildSeedState } from './seed.js';

/* ---------------------------------------------------------------------------
   A ~20-line test harness. Enough, and nothing to install.
--------------------------------------------------------------------------- */
const results = [];

function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, message: error.message });
  }
}

function eq(actual, expected, what = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${what} expected ${b}, got ${a}`);
}

function near(actual, expected, tolerance, what = '') {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${what} expected about ${expected}, got ${actual}`);
  }
}

function ok(value, what = '') {
  if (!value) throw new Error(what || 'expected a truthy value');
}

/* ---------------------------------------------------------------------------
   FIXTURES — two neighborhoods a known distance apart, and some people.
--------------------------------------------------------------------------- */
const HOODS = [
  { id: 'near-a', name: 'Near A', lat: 33.2500, lng: -96.9500 },
  { id: 'near-b', name: 'Near B', lat: 33.2600, lng: -96.9500 }, // ~0.69 mi from A
  { id: 'far',    name: 'Far',    lat: 33.3500, lng: -96.9500 }, // ~6.9 mi from A
];

const person = (id, over) => ({
  id, firstName: id, lastInitial: 'X', age: 16,
  householdId: `h-${id}`, neighborhoodId: 'near-a',
  driverKind: null, provisionalUnder12Months: false, approved: true,
  ...over,
});

const request = (id, studentId, over) => ({
  id, studentId, eventId: 'ev', status: 'pending',
  direction: 'from', destinationId: 'school',
  timeISO: '2026-10-27T18:00', neighborhoodId: 'near-a',
  ...over,
});

const offer = (id, driverId, seats, over) => ({
  id, driverId, eventId: 'ev', seats,
  direction: 'from', destinationId: 'school',
  timeISO: '2026-10-27T18:00', neighborhoodId: 'near-a',
  ...over,
});

const run = (people, requests, offers, settings) =>
  fillTheGaps({ people, requests, offers, neighborhoods: HOODS, existingRides: [], settings });

/* ===========================================================================
   THE MATH
=========================================================================== */
test('haversine: 0.01 degrees of latitude is about 0.69 miles', () => {
  near(haversineMiles(HOODS[0], HOODS[1]), 0.69, 0.02);
});

test('haversine: the same point is zero miles away', () => {
  eq(haversineMiles(HOODS[0], HOODS[0]), 0);
});

test('time: wall-clock stamps convert to comparable minutes', () => {
  eq(toMinutes('2026-10-27T18:10') - toMinutes('2026-10-27T17:55'), 15);
  eq(toMinutes('2026-11-01T00:15') - toMinutes('2026-10-31T23:30'), 45);
});

/* ===========================================================================
   STEP 1 — BUCKETING
=========================================================================== */
test('bucket: two activities inside the window share one bucket', () => {
  // This is the single most important test in the file. It is the product.
  const buckets = buildBuckets(
    [
      request('r1', 's1', { timeISO: '2026-10-27T17:55', activityId: 'xc' }),
      request('r2', 's2', { timeISO: '2026-10-27T18:10', activityId: 'theater' }),
    ],
    [offer('o1', 'd1', 4, { timeISO: '2026-10-27T18:00' })]
  );
  eq(buckets.length, 1, 'bucket count:');
  eq(buckets[0].requests.length, 2, 'riders in bucket:');
  eq(buckets[0].offers.length, 1, 'drivers in bucket:');
});

test('bucket: 16 minutes apart is two different trips', () => {
  const buckets = buildBuckets(
    [
      request('r1', 's1', { timeISO: '2026-10-27T17:55' }),
      request('r2', 's2', { timeISO: '2026-10-27T18:11' }),
    ],
    []
  );
  eq(buckets.length, 2);
});

test('bucket: opposite directions never mix', () => {
  const buckets = buildBuckets(
    [
      request('r1', 's1', { direction: 'to' }),
      request('r2', 's2', { direction: 'from' }),
    ],
    []
  );
  eq(buckets.length, 2);
});

/* ===========================================================================
   STEP 3 — THE FOUR RULES
=========================================================================== */
test('rule 1 — seat capacity is never exceeded', () => {
  const people = [person('d1', { driverKind: 'parent', age: 44 }), person('s1'), person('s2'), person('s3')];
  const result = run(
    people,
    [request('r1', 's1'), request('r2', 's2'), request('r3', 's3')],
    [offer('o1', 'd1', 2)]
  );
  eq(result.cars[0].riderIds.length, 2, 'riders seated:');
  eq(result.unmatched.length, 1);
  eq(result.unmatched[0].reasonCode, REASON.SEATS_FULL);
});

test('rule 4 — a rider past the detour limit is left out, and told why', () => {
  const people = [person('d1', { driverKind: 'parent', age: 44 }), person('s1', { neighborhoodId: 'far' })];
  const result = run(people, [request('r1', 's1', { neighborhoodId: 'far' })], [offer('o1', 'd1', 4)]);
  eq(result.cars.length, 0);
  eq(result.unmatched[0].reasonCode, REASON.OUT_OF_RANGE);
  ok(result.unmatched[0].reason.includes('detour limit'), 'reason mentions the limit');
});

test('rule 4 — raising the detour setting seats the same rider', () => {
  const people = [person('d1', { driverKind: 'parent', age: 44 }), person('s1', { neighborhoodId: 'far' })];
  const result = run(
    people,
    [request('r1', 's1', { neighborhoodId: 'far' })],
    [offer('o1', 'd1', 4)],
    { maxDetourMiles: 10 }
  );
  eq(result.cars[0].riderIds, ['s1']);
});

test('rule 2 — a new teen driver gets one non-family passenger, no more', () => {
  const people = [
    person('d1', { driverKind: 'provisional_teen', provisionalUnder12Months: true, householdId: 'h-fam' }),
    person('s1'), person('s2'),
  ];
  const result = run(people, [request('r1', 's1'), request('r2', 's2')], [offer('o1', 'd1', 4)]);
  eq(result.cars[0].riderIds.length, 1, 'only one non-family passenger:');
  eq(result.unmatched[0].reasonCode, REASON.TEEN_PASSENGER_LIMIT);
});

test('rule 2 — family members do not count against that limit', () => {
  const people = [
    person('d1', { driverKind: 'provisional_teen', provisionalUnder12Months: true, householdId: 'h-fam' }),
    person('sib', { householdId: 'h-fam' }), // same household = family
    person('s2'),                            // a friend
  ];
  const result = run(people, [request('r1', 'sib'), request('r2', 's2')], [offer('o1', 'd1', 4)]);
  eq(result.cars[0].riderIds.length, 2, 'sibling plus one friend is legal:');
  eq(result.unmatched.length, 0);
});

test('rule 2 — an adult driver has no passenger limit', () => {
  const people = [
    person('d1', { driverKind: 'parent', age: 44 }),
    person('s1'), person('s2'), person('s3'),
  ];
  const result = run(
    people,
    [request('r1', 's1'), request('r2', 's2'), request('r3', 's3')],
    [offer('o1', 'd1', 4)]
  );
  eq(result.cars[0].riderIds.length, 3);
});

test('rule 3 — curfew covers the whole drive, not just the start time', () => {
  // 11:30 p.m. looks legal. The drive ends at 12:15 a.m., which is not.
  eq(crossesCurfew('2026-10-31T23:30'), true, '11:30 p.m. departure:');
  eq(crossesCurfew('2026-10-26T05:45'), false, '5:45 a.m. departure:');
  eq(crossesCurfew('2026-10-26T04:30'), true, '4:30 a.m. departure:');
  eq(crossesCurfew('2026-10-31T22:00'), false, '10:00 p.m. departure:');
});

test('rule 3 — a new teen driver is not given a trip that runs past midnight', () => {
  const people = [
    person('d1', { driverKind: 'provisional_teen', provisionalUnder12Months: true }),
    person('s1'),
  ];
  const result = run(
    people,
    [request('r1', 's1', { timeISO: '2026-10-31T23:30' })],
    [offer('o1', 'd1', 4, { timeISO: '2026-10-31T23:30' })]
  );
  eq(result.cars.length, 0, 'no car built:');
  eq(result.unmatched[0].reasonCode, REASON.CURFEW);
});

test('rule 3 — the same teen driver is fine for a 5:45 a.m. pickup', () => {
  const people = [
    person('d1', { driverKind: 'provisional_teen', provisionalUnder12Months: true }),
    person('s1'),
  ];
  const result = run(
    people,
    [request('r1', 's1', { timeISO: '2026-10-26T05:45', direction: 'to' })],
    [offer('o1', 'd1', 4, { timeISO: '2026-10-26T05:45', direction: 'to' })]
  );
  eq(result.cars[0].riderIds, ['s1']);
});

/* ===========================================================================
   ORDERING AND DETERMINISM
=========================================================================== */
test('unrestricted drivers are used before new teen drivers', () => {
  const people = [
    person('d-teen', { driverKind: 'provisional_teen', provisionalUnder12Months: true }),
    person('d-mom', { driverKind: 'parent', age: 44 }),
    person('s1'),
  ];
  const result = run(people, [request('r1', 's1')], [offer('o-teen', 'd-teen', 4), offer('o-mom', 'd-mom', 4)]);
  eq(result.cars.length, 1);
  eq(result.cars[0].driverId, 'd-mom', 'the parent drives:');
});

test('nearer riders are seated before farther ones', () => {
  const people = [
    person('d1', { driverKind: 'parent', age: 44 }),
    person('s-far', { neighborhoodId: 'near-b' }),
    person('s-near'),
  ];
  const result = run(
    people,
    [request('r1', 's-far', { neighborhoodId: 'near-b' }), request('r2', 's-near')],
    [offer('o1', 'd1', 1)]
  );
  eq(result.cars[0].riderIds, ['s-near']);
});

test('the same input always produces the same output', () => {
  const state = buildSeedState();
  const input = () => ({
    requests: state.requests, offers: state.offers, people: state.people,
    neighborhoods: state.neighborhoods, existingRides: state.rides, settings: state.settings,
  });
  const a = fillTheGaps(input());
  const b = fillTheGaps(input());
  eq(JSON.stringify(a.cars), JSON.stringify(b.cars), 'cars:');
  eq(JSON.stringify(a.unmatched), JSON.stringify(b.unmatched), 'unmatched:');
});

test('handoff codes are three digits and stable', () => {
  const code = handoffCode('ride-of-sat-p07');
  eq(code.length, 3);
  ok(Number(code) >= 100 && Number(code) <= 999, 'in range 100-999');
  eq(handoffCode('ride-of-sat-p07'), code, 'same id gives the same code:');
});

/* ===========================================================================
   STEP 4 — THE EXPLANATIONS
=========================================================================== */
test('a trip with no drivers says so plainly', () => {
  const result = run([person('s1')], [request('r1', 's1')], []);
  eq(result.unmatched[0].reasonCode, REASON.NO_DRIVER);
  eq(result.unmatched[0].reason, 'Nobody has offered seats for this trip yet.');
});

test('every unmatched student gets a sentence and a rule label', () => {
  const state = buildSeedState();
  const result = fillTheGaps({
    requests: state.requests, offers: state.offers, people: state.people,
    neighborhoods: state.neighborhoods, existingRides: state.rides, settings: state.settings,
  });
  ok(result.unmatched.length > 0, 'the demo has unmatched students');
  for (const miss of result.unmatched) {
    ok(miss.reason && miss.reason.length > 20, `reason for ${miss.studentId} is a sentence`);
    ok(miss.ruleLabel, `rule label for ${miss.studentId}`);
  }
});

/* ===========================================================================
   THE DEMO ITSELF — these guard the numbers I say out loud in the video.
=========================================================================== */
test('demo: Saturday contest seats 12 and leaves exactly 4', () => {
  const state = buildSeedState();
  const event = state.events.find((e) => e.id === 'e-band-sat');
  const onTrip = (record) =>
    record.destinationId === event.destinationId &&
    record.direction === event.direction &&
    Math.abs(toMinutes(record.timeISO) - toMinutes(event.rideTimeISO)) <= 15;

  const result = fillTheGaps({
    // Chaperone seats are held back for the organizer to assign by hand.
    requests: state.requests.filter(onTrip),
    offers: state.offers.filter((o) => !o.manualOnly && onTrip(o)),
    people: state.people,
    neighborhoods: state.neighborhoods,
    existingRides: state.rides,
    settings: state.settings,
  });

  eq(result.newAssignments.length, 12, 'students seated:');
  eq(result.unmatched.length, 4, 'students left over:');
  // Only adults drive at this school, so the two reasons left are the two
  // that do not depend on a driver's licence age.
  eq(
    result.unmatched.map((u) => u.reasonCode).sort(),
    [REASON.OUT_OF_RANGE, REASON.OUT_OF_RANGE, REASON.SEATS_FULL, REASON.SEATS_FULL]
  );
});

test('demo: the four left over fit the chaperone\'s car exactly', () => {
  const state = buildSeedState();
  const rivera = state.offers.find((o) => o.driverId === 'c-rivera');
  ok(rivera, 'the chaperone has an offer');
  ok(rivera.manualOnly, 'and it is held back from the automatic run');
  eq(rivera.seats, 4, 'seats in the chaperone car:');
});

test('demo: nobody under 21 drives', () => {
  const state = buildSeedState();
  const drivers = new Set(state.offers.map((o) => o.driverId));
  for (const id of drivers) {
    const person = state.people.find((p) => p.id === id);
    ok(person.age >= 21, `${person.firstName} ${person.lastInitial}. is an adult`);
    eq(person.driverKind, 'parent', `${person.firstName}'s driver kind:`);
  }
});

test('demo: Tuesday evening builds a car with three different activities', () => {
  const state = buildSeedState();
  const event = state.events.find((e) => e.id === 'e-vball-tue');
  const onTrip = (record) =>
    record.destinationId === event.destinationId &&
    record.direction === event.direction &&
    Math.abs(toMinutes(record.timeISO) - toMinutes(event.rideTimeISO)) <= 15;

  const result = fillTheGaps({
    requests: state.requests.filter(onTrip),
    offers: state.offers.filter(onTrip),
    people: state.people,
    neighborhoods: state.neighborhoods,
    existingRides: state.rides,
    settings: state.settings,
  });

  const byId = Object.fromEntries(state.requests.map((r) => [r.id, r]));
  const mixedCars = result.cars.filter(
    (car) => new Set(car.riderRequestIds.map((id) => byId[id].activityId)).size > 1
  );
  ok(mixedCars.length >= 1, 'at least one car carries more than one activity');

  const biggest = mixedCars.sort((a, b) => b.riderIds.length - a.riderIds.length)[0];
  eq(new Set(biggest.riderRequestIds.map((id) => byId[id].activityId)).size, 3, 'activities in one car:');
});

/* ---------------------------------------------------------------------------
   REPORT
--------------------------------------------------------------------------- */
const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);

export const summary = { passed, failed: failed.length, total: results.length, results };

// Terminal output when run with `node js/matching.test.js`.
if (typeof process !== 'undefined' && process.stdout && !globalThis.document) {
  for (const r of results) {
    console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.name}${r.ok ? '' : `\n          ${r.message}`}`);
  }
  console.log(`\n  ${passed} passed, ${failed.length} failed, ${results.length} total\n`);
  if (failed.length) process.exitCode = 1;
}
