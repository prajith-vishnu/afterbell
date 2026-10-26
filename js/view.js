/* ===========================================================================
   AfterBell — view.js
   View-only state for the redesign.
   ===========================================================================
   This file exists so the visual redesign never has to reach into state.js.
   Nothing here affects matching, seed data, or what a ride IS — these are
   only "what is this person currently looking at" flags. Reloading the page
   resets them, which is correct: they are not data.
=========================================================================== */

export const view = {
  /** Which roster group the organizer is highlighting. 'ALL' or a group name. */
  groupFilter: 'ALL',

  /** The waiting list is capped until the organizer asks to see all of it. */
  showAllGaps: false,

  /** Home screen: which kind of event the chips are filtering to. */
  homeFilter: null,

  /** Request screen: which drivers the student will accept. */
  ridePreference: 'Any approved driver',

  /** Organizer: which unmatched student's "assign a driver" list is open. */
  assignOpenFor: null,
};

/**
 * Short label for a circular group filter button.
 * One word  -> first three letters ("Trumpets" -> "Tru")
 * Two words -> initials ("Low Brass" -> "LB")
 * The full name is always in the button's aria-label, so nothing is lost.
 */
export function groupShortCode(group) {
  const words = group.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3);
  return words.map((w) => w[0].toUpperCase()).join('').slice(0, 3);
}
