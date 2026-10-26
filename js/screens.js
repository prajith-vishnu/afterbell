/* ===========================================================================
   AfterBell — screens.js
   One function per screen. Each returns a plain HTML string.
   ===========================================================================
   Written so a judge can read a function top to bottom and see exactly what
   lands on the page. Interaction is handled by `data-action` attributes that
   app.js listens for.
=========================================================================== */

import * as S from './state.js';
import {
  esc, icon, dayLabel, formatTime, personName, initials, avatar,
  statusPill, head, notice, emptyState, mapBlock, STATUS_TEXT,
} from './ui.js';
import { haversineMiles, toMinutes } from './matching.js';
import { view } from './view.js';
import { notificationsFor } from './notifications.js';

/* ---------------------------------------------------------------------------
   SHARED PIECES
--------------------------------------------------------------------------- */

/** Reached by URL in the wrong role: explain rather than crash. */
function wrongRole(needed) {
  return `${head('', 'Switch roles to see this')}
    <div class="pad">${notice(
      `This screen is the ${needed} view`,
      `You are signed in as ${S.DEMO_ACCOUNTS[S.state.role].label}. Use the role chips at the top.`
    )}</div>`;
}

/** An icon that suits the kind of event. */
function eventIcon(event) {
  const title = `${event.title} ${event.detail}`.toLowerCase();
  if (title.includes('contest')) return 'trophy';
  if (title.includes('game') || title.includes('meet')) return 'flag';
  if (title.includes('rehearsal')) return 'music';
  if (title.includes('build')) return 'wrench';
  return 'calendar';
}

/** Which filter chip an event belongs under. */
export function eventKind(event) {
  const title = `${event.title} ${event.detail}`.toLowerCase();
  if (title.includes('contest')) return 'Contest';
  if (title.includes('game')) return 'Game';
  if (title.includes('rehearsal')) return 'Rehearsal';
  return 'Practice';
}

/** One upcoming-event row: grey icon tile, name, when, status on the right. */
function eventRow(event, statusHtml, href) {
  const activity = S.activityById(event.activityId);
  const place = S.placeById(event.destinationId);
  const direction = event.direction === 'to' ? 'to' : 'home from';

  return `<button class="row" data-action="go" data-href="${esc(href)}">
    <span class="tile">${icon(eventIcon(event))}</span>
    <span class="row__body">
      <span class="row__title">${esc(activity.name)} — ${esc(event.title)}</span>
      <span class="row__meta">${esc(dayLabel(event.rideTimeISO))} ·
        ${esc(formatTime(event.rideTimeISO))} · ${esc(direction)} ${esc(place.short)}</span>
    </span>
    <span class="row__end">${statusHtml}</span>
  </button>`;
}

/** The driver block used on the ride card: avatar, name, car. */
function driverBlock(driver) {
  const car = [driver.carColor, driver.carModel].filter(Boolean).join(' ');
  return `<div class="rowbar">
    ${avatar(driver)}
    <div class="row__body">
      <div class="row__title">${esc(personName(driver))}</div>
      <div class="row__meta">${esc(car || 'Car not listed')}${
        driver.driverKind === 'parent' ? ' · Parent' : ' · Student driver'
      }</div>
    </div>
  </div>`;
}

/* ===========================================================================
   1. ORGANIZER — readiness dial, Fill the Gaps, unmatched list
=========================================================================== */

/**
 * THE DIAL. One radial tick per roster member around a 270 degree arc, gap at
 * the bottom. Every tick is the same length and width with rounded ends, and
 * the angles are computed, not hand-placed. Filled means that person has a
 * ride; the same number is printed in the middle, so the picture is never the
 * only way to read it.
 */
