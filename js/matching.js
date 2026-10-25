/* ===========================================================================
   AfterBell — matching.js
   The "Fill the Gaps" algorithm.
   ===========================================================================

   PLAIN-ENGLISH EXPLANATION (this is the version I say out loud in my video):

   AfterBell exists because of one specific failure: a student can't get a ride,
   so the whole group is short a person. A hole in the marching band drill. A
   team playing a man down. A cast rehearsing without its lead.

   The insight is that two students in completely different activities often
   need the exact same car. The volleyball player and the theater kid live four
   blocks apart and both finish at six. Nobody notices, because volleyball and
   theater never look at the same list.

   The algorithm runs in four steps.

   1. BUCKET — Every ride request goes into a group based on three things:
      the shared endpoint (where the car meets everyone), the direction (to the
      event, or home from it), and the time (requests within 15 minutes of each
      other count as the same trip).
      The activity is DELIBERATELY NOT part of that key. That is the entire
      idea of this app. Volleyball practice ending at 6:00 and theater
      rehearsal ending at 6:10 land in the same bucket, so those two students
      become candidates for the same car.

   2. CLUSTER — Inside a bucket, riders are grouped by neighborhood. Every
      neighborhood has ONE approximate center point, and I measure the
      straight-line distance between centers using the haversine formula, which
      is the great-circle distance between two points on a sphere. No maps API
      and, more importantly, no home addresses — a neighborhood name is as
      precise as this app ever gets about where a student lives.

   3. ASSIGN — For each driver in the bucket, I fill their open seats with the
      nearest unassigned riders, stopping for four rules:
        a. seat capacity — a car can't hold more people than it has seats;
        b. the Texas provisional-license passenger limit — a teen in their
           first 12 months may carry at most ONE passenger under 21 who isn't
           a family member (family members don't count toward the limit);
        c. the Texas provisional-license curfew — a driver in their first 12
           months can't be given a trip that runs between midnight and 5 a.m.;
        d. a maximum detour distance — default 3 miles between neighborhood
           centers, adjustable in settings.

   4. EXPLAIN — I return the assignments AND every student who still has no
      ride, each with a sentence a human can act on: "The only driver near
      Sandbrock Ranch is a new teen driver, and this trip gets back after
      midnight."

   WHY IT'S DETERMINISTIC: there is no randomness and no scoring function
   anywhere. Same input, same output, every single time. Every tie is broken by
   an explicit, boring rule, so I can always answer the question "why did it
   put Jake in that car?" The driver order is: unrestricted drivers first
   (parents and fully licensed teens), then by most open seats, then
   alphabetically by driver id. The rider order inside a car is: nearest
   neighborhood first, then alphabetically by student id.

   WHY UNRESTRICTED DRIVERS GO FIRST: a brand-new teen driver has exactly one
   legal seat for a non-family passenger. That seat is the scarcest resource in
   the whole system, so I spend the unrestricted seats first and save the
   restricted one for a student who has no other option.

   THIS FILE IS PURE JAVASCRIPT. It imports nothing — no Firebase, no DOM, no
   network — so it can be tested on its own. See js/matching.test.js.
=========================================================================== */


/* ---------------------------------------------------------------------------
   SETTINGS
   Every rule the algorithm enforces is a number in one place, so I can show a
   judge exactly what "the rules" are and change one without hunting.
--------------------------------------------------------------------------- */
export const DEFAULT_SETTINGS = {
  // Two trips are "the same trip" if their times are this close together.
  timeWindowMinutes: 15,

  // Max distance between a driver's neighborhood center and a rider's
  // neighborhood center. This is the "detour" cap from the spec.
  maxDetourMiles: 3,

  // How long we assume a trip takes door-to-door. Only used by the curfew
  // check, so that a trip leaving at 11:30 p.m. is correctly seen as running
  // past midnight.
  assumedTripMinutes: 45,

  // Texas provisional-license curfew window (midnight to 5 a.m.).
  curfewStartHour: 0,
  curfewEndHour: 5,

  // Texas provisional-license passenger rule.
  provisionalMaxNonFamilyPassengers: 1,
  passengerAgeLimit: 21, // "passengers under 21" are the ones that count
};


