/* ===========================================================================
   AfterBell — state.js
   The one place that holds data and changes it.
   ===========================================================================
   In Stage 1 this wraps the local seed data. In Stage 2 the same functions
   will read and write Firestore instead, and no screen will have to change,
   because every screen already goes through this file.
=========================================================================== */

import { buildSeedState, DEMO_ACCOUNTS } from './seed.js';
import {
  fillTheGaps, handoffCode, toMinutes, crossesCurfew, countsAgainstTeenLimit,
  formatTime, parseStamp,
} from './matching.js';

/** Add minutes to a wall-clock stamp, staying in wall-clock time. */
function addMinutes(iso, minutes) {
  const t = parseStamp(iso);
  let total = t.hour * 60 + t.minute + minutes;
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${iso.slice(0, 11)}${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/* ---------------------------------------------------------------------------
   THE STATE OBJECT
--------------------------------------------------------------------------- */
export const state = {
  data: buildSeedState(),
  role: 'student',                  // which demo role tab is active
  userId: DEMO_ACCOUNTS.student.id, // who we are "signed in" as
  signedIn: true,
  // Set by the last Fill the Gaps run, so the organizer screen can animate
  // the squares and list the reasons. Cleared when you switch events.
  lastFill: null,

  // Everything that has actually happened this session: approvals, requests,
  // matches, pickups. The Rides tab reads this. It lives here rather than in
  // notifications.js so that module can import state without a cycle.
  log: [],
};

/**
 * Record something that just happened, for the people it happened to.
 * Called by the actions below — never with made-up content.
 */
export function logEvent(audience, icon, text) {
  state.log.push({
    id: `n${state.log.length + 1}`,
    audience: Array.isArray(audience) ? audience : [audience],
    icon,
    text,
    at: Date.now(),
    live: true,
  });
}

export { DEMO_ACCOUNTS, handoffCode };

/** Throw the demo data away and start over. Wired to "Reset demo". */
export function resetDemo() {
  state.data = buildSeedState();
  state.lastFill = null;
  state.log = [];
  state.signedIn = true;
}

export function setRole(role) {
  state.role = role;
  state.userId = DEMO_ACCOUNTS[role].id;
  state.lastFill = null;
}

/* ---------------------------------------------------------------------------
   LOOKUPS
--------------------------------------------------------------------------- */
export const personById = (id) => state.data.people.find((p) => p.id === id);
export const activityById = (id) => state.data.activities.find((a) => a.id === id);
export const eventById = (id) => state.data.events.find((e) => e.id === id);
export const placeById = (id) => state.data.places.find((p) => p.id === id);
export const hoodById = (id) => state.data.neighborhoods.find((n) => n.id === id);
export const offerById = (id) => state.data.offers.find((o) => o.id === id);
export const rideById = (id) => state.data.rides.find((r) => r.id === id);
export const currentUser = () => personById(state.userId);

export const hoodName = (id) => (hoodById(id) ? hoodById(id).name : 'Unknown');
export const activityName = (id) => (activityById(id) ? activityById(id).name : 'Unknown');

/** Every activity a student is on the roster of. */
export function activitiesForStudent(studentId) {
  return state.data.memberships
    .filter((m) => m.studentId === studentId)
    .map((m) => ({ ...m, activity: activityById(m.activityId) }));
}

/** The roster of one activity, sorted by group then first name. */
export function rosterFor(activityId) {
  const groupOrder = activityById(activityId).groups;
  return state.data.memberships
    .filter((m) => m.activityId === activityId)
    .map((m) => ({ ...m, person: personById(m.studentId) }))
    .sort(
      (a, b) =>
        groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group) ||
        a.person.firstName.localeCompare(b.person.firstName)
    );
}

/* ---------------------------------------------------------------------------
   RIDE STATUS
   The single source of truth for "does this student have a ride to this
   event?". Every screen asks this question, so it is answered in one place.
--------------------------------------------------------------------------- */
export function rideStatusFor(studentId, eventId) {
  // A car belongs to whichever activity's trip the DRIVER offered on, but a
  // rider can be there for a different activity entirely — that is the whole
  // point of the app. So a student's ride is found through their own request,
  // not through the car's event. Without this, a band student riding in a
  // volleyball parent's car would still show as having no ride on the band
  // director's screen.
  const ride = state.data.rides.find((r) => {
    const seat = r.riderIds.indexOf(studentId);
    if (seat === -1) return false;
    const request = state.data.requests.find((q) => q.id === r.requestIds[seat]);
    return request ? request.eventId === eventId : r.eventId === eventId;
  });
  if (ride) return { code: 'confirmed', ride };

  const request = state.data.requests.find(
    (r) => r.eventId === eventId && r.studentId === studentId
  );
  if (request && request.status === 'pending') return { code: 'waiting', request };
  if (request && request.status === 'unmatched') {
    return { code: 'none', request, reason: request.unmatchedReason, ruleLabel: request.unmatchedRule };
  }

  // On the roster but never asked for a ride: they have their own way there.
  const event = eventById(eventId);
  if (event && !event.needsRide.includes(studentId)) return { code: 'own' };

  return { code: 'none' };
}

/** Does this student count as covered for this event? */
export const hasRide = (code) => code === 'confirmed' || code === 'own';

/** Readiness numbers for the organizer dashboard. */
export function readinessFor(eventId) {
  const event = eventById(eventId);
  const roster = rosterFor(event.activityId);

  const rows = roster.map((member) => {
    const status = rideStatusFor(member.studentId, eventId);
    return { ...member, status };
  });

  const covered = rows.filter((r) => hasRide(r.status.code)).length;

  // Break the same numbers down by group (band section, team position, ...).
  const byGroup = activityById(event.activityId).groups
    .map((group) => {
      const members = rows.filter((r) => r.group === group);
      return {
        group,
        total: members.length,
        covered: members.filter((r) => hasRide(r.status.code)).length,
      };
    })
    .filter((g) => g.total > 0);

  return { event, rows, covered, total: rows.length, byGroup };
}

/** Events a student should see, nearest first. */
export function upcomingEventsFor(studentId) {
  const mine = new Set(activitiesForStudent(studentId).map((m) => m.activityId));
  return state.data.events
    .filter((e) => mine.has(e.activityId))
    .slice()
    .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO));
}

