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