/* ---------------------------------------------------------------------------
   REASON CODES
   Each unmatched student gets one of these. The code is for the program; the
   sentence is for the human reading the screen.
--------------------------------------------------------------------------- */
export const REASON = {
  NO_DRIVER: 'NO_DRIVER',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  CURFEW: 'CURFEW',
  TEEN_PASSENGER_LIMIT: 'TEEN_PASSENGER_LIMIT',
  SEATS_FULL: 'SEATS_FULL',
};


/* ===========================================================================
   STEP 2's MATH: THE HAVERSINE FORMULA
   ===========================================================================
   Given two points on the Earth as (latitude, longitude) in degrees, this
   returns the great-circle distance between them in miles — the distance
   "as the crow flies", accounting for the curve of the planet.

   How it works, in words:
     - Convert the difference in latitude and longitude to radians.
     - `a` is a measure of the chord between the two points, built from the
       half-angle differences. The cos(lat1) * cos(lat2) term is what shrinks
       longitude differences as you move away from the equator (a degree of
       longitude is about 69 miles at the equator and about 58 miles here in
       North Texas).
     - `c` turns that back into an angle, and multiplying by the Earth's
       radius turns the angle into a distance.

   I use straight-line distance on purpose: it needs no API key, no network
   call, and no student's address. For deciding "are these two neighborhoods
   basically next to each other?", it is plenty accurate.
--------------------------------------------------------------------------- */
const EARTH_RADIUS_MILES = 3958.7613;

export function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  return EARTH_RADIUS_MILES * c;
}


/* ---------------------------------------------------------------------------
   TIME HANDLING

   Every time in AfterBell is stored as a plain local "wall clock" string:
   "2026-10-31T23:30". I parse it by slicing the string instead of handing it
   to `new Date()`, for one reason: time zones. A school schedule is wall-clock
   time. 6:15 a.m. band call is 6:15 a.m. no matter what the browser thinks its
   offset is. Slicing the digits means the algorithm gives the same answer on
   my laptop, on a judge's phone, and on a server.

   `toMinutes` converts a stamp into "minutes since year 2000", which gives me
   a single number I can subtract and compare.
--------------------------------------------------------------------------- */
export function parseStamp(iso) {
  return {
    year: Number(iso.slice(0, 4)),
    month: Number(iso.slice(5, 7)),
    day: Number(iso.slice(8, 10)),
    hour: Number(iso.slice(11, 13)),
    minute: Number(iso.slice(14, 16)),
  };
}

// Days from 2000-01-01 to the given date. Standard "days from civil" routine:
// it shifts the year so that March is the first month, which makes the leap-day
// arithmetic fall at the very end of the cycle instead of the middle.
function daysFromEpoch(year, month, day) {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;                                    // year of era
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 730120; // 730120 = days from 0000-03-01 to 2000-01-01
}

export function toMinutes(iso) {
  const t = parseStamp(iso);
  return daysFromEpoch(t.year, t.month, t.day) * 1440 + t.hour * 60 + t.minute;
}