/** Who is in a car, with each rider's activity for that specific trip. */
export function ridersInRide(ride) {
  return ride.riderIds.map((studentId, i) => {
    const request = state.data.requests.find((r) => r.id === ride.requestIds[i]);
    return {
      person: personById(studentId),
      neighborhood: hoodName(personById(studentId).neighborhoodId),
      activityId: request ? request.activityId : null,
      activityLabel: request ? activityName(request.activityId) : '',
    };
  });
}

/** Every car on the same trip as this one (same endpoint, direction, time). */
export function ridesOnSameTrip(ride) {
  const offer = offerById(ride.offerId);
  return state.data.rides.filter((other) => {
    const o = offerById(other.offerId);
    return (
      o.destinationId === offer.destinationId &&
      o.direction === offer.direction &&
      o.timeISO === offer.timeISO
    );
  });
}

/** How many seats are left in an offer right now. */
export function openSeats(offerId) {
  const offer = offerById(offerId);
  const taken = state.data.rides
    .filter((r) => r.offerId === offerId)
    .reduce((sum, r) => sum + r.riderIds.length, 0);
  return offer.seats - taken;
}

/* ---------------------------------------------------------------------------
   ACTIONS — the only functions that change data.
--------------------------------------------------------------------------- */

/**
 * A student asks for a ride.
 * PARENT APPROVAL IS ENFORCED HERE: an unapproved student cannot create a
 * request at all, so they can never end up in a stranger's car.
 */