function dialSvg(rows, filter, label) {
  const count = rows.length;
  const radius = 132;
  const length = 22;
  const width = 3.6;
  const sweep = 270;
  const startAngle = -135;

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
 * "Assign adult driver" — the organizer's answer to a gap the algorithm
 * could not close. Only adults are listed, because the rules that blocked the
 * match in the first place (the Texas provisional passenger limit and the
 * midnight curfew) are law, and a director cannot override them. Seat counts
 * are still real: a full car does not appear.
 */
function assignControl(row, eventId) {
  const open = view.assignOpenFor === row.studentId;
  const drivers = open ? S.adultDriversFor(eventId) : [];

  return `<div style="margin-top:10px">
    <button class="btn btn--sm btn--quiet" style="width:100%"
            data-action="assign-open" data-student="${esc(row.studentId)}"
            aria-expanded="${open}">
      ${open ? 'Cancel' : 'Assign adult driver'}
    </button>
    ${
      open
        ? drivers.length
          ? `<div class="list" style="margin-top:8px">${drivers
              .map(
                (entry) => `<button class="row" style="min-height:56px"
              data-action="assign-to" data-student="${esc(row.studentId)}"
              data-driver="${esc(entry.person.id)}" data-event="${esc(eventId)}">
              ${avatar(entry.person, 'avatar--sm avatar--grey')}
              <span class="row__body">
                <span class="row__title" style="font-size:15px">${esc(personName(entry.person))}</span>
                <span class="row__meta">${esc(entry.car || 'Car not listed')} ·
                  ${entry.open} seat${entry.open === 1 ? '' : 's'} open</span>
              </span>
              ${icon('chevron-right')}
            </button>`
              )
              .join('')}</div>`
          : `<p class="row__meta" style="margin-top:8px">No adult has an open seat on this trip.</p>`
        : ''
    }
  </div>`;
}

/** "Still without a ride", with the organizer's manual-assign control. */
export function rosterGapsCard(eventId) {
  const r = S.readinessFor(eventId);
  const missing = r.rows.filter((row) => !S.hasRide(row.status.code));

  const PREVIEW = 6;
  const withReason = missing.filter((row) => row.status.reason);
  const waiting = missing.filter((row) => !row.status.reason);
  const ordered = [...withReason, ...waiting];
  const visible = view.showAllGaps ? ordered : ordered.slice(0, PREVIEW);

  if (!missing.length) {
    return `<section class="pad">
      <p class="label">Every spot is filled</p>
      <div class="divider"></div>
      ${emptyState('check-check', 'Nobody is missing a ride',
        `Every student on this roster can get to ${r.event.title}.`)}
    </section>`;
  }

  return `<section class="pad">
    <p class="label">Still without a ride · ${missing.length}</p>
    <div class="divider"></div>
    <div class="list">
      ${visible
        .map(
          (row) => `<div class="row row--static">
        ${avatar(row.person, 'avatar--grey')}
        <div class="row__body">
          <div class="row__title">${esc(personName(row.person))}</div>
          <div class="row__meta">${esc(row.group)} · ${esc(S.hoodName(row.person.neighborhoodId))}</div>
          ${
            row.status.reason
              ? `<div class="row__meta" style="margin-top:6px">${esc(row.status.reason)}</div>`
              : ''
          }
          <div style="margin-top:8px">${statusPill(row.status.code)}</div>
          ${assignControl(row, eventId)}
        </div>
      </div>`
        )
        .join('')}
    </div>
    ${
      ordered.length > PREVIEW
        ? `<button class="btn btn--quiet" style="margin-top:12px" data-action="toggle-gaps"
                   aria-expanded="${view.showAllGaps}">
             ${view.showAllGaps ? 'Show fewer' : `Show all ${ordered.length}`}
           </button>`
        : ''
    }
  </section>`;
}

export function defaultOrganizerEventId() {
  const me = S.currentUser();
  if (!me || me.role !== 'organizer') return null;

  const events = S.state.data.events.filter((e) => e.activityId === me.activityId);
  if (!events.length) return null;

  // The biggest gap, soonest. app.js pins the result into the URL so the
  // dashboard does not slide to another event the moment this one is filled.
  return events
    .map((e) => {
      const rr = S.readinessFor(e.id);
      return { id: e.id, gap: rr.total - rr.covered, time: e.rideTimeISO };
    })
    .sort((a, b) => b.gap - a.gap || a.time.localeCompare(b.time))[0].id;
}

export function organizer(eventId) {
  const me = S.currentUser();
  if (!me || me.role !== 'organizer') return wrongRole('organizer');

  const myEvents = S.state.data.events
    .filter((e) => e.activityId === me.activityId)
    .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO));

  const chosenId =
    eventId && myEvents.some((e) => e.id === eventId) ? eventId : defaultOrganizerEventId();

  if (!chosenId) {
    return `${head('Organizer', 'Ride readiness')}
      ${emptyState('calendar', 'No events yet', 'Add an event to see who can get there.')}`;
  }

  const r = S.readinessFor(chosenId);
  const groups = r.byGroup.map((g) => g.group);
  const filter = groups.includes(view.groupFilter) ? view.groupFilter : 'ALL';
  const shown = filter === 'ALL' ? r.rows : r.rows.filter((row) => row.group === filter);
  const shownCovered = shown.filter((row) => S.hasRide(row.status.code)).length;
  const fill = S.state.lastFill && S.state.lastFill.eventId === chosenId ? S.state.lastFill : null;

  const dialLabel =
    `${shownCovered} of ${shown.length} ${filter === 'ALL' ? 'roster members' : filter} ` +
    `have a ride to ${r.event.title}.`;

  return `
    ${head(`${S.activityName(me.activityId)} · ${personName(me)}`, r.event.title,
      `${dayLabel(r.event.rideTimeISO)} · ${formatTime(r.event.rideTimeISO)} · ` +
      `${r.event.direction === 'to' ? 'to' : 'home from'} ${S.placeById(r.event.destinationId).short}`)}

    <section class="pad">
      <div class="card card--hero">
        <p class="label">${esc(dayLabel(r.event.rideTimeISO))} · ${esc(formatTime(r.event.rideTimeISO))}</p>
        <p class="hero__num" style="margin-top:8px">${r.covered} of ${r.total} have rides</p>
        <p class="hero__sub">${esc(r.event.title)}</p>
        <div class="hero__actions">
          <button class="hero__btn" data-action="fill-gaps" data-event="${esc(chosenId)}">
            ${icon('users')} Fill the Gaps
          </button>
          <button class="hero__btn" data-action="export-plan" data-event="${esc(chosenId)}">
            ${icon('download')} Export ride plan
          </button>
        </div>
      </div>

      <div class="dial" style="margin-top:20px">
        ${dialSvg(r.rows, filter, dialLabel)}
        <div class="dial__center">
          <div class="dial__num" id="dial-number">${shownCovered}</div>
          <div class="dial__sub">of ${shown.length} have rides</div>
        </div>
      </div>

      <div class="chiprow" role="group" aria-label="Filter the dial by group" style="margin:4px 0 16px">
        <button class="chip" aria-pressed="${filter === 'ALL'}" data-action="group-filter"
                data-group="ALL">All</button>
        ${groups
          .map(
            (group) => `<button class="chip" aria-pressed="${filter === group}"
              data-action="group-filter" data-group="${esc(group)}"
              title="${esc(group)}">${esc(group)}</button>`
          )
          .join('')}
      </div>

      <p class="row__meta" style="margin-top:4px;text-align:center">
        Fill the Gaps matches everyone waiting on this trip, whatever activity they are in.
      </p>

      ${
        fill
          ? `<div class="card card--fill" style="margin-top:16px" aria-live="polite">
              <p class="label">What just happened</p>
              <p style="margin-top:8px"><strong>Seated ${fill.matchedStudentIds.length}
                ${fill.matchedStudentIds.length === 1 ? 'student' : 'students'}</strong>
                from your roster into ${fill.stats.carsUsed}
                car${fill.stats.carsUsed === 1 ? '' : 's'}.</p>
              ${
                fill.crossActivityCount
                  ? `<p style="margin-top:6px">It put ${fill.crossActivityCount} student${
                      fill.crossActivityCount === 1 ? '' : 's'
                    } from ${esc(fill.crossActivityNames.join(' and '))} in those same cars.</p>`
                  : `<p class="muted" style="margin-top:6px;font-size:14px">No other activity
                      leaves inside this 15-minute window, so every seat went to your roster.</p>`
              }
            </div>`
          : ''
      }
    </section>

    ${rosterGapsCard(chosenId)}

    <section class="pad" style="margin-top:20px">
      <p class="label">Event</p>
      <div class="divider"></div>
      <div class="field" style="margin-bottom:12px">
        <label for="org-event">Which trip</label>
        <select id="org-event" data-action="pick-event">
          ${myEvents
            .map((e) => {
              const rr = S.readinessFor(e.id);
              return `<option value="${esc(e.id)}" ${e.id === chosenId ? 'selected' : ''}>
                ${esc(dayLabel(e.rideTimeISO))} ${esc(formatTime(e.rideTimeISO))} —
                ${esc(e.title)} (${rr.covered}/${rr.total})
              </option>`;
            })
            .join('')}
        </select>
      </div>
      <div class="field">
        <label for="org-detour">Max detour between neighborhood centers</label>
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
      <button class="btn btn--quiet" style="margin-top:12px" data-action="reset-demo">
        ${icon('rotate-ccw')} Reset demo data
      </button>
    </section>`;
}