/** Format "2026-10-31T23:30" as "11:30p" for the departure-board columns. */
export function formatTime(iso) {
  const { hour, minute } = parseStamp(iso);
  const suffix = hour < 12 ? 'a' : 'p';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, '0')}${suffix}`;
}

/**
 * Does a trip starting at `startIso` and lasting `tripMinutes` overlap the
 * curfew window (midnight to 5 a.m.) on any day it touches?
 *
 * This is why the check isn't just "is the hour between 0 and 5": the Saturday
 * contest bus gets back at 11:30 p.m., which looks fine, but the drive home
 * ends at 12:15 a.m., which is not. So I check the whole window, and I check
 * it on each calendar day the window touches.
 */
export function crossesCurfew(startIso, settings = DEFAULT_SETTINGS) {
  const start = toMinutes(startIso);
  const end = start + settings.assumedTripMinutes;

  const firstDay = Math.floor(start / 1440);
  const lastDay = Math.floor(end / 1440);

  for (let day = firstDay; day <= lastDay; day++) {
    const curfewStart = day * 1440 + settings.curfewStartHour * 60;
    const curfewEnd = day * 1440 + settings.curfewEndHour * 60;
    // Two ranges overlap when each one starts before the other one ends.
    if (start < curfewEnd && end > curfewStart) return true;
  }
  return false;
}


/* ---------------------------------------------------------------------------
   HANDOFF CODE
   A 3-digit number that the rider and the driver both see, so a student never
   gets into the wrong car. It's derived from the car's id, which means both
   sides compute the same number without storing anything extra, and the same
   car always shows the same code.

   This is a polynomial rolling hash: walk the characters, and each step
   multiply the running total by 31 and add the next character code. 31 is the
   conventional multiplier because it's an odd prime, so it scrambles the bits
   well while staying cheap to compute.
--------------------------------------------------------------------------- */
export function handoffCode(seed) {
  let h = 7;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) % 900; // 900 possible values: 100..999
  }
  return String(100 + h);
}


/* ===========================================================================
   STEP 1 — BUCKET
   ===========================================================================
   Group requests AND driver offers into trips. Two records belong to the same
   trip when they share a destination and a direction, and their times are
   within `timeWindowMinutes` of each other.

   Note that offers are bucketed together with requests. A parent who offers to
   leave at 6:05 should be matched with a student who asked for 5:55, so the
   driver has to go through the same windowing the riders do.

   The windowing is a simple deterministic sweep: sort by time, anchor on the
   earliest record, keep adding records while they're within the window of that
   anchor, then start a new bucket. No clustering library, nothing adaptive.
--------------------------------------------------------------------------- */
export function buildBuckets(requests, offers, settings = DEFAULT_SETTINGS) {
  // Key on destination + direction ONLY. Activity is intentionally absent.
  const groups = new Map();
  const add = (record, kind) => {
    const key = `${record.destinationId}|${record.direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ kind, record, minutes: toMinutes(record.timeISO) });
  };

  requests.forEach((r) => add(r, 'request'));
  offers.forEach((o) => add(o, 'offer'));

  const buckets = [];

  // Sort the keys so bucket order never depends on object insertion order.
  for (const key of [...groups.keys()].sort()) {
    const entries = groups.get(key).sort(
      (a, b) => a.minutes - b.minutes || a.record.id.localeCompare(b.record.id)
    );

    let current = null;
    for (const entry of entries) {
      const startsNewBucket =
        current === null || entry.minutes - current.anchorMinutes > settings.timeWindowMinutes;

      if (startsNewBucket) {
        const [destinationId, direction] = key.split('|');
        current = {
          id: `${destinationId}-${direction}-${entry.record.timeISO}`,
          destinationId,
          direction,
          anchorMinutes: entry.minutes,
          anchorISO: entry.record.timeISO,
          requests: [],
          offers: [],
        };
        buckets.push(current);
      }

      if (entry.kind === 'request') current.requests.push(entry.record);
      else current.offers.push(entry.record);
    }
  }

  return buckets;
}


/* ===========================================================================
   STEP 2 — CLUSTER
   ===========================================================================
   For one driver, list every unassigned rider in the bucket together with how
   far that rider's neighborhood center is from the driver's, nearest first.
   This is the "cluster by neighborhood" step: riders in the same neighborhood
   all come back with distance 0 and therefore stay together naturally.
--------------------------------------------------------------------------- */
function ridersByDistance(driverHood, riders, hoodsById) {
  return riders
    .map((request) => {
      const riderHood = hoodsById[request.neighborhoodId];
      return {
        request,
        miles: haversineMiles(driverHood, riderHood),
      };
    })
    .sort(
      (a, b) =>
        a.miles - b.miles ||
        // Tie-break alphabetically so two riders in the same neighborhood are
        // always picked in the same order. This is what makes the whole
        // algorithm reproducible.
        a.request.studentId.localeCompare(b.request.studentId)
    );
}