export function requestRide(studentId, eventId) {
  const student = personById(studentId);
  if (!student.approved) {
    return { ok: false, message: 'A parent has to approve this account before it can request rides.' };
  }
  const existing = state.data.requests.find(
    (r) => r.eventId === eventId && r.studentId === studentId
  );
  if (existing) {
    existing.status = 'pending';
    delete existing.unmatchedReason;
    delete existing.unmatchedRule;
    return { ok: true, message: 'Request is back in the queue.' };
  }

  const event = eventById(eventId);
  state.data.requests.push({
    id: `rq-${eventId}-${studentId}`,
    studentId,
    eventId,
    status: 'pending',
    activityId: event.activityId,
    direction: event.direction,
    destinationId: event.destinationId,
    timeISO: event.rideTimeISO,
    neighborhoodId: student.neighborhoodId,
  });
  if (!event.needsRide.includes(studentId)) event.needsRide.push(studentId);
  logEvent(studentId, 'hand', `Ride requested for ${event.title}.`);
  return { ok: true, message: 'Ride requested. You are in the next matching run.' };
}

export function cancelRequest(studentId, eventId) {
  state.data.requests = state.data.requests.filter(
    (r) => !(r.eventId === eventId && r.studentId === studentId)
  );
  return { ok: true, message: 'Request cancelled.' };
}

/** A parent or a teen driver offers seats on a trip. */
export function offerSeats(driverId, eventId, seats, note = '') {
  const driver = personById(driverId);
  const event = eventById(eventId);
  const id = `of-${eventId}-${driverId}`;

  const existing = offerById(id);
  if (existing) {
    existing.seats = seats;
    existing.note = note || existing.note;
    return { ok: true, message: `Updated to ${seats} seats.` };
  }

  state.data.offers.push({
    id, driverId, eventId, seats, note,
    direction: event.direction,
    destinationId: event.destinationId,
    timeISO: event.rideTimeISO,
    neighborhoodId: driver.neighborhoodId,
  });
  return { ok: true, message: `${seats} seats offered. They get used on the next matching run.` };
}

export function approveStudent(studentId) {
  const student = personById(studentId);
  student.approved = true;

  const parent = state.data.people.find((p) => (p.childIds || []).includes(studentId));
  logEvent(
    [studentId, parent ? parent.id : studentId],
    'user-round-check',
    `${student.firstName}'s account was approved by a parent.`
  );
  return { ok: true, message: `${student.firstName} can now request and accept rides.` };
}

export function markPickedUp(rideId, value = true) {
  const ride = rideById(rideId);
  ride.pickedUp = value;
  // Twelve minutes after the car was due: a plausible stamp that follows the
  // trip, so a late contest does not report a morning pickup.
  const offer = offerById(ride.offerId);
  ride.pickedUpAt = value ? formatTime(addMinutes(offer.timeISO, 12)) : null;

  if (value) {
    const names = ride.riderIds.map((id) => personById(id).firstName).join(', ');
    logEvent(
      [...ride.riderIds, ride.driverId],
      'check-check',
      `${names} picked up at ${ride.pickedUpAt}.`
    );
  }
  return { ok: true };
}

export function setMaxDetour(miles) {
  state.data.settings.maxDetourMiles = miles;
}

/* ---------------------------------------------------------------------------
   MANUAL ASSIGNMENT
   ---------------------------------------------------------------------------
   The algorithm says who it could not seat and why. Sometimes the answer is a
   grown-up: a chaperone, or a parent with a spare seat, who the director can
   simply ask. This is that — a real assignment that changes real state.

   It skips the DETOUR rule on purpose, because a human has decided the drive
   is worth it. It does not skip seat capacity, and it does not skip the Texas
   provisional-licence rules: those are law, not preference, so only adults
   appear in the list.
--------------------------------------------------------------------------- */