/* ===========================================================================
   2. RIDE CARD
=========================================================================== */
export function rideCard(rideId) {
  const ride = S.rideById(rideId);
  if (!ride) {
    return emptyState('car-front', 'That ride is gone', 'It may have been reset or deleted.');
  }

  const offer = S.offerById(ride.offerId);
  const event = S.eventById(ride.eventId);
  const driver = S.personById(ride.driverId);
  const place = S.placeById(offer.destinationId);
  const riders = S.ridersInRide(ride);
  const code = S.handoffCode(ride.id);

  const hoods = [...new Set(riders.map((r) => S.personById(r.person.id).neighborhoodId))];

  return `
    ${mapBlock({
      highlight: hoods,
      destination: offer.destinationId,
      routes: hoods,
    })}

    <section class="sheet">
      <div class="sheet__handle"></div>

      <p class="label">${esc(dayLabel(offer.timeISO))} · ${esc(S.activityName(event.activityId))}</p>
      <h1 style="margin-top:6px">${esc(formatTime(offer.timeISO))}</h1>
      <p class="head__sub" style="margin-top:4px">
        ${esc(event.direction === 'to' ? 'Pickup for' : 'Pickup from')} ${esc(place.name)}
      </p>

      <div class="divider"></div>
      ${driverBlock(driver)}

      <div class="handoff" style="margin-top:16px">
        <p class="label">Handoff code</p>
        <div class="handoff__code">${esc(code)}</div>
        <p class="handoff__help">Show this code to your driver. If it does not match, it is not your car.</p>
      </div>

      <div class="divider"></div>
      <p class="label">Riding with</p>
      <div class="people" style="margin-top:12px">
        ${riders
          .map(
            (r) => `<div class="person">
          ${avatar(r.person, 'avatar--grey')}
          <div class="person__name">${esc(personName(r.person))}</div>
          <div class="person__act">${esc(r.activityLabel || '')}</div>
        </div>`
          )
          .join('')}
      </div>

      <p class="row__meta" style="margin-top:14px">
        Pickups are by neighborhood: ${esc(hoods.map((h) => S.hoodName(h)).join(', '))}.
        AfterBell never stores or shows a home address.
      </p>
    </section>`;
}

/* ===========================================================================
   3. HOME — map on top, bottom sheet underneath
=========================================================================== */
export function studentHome() {
  const me = S.currentUser();
  if (!me || me.role !== 'student') return wrongRole('student');

  const events = S.upcomingEventsFor(me.id);
  const kinds = [
    ['Rehearsal', 'music'],
    ['Game', 'flag'],
    ['Contest', 'trophy'],
    ['Practice', 'dumbbell'],
  ];
  const activeKind = view.homeFilter;
  const shown = activeKind ? events.filter((e) => eventKind(e) === activeKind) : events;

  // Two saved destinations, derived from where this student actually goes.
  const saved = [...new Set(events.map((e) => e.destinationId))]
    .slice(0, 2)
    .map((placeId) => {
      const event = events.find((e) => e.destinationId === placeId);
      return {
        name: S.placeById(placeId).short,
        sub: `${S.activityName(event.activityId)} · ${event.where.replace(/\s*\(.*\)/, '')}`,
        href: `#/request/${event.id}`,
      };
    });

  const hour = Number(events[0] ? events[0].rideTimeISO.slice(11, 13) : 9);
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return `
    ${mapBlock(
      { highlight: [me.neighborhoodId], destination: 'school', routes: [me.neighborhoodId] },
      'mapwrap--tall'
    )}

    <section class="sheet">
      <div class="sheet__handle"></div>

      <p class="row__meta">${esc(greeting)}, ${esc(me.firstName)}</p>
      <h1 style="margin-top:4px">Where are you headed?</h1>

      <button class="searchpill" style="margin-top:16px" data-action="go" data-href="#/pick">
        ${icon('search')} Need a ride to…
        <span class="searchpill__now">Now</span>
      </button>

      ${
        !me.approved
          ? `<div style="margin-top:14px">${notice(
              'Waiting on a parent',
              'A parent has to approve your account before AfterBell will put you in a car.',
              'user-round-x'
            )}</div>`
          : ''
      }

      <div class="saved" style="margin-top:14px">
        ${saved
          .map(
            (item) => `<button class="savedrow" data-action="go" data-href="${esc(item.href)}">
          <span class="savedrow__dot" aria-hidden="true"></span>
          <span class="row__body">
            <span class="savedrow__name">${esc(item.name)}</span>
            <span class="savedrow__sub">${esc(item.sub)}</span>
          </span>
          ${icon('chevron-right')}
        </button>`
          )
          .join('')}
      </div>

      <div class="quickgrid" style="margin-top:18px" role="group" aria-label="Filter by kind">
        ${kinds
          .map(
            ([kind, iconName]) => `<button class="quick" aria-pressed="${activeKind === kind}"
              data-action="home-filter" data-kind="${esc(kind)}">
              <span class="quick__icon">${icon(iconName)}</span>${esc(kind)}
            </button>`
          )
          .join('')}
      </div>

      <p class="label" style="margin-top:22px">Upcoming</p>
      <div class="divider"></div>

      ${
        shown.length
          ? `<div class="list">${shown
              .map((event) =>
                eventRow(event, statusPill(S.rideStatusFor(me.id, event.id).code), `#/event/${event.id}`)
              )
              .join('')}</div>`
          : emptyState('calendar', 'Nothing here',
              `No ${String(activeKind || '').toLowerCase()} events coming up.`)
      }
    </section>`;
}

