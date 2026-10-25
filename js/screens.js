/* ===========================================================================
   AfterBell — screens.js
   One function per screen. Each returns a plain HTML string.
   ===========================================================================
   Why strings instead of a framework: a judge can read a function top to
   bottom and see exactly what ends up on the page. Interactivity is handled by
   `data-action` attributes that app.js listens for.
=========================================================================== */

import * as S from './state.js';
import {
  esc, icon, dayLabel, formatTime, personName, statusChip, activityChip,
  meter, spotClass, block, notice, empty, STATUS_TEXT,
} from './ui.js';
import { haversineMiles, toMinutes } from './matching.js';
import { view, groupShortCode } from './view.js';

/**
 * Screens are reachable by URL, so each one checks that the active demo role
 * actually makes sense for it. Without this, typing #/organizer while signed
 * in as a student would crash instead of explaining itself.
 */
function wrongRole(needed) {
  return `<div class="pagehead">
      <h1>Switch roles to see this</h1>
      <p class="pagehead__sub">This screen belongs to the
      <strong>${esc(needed)}</strong> view. Use the role switcher at the top right.</p>
    </div>
    ${notice('You are signed in as ' + S.DEMO_ACCOUNTS[S.state.role].label, S.DEMO_ACCOUNTS[S.state.role].caption, 'info')}`;
}

/* ---------------------------------------------------------------------------
   SHARED PIECES
--------------------------------------------------------------------------- */

/**
 * The row used on every list of events.
 *
 * LAYOUT NOTE: this used to be a four-column grid (time / activity / trip /
 * status) from when the app filled the whole page. Now the app is always a
 * phone-width column, so those fixed columns no longer fit: the trip column
 * kept its 190px while the activity name — the longest and most important
 * text in the row — got squeezed into 72px. It is a single stack now, so the
 * activity name always gets the full width, and the trip and the status
 * share the last line.
 */
function eventRow(event, statusHtml, href, isCurrent = false) {
  const activity = S.activityById(event.activityId);
  const place = S.placeById(event.destinationId);
  const arrow = event.direction === 'to' ? 'To' : 'Home from';

  return `<button class="board__row" data-action="go" data-href="${esc(href)}"
      ${isCurrent ? 'aria-current="true"' : ''}>
    <span class="row__when">
      <span class="row__day">${esc(dayLabel(event.rideTimeISO))}</span>
      <span class="row__time">${esc(formatTime(event.rideTimeISO))}</span>
    </span>
    <span class="row__title">${esc(activity.name)} — ${esc(event.title)}</span>
    <span class="row__meta">${esc(event.detail)}</span>
    <span class="row__foot">
      <span class="row__trip">${esc(arrow)} ${esc(place.short)}</span>
      ${statusHtml}
    </span>
  </button>`;
}

/** The three-state legend. Shown wherever squares or chips appear. */
function legend() {
  return `<div class="legend">
    ${statusChip('confirmed')}${statusChip('waiting')}${statusChip('none')}
  </div>`;
}

/** A car, with every rider labeled by the activity they are riding for. */
function carCard(ride, { showCode = true, highlightMixed = true } = {}) {
  const driver = S.personById(ride.driverId);
  const offer = S.offerById(ride.offerId);
  const place = S.placeById(offer.destinationId);
  const riders = S.ridersInRide(ride);
  const activities = [...new Set(riders.map((r) => r.activityLabel))].filter(Boolean);
  const mixed = activities.length > 1;

  return `<div class="ridecard">
    <div class="ridecard__top">
      <span><span class="k">Driver</span> ${esc(personName(driver))}${
        driver.driverKind === 'parent' ? ' (parent)' : ''
      }</span>
      <span><span class="k">Pickup</span> ${esc(formatTime(offer.timeISO))}, ${esc(place.short)}</span>
    </div>
    <div class="ridecard__body stack">
      ${
        mixed && highlightMixed
          ? `<p class="mono" style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0">
               One car, ${activities.length} activities
             </p>`
          : ''
      }
      <ul class="riders">
        ${riders
          .map(
            (r) => `<li>
          <span class="rider__name">${esc(personName(r.person))}</span>
          ${r.activityLabel ? activityChip(r.activityLabel) : ''}
          <span class="rider__hood">${esc(r.neighborhood)}</span>
        </li>`
          )
          .join('')}
      </ul>
      ${
        showCode
          ? `<div class="handoff">
               <div>
                 <div class="pagehead__eyebrow" style="margin-bottom:4px">Handoff code</div>
                 <div class="handoff__code">${esc(S.handoffCode(ride.id))}</div>
               </div>
               <p class="handoff__help">Both the driver and every rider see this
               number. If it doesn't match, it isn't your car.</p>
             </div>`
          : ''
      }
    </div>
  </div>`;
}