/** Adults who could be asked to drive this trip, with seats left. */
export function adultDriversFor(eventId) {
  const event = eventById(eventId);

  return state.data.people
    .filter((p) => p.driverKind === 'parent' && p.age >= 21)
    .map((person) => {
      const offerId = `of-${eventId}-${person.id}`;
      const existing =
        state.data.offers.find((o) => o.driverId === person.id && o.eventId === eventId) || null;
      const seats = existing ? existing.seats : person.chaperoneSeats || 0;
      const used = state.data.rides
        .filter((r) => r.offerId === (existing ? existing.id : offerId))
        .reduce((sum, r) => sum + r.riderIds.length, 0);
      return {
        person,
        offerId: existing ? existing.id : offerId,
        open: seats - used,
        car: [person.carColor, person.carModel].filter(Boolean).join(' '),
      };
    })
    .filter((entry) => entry.open > 0)
    .sort((a, b) => b.open - a.open || a.person.id.localeCompare(b.person.id));
}

/** Put one student in one adult's car, by hand. */
export function assignManually(studentId, eventId, driverId) {
  const d = state.data;
  const event = eventById(eventId);
  const driver = personById(driverId);
  const student = personById(studentId);

  const candidate = adultDriversFor(eventId).find((entry) => entry.person.id === driverId);
  if (!candidate) {
    return { ok: false, message: `${driver.firstName}'s car is full.` };
  }

  // Make the offer real if the adult had not formally offered yet.
  let offer = d.offers.find((o) => o.id === candidate.offerId);
  if (!offer) {
    offer = {
      id: candidate.offerId,
      driverId,
      eventId,
      seats: driver.chaperoneSeats || 1,
      note: 'Assigned by the organizer',
      direction: event.direction,
      destinationId: event.destinationId,
      timeISO: event.rideTimeISO,
      neighborhoodId: driver.neighborhoodId,
      manualOnly: true,
    };
    d.offers.push(offer);
  }

  let ride = d.rides.find((r) => r.offerId === offer.id);
  if (!ride) {
    ride = {
      id: `ride-${offer.id}`,
      offerId: offer.id,
      driverId,
      eventId,
      riderIds: [],
      requestIds: [],
      pickedUp: false,
      matchedBy: 'organizer',
    };
    d.rides.push(ride);
  }

  const requestId = `rq-${eventId}-${studentId}`;
  let request = d.requests.find((r) => r.id === requestId);
  if (!request) {
    request = {
      id: requestId,
      studentId,
      eventId,
      status: 'pending',
      activityId: event.activityId,
      direction: event.direction,
      destinationId: event.destinationId,
      timeISO: event.rideTimeISO,
      neighborhoodId: student.neighborhoodId,
    };
    d.requests.push(request);
  }

  ride.riderIds.push(studentId);
  ride.requestIds.push(request.id);
  request.status = 'assigned';
  delete request.unmatchedReason;
  delete request.unmatchedRule;

  logEvent(
    studentId,
    'car-front',
    `${driver.firstName} ${driver.lastInitial}. is driving you to ${event.title}.`
  );

  return {
    ok: true,
    message: `${student.firstName} is riding with ${driver.firstName} ${driver.lastInitial}.`,
  };
}

/* ---------------------------------------------------------------------------
   ACCOUNT
--------------------------------------------------------------------------- */

/**
 * Change which neighbourhood someone lives in.
 * Their open ride requests move with them, because the matcher reads the
 * neighbourhood off the request, and a stale one would put them in a car
 * going the wrong way.
 */
export function updateNeighborhood(personId, neighborhoodId) {
  const person = personById(personId);
  person.neighborhoodId = neighborhoodId;

  for (const request of state.data.requests) {
    if (request.studentId === personId && request.status !== 'assigned') {
      request.neighborhoodId = neighborhoodId;
    }
  }
  for (const offer of state.data.offers) {
    if (offer.driverId === personId) offer.neighborhoodId = neighborhoodId;
  }
  return { ok: true, message: `Neighborhood updated to ${hoodName(neighborhoodId)}.` };
}

/**
 * Delete someone's account and everything attached to it.
 *
 * This really does remove the data rather than hide it: their ride requests,
 * their seat offers, the cars built from those offers, their seat in anyone
 * else's car, and their notifications. In Stage 1 everything lives in memory,
 * so "delete" means delete; "Reset demo data" is what brings the sample
 * person back.
 */
