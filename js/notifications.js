/* ===========================================================================
   AfterBell — notifications.js
   The Rides tab: what has actually happened to this person.
   ===========================================================================
   Nothing here is written by hand. Entries come from two places, both real:

     1. A LIVE LOG. state.js calls `log()` when something happens — a parent
        approves an account, a ride request goes in, Fill the Gaps seats
        someone, a driver confirms a pickup.

     2. DERIVED ENTRIES, read back out of the current data: every car this
        person is in right now, and whether they have been picked up.

   The second kind exists because the demo starts mid-week with rides already
   arranged. Those were real events, they just happened before the page
   loaded, so they are reconstructed from the rides themselves rather than
   invented.
=========================================================================== */

import * as S from './state.js';
import { formatTime } from './matching.js';
import { dayLabel } from './ui.js';

/** "Just now", "4m ago", "2h ago" */
function sinceLabel(timestamp) {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/** Everything this person should see, newest first. */
export function notificationsFor(personId) {
  const person = S.personById(personId);
  if (!person) return [];

  // Anyone a parent is responsible for counts as "theirs".
  const family = new Set([personId, ...(person.childIds || [])]);

  const live = S.state.log
    .filter((entry) => entry.audience.some((id) => family.has(id)))
    .map((entry) => ({ ...entry, when: sinceLabel(entry.at), sort: entry.at }));

  const derived = [];

  for (const ride of S.state.data.rides) {
    const event = S.eventById(ride.eventId);
    if (!event) continue;
    const offer = S.offerById(ride.offerId);
    const when = `${dayLabel(offer.timeISO)} ${formatTime(offer.timeISO)}`;

    for (const riderId of ride.riderIds) {
      if (!family.has(riderId)) continue;
      const rider = S.personById(riderId);
      const driver = S.personById(ride.driverId);
      const who = riderId === personId ? 'You' : rider.firstName;

      if (ride.pickedUp) {
        derived.push({
          id: `d-pick-${ride.id}-${riderId}`,
          icon: 'check-check',
          text: `${who === 'You' ? 'You were' : `${who} was`} picked up at ${ride.pickedUpAt || when}.`,
          when,
          sort: 2,
        });
      }

      derived.push({
        id: `d-ride-${ride.id}-${riderId}`,
        icon: 'car-front',
        text: `Ride confirmed for ${event.title} — ${driver.firstName} ${driver.lastInitial}., ${formatTime(offer.timeISO)}.`,
        when,
        sort: 1,
      });
    }

    // A driver sees who is in their car.
    if (ride.driverId === personId && ride.riderIds.length) {
      derived.push({
        id: `d-drive-${ride.id}`,
        icon: 'steering-wheel',
        text: `${ride.riderIds.length} rider${ride.riderIds.length === 1 ? '' : 's'} assigned to your car for ${event.title}.`,
        when,
        sort: 1,
      });
    }
  }

  // Account state is a real, current fact worth surfacing.
  for (const id of family) {
    const member = S.personById(id);
    if (member && member.role === 'student' && !member.approved) {
      derived.push({
        id: `d-approve-${id}`,
        icon: 'user-round-x',
        text: `${id === personId ? 'Your account is' : `${member.firstName}'s account is`} waiting for a parent to approve it.`,
        when: 'Pending',
        sort: 3,
      });
    }
  }

  // Live entries first (they just happened), then derived ones.
  return [
    ...live.sort((a, b) => b.sort - a.sort),
    ...derived.sort((a, b) => b.sort - a.sort),
  ];
}