/* ===========================================================================
   STEP 3 + 4 — ASSIGN AND EXPLAIN
   ===========================================================================
   The one function the app actually calls.

   INPUT (plain objects — no classes, no Firebase documents):
     requests[]   { id, studentId, eventId, destinationId, direction,
                    timeISO, neighborhoodId, status }
     offers[]     { id, driverId, eventId, destinationId, direction,
                    timeISO, neighborhoodId, seats }
     people[]     { id, firstName, lastInitial, age, householdId,
                    neighborhoodId, driverKind, provisionalUnder12Months }
     neighborhoods[] { id, name, lat, lng }
     existingRides[] { offerId, riderIds[] }   // seats already committed
     settings     overrides for DEFAULT_SETTINGS

   OUTPUT:
     { cars, newAssignments, unmatched, buckets, stats }

   `cars` is one entry per driver who ended up with at least one NEW rider.
   `unmatched` is one entry per student still without a ride, each carrying a
   reason code and a sentence.
--------------------------------------------------------------------------- */
export function fillTheGaps(input) {
  const settings = { ...DEFAULT_SETTINGS, ...(input.settings || {}) };

  // --- Index the reference data once, so lookups below are simple. ---------
  const peopleById = Object.fromEntries(input.people.map((p) => [p.id, p]));
  const hoodsById = Object.fromEntries(input.neighborhoods.map((n) => [n.id, n]));
  const offersById = Object.fromEntries((input.offers || []).map((o) => [o.id, o]));

  // Only requests that are still waiting get matched. Anything already
  // assigned keeps the ride it has — Fill the Gaps never reshuffles a student
  // who was already promised a seat.
  const pending = (input.requests || []).filter((r) => r.status !== 'assigned');

  // --- Seats and passenger counts that are ALREADY used up ----------------
  // A car that has two riders in it only has (seats - 2) left. And if that car
  // belongs to a new teen driver, one of those riders may already have used up
  // the single non-family seat.
  const seatsTaken = {};
  const nonFamilyTaken = {};
  for (const ride of input.existingRides || []) {
    const offer = offersById[ride.offerId];
    if (!offer) continue;
    seatsTaken[offer.id] = (seatsTaken[offer.id] || 0) + ride.riderIds.length;

    const driver = peopleById[offer.driverId];
    nonFamilyTaken[offer.id] =
      (nonFamilyTaken[offer.id] || 0) +
      ride.riderIds.filter((id) => countsAgainstTeenLimit(driver, peopleById[id], settings)).length;
  }

  const buckets = buildBuckets(pending, input.offers || [], settings);

  const carsByOffer = new Map();   // offerId -> { ...car, riderIds: [] }
  const assignedRequestIds = new Set();
  const unmatched = [];

  for (const bucket of buckets) {
    // ---- Order the drivers. Deterministic, and explainable in one line. ---
    const drivers = bucket.offers
      .map((offer) => {
        const driver = peopleById[offer.driverId];
        const openSeats = offer.seats - (seatsTaken[offer.id] || 0);
        return {
          offer,
          driver,
          openSeats,
          restricted: isProvisional(driver),
          curfewBlocked: isProvisional(driver) && crossesCurfew(offer.timeISO, settings),
          nonFamilyAboard: nonFamilyTaken[offer.id] || 0,
        };
      })
      .sort(
        (a, b) =>
          // 1. Unrestricted drivers first — save the new teen's single legal
          //    passenger seat for someone with no other option.
          Number(a.restricted) - Number(b.restricted) ||
          // 2. Biggest car first — it can absorb more of the neighborhood.
          b.openSeats - a.openSeats ||
          // 3. Alphabetical, purely so ties never wobble between runs.
          a.offer.driverId.localeCompare(b.offer.driverId)
      );

    // ---- Fill each driver's open seats with the nearest riders -----------
    for (const d of drivers) {
      if (d.openSeats <= 0) continue;        // car is already full
      if (d.curfewBlocked) continue;         // RULE: Texas provisional curfew

      const driverHood = hoodsById[d.offer.neighborhoodId];

      const stillWaiting = bucket.requests.filter((r) => !assignedRequestIds.has(r.id));
      const candidates = ridersByDistance(driverHood, stillWaiting, hoodsById);

      for (const candidate of candidates) {
        if (d.openSeats <= 0) break;                           // RULE: capacity
        if (candidate.miles > settings.maxDetourMiles) break;  // RULE: detour
        // (`break`, not `continue`: the list is sorted by distance, so once one
        //  rider is too far away, every rider after them is too.)

        const rider = peopleById[candidate.request.studentId];

        // RULE: Texas provisional passenger limit.
        const counts = countsAgainstTeenLimit(d.driver, rider, settings);
        if (
          d.restricted &&
          counts &&
          d.nonFamilyAboard >= settings.provisionalMaxNonFamilyPassengers
        ) {
          continue; // this rider can't ride with THIS driver; try the next rider
        }

        // --- Seat the rider. ---
        if (!carsByOffer.has(d.offer.id)) {
          carsByOffer.set(d.offer.id, {
            offerId: d.offer.id,
            driverId: d.offer.driverId,
            destinationId: bucket.destinationId,
            direction: bucket.direction,
            timeISO: d.offer.timeISO,
            neighborhoodId: d.offer.neighborhoodId,
            riderIds: [],
            riderRequestIds: [],
          });
        }
        const car = carsByOffer.get(d.offer.id);
        car.riderIds.push(rider.id);
        car.riderRequestIds.push(candidate.request.id);

        assignedRequestIds.add(candidate.request.id);
        d.openSeats -= 1;
        seatsTaken[d.offer.id] = (seatsTaken[d.offer.id] || 0) + 1;
        if (counts) d.nonFamilyAboard += 1;
      }
    }

    // ---- STEP 4: explain everyone this bucket could not seat -------------
    for (const request of bucket.requests) {
      if (assignedRequestIds.has(request.id)) continue;
      unmatched.push(explainUnmatched({ request, bucket, drivers, peopleById, hoodsById, settings }));
    }
  }

  const cars = [...carsByOffer.values()].sort((a, b) => a.offerId.localeCompare(b.offerId));

  return {
    cars,
    // Flat list of the students who just got a seat, in the order they were
    // seated. The organizer dashboard animates the roster squares in exactly
    // this order, so the animation shows the algorithm's real decision order.
    newAssignments: cars.flatMap((car) =>
      car.riderIds.map((studentId, i) => ({
        studentId,
        requestId: car.riderRequestIds[i],
        offerId: car.offerId,
        driverId: car.driverId,
      }))
    ),
    unmatched,
    buckets,
    stats: {
      pendingConsidered: pending.length,
      matched: assignedRequestIds.size,
      unmatched: unmatched.length,
      buckets: buckets.length,
      carsUsed: cars.length,
    },
  };
}