export function deleteAccount(personId) {
  const d = state.data;
  const person = personById(personId);

  d.requests = d.requests.filter((r) => r.studentId !== personId);

  // Their seat in someone else's car.
  for (const ride of d.rides) {
    const index = ride.riderIds.indexOf(personId);
    if (index !== -1) {
      ride.riderIds.splice(index, 1);
      ride.requestIds.splice(index, 1);
    }
  }

  // Cars they were driving, and the offers behind them.
  const theirOffers = d.offers.filter((o) => o.driverId === personId).map((o) => o.id);
  d.rides = d.rides.filter((ride) => !theirOffers.includes(ride.offerId) && ride.riderIds.length);
  d.offers = d.offers.filter((o) => o.driverId !== personId);

  // Roster memberships and any event expecting them.
  d.memberships = d.memberships.filter((m) => m.studentId !== personId);
  for (const event of d.events) {
    event.needsRide = event.needsRide.filter((id) => id !== personId);
  }

  d.people = d.people.filter((p) => p.id !== personId);
  for (const parent of d.people) {
    if (parent.childIds) parent.childIds = parent.childIds.filter((id) => id !== personId);
  }

  state.log = state.log.filter((entry) => !entry.audience.includes(personId));
  state.signedIn = false;
  state.lastFill = null;

  return { ok: true, message: `${person ? person.firstName : 'That account'} and all of its data were deleted.` };
}

/* ---------------------------------------------------------------------------
   RUN THE ALGORITHM AND SAVE WHAT IT DECIDED
   ---------------------------------------------------------------------------
   SCOPE: Fill the Gaps runs on one TRIP, not on one activity and not on the
   whole week. A trip is "same endpoint, same direction, times within the
   matching window" — the bucket key from step 1 of the algorithm.

   That distinction is the entire product. When Mr. Moreno presses Fill the
   Gaps on the band contest, the run is scoped to the 11:30 p.m. pickup at
   Braswell, so it won't quietly reshuffle Thursday's volleyball game. But
   because the scope is the TRIP and not the ACTIVITY, pressing it on
   Tuesday's volleyball practice also pulls in the theater kids and the cross
   country kids who finish within 15 minutes — and puts them in the same cars.
--------------------------------------------------------------------------- */

/** Is this request or offer part of the same trip as `event`? */
function onSameTripAs(event, record, windowMinutes) {
  return (
    record.destinationId === event.destinationId &&
    record.direction === event.direction &&
    Math.abs(toMinutes(record.timeISO) - toMinutes(event.rideTimeISO)) <= windowMinutes
  );
}