/* ===========================================================================
   SCREEN 1 — WELCOME / SIGN IN
   Deliberately a form and nothing else. No hero, no feature grid.
=========================================================================== */
export function signIn() {
  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Ray Braswell HS · Denton ISD</div>
      <h1>Sign in to AfterBell</h1>
      <p class="pagehead__sub">Rides to practices, rehearsals, games and contests,
      organized by where you live and when your activity starts or ends.</p>
    </div>

    <form class="signin card" data-action="noop">
      <div class="field">
        <label for="si-email">School email</label>
        <input id="si-email" type="email" autocomplete="username" placeholder="you@students.dentonisd.org" />
      </div>
      <div class="field">
        <label for="si-pass">Password</label>
        <input id="si-pass" type="password" autocomplete="current-password" />
      </div>
      <button class="btn btn--primary btn--block" type="button" data-action="demo-signin">
        Sign in
      </button>

      <hr class="signin__rule" />

      <div class="field">
        <label for="si-code">Joining an activity? Enter the code your director gave you
          <span class="field__hint">For example, the band's code is BAND-4821.</span>
        </label>
        <input id="si-code" type="text" placeholder="BAND-4821" />
      </div>

      ${notice(
        'Stage 1 has no accounts yet',
        'Sign-in and parent approval get wired to Firebase Authentication in Stage 2. For now, use the role switcher at the top to look around.',
        'info'
      )}
    </form>`;
}

/* ===========================================================================
   SCREEN 2 — STUDENT HOME
=========================================================================== */
export function studentHome() {
  const me = S.currentUser();
  if (me.role !== 'student') return wrongRole('student');

  const mine = S.activitiesForStudent(me.id);
  const events = S.upcomingEventsFor(me.id);

  const rows = events
    .map((event) => {
      const status = S.rideStatusFor(me.id, event.id);
      return eventRow(event, statusChip(status.code), `#/event/${event.id}`);
    })
    .join('');

  const needsAttention = events.filter((e) => {
    const c = S.rideStatusFor(me.id, e.id).code;
    return c === 'none';
  });

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Student</div>
      <h1>${esc(personName(me))}</h1>
      <p class="pagehead__sub">
        Grade ${esc(me.grade)} ·
        ${esc(mine.map((m) => `${m.activity.name} (${m.group})`).join(' · '))} ·
        ${esc(S.hoodName(me.neighborhoodId))}
      </p>
    </div>

    ${
      !me.approved
        ? notice(
            'Waiting on a parent',
            'Your account has to be approved by a parent before you can request or accept a ride.'
          )
        : ''
    }

    ${
      needsAttention.length
        ? notice(
            `${needsAttention.length === 1 ? 'One event still needs' : `${needsAttention.length} events still need`} a ride`,
            needsAttention
              .map((e) => `${S.activityById(e.activityId).name}, ${dayLabel(e.rideTimeISO)}`)
              .join('; ') + '.'
          )
        : ''
    }

    ${block(
      'Your week',
      `<div class="board">${rows}</div>
       <div style="margin-top:10px">${legend()}</div>`,
      `${events.length} events`
    )}`;
}

/* ===========================================================================
   SCREEN 3 — EVENT DETAIL
=========================================================================== */
export function eventDetail(eventId) {
  const event = S.eventById(eventId);
  if (!event) return empty('<strong>That event does not exist.</strong>');

  const me = S.currentUser();
  const activity = S.activityById(event.activityId);
  const place = S.placeById(event.destinationId);
  const status = me.role === 'student' ? S.rideStatusFor(me.id, event.id) : null;
  const arrow = event.direction === 'to' ? 'Ride to' : 'Ride home from';

  // --- What this person can do on this screen ---------------------------
  let actions = '';
  if (me.role === 'student') {
    if (!me.approved) {
      actions = notice(
        'A parent has to approve your account first',
        'Until then AfterBell will not put you in a car, and will not let you offer or accept one.'
      );
    } else if (status.code === 'waiting') {
      actions = `<div class="stack">
        <p>You asked for a ride. You are in the next matching run.</p>
        <div class="btnrow">
          <button class="btn btn--quiet" data-action="cancel-request" data-event="${esc(event.id)}">
            ${icon('x')} Cancel request
          </button>
        </div>
      </div>`;
    } else if (status.code === 'confirmed') {
      actions = `<div class="stack">
        ${carCard(status.ride)}
        <div class="btnrow">
          <a class="btn btn--quiet" href="#/ride/${esc(status.ride.id)}">${icon('id-card')} Open ride card</a>
        </div>
      </div>`;
    } else {
      actions = `<div class="stack">
        ${
          status.reason
            ? notice('Fill the Gaps could not seat you', status.reason)
            : `<p>You have not asked for a ride to this one yet.</p>`
        }
        <div class="btnrow">
          <button class="btn btn--primary" data-action="request-ride" data-event="${esc(event.id)}">
            ${icon('hand')} Request a ride
          </button>
        </div>
      </div>`;
    }
  } else if (me.role === 'parent' || me.driverKind) {
    actions = offerSeatsForm(me, event);
  } else {
    actions = `<p class="muted">Organizers manage this event from the readiness dashboard.</p>
      <div class="btnrow"><a class="btn btn--quiet" href="#/organizer/${esc(event.id)}">
        ${icon('layout-grid')} Open readiness</a></div>`;
  }

  // --- Cars already running on this trip --------------------------------
  const tripRides = S.state.data.rides.filter((ride) => {
    const offer = S.offerById(ride.offerId);
    return (
      offer.destinationId === event.destinationId &&
      offer.direction === event.direction &&
      Math.abs(toMinutes(offer.timeISO) - toMinutes(event.rideTimeISO)) <=
        S.state.data.settings.timeWindowMinutes
    );
  });

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">
        <a href="#/${me.role === 'student' ? 'student' : me.role}">${esc(activity.name)}</a> ·
        ${esc(dayLabel(event.rideTimeISO))}
      </div>
      <h1>${esc(event.title)}</h1>
      <p class="pagehead__sub">${esc(event.detail)}</p>
    </div>

    ${block(
      'The trip',
      `<div class="card">
        <dl class="dl">
          <dt>Event</dt><dd>${esc(activity.name)} — ${esc(event.title)}</dd>
          <dt>Where</dt><dd>${esc(event.where)}</dd>
          <dt>${esc(arrow)}</dt><dd>${esc(place.name)}</dd>
          <dt>Car meets</dt><dd class="mono">${esc(formatTime(event.rideTimeISO))}, ${esc(dayLabel(event.rideTimeISO))}</dd>
          <dt>Needs a ride</dt><dd>${event.needsRide.length} of ${S.rosterFor(event.activityId).length} on the roster</dd>
        </dl>
      </div>`
    )}

    ${block(me.role === 'student' ? 'Your ride' : 'Offer seats', actions)}

    ${block(
      'Cars on this trip',
      tripRides.length
        ? `<div class="stack">${tripRides.map((r) => carCard(r, { showCode: false })).join('')}</div>`
        : empty(
            `<strong>No cars yet.</strong> Nobody has been matched for this trip.
             An organizer presses <em>Fill the Gaps</em> to build them.`
          ),
      `${tripRides.length} car${tripRides.length === 1 ? '' : 's'}`
    )}`;
}

