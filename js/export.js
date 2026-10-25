/* ===========================================================================
   AfterBell — export.js
   "Export ride plan" — builds a CSV in the browser. No server.
   ===========================================================================
   The plan is what a director actually carries on contest day: who is in
   whose car, when, and the handoff code. Students the algorithm could not
   seat are IN the file, with the driver column blank and the reason in the
   status column, because a plan that silently omits the people without rides
   is the problem this app exists to fix.

   Privacy holds here too: a neighbourhood name, never an address, and names
   as a first name plus a last initial.
=========================================================================== */

import * as S from './state.js';
import { formatTime } from './matching.js';
import { dayLabel } from './ui.js';

const COLUMNS = [
  'Student', 'Activity', 'Group/Section', 'Neighborhood',
  'Driver', 'Car', 'Pickup Time', 'Handoff Code', 'Status',
];

/** Quote a CSV field: double the quotes, wrap if it holds a comma or newline. */
function cell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One row per roster member who needs a ride to this event. */
export function buildRidePlanRows(eventId) {
  const event = S.eventById(eventId);
  const readiness = S.readinessFor(eventId);
  const activityName = S.activityName(event.activityId);

  return readiness.rows
    .filter((row) => event.needsRide.includes(row.studentId))
    .map((row) => {
      const person = row.person;
      const base = {
        Student: `${person.firstName} ${person.lastInitial}.`,
        Activity: activityName,
        'Group/Section': row.group,
        Neighborhood: S.hoodName(person.neighborhoodId),
        Driver: '',
        Car: '',
        'Pickup Time': `${dayLabel(event.rideTimeISO)} ${formatTime(event.rideTimeISO)}`,
        'Handoff Code': '',
        Status: '',
      };

      if (row.status.code === 'confirmed' && row.status.ride) {
        const ride = row.status.ride;
        const driver = S.personById(ride.driverId);
        return {
          ...base,
          Driver: `${driver.firstName} ${driver.lastInitial}.`,
          Car: [driver.carColor, driver.carModel].filter(Boolean).join(' '),
          'Handoff Code': S.handoffCode(ride.id),
          Status: 'Ride confirmed',
        };
      }

      if (row.status.code === 'none' && row.status.reason) {
        // The plain-English reason from the algorithm goes straight in.
        return { ...base, Status: row.status.reason };
      }

      return { ...base, Status: row.status.code === 'waiting' ? 'Waiting for match' : 'No ride yet' };
    });
}

export function buildRidePlanCsv(eventId) {
  const rows = buildRidePlanRows(eventId);
  const lines = [COLUMNS.join(',')];
  for (const row of rows) lines.push(COLUMNS.map((key) => cell(row[key])).join(','));
  return lines.join('\r\n');
}

/** "UIL Area Marching Contest — ride home" -> "uil-area-marching-contest-ride-home" */
function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function ridePlanFilename(eventId) {
  const event = S.eventById(eventId);
  return `afterbell-${slug(event.title)}-ride-plan.csv`;
}

/** Build the file and hand it to the browser's downloader. */
export function downloadRidePlan(eventId) {
  const csv = buildRidePlanCsv(eventId);
  const filename = ridePlanFilename(eventId);

  // A BOM so Excel opens the UTF-8 correctly on a school laptop.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { filename, rows: csv.split('\r\n').length - 1 };
}