export function runFillTheGaps(eventId) {
  const d = state.data;
  const event = eventById(eventId);
  const windowMinutes = d.settings.timeWindowMinutes;

  // Parent approval is a hard gate: an unapproved student is not matched.
  const eligible = d.requests.filter(
    (r) => personById(r.studentId).approved && onSameTripAs(event, r, windowMinutes)
  );
  const offersOnTrip = d.offers.filter(
    (o) => !o.manualOnly && onSameTripAs(event, o, windowMinutes)
  );

  const result = fillTheGaps({
    requests: eligible,
    offers: offersOnTrip,
    people: d.people,
    neighborhoods: d.neighborhoods,
    existingRides: d.rides,
    settings: d.settings,
  });

  // --- Write the cars into state -----------------------------------------
  for (const car of result.cars) {
    let ride = d.rides.find((r) => r.offerId === car.offerId);
    if (!ride) {
      ride = {
        id: `ride-${car.offerId}`,
        offerId: car.offerId,
        driverId: car.driverId,
        eventId: offerById(car.offerId).eventId,
        riderIds: [],
        requestIds: [],
        pickedUp: false,
        matchedBy: 'fill-the-gaps',
      };
      d.rides.push(ride);
    }
    ride.riderIds.push(...car.riderIds);
    ride.requestIds.push(...car.riderRequestIds);
    ride.matchedBy = 'fill-the-gaps';
  }

  // --- Mark the requests --------------------------------------------------
  const matchedRequestIds = new Set(result.newAssignments.map((a) => a.requestId));
  for (const request of d.requests) {
    if (matchedRequestIds.has(request.id)) request.status = 'assigned';
  }
  for (const miss of result.unmatched) {
    const request = d.requests.find((r) => r.id === miss.requestId);
    if (request) {
      request.status = 'unmatched';
      request.unmatchedReason = miss.reason;
      request.unmatchedRule = miss.ruleLabel;
    }
  }

  // --- Build the report the organizer screen shows ------------------------
  const requestById = Object.fromEntries(d.requests.map((r) => [r.id, r]));
  const forThisEvent = result.newAssignments.filter(
    (a) => requestById[a.requestId] && requestById[a.requestId].eventId === eventId
  );
  // Riders the algorithm put in these same cars who are NOT on this
  // organizer's roster. This number is the cross-activity payoff, stated
  // plainly on the dashboard.
  const crossActivity = result.newAssignments.filter(
    (a) => requestById[a.requestId] && requestById[a.requestId].activityId !== event.activityId
  );

  // One log entry per student the algorithm just seated.
  for (const assignment of forThisEvent) {
    const driver = personById(assignment.driverId);
    logEvent(
      assignment.studentId,
      'car-front',
      `Matched for ${event.title} — riding with ${driver.firstName} ${driver.lastInitial}.`
    );
  }

  state.lastFill = {
    eventId,
    // Order matters: the squares animate in exactly the order the algorithm
    // seated people, so the animation is the algorithm's real decision order.
    matchedStudentIds: forThisEvent.map((a) => a.studentId),
    unmatched: result.unmatched.filter((u) => u.eventId === eventId),
    crossActivityCount: crossActivity.length,
    crossActivityNames: [
      ...new Set(crossActivity.map((a) => activityName(requestById[a.requestId].activityId))),
    ],
    stats: result.stats,
  };

  return state.lastFill;
}

/* ---------------------------------------------------------------------------
   PREVIEW — run the algorithm WITHOUT saving anything.
   Used by the cross-activity screen so it always has something real to show,
   and by anything that wants to answer "what would happen if?".
--------------------------------------------------------------------------- */
export function previewTrip(eventId) {
  const d = state.data;
  const event = eventById(eventId);
  const w = d.settings.timeWindowMinutes;

  return fillTheGaps({
    requests: d.requests.filter((r) => personById(r.studentId).approved && onSameTripAs(event, r, w)),
    offers: d.offers.filter((o) => !o.manualOnly && onSameTripAs(event, o, w)),
    people: d.people,
    neighborhoods: d.neighborhoods,
    existingRides: d.rides,
    settings: d.settings,
  });
}

/** The activity each rider is riding for, on a specific trip. */
export function activityOfRequest(studentId, eventIdHint) {
  const request = state.data.requests.find(
    (r) => r.studentId === studentId && r.eventId === eventIdHint
  );
  return request ? activityName(request.activityId) : '';
}

/**
 * For a provisional teen driver: how many of their open seats they can
 * legally use on this trip. The Texas rule caps non-family passengers under
 * 21 at one, so a driver with three open seats may only be able to fill one
 * of them. The driver screen says this out loud instead of letting them
 * wonder why nobody got assigned.
 */
export function legalSeatsFor(offerId) {
  const offer = offerById(offerId);
  const driver = personById(offer.driverId);
  const open = openSeats(offerId);

  if (!(driver.driverKind === 'provisional_teen' && driver.provisionalUnder12Months)) {
    return { open, usable: open, limited: false, curfew: false };
  }

  const curfew = crossesCurfew(offer.timeISO);
  if (curfew) return { open, usable: 0, limited: true, curfew: true };

  const aboard = state.data.rides
    .filter((r) => r.offerId === offerId)
    .flatMap((r) => r.riderIds)
    .filter((id) => countsAgainstTeenLimit(driver, personById(id))).length;

  const remainingNonFamily = Math.max(0, 1 - aboard);
  return { open, usable: Math.min(open, remainingNonFamily), limited: true, curfew: false, aboard };
}