/** The driver-side form. Shown to parents and to teen drivers. */
function offerSeatsForm(driver, event) {
  const id = `of-${event.id}-${driver.id}`;
  const existing = S.offerById(id);
  const seatInfo = existing ? S.legalSeatsFor(id) : null;

  return `<div class="card stack">
    <div class="field">
      <label for="seats-${esc(event.id)}">Open seats
        <span class="field__hint">Not counting yourself.</span>
      </label>
      <input id="seats-${esc(event.id)}" type="number" min="1" max="7"
             value="${existing ? esc(existing.seats) : 2}" />
    </div>
    <div class="btnrow">
      <button class="btn btn--primary" data-action="offer-seats" data-event="${esc(event.id)}">
        ${icon('car-front')} ${existing ? 'Update seats' : 'Offer seats'}
      </button>
    </div>
    ${
      seatInfo && seatInfo.curfew
        ? notice(
            'These seats cannot be used on this trip',
            'This trip runs between midnight and 5 a.m. A driver in their first 12 months is not allowed to drive then, so AfterBell will not assign anyone to you.'
          )
        : ''
    }
    ${
      seatInfo && seatInfo.limited && !seatInfo.curfew
        ? notice(
            `${seatInfo.usable} of your ${seatInfo.open} open seats can be filled`,
            'Texas limits a driver in their first 12 months to one passenger under 21 who is not a family member. Brothers and sisters do not count against that.'
          )
        : ''
    }
  </div>`;
}

/* ===========================================================================
   SCREEN 4 — RIDE CARD
=========================================================================== */
export function rideCard(rideId) {
  const ride = S.rideById(rideId);
  if (!ride) return empty('<strong>That ride no longer exists.</strong>');

  const offer = S.offerById(ride.offerId);
  const event = S.eventById(ride.eventId);
  const driver = S.personById(ride.driverId);
  const place = S.placeById(offer.destinationId);
  const code = S.handoffCode(ride.id);

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Ride card · ${esc(dayLabel(offer.timeISO))}</div>
      <h1>${esc(formatTime(offer.timeISO))} ${event.direction === 'to' ? 'to' : 'from'} ${esc(place.short)}</h1>
      <p class="pagehead__sub">${esc(S.activityName(event.activityId))} — ${esc(event.title)}</p>
    </div>

    ${block(
      'Show this to your driver',
      `<div class="card stack">
        <div class="handoff">
          <div>
            <div class="pagehead__eyebrow" style="margin-bottom:4px">Handoff code</div>
            <div class="handoff__code">${esc(code)}</div>
          </div>
          <p class="handoff__help">
            Say the code out loud before you get in. ${esc(personName(driver))} has the
            same three digits on their screen. If the numbers don't match, it is not your car.
          </p>
        </div>
        <dl class="dl">
          <dt>Driver</dt><dd>${esc(personName(driver))}${
            driver.driverKind === 'parent' ? ' (parent)' : ' (student driver)'
          }</dd>
          <dt>Pickup</dt><dd class="mono">${esc(formatTime(offer.timeISO))}, ${esc(dayLabel(offer.timeISO))}</dd>
          <dt>Place</dt><dd>${esc(place.name)}</dd>
          <dt>Matched by</dt><dd>${ride.matchedBy === 'fill-the-gaps' ? 'Fill the Gaps' : 'Set up before the trip'}</dd>
          <dt>Status</dt><dd>${
            ride.pickedUp ? `Picked up ${esc(ride.pickedUpAt || '')}` : 'Not picked up yet'
          }</dd>
        </dl>
      </div>`
    )}

    ${block("Who's in the car", carCard(ride, { showCode: false }))}`;
}

/** A student's confirmed rides, newest trip first. */
export function myRides() {
  const me = S.currentUser();
  if (me.role !== 'student' && me.role !== 'parent') return wrongRole('student');

  const rides = S.state.data.rides
    .filter((r) => r.riderIds.includes(me.id))
    .sort((a, b) => S.offerById(a.offerId).timeISO.localeCompare(S.offerById(b.offerId).timeISO));

  if (!rides.length) {
    return `<div class="pagehead"><h1>Your ride cards</h1></div>
      ${empty(`<strong>No confirmed rides yet.</strong> Request a ride from an event
       on your <a href="#/student">week</a>, then an organizer runs the match.`)}`;
  }

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Student</div>
      <h1>Your ride cards</h1>
      <p class="pagehead__sub">Each card has its own handoff code.</p>
    </div>
    ${rides
      .map((ride) => {
        const event = S.eventById(ride.eventId);
        return block(
          `${dayLabel(S.offerById(ride.offerId).timeISO)} · ${S.activityName(event.activityId)}`,
          `<div class="stack">
            ${carCard(ride)}
            <div class="btnrow">
              <a class="btn btn--quiet btn--sm" href="#/ride/${esc(ride.id)}">Open full card</a>
            </div>
          </div>`
        );
      })
      .join('')}`;
}

/* ===========================================================================
   SCREEN 5 — PARENT VIEW
=========================================================================== */

/**
 * A parent offering seats on one of their students' trips.
 *
 * This is a real control wired to the real `offerSeats` action — the same one
 * the event screen uses — so tour mode can drive it without a stand-in. It
 * targets the soonest trip of theirs the parent has not already offered on.
 */
function parentOfferCard(parent) {
  const eventIds = [
    ...new Set((parent.childIds || []).flatMap((id) => S.upcomingEventsFor(id).map((e) => e.id))),
  ];
  const trips = eventIds
    .map((id) => S.eventById(id))
    .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO));

  // The soonest trip, always. Picking "the first one without an offer" would
  // make the card jump to a different trip the instant you offered seats.
  const target = trips[0];
  if (!target) return '';

  const offer = S.offerById(`of-${target.id}-${parent.id}`);
  const seats = offer ? offer.seats : 0;
  const on = seats > 0;

  return block(
    'Offer seats',
    `<div class="ab-card">
      <div class="ab-togglerow ab-togglerow--light">
        <span class="ab-togglerow__text">
          <strong>${esc(S.activityName(target.activityId))} — ${esc(target.title)}</strong>
          <span>${esc(dayLabel(target.rideTimeISO))} ${esc(formatTime(target.rideTimeISO))} ·
            ${esc(target.direction === 'to' ? 'to' : 'home from')}
            ${esc(S.placeById(target.destinationId).short)}</span>
        </span>
        <button class="ab-toggle" role="switch" aria-checked="${on}"
                data-action="toggle-offer" data-event="${esc(target.id)}"
                aria-label="Offer seats on this trip">
          <span class="ab-toggle__track"><span class="ab-toggle__knob"></span></span>
        </button>
      </div>
      <div class="ab-seatrow">
        <span class="ab-label" style="margin:0">Open seats</span>
        <span class="ab-seatnum" data-seatcount>${seats}</span>
      </div>
    </div>`
  );
}