/* ---------------------------------------------------------------------------
   RULE HELPERS
--------------------------------------------------------------------------- */

/** A "provisional" driver is a teen in their first 12 months of licensure. */
export function isProvisional(driver) {
  return Boolean(driver && driver.driverKind === 'provisional_teen' && driver.provisionalUnder12Months);
}

/**
 * Texas limits a provisional driver to ONE passenger under 21 who is not a
 * family member. So a rider counts against that limit only if they are (a)
 * under the age limit and (b) not in the driver's household.
 *
 * Household, not address: AfterBell stores a household id so it can tell
 * siblings apart from friends without ever knowing where anyone lives.
 */
export function countsAgainstTeenLimit(driver, rider, settings = DEFAULT_SETTINGS) {
  if (!driver || !rider) return false;
  const isFamily = Boolean(driver.householdId) && driver.householdId === rider.householdId;
  if (isFamily) return false;
  return rider.age < settings.passengerAgeLimit;
}


/* ---------------------------------------------------------------------------
   STEP 4's DETAIL — WHY A STUDENT HAS NO RIDE

   For the student we couldn't seat, look at every driver in their bucket and
   work out what stopped each one. Then report the single most useful reason,
   in this order:

     1. Nobody offered seats at all      -> NO_DRIVER
     2. No driver is within the detour   -> OUT_OF_RANGE  (name the distance)
     3. Every in-range driver is a new
        teen blocked by curfew           -> CURFEW
     4. A new teen is in range but has
        already used their one legal
        non-family seat                  -> TEEN_PASSENGER_LIMIT
     5. Otherwise the cars are simply
        out of seats                     -> SEATS_FULL

   The order matters: it goes from "nothing exists" to "something exists but a
   law blocks it" to "we just need one more seat", which is also the order in
   which an organizer can actually do something about it.
--------------------------------------------------------------------------- */
function explainUnmatched({ request, bucket, drivers, peopleById, hoodsById, settings }) {
  const student = peopleById[request.studentId];
  const hood = hoodsById[request.neighborhoodId];
  const base = {
    requestId: request.id,
    studentId: request.studentId,
    eventId: request.eventId,
    neighborhoodId: request.neighborhoodId,
  };

  if (drivers.length === 0) {
    return {
      ...base,
      reasonCode: REASON.NO_DRIVER,
      reason: 'Nobody has offered seats for this trip yet.',
      ruleLabel: 'No drivers available',
    };
  }

  // Measure every driver in the bucket against this one rider.
  const seen = drivers
    .map((d) => ({
      ...d,
      miles: haversineMiles(hoodsById[d.offer.neighborhoodId], hood),
    }))
    .sort((a, b) => a.miles - b.miles);

  const inRange = seen.filter((d) => d.miles <= settings.maxDetourMiles);

  if (inRange.length === 0) {
    const nearest = seen[0];
    const nearestHood = hoodsById[nearest.offer.neighborhoodId];
    return {
      ...base,
      reasonCode: REASON.OUT_OF_RANGE,
      reason:
        `The closest driver lives in ${nearestHood.name}, about ` +
        `${nearest.miles.toFixed(1)} miles from ${hood.name}. That is past the ` +
        `${settings.maxDetourMiles}-mile detour limit, so no car was offered.`,
      ruleLabel: `Detour limit ${settings.maxDetourMiles} mi`,
      detailMiles: Number(nearest.miles.toFixed(1)),
    };
  }

  if (inRange.every((d) => d.curfewBlocked)) {
    const who = inRange.length === 1 ? 'The only driver' : 'Every driver';
    return {
      ...base,
      reasonCode: REASON.CURFEW,
      reason:
        `${who} near ${hood.name} is a teen in their first year of driving, and ` +
        `this trip runs past midnight. Texas does not let a provisional driver ` +
        `drive between midnight and 5 a.m.`,
      ruleLabel: 'TX provisional curfew',
    };
  }

  const teenLimited = inRange.filter(
    (d) =>
      d.restricted &&
      !d.curfewBlocked &&
      d.nonFamilyAboard >= settings.provisionalMaxNonFamilyPassengers &&
      countsAgainstTeenLimit(d.driver, student, settings)
  );
  const everyoneElseIsFull = inRange.every((d) => d.openSeats <= 0 || teenLimited.includes(d));

  if (teenLimited.length > 0 && everyoneElseIsFull) {
    return {
      ...base,
      reasonCode: REASON.TEEN_PASSENGER_LIMIT,
      reason:
        `Only a new teen driver is available nearby; Texas law limits them to ` +
        `one non-family passenger, and that seat is taken.`,
      ruleLabel: 'TX provisional passenger limit',
    };
  }

  return {
    ...base,
    reasonCode: REASON.SEATS_FULL,
    reason:
      `Every car on this trip within ${settings.maxDetourMiles} miles of ` +
      `${hood.name} is full. One more open seat would cover ${student.firstName}.`,
    ruleLabel: 'Out of seats',
  };
}