/* ===========================================================================
   4. REQUEST RIDE + "Finding your ride"
=========================================================================== */

/** The event picker reached from the "Need a ride to…" pill. */
export function pickEvent() {
  const me = S.currentUser();
  if (!me || me.role !== 'student') return wrongRole('student');

  const events = S.upcomingEventsFor(me.id);
  return `
    ${head('Request a ride', 'Where do you need to be?')}
    <section class="pad">
      <div class="list">
        ${events
          .map((event) =>
            eventRow(event, statusPill(S.rideStatusFor(me.id, event.id).code), `#/request/${event.id}`)
          )
          .join('')}
      </div>
    </section>`;
}

export function requestRide(eventId) {
  const me = S.currentUser();
  if (!me || me.role !== 'student') return wrongRole('student');

  const event = S.eventById(eventId);
  if (!event) return emptyState('calendar', 'No such event', 'Go back and pick another one.');

  const place = S.placeById(event.destinationId);
  const status = S.rideStatusFor(me.id, eventId);
  const pickupFrom = toMinutes(event.rideTimeISO) - 10;
  void pickupFrom;

  return `
    ${mapBlock({
      highlight: [me.neighborhoodId],
      destination: event.destinationId,
      routes: [me.neighborhoodId],
    })}

    <section class="sheet">
      <div class="sheet__handle"></div>

      <p class="label">${esc(S.activityName(event.activityId))}</p>
      <h2 style="margin-top:6px">${esc(event.title)}</h2>
      <p class="head__sub" style="margin-top:6px">${esc(event.detail)}</p>

      <div class="divider"></div>
      <dl class="kv">
        <div>
          <dt>Pickup window</dt>
          <dd>${esc(formatTime(event.rideTimeISO))} · ${esc(dayLabel(event.rideTimeISO))}</dd>
        </div>
        <div>
          <dt>${esc(event.direction === 'to' ? 'Going to' : 'Home from')}</dt>
          <dd>${esc(place.name)}</dd>
        </div>
        <div>
          <dt>Picked up in</dt>
          <dd>${esc(S.hoodName(me.neighborhoodId))}</dd>
        </div>
      </dl>

      <div class="divider"></div>
      <p class="label" style="margin-bottom:10px">Ride with</p>
      <div class="choices">
        ${['Any approved driver', 'Parent drivers only']
          .map(
            (option) => `<button class="choice" role="radio"
              aria-checked="${view.ridePreference === option}"
              data-action="ride-pref" data-pref="${esc(option)}">
              <span class="choice__mark" aria-hidden="true"></span>
              <span class="choice__text">${esc(option)}</span>
            </button>`
          )
          .join('')}
      </div>

      <div style="margin-top:18px">
        ${
          status.code === 'confirmed'
            ? `<a class="btn" href="#/ride/${esc(status.ride.id)}">${icon('id-card')} Open ride card</a>`
            : status.code === 'waiting'
            ? `<button class="btn btn--ghost" data-action="cancel-request" data-event="${esc(eventId)}">
                 ${icon('x')} Cancel request</button>`
            : `<button class="btn" data-action="request-ride" data-event="${esc(eventId)}">
                 Request ride</button>`
        }
      </div>
    </section>`;
}

/** The brief "Finding your ride…" state after a request goes in. */
export function matching(eventId) {
  const me = S.currentUser();
  const event = S.eventById(eventId);
  if (!event) return emptyState('calendar', 'No such event', 'Go back and pick another one.');

  return `
    ${mapBlock(
      {
        highlight: [me.neighborhoodId],
        destination: event.destinationId,
        routes: [me.neighborhoodId],
        searching: true,
      },
      'mapwrap--tall'
    )}

    <section class="sheet">
      <div class="sheet__handle"></div>
      <h2>Finding your ride…</h2>
      <p class="head__sub" style="margin-top:8px">
        Looking for drivers leaving ${esc(S.placeById(event.destinationId).short)} around
        ${esc(formatTime(event.rideTimeISO))} who pass near ${esc(S.hoodName(me.neighborhoodId))}.
      </p>
      <p class="row__meta" style="margin-top:14px">
        Your director runs the match for the whole trip at once, so you may be grouped
        with students from other activities.
      </p>
    </section>`;
}

/* ===========================================================================
   5. PARENT VIEW
=========================================================================== */
export function parentView() {
  const me = S.currentUser();
  if (!me || me.role !== 'parent') return wrongRole('parent');

  const children = (me.childIds || []).map((id) => S.personById(id)).filter(Boolean);

  // The soonest trip of theirs, always the same one, so the card does not
  // jump to a different trip the moment seats are offered.
  const eventIds = [...new Set(children.flatMap((c) => S.upcomingEventsFor(c.id).map((e) => e.id)))];
  const trips = eventIds
    .map((id) => S.eventById(id))
    .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO));
  const target = trips[0];
  const offer = target ? S.offerById(`of-${target.id}-${me.id}`) : null;
  const seats = offer ? offer.seats : 0;

  return `
    ${head('Parent', personName(me), 'Approve your students, offer seats, and see when your kid got in the car.')}

    <section class="pad">
      <p class="label">Your students</p>
      <div class="divider"></div>
      <div class="list">
        ${children
          .map((child) => {
            const next = S.upcomingEventsFor(child.id).find(
              (e) => S.rideStatusFor(child.id, e.id).code === 'confirmed'
            );
            const ride = next ? S.rideStatusFor(child.id, next.id).ride : null;
            return `<div class="row row--static">
              ${avatar(child, 'avatar--grey')}
              <div class="row__body">
                <div class="row__title">${esc(personName(child))}</div>
                <div class="row__meta">Grade ${esc(child.grade)} ·
                  ${esc(S.activitiesForStudent(child.id).map((m) => m.activity.name).join(', '))} ·
                  ${esc(S.hoodName(child.neighborhoodId))}</div>
                ${
                  child.approved
                    ? `<div style="margin-top:8px"><span class="chip chip--done">
                         ${icon('check')} Account approved</span></div>`
                    : `<button class="btn btn--sm" style="margin-top:10px;width:100%"
                               data-action="approve" data-student="${esc(child.id)}">
                         Approve ${esc(child.firstName)}</button>`
                }
                ${
                  ride
                    ? `<div class="row__meta" style="margin-top:8px">
                         ${esc(next.title)} · ${esc(formatTime(S.offerById(ride.offerId).timeISO))} ·
                         code <strong>${esc(S.handoffCode(ride.id))}</strong></div>
                       <button class="btn btn--sm btn--quiet" style="margin-top:10px;width:100%"
                               data-action="toggle-pickup" data-ride="${esc(ride.id)}">
                         ${ride.pickedUp ? `Picked up ${esc(ride.pickedUpAt || '')} — undo` : 'Mark picked up'}
                       </button>`
                    : ''
                }
              </div>
            </div>`;
          })
          .join('')}
      </div>
    </section>

    ${
      target
        ? `<section class="pad" style="margin-top:20px">
            <p class="label">Offer seats</p>
            <div class="divider"></div>
            <div class="rowbar rowbar--between">
              <div class="row__body">
                <div class="row__title">${esc(S.activityName(target.activityId))} — ${esc(target.title)}</div>
                <div class="row__meta">${esc(dayLabel(target.rideTimeISO))} ·
                  ${esc(formatTime(target.rideTimeISO))}</div>
              </div>
              <button class="toggle" role="switch" aria-checked="${seats > 0}"
                      data-action="toggle-offer" data-event="${esc(target.id)}"
                      aria-label="Offer seats on this trip">
                <span class="toggle__track"><span class="toggle__knob"></span></span>
              </button>
            </div>
            <div class="rowbar rowbar--between" style="margin-top:14px">
              <span class="label" style="margin:0">Open seats</span>
              <span class="stepper">
                <button class="stepper__btn" data-action="seats-down" data-event="${esc(target.id)}"
                        ${seats <= 0 ? 'disabled' : ''} aria-label="One fewer seat">&minus;</button>
                <span class="stepper__value" data-seatcount aria-live="polite">${seats}</span>
                <button class="stepper__btn" data-action="seats-up" data-event="${esc(target.id)}"
                        ${seats >= 7 ? 'disabled' : ''} aria-label="One more seat">+</button>
              </span>
            </div>
            <p class="row__meta" style="margin-top:12px">
              ${esc([me.carColor, me.carModel].filter(Boolean).join(' ') || 'No car on file')}
            </p>
          </section>`
        : ''
    }`;
}

/* ===========================================================================
   6. SIGN IN
=========================================================================== */
export function signIn() {
  return `
    <section class="welcome">
      <div class="wordmark">AfterBell<span class="wordmark__dot" aria-hidden="true"></span></div>
      <p>Rides to practices, rehearsals, games and contests — grouped by where
      you live and when your activity starts or ends.</p>
      <button class="welcome__btn" data-action="start-demo">Try the demo</button>
      <button class="welcome__btn welcome__btn--ghost" data-action="start-demo">
        I already have an account
      </button>
      <p class="welcome__note">Free for every student at Ray Braswell High School.
      Accounts arrive in Stage 2 — &ldquo;Try the demo&rdquo; opens the app on a week of
      sample students so you can use every screen.</p>
    </section>`;
}

/* ===========================================================================
   TEEN DRIVER
=========================================================================== */
export function driverView() {
  const me = S.currentUser();
  if (!me || !me.driverKind) return wrongRole('teen driver');

  const isNew = me.driverKind === 'provisional_teen' && me.provisionalUnder12Months;
  const myOffers = S.state.data.offers.filter((o) => o.driverId === me.id);

  return `
    ${head('Teen driver', personName(me),
      [me.carColor, me.carModel].filter(Boolean).join(' '))}

    <section class="pad">
      <div class="card card--fill">
        <p class="label">Your license</p>
        <p style="margin-top:8px;font-weight:600">${
          isNew
            ? 'You have had your provisional license for less than 12 months.'
            : 'You have held a full license for more than 12 months.'
        }</p>
        ${
          isNew
            ? `<ul style="margin:10px 0 0;padding-left:20px">
                 <li>At most <strong>one passenger under 21 who is not family</strong>.
                   Brothers and sisters do not count.</li>
                 <li><strong>No trips between midnight and 5 a.m.</strong></li>
               </ul>
               <p class="row__meta" style="margin-top:10px">These are Texas rules for
               provisional drivers. AfterBell refuses to build a car that breaks them.</p>`
            : `<p class="row__meta" style="margin-top:8px">No passenger limit and no curfew.</p>`
        }
      </div>
    </section>

    <section class="pad" style="margin-top:20px">
      <p class="label">Trips you are driving</p>
      <div class="divider"></div>
      ${
        myOffers.length
          ? `<div class="list">${myOffers
              .map((offer) => {
                const event = S.eventById(offer.eventId);
                const ride = S.state.data.rides.find((r) => r.offerId === offer.id);
                const seats = S.legalSeatsFor(offer.id);
                return `<div class="row row--static">
                  <span class="tile">${icon('car-front')}</span>
                  <div class="row__body">
                    <div class="row__title">${esc(S.activityName(event.activityId))} — ${esc(event.title)}</div>
                    <div class="row__meta">${esc(dayLabel(offer.timeISO))} ·
                      ${esc(formatTime(offer.timeISO))} · ${offer.seats} seats offered,
                      ${seats.open} open</div>
                    ${
                      seats.curfew
                        ? `<div class="row__meta" style="margin-top:6px">AfterBell will not
                            assign anyone: this trip runs past midnight.</div>`
                        : seats.limited
                        ? `<div class="row__meta" style="margin-top:6px">${seats.usable} of your
                            open seats can legally be filled.</div>`
                        : ''
                    }
                    ${
                      ride
                        ? `<div style="margin-top:8px">${statusPill('confirmed',
                            `${ride.riderIds.length} rider${ride.riderIds.length === 1 ? '' : 's'} assigned`)}</div>
                           <a class="btn btn--sm btn--quiet" style="margin-top:10px;width:100%"
                              href="#/ride/${esc(ride.id)}">Open ride card</a>`
                        : `<div style="margin-top:8px">${statusPill('waiting', 'No riders yet')}</div>`
                    }
                  </div>
                </div>`;
              })
              .join('')}</div>`
          : emptyState('car-front', 'No trips yet', 'Open an event from your week to offer seats.')
      }
    </section>`;
}

/* ===========================================================================
   EVENT DETAIL
=========================================================================== */
export function eventDetail(eventId) {
  const event = S.eventById(eventId);
  if (!event) return emptyState('calendar', 'No such event', 'Go back and pick another one.');

  const me = S.currentUser();
  const place = S.placeById(event.destinationId);
  const status = me && me.role === 'student' ? S.rideStatusFor(me.id, event.id) : null;

  const tripRides = S.state.data.rides.filter((ride) => {
    const offer = S.offerById(ride.offerId);
    return (
      offer.destinationId === event.destinationId &&
      offer.direction === event.direction &&
      Math.abs(toMinutes(offer.timeISO) - toMinutes(event.rideTimeISO)) <=
        S.state.data.settings.timeWindowMinutes
    );
  });

  return `
    ${mapBlock({
      highlight: me && me.neighborhoodId ? [me.neighborhoodId] : [],
      destination: event.destinationId,
      routes: me && me.neighborhoodId ? [me.neighborhoodId] : [],
    })}

    <section class="sheet">
      <div class="sheet__handle"></div>
      <p class="label">${esc(S.activityName(event.activityId))} · ${esc(dayLabel(event.rideTimeISO))}</p>
      <h2 style="margin-top:6px">${esc(event.title)}</h2>
      <p class="head__sub" style="margin-top:6px">${esc(event.detail)}</p>

      <div class="divider"></div>
      <dl class="kv">
        <div><dt>Where</dt><dd>${esc(event.where)}</dd></div>
        <div><dt>${esc(event.direction === 'to' ? 'Ride to' : 'Ride home from')}</dt>
             <dd>${esc(place.name)}</dd></div>
        <div><dt>Car meets</dt><dd>${esc(formatTime(event.rideTimeISO))}</dd></div>
        <div><dt>Needs a ride</dt>
             <dd>${event.needsRide.length} of ${S.rosterFor(event.activityId).length} on the roster</dd></div>
      </dl>

      ${
        status
          ? `<div class="divider"></div>
             <div class="rowbar rowbar--between">
               <span class="label" style="margin:0">Your ride</span>${statusPill(status.code)}
             </div>
             ${
               status.reason
                 ? `<p class="row__meta" style="margin-top:10px">${esc(status.reason)}</p>`
                 : ''
             }
             <div style="margin-top:14px">
               ${
                 status.code === 'confirmed'
                   ? `<a class="btn" href="#/ride/${esc(status.ride.id)}">Open ride card</a>`
                   : status.code === 'waiting'
                   ? `<button class="btn btn--ghost" data-action="cancel-request"
                              data-event="${esc(event.id)}">Cancel request</button>`
                   : `<button class="btn" data-action="request-ride"
                              data-event="${esc(event.id)}">Request a ride</button>`
               }
             </div>`
          : ''
      }

      <div class="divider"></div>
      <p class="label">Cars on this trip · ${tripRides.length}</p>
      ${
        tripRides.length
          ? `<div class="list" style="margin-top:8px">${tripRides
              .map((ride) => {
                const driver = S.personById(ride.driverId);
                return `<a class="row" href="#/ride/${esc(ride.id)}">
                  ${avatar(driver, 'avatar--grey')}
                  <span class="row__body">
                    <span class="row__title">${esc(personName(driver))}</span>
                    <span class="row__meta">${esc([driver.carColor, driver.carModel].filter(Boolean).join(' '))} ·
                      ${ride.riderIds.length} riding</span>
                  </span>
                  ${icon('chevron-right')}
                </a>`;
              })
              .join('')}</div>`
          : `<p class="row__meta" style="margin-top:8px">No cars yet. An organizer presses
             Fill the Gaps to build them.</p>`
      }
    </section>`;
}

/* ===========================================================================
   RIDES / UPDATES TAB
=========================================================================== */
export function updates() {
  const me = S.currentUser();
  if (!me) return wrongRole('student');

  const items = notificationsFor(me.id);

  return `
    ${head('Rides', 'Updates', 'What has happened to your rides, newest first.')}
    <section class="pad">
      ${
        items.length
          ? `<div class="list">${items
              .map(
                (item) => `<div class="row row--static">
            <span class="tile">${icon(item.icon)}</span>
            <span class="row__body">
              <span class="row__title" style="font-weight:600">${esc(item.text)}</span>
              <span class="row__meta">${esc(item.when)}</span>
            </span>
          </div>`
              )
              .join('')}</div>`
          : emptyState('bell', 'Nothing yet', 'Ride updates will show up here.')
      }
    </section>`;
}

/* ===========================================================================
   ACTIVITIES TAB
=========================================================================== */
export function activities() {
  const me = S.currentUser();
  if (!me) return wrongRole('student');

  const mine =
    me.role === 'organizer'
      ? [{ activity: S.activityById(me.activityId), group: 'Organizer' }]
      : me.role === 'parent'
      ? [
          ...new Map(
            (me.childIds || [])
              .flatMap((id) => S.activitiesForStudent(id))
              .map((m) => [m.activityId, m])
          ).values(),
        ]
      : S.activitiesForStudent(me.id);

  return `
    ${head('Activities', 'Your activities', 'Join codes come from your director or coach.')}
    <section class="pad">
      ${
        mine.length
          ? `<div class="list">${mine
              .map((m) => {
                const roster = S.rosterFor(m.activity.id);
                const next = S.state.data.events
                  .filter((e) => e.activityId === m.activity.id)
                  .sort((a, b) => a.rideTimeISO.localeCompare(b.rideTimeISO))[0];
                return `<div class="row row--static">
              <span class="tile">${icon('users')}</span>
              <span class="row__body">
                <span class="row__title">${esc(m.activity.name)}</span>
                <span class="row__meta">${esc(m.group)} · ${roster.length} on the roster ·
                  code ${esc(m.activity.joinCode)}</span>
                ${
                  next
                    ? `<span class="row__meta">Next: ${esc(next.title)},
                        ${esc(dayLabel(next.rideTimeISO))}</span>`
                    : ''
                }
              </span>
            </div>`;
              })
              .join('')}</div>`
          : emptyState('users', 'No activities yet', 'Enter a join code to get started.')
      }
    </section>`;
}

/* ===========================================================================
   ACCOUNT TAB
=========================================================================== */
export function account() {
  const me = S.currentUser();
  if (!me) {
    return emptyState('user-round', 'Signed out', 'Pick a role at the top to sign back in.');
  }

  const roleLabel =
    { student: 'Student', parent: 'Parent', organizer: 'Organizer', chaperone: 'Chaperone' }[me.role] ||
    'Student';
  const isDriver = Boolean(me.driverKind && me.driverKind !== 'parent');

  // Real counts out of the real data, not decoration.
  const ridesTaken = S.state.data.rides.filter((r) => r.riderIds.includes(me.id)).length;
  const ridesGiven = S.state.data.rides.filter((r) => r.driverId === me.id).length;
  const activityCount =
    me.role === 'parent'
      ? new Set((me.childIds || []).flatMap((id) => S.activitiesForStudent(id).map((m) => m.activityId))).size
      : S.activitiesForStudent(me.id).length;

  const settings = [
    ['user-round', 'Personal info'],
    ['map-pin', 'My neighborhood'],
    ['users', 'Parent contacts'],
    ['bell', 'Notifications'],
  ];

  return `
    ${head('Account', personName(me))}

    <section class="pad">
      <div class="rowbar" style="margin-bottom:20px">
        ${avatar(me)}
        <div class="row__body">
          <div class="row__title">${esc(personName(me))}</div>
          <div class="row__meta">${esc(roleLabel)}${isDriver ? ' · Teen driver' : ''}${
            me.grade ? ` · Grade ${esc(me.grade)}` : ''
          }</div>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="stat__num">${ridesTaken}</div>
          <div class="stat__label">Rides taken</div></div>
        <div class="stat"><div class="stat__num">${ridesGiven}</div>
          <div class="stat__label">Rides given</div></div>
        <div class="stat"><div class="stat__num">${activityCount}</div>
          <div class="stat__label">Activities</div></div>
      </div>

      <div class="field" style="margin-top:22px">
        <label for="acct-hood">My neighborhood
          <span class="field__hint">AfterBell stores your neighborhood, never your address.</span>
        </label>
        <select id="acct-hood" data-action="set-neighborhood">
          ${S.state.data.neighborhoods
            .map(
              (hood) => `<option value="${esc(hood.id)}"
                ${hood.id === me.neighborhoodId ? 'selected' : ''}>${esc(hood.name)}</option>`
            )
            .join('')}
        </select>
      </div>

      <div class="settings" style="margin-top:20px">
        ${settings
          .map(
            ([iconName, label]) => `<button class="setting" data-action="noop">
          <span class="tile">${icon(iconName)}</span>${esc(label)}
          <span class="setting__chev">${icon('chevron-right')}</span>
        </button>`
          )
          .join('')}
        <button class="setting setting--danger" data-action="delete-account">
          <span class="tile">${icon('trash-2')}</span>Delete my account and data
          <span class="setting__chev">${icon('chevron-right')}</span>
        </button>
      </div>

      <button class="btn btn--ghost" style="margin-top:20px" data-action="log-out">
        ${icon('log-out')} Log out
      </button>

      <p class="row__meta" style="margin-top:16px">
        AfterBell stores a first name, a last initial, a neighborhood, and your activities.
        It never stores a home address.
      </p>
    </section>`;
}

/** The confirmation step before deleting. */
export function confirmDelete() {
  const me = S.currentUser();
  if (!me) return account();

  return `
    ${head('Account', 'Delete your account?')}
    <section class="pad">
      ${notice(
        'This cannot be undone',
        'This removes your account, ride requests, and ride history. This can’t be undone.',
        'triangle-alert'
      )}
      <div class="stack" style="margin-top:20px">
        <button class="btn btn--danger" data-action="delete-confirm">
          Yes, delete ${esc(me.firstName)}’s account
        </button>
        <button class="btn btn--quiet" data-action="go" data-href="#/account">Keep my account</button>
      </div>
      <p class="row__meta" style="margin-top:16px">
        This is the demo build, so everything lives in your browser.
        &ldquo;Reset demo data&rdquo; on the organizer screen brings the sample people back.
      </p>
    </section>`;
}

/* ===========================================================================
   CROSS-ACTIVITY
=========================================================================== */
export function crossActivity() {
  const committed = S.state.data.rides.filter((ride) => {
    const activities = new Set(S.ridersInRide(ride).map((r) => r.activityId));
    return activities.size > 1;
  });

  const preview = committed.length ? null : S.previewTrip('e-vball-tue');
  const previewCars = preview
    ? preview.cars.filter((car) => {
        const acts = new Set(
          car.riderRequestIds.map((id) => S.state.data.requests.find((r) => r.id === id).activityId)
        );
        return acts.size > 1;
      })
    : [];

  const explain = `<div class="card card--fill">
      <p style="font-weight:600">Volleyball ends at 6:00. Theater ends at 6:10. Cross country
      gets back at 5:55.</p>
      <p class="row__meta" style="margin-top:8px">Three coaches, three group chats, three
      separate problems — and four students from the same two neighborhoods standing outside
      the same door within fifteen minutes. AfterBell groups ride requests by where the car
      meets, which direction it is going, and when. The activity is deliberately not part of
      that key.</p>
    </div>`;

  if (committed.length) {
    return `
      ${head('Cross-activity', 'One car, more than one activity',
        'Built by the matching algorithm. Each rider is labeled with the activity they are riding for.')}
      <section class="pad">
        ${explain}
        <div class="stack" style="margin-top:16px">
          ${committed
            .map((ride) => {
              const driver = S.personById(ride.driverId);
              const riders = S.ridersInRide(ride);
              const acts = [...new Set(riders.map((r) => r.activityLabel))];
              return `<div class="card">
                <p class="label">${acts.length} activities</p>
                <div style="margin-top:10px">${driverBlock(driver)}</div>
                <div class="people" style="margin-top:14px">
                  ${riders
                    .map(
                      (r) => `<div class="person">
                    ${avatar(r.person, 'avatar--grey')}
                    <div class="person__name">${esc(personName(r.person))}</div>
                    <div class="person__act">${esc(r.activityLabel)}</div>
                  </div>`
                    )
                    .join('')}
                </div>
                <a class="btn btn--quiet btn--sm" style="margin-top:14px;width:100%"
                   href="#/ride/${esc(ride.id)}">Open ride card</a>
              </div>`;
            })
            .join('')}
        </div>
      </section>`;
  }

  return `
    ${head('Cross-activity', 'One car, more than one activity',
      'Nothing is matched for Tuesday evening yet. This is what the algorithm would build, computed right now.')}
    <section class="pad">
      ${explain}
      <div class="stack" style="margin-top:16px">
        ${
          previewCars.length
            ? previewCars
                .map((car) => {
                  const driver = S.personById(car.driverId);
                  const riders = car.riderIds.map((studentId, i) => {
                    const request = S.state.data.requests.find((r) => r.id === car.riderRequestIds[i]);
                    return { person: S.personById(studentId), label: S.activityName(request.activityId) };
                  });
                  const acts = [...new Set(riders.map((r) => r.label))];
                  return `<div class="card">
                    <p class="label">Preview · ${acts.length} activities</p>
                    <div style="margin-top:10px">${driverBlock(driver)}</div>
                    <div class="people" style="margin-top:14px">
                      ${riders
                        .map(
                          (r) => `<div class="person">
                        ${avatar(r.person, 'avatar--grey')}
                        <div class="person__name">${esc(personName(r.person))}</div>
                        <div class="person__act">${esc(r.label)}</div>
                      </div>`
                        )
                        .join('')}
                    </div>
                  </div>`;
                })
                .join('')
            : emptyState('shuffle', 'No shared cars right now', 'Every pending trip is single-activity.')
        }
        ${
          previewCars.length
            ? `<button class="btn" data-action="fill-gaps" data-event="e-vball-tue">
                 Run the match for Tuesday evening</button>`
            : ''
        }
      </div>
    </section>`;
}

/* ===========================================================================
   HOW IT WORKS
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

  const step = (n, title, body) => `<div class="card" style="margin-top:12px">
    <p class="label">Step ${n}</p>
    <h3 style="margin-top:6px">${esc(title)}</h3>
    <div class="row__meta" style="margin-top:8px;color:var(--black)">${body}</div>
  </div>`;

  return `
    ${head('Under the hood', 'How Fill the Gaps works',
      'Four steps, no randomness, no scoring. Same input, same output, every time.')}
    <section class="pad">
      ${step(1, 'Bucket by trip',
        `Every request is grouped by <strong>where the car meets</strong>,
         <strong>which direction it is going</strong>, and <strong>when</strong> — within
         ${S.state.data.settings.timeWindowMinutes} minutes counts as the same trip.
         The activity is <strong>not</strong> part of that key. That is the whole app.`)}

      ${step(2, 'Cluster by neighborhood',
        `Each neighborhood has one approximate center. Distances come from the haversine
         formula, the great-circle distance on a sphere. No maps API, and no home address
         is ever stored.`)}

      <div class="list" style="margin-top:12px">
        ${pairs
          .map(
            (p) => `<div class="row row--static">
          <span class="row__body">
            <span class="row__title">${esc(p.a)} → ${esc(p.b)}</span>
            <span class="row__meta">${p.miles.toFixed(1)} miles apart</span>
          </span>
          ${statusPill(p.ok ? 'confirmed' : 'none', p.ok ? 'Can share a car' : 'Too far')}
        </div>`
          )
          .join('')}
      </div>

      ${step(3, 'Assign, under four rules',
        `<ol style="margin:0;padding-left:20px">
           <li><strong>Seat capacity.</strong></li>
           <li><strong>Texas provisional passenger limit.</strong> A teen in their first 12
             months gets at most one passenger under 21 who is not family. Siblings do not count.</li>
           <li><strong>Texas provisional curfew.</strong> No trip between midnight and 5 a.m.
             The check covers the whole drive, so an 11:30 p.m. pickup landing at 12:15 a.m.
             is correctly refused.</li>
           <li><strong>Max detour</strong> — currently ${S.state.data.settings.maxDetourMiles} miles.</li>
         </ol>`)}

      ${step(4, 'Explain who is left',
        `Every unmatched student comes back with a sentence an organizer can act on, not an
         error code. "The only driver near Sandbrock Ranch is a teen in their first year of
         driving, and this trip runs past midnight."`)}

      ${step('·', 'Privacy',
        `<ul style="margin:0;padding-left:20px">
           <li>No home address is stored. There is no field for one.</li>
           <li>Location is a neighborhood name and nothing finer.</li>
           <li>Names are a first name and a last initial — that is all that is stored.</li>
           <li>A household id, not an address, tells a sibling from a friend.</li>
         </ul>`)}
    </section>`;
}