export function parentView() {
  const me = S.currentUser();
  if (me.role !== 'parent') return wrongRole('parent');

  const children = (me.childIds || []).map((id) => S.personById(id));

  const childBlocks = children
    .map((child) => {
      const events = S.upcomingEventsFor(child.id);
      const next = events.find((e) => S.rideStatusFor(child.id, e.id).code === 'confirmed');
      const ride = next ? S.rideStatusFor(child.id, next.id).ride : null;

      return `<div class="card stack">
        <div>
          <h3 class="card__title">${esc(personName(child))}</h3>
          <p class="muted" style="margin:0">
            Grade ${esc(child.grade)} ·
            ${esc(S.activitiesForStudent(child.id).map((m) => m.activity.name).join(', '))} ·
            ${esc(S.hoodName(child.neighborhoodId))}
          </p>
        </div>

        ${
          child.approved
            ? `<p style="margin:0">${statusChip('confirmed', 'Account approved')}</p>`
            : `<div class="stack">
                 ${notice(
                   `${esc(child.firstName)} is waiting for your approval`,
                   'Until you approve, AfterBell will not let them request a ride, accept a ride, or appear in anyone else’s car.'
                 )}
                 <div class="btnrow">
                   <button class="btn btn--primary" data-action="approve" data-student="${esc(child.id)}">
                     ${icon('user-check')} Approve ${esc(child.firstName)}
                   </button>
                 </div>
               </div>`
        }

        ${
          ride
            ? `<div class="stack">
                 <div class="pagehead__eyebrow" style="margin:0">Next confirmed ride</div>
                 ${carCard(ride)}
                 <div class="btnrow">
                   <button class="btn ${ride.pickedUp ? 'btn--quiet' : 'btn--primary'}"
                           data-action="toggle-pickup" data-ride="${esc(ride.id)}">
                     ${icon(ride.pickedUp ? 'rotate-ccw' : 'check')}
                     ${ride.pickedUp ? 'Undo picked up' : 'Mark picked up'}
                   </button>
                 </div>
                 <p class="muted" style="margin:0">
                   ${
                     ride.pickedUp
                       ? `${esc(child.firstName)} was picked up at ${esc(ride.pickedUpAt)}. You and the driver both see this.`
                       : `When the driver confirms, this says "picked up" with a time stamp. Demo mode lets you press it yourself.`
                   }
                 </p>
               </div>`
            : `<p class="muted" style="margin:0">No confirmed ride yet.</p>`
        }

        <div>
          <div class="pagehead__eyebrow" style="margin-bottom:6px">${esc(child.firstName)}'s week</div>
          <div class="board">
            ${events
              .map((e) =>
                eventRow(e, statusChip(S.rideStatusFor(child.id, e.id).code), `#/event/${e.id}`)
              )
              .join('')}
          </div>
        </div>
      </div>`;
    })
    .join('');

  // Seats this parent has offered.
  const myOffers = S.state.data.offers.filter((o) => o.driverId === me.id);

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Parent</div>
      <h1>${esc(personName(me))}</h1>
      <p class="pagehead__sub">Approve your students, offer seats, and see when
      your kid actually got in the car.</p>
    </div>

    ${block('Your students', `<div class="cols cols--2">${childBlocks}</div>`)}

    ${parentOfferCard(me)}

    ${block(
      'Seats you have offered',
      myOffers.length
        ? `<div class="board">${myOffers
            .map((offer) => {
              const event = S.eventById(offer.eventId);
              const open = S.openSeats(offer.id);
              return eventRow(
                event,
                `<span class="chip chip--plain"><span class="mono">${offer.seats}</span> seats ·
                 <span class="mono">${open}</span> open</span>`,
                `#/event/${event.id}`
              );
            })
            .join('')}</div>`
        : empty('<strong>You have not offered any seats this week.</strong>'),
      `${myOffers.length} trips`
    )}`;
}

/* ===========================================================================
   SCREEN 6 — TEEN DRIVER VIEW
   The point of this screen is that the law is stated plainly, before the
   driver wonders why AfterBell only gave them one passenger.
=========================================================================== */
export function driverView() {
  const me = S.currentUser();
  if (!me.driverKind) return wrongRole('teen driver');

  const isNew = me.driverKind === 'provisional_teen' && me.provisionalUnder12Months;
  const myOffers = S.state.data.offers.filter((o) => o.driverId === me.id);

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Teen driver</div>
      <h1>${esc(personName(me))}</h1>
      <p class="pagehead__sub">Grade ${esc(me.grade)} ·
        ${esc(S.activitiesForStudent(me.id).map((m) => m.activity.name).join(', '))} ·
        ${esc(S.hoodName(me.neighborhoodId))}</p>
    </div>

    ${block(
      'Your license',
      `<div class="card stack">
        <p style="margin:0"><strong>${
          isNew
            ? 'You told AfterBell you have had your provisional license for less than 12 months.'
            : 'You have held a full license for more than 12 months.'
        }</strong></p>
        ${
          isNew
            ? `<ul style="margin:0;padding-left:20px">
                 <li>AfterBell will give you <strong>at most one passenger under 21 who is
                   not a family member</strong>. Brothers and sisters do not count.</li>
                 <li>AfterBell will <strong>never</strong> assign you a trip that runs between
                   <strong>midnight and 5 a.m.</strong></li>
               </ul>
               <p class="muted" style="margin:0">These are Texas rules for provisional
               drivers, not AfterBell's rules. The app just refuses to build a car
               that would break them.</p>`
            : `<p class="muted" style="margin:0">No passenger limit and no curfew, so your
               seats can be filled all the way up.</p>`
        }
      </div>`
    )}

    ${block(
      'Trips you are driving',
      myOffers.length
        ? `<div class="stack">${myOffers
            .map((offer) => {
              const event = S.eventById(offer.eventId);
              const ride = S.state.data.rides.find((r) => r.offerId === offer.id);
              const seats = S.legalSeatsFor(offer.id);
              return `<div class="card stack">
                <div>
                  <h3 class="card__title">${esc(S.activityName(event.activityId))} — ${esc(event.title)}</h3>
                  <p class="muted" style="margin:0">
                    <span class="mono">${esc(dayLabel(offer.timeISO))} ${esc(formatTime(offer.timeISO))}</span> ·
                    ${esc(event.direction === 'to' ? 'to' : 'home from')} ${esc(S.placeById(offer.destinationId).short)}
                  </p>
                </div>
                <p style="margin:0">
                  <span class="chip chip--plain"><span class="mono">${offer.seats}</span> seats offered</span>
                  <span class="chip chip--plain"><span class="mono">${seats.open}</span> still open</span>
                  ${
                    seats.limited
                      ? `<span class="chip chip--waiting"><span class="swatch"></span>${
                          seats.curfew
                            ? 'Curfew blocks this trip'
                            : `${seats.usable} legally fillable`
                        }</span>`
                      : ''
                  }
                </p>
                ${
                  seats.curfew
                    ? notice(
                        'AfterBell will not assign anyone to this trip',
                        'It runs past midnight, and a provisional driver cannot drive between midnight and 5 a.m. Your three seats stay empty on purpose.'
                      )
                    : ''
                }
                ${ride ? carCard(ride) : `<p class="muted" style="margin:0">No riders assigned yet.</p>`}
                <div class="btnrow">
                  <a class="btn btn--quiet btn--sm" href="#/event/${esc(event.id)}">Open event</a>
                </div>
              </div>`;
            })
            .join('')}</div>`
        : empty('<strong>You have not offered seats yet.</strong> Open an event from your week to offer some.'),
      `${myOffers.length} trips`
    )}

    ${block(
      'Your own week',
      `<div class="board">${S.upcomingEventsFor(me.id)
        .map((e) => eventRow(e, statusChip(S.rideStatusFor(me.id, e.id).code), `#/event/${e.id}`))
        .join('')}</div>`
    )}`;
}

/* ===========================================================================
   SCREEN 7 — ORGANIZER READINESS DASHBOARD
   The most important screen in the app, and the first one redesigned.
   ===========================================================================
   Layout, top to bottom:
     1. One dark card holding everything that matters: the event, the alert
        toggle, the dial, the group filters, and the Fill the Gaps button.
     2. Light cards underneath for the detail: who still has no ride and why,
        which event is selected, and the full square-per-member grid.
=========================================================================== */

/** "Jake A." -> "JA". The only form of a face this app ever shows. */
function initials(person) {
  return `${person.firstName[0]}${person.lastInitial}`.toUpperCase();
}

function avatar(person, extraClass = '') {
  return `<span class="ab-avatar ${extraClass}" aria-hidden="true">${esc(initials(person))}</span>`;
}

/* ---------------------------------------------------------------------------
   THE DIAL
   One radial tick per roster member, laid out around a 270 degree arc with
   the gap at the bottom. Ticks are drawn in roster order, which is the same
   order as the square grid, so the two views agree.

   The dial is marked role="img" with a sentence for a label. It is a picture
   of a number that is also printed in the middle of it, so nothing here is
   information you can only get by looking at colour.
--------------------------------------------------------------------------- */
function dialSvg(rows, filter, label) {
  const count = rows.length;
  const radius = 132;      // distance from centre to the outer end of a tick
  const length = 22;       // how long each tick is
  const width = 3.6;       // how thick each tick is
  const sweep = 270;       // degrees of arc, gap at the bottom
  const startAngle = -135; // straight up is 0, so -135 starts at lower left

  const ticks = rows
    .map((row, i) => {
      const angle = count <= 1 ? 0 : startAngle + (i * sweep) / (count - 1);
      const filled = S.hasRide(row.status.code);
      const dimmed = filter !== 'ALL' && row.group !== filter;
      return `<rect class="dial__tick${filled ? ' is-filled' : ''}${dimmed ? ' is-dim' : ''}"
        data-student="${esc(row.studentId)}"
        x="${-width / 2}" y="${-radius}" width="${width}" height="${length}" rx="${width / 2}"
        transform="rotate(${angle.toFixed(2)})" />`;
    })
    .join('');

  return `<svg class="dial__svg" viewBox="0 0 300 300" role="img" aria-label="${esc(label)}">
    <g transform="translate(150 150)">${ticks}</g>
  </svg>`;
}

/**
 * "Still without a ride" — the real component, used by the organizer
 * dashboard and re-used as its own section by tour mode. Students the
 * algorithm actually tried and failed to seat get the full tile with a
 * sentence; students simply queued for the next run get a compact row,
 * because sixteen copies of "waiting for the next run" is a wall of text.
 */
export function rosterGapsCard(eventId) {
  const r = S.readinessFor(eventId);
  const missing = r.rows.filter((row) => !S.hasRide(row.status.code));

  const GAP_PREVIEW = 6;
  const withReason = missing.filter((row) => row.status.reason);
  const waiting = missing.filter((row) => !row.status.reason);
  const ordered = [...withReason, ...waiting];
  const visible = view.showAllGaps ? ordered : ordered.slice(0, GAP_PREVIEW);

  const gapTile = (row) => `<div class="ab-tile">
    <div class="ab-person">
      ${avatar(row.person, row.status.reason ? '' : 'ab-avatar--sm')}
      <div class="ab-person__body">
        <p class="ab-person__name">${esc(personName(row.person))}</p>
        <p class="ab-person__meta">${esc(row.group)} · ${esc(S.hoodName(row.person.neighborhoodId))}</p>
        ${row.status.reason ? `<p class="ab-person__why">${esc(row.status.reason)}</p>` : ''}
        <div class="ab-person__tags">
          ${statusChip(row.status.code)}
          ${row.status.ruleLabel ? `<span class="ab-person__rule">${esc(row.status.ruleLabel)}</span>` : ''}
        </div>
      </div>
    </div>
  </div>`;

  return `<section class="ab-card">
    <p class="ab-label">
      ${missing.length ? `Still without a ride · ${missing.length}` : 'Every spot is filled'}
    </p>
    ${
      missing.length
        ? `<div class="ab-tilelist">${visible.map(gapTile).join('')}</div>
           ${
             ordered.length > GAP_PREVIEW
               ? `<button class="ab-btn ab-btn--ghost ab-gaps__more" data-action="toggle-gaps"
                          aria-expanded="${view.showAllGaps}">
                    ${view.showAllGaps ? 'Show fewer' : `Show all ${ordered.length}`}
                  </button>`
               : ''
           }`
        : `<p style="margin:0">Nobody on this roster is missing a ride to
            ${esc(r.event.title)}.</p>`
    }
  </section>`;
}

export function organizer(eventId) {
  const me = S.currentUser();
  if (me.role !== 'organizer') return wrongRole('organizer');

  const myEvents = S.state.data.events
    .filter((e) => e.activityId === me.activityId)
    .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO));

  const chosenId =
    eventId && myEvents.some((e) => e.id === eventId) ? eventId : defaultOrganizerEventId();

  if (!chosenId) {
    return `<div class="ab-card">
      <h1 class="ab-h2">Ride readiness</h1>
      <p class="ab-label" style="margin:8px 0 0">No events scheduled yet.</p>
    </div>`;
  }

  const r = S.readinessFor(chosenId);
  const groups = r.byGroup.map((g) => g.group);

  // A filter left over from a different activity simply does not apply here.
  const filter = groups.includes(view.groupFilter) ? view.groupFilter : 'ALL';
  const shown = filter === 'ALL' ? r.rows : r.rows.filter((row) => row.group === filter);
  const shownCovered = shown.filter((row) => S.hasRide(row.status.code)).length;

  const fill = S.state.lastFill && S.state.lastFill.eventId === chosenId ? S.state.lastFill : null;
  const missing = r.rows.filter((row) => !S.hasRide(row.status.code));

  const dialLabel =
    `${shownCovered} of ${shown.length} ` +
    `${filter === 'ALL' ? 'roster members' : filter} have a ride to ${r.event.title}.`;

  /* ---- 1. THE DARK CARD ------------------------------------------------ */
  const darkCard = `<section class="ab-dark">
    <div class="ab-dark__top">
      <button class="ab-icon-btn" data-action="back" aria-label="Go back">
        ${icon('chevron-left')}
      </button>
      <div>
        <p class="ab-dark__eyebrow">${esc(S.activityName(me.activityId))} · ${esc(personName(me))}</p>
        <h1 class="ab-h2">${esc(r.event.title)}</h1>
      </div>
    </div>

    <div class="ab-tile ab-togglerow" style="margin-top:14px">
      <span class="ab-togglerow__text">
        <strong>Auto-alert unfilled rides</strong>
        <span>${
          view.autoAlert
            ? 'Texts you 24 hours out. Sends once accounts are live in Stage 2.'
            : 'Off. You check readiness yourself.'
        }</span>
      </span>
      <button class="ab-toggle" role="switch" aria-checked="${view.autoAlert}"
              data-action="toggle-auto-alert" aria-label="Auto-alert unfilled rides">
        <span class="ab-toggle__track"><span class="ab-toggle__knob"></span></span>
      </button>
    </div>

    <div class="dial">
      ${dialSvg(r.rows, filter, dialLabel)}
      <div class="dial__center">
        <div class="dial__num" id="dial-number">${shownCovered}</div>
        <div class="dial__sub">of ${shown.length} have rides</div>
        <div class="dial__time">${esc(dayLabel(r.event.rideTimeISO))} · ${esc(formatTime(r.event.rideTimeISO))}</div>
      </div>
    </div>

    <div class="gfilters" role="group" aria-label="Filter the dial by group">
      <button class="gfilter" aria-pressed="${filter === 'ALL'}"
              data-action="group-filter" data-group="ALL" aria-label="All groups">All</button>
      ${groups
        .map(
          (group) => `<button class="gfilter" aria-pressed="${filter === group}"
            data-action="group-filter" data-group="${esc(group)}" aria-label="${esc(group)}"
            title="${esc(group)}">${esc(groupShortCode(group))}</button>`
        )
        .join('')}
    </div>
    <p class="gfilter__caption">
      ${
        filter === 'ALL'
          ? `Showing the whole roster.`
          : `Showing ${esc(filter)} only — ${shown.length - shownCovered} still without a ride.`
      }
    </p>

    <button class="ab-btn ab-btn--primary ab-btn--lg" style="margin-top:14px"
            data-action="fill-gaps" data-event="${esc(chosenId)}">
      ${icon('users')} Fill the Gaps
    </button>
    <p class="gfilter__caption" style="text-align:center">
      Matches everyone waiting on this trip — ${esc(formatTime(r.event.rideTimeISO))}
      ${r.event.direction === 'to' ? 'to' : 'home from'}
      ${esc(S.placeById(r.event.destinationId).short)} — whatever activity they are in.
    </p>
  </section>`;

  /* ---- 2. WHAT FILL THE GAPS JUST DID ---------------------------------- */
  const summaryCard = fill
    ? `<section class="ab-card" aria-live="polite">
        <p class="ab-label">What Fill the Gaps just did</p>
        <p style="margin:0">
          <strong>Seated ${fill.matchedStudentIds.length}
          ${fill.matchedStudentIds.length === 1 ? 'student' : 'students'}</strong>
          from your roster into ${fill.stats.carsUsed}
          car${fill.stats.carsUsed === 1 ? '' : 's'}.
        </p>
        ${
          fill.crossActivityCount
            ? `<p style="margin:8px 0 0">It put
                <strong>${fill.crossActivityCount}</strong>
                ${fill.crossActivityCount === 1 ? 'student' : 'students'}
                from ${esc(fill.crossActivityNames.join(' and '))} in those same cars.
                <a href="#/cross">See the shared cars</a>.</p>`
            : `<p class="ab-label" style="margin:8px 0 0">No other activity leaves inside
                this 15-minute window, so every seat went to your roster.</p>`
        }
      </section>`
    : '';

  const gapsCard = rosterGapsCard(chosenId);

  /* ---- 4. EVENT PICKER + DETOUR SETTING -------------------------------- */
  const pickerCard = `<section class="ab-card">
    <p class="ab-label">Event</p>
    <div class="ab-field">
      <label for="org-event">Which trip are you looking at</label>
      <select id="org-event" data-action="pick-event">
        ${myEvents
          .map((e) => {
            const rr = S.readinessFor(e.id);
            return `<option value="${esc(e.id)}" ${e.id === chosenId ? 'selected' : ''}>
              ${esc(dayLabel(e.rideTimeISO))} ${esc(formatTime(e.rideTimeISO))} — ${esc(e.title)}
              (${rr.covered}/${rr.total})
            </option>`;
          })
          .join('')}
      </select>
    </div>
    <div class="ab-field">
      <label for="org-detour">Max detour, in miles between neighbourhood centres</label>
      <select id="org-detour" data-action="set-detour">
        ${[1, 2, 3, 4, 5]
          .map(
            (mi) => `<option value="${mi}" ${
              S.state.data.settings.maxDetourMiles === mi ? 'selected' : ''
            }>${mi} mile${mi === 1 ? '' : 's'}</option>`
          )
          .join('')}
      </select>
    </div>
    <button class="ab-btn ab-btn--ghost" style="width:100%;margin-top:4px" data-action="reset-demo">
      ${icon('rotate-ccw')} Reset demo data
    </button>
  </section>`;

  /* ---- 5. SECONDARY VIEW: the original square-per-member grid ---------- */
  const spotsCard = `<section class="ab-card">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <p class="ab-label" style="margin:0">All spots</p>
      <button class="ab-btn ab-btn--ghost" style="min-height:40px;padding:0 16px;font-size:13px"
              data-action="toggle-spots" aria-expanded="${view.showAllSpots}">
        ${view.showAllSpots ? 'Hide' : 'View all spots'}
      </button>
    </div>
    ${
      view.showAllSpots
        ? `<div style="margin-top:14px">
            <div class="spots" id="spots-grid" role="group" aria-label="Roster, one square per member">
              ${r.rows
                .map(
                  (row) => `<button class="${spotClass(row.status.code)}"
                    data-action="spot" data-student="${esc(row.studentId)}"
                    title="${esc(personName(row.person))} — ${esc(row.group)}"
                    aria-label="${esc(personName(row.person))}, ${esc(row.group)}, ${esc(
                    row.status.code === 'own' ? 'has own ride' : STATUS_TEXT[row.status.code]
                  )}"></button>`
                )
                .join('')}
            </div>
            <p id="spot-detail" class="ab-person__meta" style="margin:10px 0 0;min-height:1.4em">
              Tap a square for the name. ${r.rows.length} squares, one per member.
            </p>
            <div class="legend" style="margin-top:10px">
              ${statusChip('confirmed')}${statusChip('waiting')}${statusChip('none')}
            </div>
            <table class="groups" style="margin-top:16px">
              <thead><tr><th>Group</th><th>Covered</th><th>Still needed</th></tr></thead>
              <tbody>
                ${r.byGroup
                  .map(
                    (g) => `<tr>
                  <td>${esc(g.group)}</td>
                  <td class="num">${g.covered} / ${g.total}</td>
                  <td class="num">${g.total - g.covered || '—'}</td>
                </tr>`
                  )
                  .join('')}
              </tbody>
            </table>
          </div>`
        : ''
    }
  </section>`;

  return `${darkCard}${summaryCard}${gapsCard}${pickerCard}${spotsCard}`;
}

/**
 * Pick the event that needs attention most: the biggest gap, soonest.
 *
 * app.js pins the result into the URL (#/organizer/<id>) as soon as the
 * dashboard opens. Without that pin the dashboard would quietly slide to a
 * different event the moment Fill the Gaps closed the gap on this one, which
 * is exactly when the organizer is still looking at it.
 */
export function defaultOrganizerEventId() {
  const me = S.currentUser();
  if (me.role !== 'organizer') return null;

  const events = S.state.data.events.filter((e) => e.activityId === me.activityId);
  if (!events.length) return null;

  return events
    .map((e) => {
      const rr = S.readinessFor(e.id);
      return { id: e.id, gap: rr.total - rr.covered, time: e.rideTimeISO };
    })
    .sort((a, b) => b.gap - a.gap || a.time.localeCompare(b.time))[0].id;
}

/* ===========================================================================
   SCREEN 8 — CROSS-ACTIVITY VIEW (the differentiator)
=========================================================================== */
export function crossActivity() {
  // Cars that already exist and carry riders from more than one activity.
  const committed = S.state.data.rides.filter((ride) => {
    const activities = new Set(S.ridersInRide(ride).map((r) => r.activityId));
    return activities.size > 1;
  });

  // If none exist yet, show what the algorithm WOULD build for Tuesday
  // evening, computed live. Nothing is saved until the button is pressed.
  const preview = committed.length ? null : S.previewTrip('e-vball-tue');
  const previewCars = preview
    ? preview.cars.filter((car) => {
        const acts = new Set(
          car.riderRequestIds.map((id) => S.state.data.requests.find((r) => r.id === id).activityId)
        );
        return acts.size > 1;
      })
    : [];

  const explain = `<div class="callout">
      <h3>Why this is the whole idea</h3>
      <p>Volleyball practice ends at 6:00. Theater rehearsal ends at 6:10. Cross
      country gets back at 5:55. Three different coaches, three different group
      chats, three separate problems — and four kids from the same two
      neighborhoods all standing outside the same door within fifteen minutes.</p>
      <p>AfterBell groups ride requests by <strong>where the car meets</strong>,
      <strong>which direction it's going</strong>, and <strong>when</strong>.
      The activity is deliberately left out of that key. That one decision is
      what lets a volleyball player, a theater kid and a runner share a car.</p>
    </div>`;

  if (committed.length) {
    return `<div class="pagehead">
        <div class="pagehead__eyebrow">Cross-activity</div>
        <h1>One car, more than one activity</h1>
        <p class="pagehead__sub">These cars were built by the matching algorithm.
        Each rider is labeled with the activity they are riding for.</p>
      </div>
      ${explain}
      ${block(
        'Shared cars',
        `<div class="stack">${committed.map((ride) => sharedCarCard(ride)).join('')}</div>`,
        `${committed.length} car${committed.length === 1 ? '' : 's'}`
      )}`;
  }

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Cross-activity</div>
      <h1>One car, more than one activity</h1>
      <p class="pagehead__sub">Nothing is matched for Tuesday evening yet. Here is
      what the algorithm would build, computed right now from the real requests.</p>
    </div>
    ${explain}
    ${block(
      'Preview for Tuesday, 5:55–6:10 p.m.',
      previewCars.length
        ? `<div class="stack">
             ${previewCars.map((car) => previewCarCard(car)).join('')}
             <div class="btnrow">
               <button class="btn btn--primary" data-action="fill-gaps" data-event="e-vball-tue">
                 ${icon('users')} Run the match for Tuesday evening
               </button>
             </div>
             <p class="muted" style="margin:0">Until you press that, nothing is saved —
             the cars above are the pure algorithm's output, computed on this page.</p>
           </div>`
        : empty('<strong>No shared cars right now.</strong> Every pending trip is single-activity.'),
      `${previewCars.length} car${previewCars.length === 1 ? '' : 's'}`
    )}`;
}

function sharedCarCard(ride) {
  const riders = S.ridersInRide(ride);
  const activities = [...new Set(riders.map((r) => r.activityLabel))];
  return `<div class="stack">
    <p style="margin:0">${activities.map((a) => activityChip(a)).join(' ')}</p>
    ${carCard(ride)}
  </div>`;
}

function previewCarCard(car) {
  const driver = S.personById(car.driverId);
  const place = S.placeById(car.destinationId);
  const riders = car.riderIds.map((studentId, i) => {
    const request = S.state.data.requests.find((r) => r.id === car.riderRequestIds[i]);
    const person = S.personById(studentId);
    return {
      person,
      neighborhood: S.hoodName(person.neighborhoodId),
      activityLabel: S.activityName(request.activityId),
      time: request.timeISO,
    };
  });
  const activities = [...new Set(riders.map((r) => r.activityLabel))];

  return `<div class="stack">
    <p style="margin:0">${activities.map((a) => activityChip(a)).join(' ')}</p>
    <div class="ridecard">
      <div class="ridecard__top">
        <span><span class="k">Driver</span> ${esc(personName(driver))}${
          driver.driverKind === 'parent' ? ' (parent)' : ''
        }</span>
        <span><span class="k">Pickup</span> ${esc(formatTime(car.timeISO))}, ${esc(place.short)}</span>
      </div>
      <div class="ridecard__body">
        <p class="mono" style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0 0 8px">
          One car, ${activities.length} activities
        </p>
        <ul class="riders">
          ${riders
            .map(
              (r) => `<li>
            <span class="rider__name">${esc(personName(r.person))}</span>
            ${activityChip(r.activityLabel)}
            <span class="rider__hood">${esc(r.neighborhood)}</span>
            <span class="rider__hood mono">ready ${esc(formatTime(r.time))}</span>
          </li>`
            )
            .join('')}
        </ul>
      </div>
    </div>
  </div>`;
}

/* ===========================================================================
   SCREEN 9 — HOW MATCHING WORKS
   A page I can point judges at, with numbers computed live from the real data.
=========================================================================== */
export function howItWorks() {
  const hoods = S.state.data.neighborhoods;
  const pairs = [
    ['savannah', 'winn-ridge'],
    ['paloma-creek', 'paloma-south'],
    ['sandbrock', 'silverado'],
    ['lakewood', 'union-park'],
  ].map(([a, b]) => {
    const A = hoods.find((h) => h.id === a);
    const B = hoods.find((h) => h.id === b);
    const miles = haversineMiles(A, B);
    return { a: A.name, b: B.name, miles, ok: miles <= S.state.data.settings.maxDetourMiles };
  });

  return `<div class="pagehead">
      <div class="pagehead__eyebrow">Under the hood</div>
      <h1>How Fill the Gaps works</h1>
      <p class="pagehead__sub">Four steps, no randomness, no scoring. Same input,
      same output, every time.</p>
    </div>

    ${block(
      'Step 1 — Bucket',
      `<div class="card">
        <p>Every ride request is grouped by three things: <strong>where the car
        meets</strong>, <strong>which direction it is going</strong>, and
        <strong>when</strong> — requests within
        <span class="mono">${S.state.data.settings.timeWindowMinutes} minutes</span>
        of each other count as the same trip.</p>
        <p style="margin:0">The activity is <strong>not</strong> part of that key.
        That is on purpose, and it is the whole app.</p>
      </div>`
    )}

    ${block(
      'Step 2 — Cluster by neighborhood',
      `<div class="card stack">
        <p style="margin:0">Each neighborhood has one approximate center point.
        Distances come from the haversine formula — great-circle distance on a
        sphere. No maps API, and no home address is ever stored. Real numbers
        from this app's data:</p>
        <table class="groups">
          <thead><tr><th>Neighborhood pair</th><th>Distance</th><th>Within ${S.state.data.settings.maxDetourMiles} mi?</th></tr></thead>
          <tbody>
            ${pairs
              .map(
                (p) => `<tr>
              <td>${esc(p.a)} → ${esc(p.b)}</td>
              <td class="num">${p.miles.toFixed(1)} mi</td>
              <td>${p.ok ? statusChip('confirmed', 'Can share a car') : statusChip('none', 'Too far')}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    )}

    ${block(
      'Step 3 — Assign, under four rules',
      `<div class="card">
        <ol style="margin:0;padding-left:20px">
          <li><strong>Seat capacity.</strong> A car never holds more people than it has seats.</li>
          <li><strong>Texas provisional passenger limit.</strong> A teen in their first
            12 months gets at most one passenger under 21 who is not family. Siblings
            do not count.</li>
          <li><strong>Texas provisional curfew.</strong> No trip between midnight and
            5 a.m. for a driver in their first 12 months. The check covers the whole
            drive, so an 11:30 p.m. pickup that lands at 12:15 a.m. is correctly refused.</li>
          <li><strong>Max detour.</strong> Currently
            <span class="mono">${S.state.data.settings.maxDetourMiles} miles</span>
            between neighborhood centers.</li>
        </ol>
      </div>`
    )}

    ${block(
      'Step 4 — Explain the ones it could not seat',
      `<div class="card">
        <p style="margin:0">Every unmatched student comes back with a sentence an
        organizer can act on, not an error code. For example: <em>"The only driver
        near Sandbrock Ranch is a teen in their first year of driving, and this trip
        runs past midnight."</em> That tells Mr. Moreno exactly what to go find:
        one adult driver on the north side.</p>
      </div>`
    )}

    ${block(
      'Why the order is fixed',
      `<div class="card">
        <p>Drivers are tried in this order: <strong>unrestricted drivers first</strong>
        (parents and fully licensed seniors), then <strong>most open seats</strong>, then
        <strong>alphabetically by id</strong>. Riders inside a car are picked
        <strong>nearest neighborhood first</strong>, then alphabetically.</p>
        <p style="margin:0">Unrestricted drivers go first because a brand-new teen
        driver has exactly one legal seat for a non-family passenger. That seat is the
        scarcest thing in the system, so it is spent last.</p>
      </div>`
    )}

    ${block(
      'Privacy',
      `<div class="card">
        <ul style="margin:0;padding-left:20px">
          <li>No home address is stored anywhere. There is no field for one.</li>
          <li>A student's location is a neighborhood name and nothing finer.</li>
          <li>Names are shown as a first name and a last initial — that is also
            all that gets stored.</li>
          <li>A household id, not an address, is what tells a sibling apart from
            a friend for the passenger rule.</li>
        </ul>
      </div>`
    )}`;
}
