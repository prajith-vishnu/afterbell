/* ===========================================================================
   AfterBell — seed.js
   All of the sample data for the Stage 1 demo.
   ===========================================================================

   Nothing in this file is a real person. These are made-up students, made-up
   parents and a made-up week of events, built so that every rule in the
   matching algorithm can be shown on screen.

   The app reads from this one file in Stage 1. In Stage 2 the same shapes get
   stored in Firestore, so none of the screens have to change.

   WHAT IS AND IS NOT STORED (the privacy design):
     - There is NO address field anywhere in this file, and there is no place
       to put one. A student's location is a NEIGHBORHOOD ID and nothing else.
     - Names are stored as a first name plus a single last initial, which is
       also exactly how they are displayed. The full last name is never
       collected, so it cannot leak.
     - `householdId` is how the app tells a sibling apart from a friend, which
       it needs for the Texas provisional-license passenger rule. It is an
       opaque id, not a place.
=========================================================================== */


/* ===========================================================================
   NEIGHBORHOODS
   ===========================================================================
   >>> PLACEHOLDER COORDINATES — PRAJITH, CHECK THESE <<<
   Each lat/lng below is an eyeballed center point for the neighborhood, not a
   surveyed one. They do not need to be exact. The algorithm only ever uses
   them to compare neighborhoods against each other ("is Savannah closer to
   Paloma Creek than to Oak Point?"), never to navigate.

   To correct one: open a map, drop a pin roughly in the middle of the
   neighborhood, copy the two numbers. Nothing else in the app has to change.

   Order of magnitude so you can sanity-check: around here, 0.01 degrees of
   latitude is about 0.69 miles, and 0.01 degrees of longitude is about
   0.58 miles.
=========================================================================== */
export const NEIGHBORHOODS = [
  { id: 'savannah',     name: 'Savannah',            lat: 33.2546, lng: -96.9230 }, // PLACEHOLDER
  { id: 'paloma-creek', name: 'Paloma Creek',        lat: 33.2470, lng: -96.9690 }, // PLACEHOLDER
  { id: 'paloma-south', name: 'Paloma Creek South',  lat: 33.2385, lng: -96.9705 }, // PLACEHOLDER
  { id: 'providence',   name: 'Providence Village',  lat: 33.2365, lng: -96.9480 }, // PLACEHOLDER
  { id: 'winn-ridge',   name: 'Winn Ridge',          lat: 33.2290, lng: -96.9265 }, // PLACEHOLDER
  { id: 'union-park',   name: 'Union Park',          lat: 33.2240, lng: -96.9800 }, // PLACEHOLDER
  { id: 'sandbrock',    name: 'Sandbrock Ranch',     lat: 33.3065, lng: -96.9900 }, // PLACEHOLDER
  { id: 'arrow-brooke', name: 'Arrow Brooke',        lat: 33.2900, lng: -96.9710 }, // PLACEHOLDER
  { id: 'silverado',    name: 'Silverado',           lat: 33.2795, lng: -96.9450 }, // PLACEHOLDER
  { id: 'cross-oak',    name: 'Cross Oak Ranch',     lat: 33.2160, lng: -96.9880 }, // PLACEHOLDER
  { id: 'aubrey-town',  name: 'Aubrey',              lat: 33.3040, lng: -96.9860 }, // PLACEHOLDER
  { id: 'oak-point',    name: 'Oak Point',           lat: 33.1870, lng: -96.9920 }, // PLACEHOLDER
  { id: 'lakewood',     name: 'Lakewood Village',    lat: 33.1600, lng: -96.9700 }, // PLACEHOLDER
];


/* ===========================================================================
   PLACES — the shared endpoints a car can meet at.
   A trip is always "to a place" or "home from a place".
=========================================================================== */
export const PLACES = [
  { id: 'school',      name: 'Ray Braswell HS',       short: 'Braswell HS' },
  { id: 'little-elm',  name: 'Little Elm HS',         short: 'Little Elm HS' },
  { id: 'north-lakes', name: 'North Lakes Park, Denton', short: 'North Lakes Park' },
];


/* ===========================================================================
   ACTIVITIES
   `groups` are the sub-groups inside an activity: band sections, team
   positions, cast vs. crew. The organizer dashboard breaks readiness down by
   these, because "we're missing 4 trumpets" matters more than "we're missing 4".
=========================================================================== */
export const ACTIVITIES = [
  {
    id: 'band', name: 'Marching Band', joinCode: 'BAND-4821',
    organizerId: 'o-moreno', organizerName: 'Mr. Moreno', organizerRole: 'Director of Bands',
    groups: ['Trumpets', 'Mellophones', 'Low Brass', 'Woodwinds', 'Percussion', 'Color Guard'],
  },
  {
    id: 'volleyball', name: 'Volleyball', joinCode: 'VB-1042',
    organizerId: 'o-pham', organizerName: 'Coach Pham', organizerRole: 'Head Coach',
    groups: ['Outside Hitter', 'Setter', 'Middle Blocker', 'Libero', 'Right Side'],
  },
  {
    id: 'theater', name: 'Theater', joinCode: 'STAGE-77',
    organizerId: 'o-ellis', organizerName: 'Ms. Ellis', organizerRole: 'Theater Director',
    groups: ['Cast', 'Crew', 'Tech'],
  },
  {
    id: 'robotics', name: 'Robotics', joinCode: 'BOT-512',
    organizerId: 'o-kaur', organizerName: 'Mr. Kaur', organizerRole: 'Team Sponsor',
    groups: ['Build', 'Programming', 'Drive Team', 'Scouting'],
  },
  {
    id: 'xc', name: 'Cross Country', joinCode: 'XC-2026',
    organizerId: 'o-boone', organizerName: 'Coach Boone', organizerRole: 'Head Coach',
    groups: ['Varsity', 'JV'],
  },
];


/* ===========================================================================
   PEOPLE
   ===========================================================================
   One table for everybody, because the matching algorithm treats a parent
   driver and a senior driver the same way — it only cares about the rules that
   apply to them.

   STUDENT COLUMNS:
     id, firstName, lastInitial, grade, age, neighborhoodId, householdId,
     approved, driverKind, provisionalUnder12Months

     approved ....... has a parent approved this account? An unapproved
                      student cannot request or accept a ride. Everyone in the
                      demo is approved except Aaliyah M., who is the example.
     driverKind ..... null (not a driver)
                      'licensed_teen'      = has held a full license 12+ months
                      'provisional_teen'   = a teen driver
     provisionalUnder12Months
                      true only for a teen still inside their first 12 months.
                      This single flag is what turns on BOTH Texas rules: the
                      one-non-family-passenger limit and the midnight-to-5 a.m.
                      curfew.
=========================================================================== */

// prettier-ignore
const STUDENT_ROWS = [
  // --- Marching Band, already have a ride to Saturday's contest -----------
  ['s01','Marisol','V',12,17,'savannah',    'h-s01', true,  null, false],
  ['s02','Devin','P',  11,16,'savannah',    'h-s02', true,  null, false],
  ['s03','Camille','B',10,15,'savannah',    'h-s03', true,  null, false],
  ['s04','Noah','K',   11,17,'savannah',    'h-s04', true,  null, false],
  ['s05','Priya','R',  12,17,'paloma-creek','h-ramos', true, null, false],
  ['s06','Eli','N',     9,14,'paloma-creek','h-s06', true,  null, false],
  ['s07','Camila','Q', 11,16,'paloma-creek','h-s07', true,  null, false],
  ['s08','Jordan','T', 10,15,'paloma-creek','h-s08', true,  null, false],
  ['s09','Hassan','B', 12,18,'providence',  'h-bell', true, null, false],
  ['s10','Ruby','F',   10,15,'providence',  'h-s10', true,  null, false],
  ['s11','Tomas','H',  11,16,'providence',  'h-s11', true,  null, false],
  ['s12','Keira','W',   9,14,'providence',  'h-s12', true,  null, false],
  ['s13','Micah','O',  11,16,'winn-ridge',  'h-okafor', true, null, false],
  ['s14','Ines','C',   12,17,'winn-ridge',  'h-s14', true,  null, false],
  ['s15','Brady','Z',  10,15,'winn-ridge',  'h-s15', true,  null, false],
  ['s16','Zara','K',   11,16,'union-park',  'h-kaur', true, null, false],
  ['s17','Owen','A',    9,14,'union-park',  'h-s17', true,  null, false],
  ['s18','Lucia','E',  12,17,'union-park',  'h-s18', true,  null, false],

  // --- Marching Band, still waiting for a ride Saturday night ------------
  ['s19','Jalen','M',  11,16,'savannah',    'h-moreau', true, null, false],
  ['s20','Sofia','S',  10,15,'savannah',    'h-sanders', true, null, false],
  ['s21','Reid','J',   12,17,'savannah',    'h-s21', true,  null, false],
  ['s22','Amara','G',  11,16,'paloma-creek','h-garza', true, null, false],
  ['s23','Luke','I',    9,14,'paloma-creek','h-s23', true,  null, false],
  ['s24','Nadia','U',  10,15,'paloma-south','h-s24', true,  null, false],
  ['s25','Gabe','X',   11,16,'paloma-south','h-s25', true,  null, false],
  ['s26','Tessa','L',  12,17,'providence',  'h-lund', true, null, false],
  ['s27','Caleb','Y',  10,15,'providence',  'h-s27', true,  null, false],
  ['s28','Mina','D',   11,16,'winn-ridge',  'h-dumont', true, null, false],
  ['s29','Drew','H',    9,14,'winn-ridge',  'h-s29', true,  null, false],
  ['s30','Harper','U', 12,17,'union-park',  'h-s30', true,  null, false],
  ['s31','Isaiah','V', 11,16,'silverado',   'h-vega', true, null, false],
  ['s32','Elena','C',  10,15,'cross-oak',   'h-s32', true,  null, false],
  ['s33','Jake','A',   11,16,'sandbrock',   'h-s33', true,  null, false], // ends up unmatched: curfew
  ['s34','Maya','T',   12,17,'lakewood',    'h-s34', true,  null, false], // ends up unmatched: detour

  // --- Volleyball --------------------------------------------------------
  ['s35','Reese','P',  11,16,'savannah',    'h-s35', true,  null, false],
  ['s36','Ava','W',    10,15,'savannah',    'h-s36', true,  null, false],
  ['s37','Nia','O',    10,15,'winn-ridge',  'h-okafor', true, null, false], // Bianca's sister
  ['s38','Kelsey','T', 11,16,'winn-ridge',  'h-s38', true,  null, false],
  ['s39','Dani','F',    9,14,'winn-ridge',  'h-s39', true,  null, false], // unmatched: teen passenger limit
  ['s40','Noor','H',   11,16,'oak-point',   'h-s40', true,  null, false], // unmatched: detour
  ['s41','Bri','E',    12,17,'providence',  'h-s41', true,  null, false],
  ['s42','Jada','N',   10,15,'providence',  'h-s42', true,  null, false],
  ['s43','Liv','Q',    11,16,'paloma-creek','h-s43', true,  null, false],
  ['s44','Sloane','I', 12,17,'silverado',   'h-s44', true,  null, false],

  // --- Theater -----------------------------------------------------------
  ['s45','Maddox','C', 11,16,'savannah',    'h-s45', true,  null, false],
  ['s46','June','P',   10,15,'winn-ridge',  'h-s46', true,  null, false],
  ['s47','Omar','Z',   12,17,'paloma-south','h-s47', true,  null, false],
  ['s48','Hana','W',   11,16,'savannah',    'h-s48', true,  null, false],
  ['s49','Theo','B',   10,15,'providence',  'h-s49', true,  null, false],
  ['s50','Aaliyah','M', 9,14,'savannah',    'h-moreau', false, null, false], // waiting on parent approval
  ['s51','Priya','N',  12,18,'silverado',   'h-s51', true,  'licensed_teen', false],
  ['s52','Caleb','W',  12,18,'union-park',  'h-s52', true,  'licensed_teen', false],
  ['s54','Owen','E',   11,16,'aubrey-town', 'h-s54', true,  'provisional_teen', true],

  // --- Robotics ----------------------------------------------------------
  ['s53','Sam','D',    12,18,'winn-ridge',  'h-dumont', true, 'licensed_teen', false], // Mina's brother
  ['s55','Ravi','J',   11,16,'silverado',   'h-s55', true,  null, false],
  ['s56','Pilar','F',  10,15,'arrow-brooke','h-s56', true,  null, false],
  ['s57','Ibrahim','T',12,17,'paloma-creek','h-s57', true,  null, false],
  ['s58','Wren','A',    9,14,'providence',  'h-s58', true,  null, false],
  ['s59','Bianca','O', 11,16,'winn-ridge',  'h-okafor', true, 'provisional_teen', true], // Nia's sister
  ['s60','Trey','S',   11,16,'savannah',    'h-sanders', true, 'provisional_teen', true], // Sofia's brother
];

// PARENT COLUMNS: id, firstName, lastInitial, neighborhoodId, householdId, childIds
// prettier-ignore
const PARENT_ROWS = [
  ['p01','Dana','M',   'savannah',    'h-moreau',  ['s19','s50']],
  ['p02','Luis','R',   'paloma-creek','h-ramos',   ['s05']],
  ['p03','Renee','B',  'providence',  'h-bell',    ['s09']],
  ['p04','Mark','O',   'winn-ridge',  'h-okafor',  ['s13','s37','s59']],
  ['p05','Angela','K', 'union-park',  'h-kaur',    ['s16']],
  ['p06','Chris','V',  'silverado',   'h-vega',    ['s31']],
  ['p07','Nicole','S', 'savannah',    'h-sanders', ['s20','s60']],
  ['p08','Hector','G', 'paloma-creek','h-garza',   ['s22']],
  ['p09','Tara','L',   'providence',  'h-lund',    ['s26']],
  ['p10','Olivia','D', 'winn-ridge',  'h-dumont',  ['s28','s53']],
];

/* ---------------------------------------------------------------------------
   CHAPERONES — adults who are not a parent of anyone on the roster, but who
   travel with the group and can be asked to drive. They are ordinary adult
   drivers as far as the law is concerned: no passenger-age limit, no curfew.
   COLUMNS: id, firstName, lastInitial, neighborhoodId, seats
--------------------------------------------------------------------------- */
// prettier-ignore
const CHAPERONE_ROWS = [
  ['c-rivera', 'Coach', 'Rivera', 'providence', 4],
];

// ORGANIZER COLUMNS: id, firstName, lastInitial, activityId
// prettier-ignore
const ORGANIZER_ROWS = [
  ['o-moreno','Mr.','Moreno','band'],
  ['o-pham','Coach','Pham','volleyball'],
  ['o-ellis','Ms.','Ellis','theater'],
  ['o-kaur','Mr.','Kaur','robotics'],
  ['o-boone','Coach','Boone','xc'],
];


/* ===========================================================================
   CARS — what each driver actually shows up in.
   ===========================================================================
   Display only. The matching algorithm never reads these: capacity comes from
   the `seats` on a ride offer, because a seven-seater with four people
   already in it has three seats, not seven.

   A rider waiting in a dark parking lot is looking for a colour and a shape,
   so the ride card says "Silver Honda Odyssey" next to the handoff code.
   COLUMNS: personId -> [colour, model]
=========================================================================== */
// prettier-ignore
const CARS = {
  // Parents
  p01: ['Silver',  'Honda Odyssey'],
  p02: ['White',   'Toyota Sienna'],
  p03: ['Dark Blue','Chevrolet Tahoe'],
  p04: ['Gray',    'Toyota Highlander'],
  p05: ['Black',   'Ford Explorer'],
  p06: ['Red',     'Honda CR-V'],
  p07: ['White',   'Kia Carnival'],
  p08: ['Silver',  'Toyota Sienna'],
  p09: ['Beige',   'Subaru Outback'],
  p10: ['Dark Gray','Nissan Rogue'],
  // Fully licensed seniors
  s51: ['White',   'Toyota RAV4'],
  s52: ['Black',   'Honda Civic'],
  s53: ['Blue',    'Ford Escape'],
  // Chaperone
  'c-rivera': ['White', 'Chevrolet Tahoe'],
  // Teens in their first 12 months
  s54: ['Silver',  'Toyota Corolla'],
  s59: ['Red',     'Hyundai Elantra'],
  s60: ['Gray',    'Honda Accord'],
};

/** Expand the compact tables above into the object shape the app uses. */
export const PEOPLE = [
  ...STUDENT_ROWS.map(([id, firstName, lastInitial, grade, age, neighborhoodId, householdId, approved, driverKind, provisionalUnder12Months]) => ({
    id, role: 'student', firstName, lastInitial, grade, age,
    neighborhoodId, householdId, approved,
    driverKind, provisionalUnder12Months,
    carColor: CARS[id] ? CARS[id][0] : null,
    carModel: CARS[id] ? CARS[id][1] : null,
  })),
  ...PARENT_ROWS.map(([id, firstName, lastInitial, neighborhoodId, householdId, childIds]) => ({
    id, role: 'parent', firstName, lastInitial,
    age: 44, // adults are over the passenger-age limit; the exact number never matters
    neighborhoodId, householdId, approved: true,
    driverKind: 'parent', provisionalUnder12Months: false,
    carColor: CARS[id] ? CARS[id][0] : null,
    carModel: CARS[id] ? CARS[id][1] : null,
    childIds,
  })),
  ...CHAPERONE_ROWS.map(([id, firstName, lastInitial, neighborhoodId, seats]) => ({
    id, role: 'chaperone', firstName, lastInitial,
    age: 38, // an adult, so no passenger-age limit applies to their car
    neighborhoodId, householdId: `h-${id}`, approved: true,
    driverKind: 'parent', provisionalUnder12Months: false,
    chaperoneSeats: seats,
    carColor: CARS[id] ? CARS[id][0] : null,
    carModel: CARS[id] ? CARS[id][1] : null,
  })),
  ...ORGANIZER_ROWS.map(([id, firstName, lastInitial, activityId]) => ({
    id, role: 'organizer', firstName, lastInitial, age: 40,
    neighborhoodId: null, householdId: `h-${id}`, approved: true,
    driverKind: null, provisionalUnder12Months: false, activityId,
  })),
];


/* ===========================================================================
   MEMBERSHIPS — who is on which roster, and in which group.
   Kept separate from PEOPLE so one student can be in two activities. Eight of
   the 60 students are, which is exactly the situation AfterBell is built for.
   COLUMNS: studentId, activityId, group
=========================================================================== */
// prettier-ignore
export const MEMBERSHIPS = [
  // Marching Band (34)
  ['s01','band','Woodwinds'],    ['s02','band','Trumpets'],     ['s03','band','Color Guard'],
  ['s04','band','Percussion'],   ['s05','band','Woodwinds'],    ['s06','band','Low Brass'],
  ['s07','band','Mellophones'],  ['s08','band','Trumpets'],     ['s09','band','Low Brass'],
  ['s10','band','Woodwinds'],    ['s11','band','Percussion'],   ['s12','band','Color Guard'],
  ['s13','band','Trumpets'],     ['s14','band','Woodwinds'],    ['s15','band','Low Brass'],
  ['s16','band','Mellophones'],  ['s17','band','Percussion'],   ['s18','band','Woodwinds'],
  ['s19','band','Trumpets'],     ['s20','band','Woodwinds'],    ['s21','band','Low Brass'],
  ['s22','band','Color Guard'],  ['s23','band','Trumpets'],     ['s24','band','Mellophones'],
  ['s25','band','Percussion'],   ['s26','band','Woodwinds'],    ['s27','band','Low Brass'],
  ['s28','band','Percussion'],   ['s29','band','Trumpets'],     ['s30','band','Woodwinds'],
  ['s31','band','Mellophones'],  ['s32','band','Color Guard'],  ['s33','band','Trumpets'],
  ['s34','band','Percussion'],

  // Volleyball (10)
  ['s35','volleyball','Outside Hitter'], ['s36','volleyball','Setter'],
  ['s37','volleyball','Middle Blocker'], ['s38','volleyball','Libero'],
  ['s39','volleyball','Right Side'],     ['s40','volleyball','Outside Hitter'],
  ['s41','volleyball','Setter'],         ['s42','volleyball','Middle Blocker'],
  ['s43','volleyball','Libero'],         ['s44','volleyball','Right Side'],

  // Theater (9)
  ['s45','theater','Cast'], ['s46','theater','Cast'], ['s47','theater','Crew'],
  ['s48','theater','Cast'], ['s49','theater','Tech'], ['s50','theater','Crew'],
  ['s51','theater','Cast'], ['s52','theater','Tech'], ['s54','theater','Crew'],

  // Robotics (7)
  ['s53','robotics','Build'],       ['s55','robotics','Programming'],
  ['s56','robotics','Build'],       ['s57','robotics','Drive Team'],
  ['s58','robotics','Scouting'],    ['s59','robotics','Programming'],
  ['s60','robotics','Drive Team'],

  // Cross Country (8) — every one of these students is ALSO in theater or
  // robotics. These are the students who make cross-activity matching matter.
  ['s46','xc','Varsity'], ['s47','xc','Varsity'], ['s48','xc','JV'], ['s49','xc','JV'],
  ['s55','xc','Varsity'], ['s56','xc','JV'],      ['s57','xc','Varsity'], ['s58','xc','JV'],
];


/* ===========================================================================
   EVENTS — one week, Monday Oct 26 through Saturday Oct 31, 2026.
   ===========================================================================
   Each event carries exactly one trip, because that is the trip students in
   this demo actually struggle with. (The band rides a charter bus TO the
   Saturday contest; the problem is the 11:30 p.m. drop-off back at school.)

   FIELDS
     direction ....... 'to'   = everyone is heading to the place
                       'from' = everyone is heading home from the place
     destinationId ... the shared endpoint. This plus direction plus time is
                       the bucket key in the algorithm. The ACTIVITY is not
                       part of that key, which is what lets a volleyball
                       player and a theater kid share a car.
     rideTimeISO ..... when the car meets. Local wall-clock time.
     needsRide ....... roster members who need AfterBell for this event.
                       Anyone on the roster but not in this list already has
                       their own ride, and counts as covered.
=========================================================================== */
export const EVENTS = [
  {
    id: 'e-band-mon',
    activityId: 'band',
    title: 'Early rehearsal',
    detail: '6:15 a.m. call on the practice field',
    where: 'Ray Braswell HS',
    startISO: '2026-10-26T06:15',
    endISO: '2026-10-26T07:40',
    direction: 'to',
    destinationId: 'school',
    rideTimeISO: '2026-10-26T05:45',
    needsRide: ['s13', 's14', 's19', 's20', 's22', 's26', 's27'],
  },
  {
    id: 'e-xc-tue',
    activityId: 'xc',
    title: 'Practice ends',
    detail: 'Long run, back at the field house by 5:55',
    where: 'Ray Braswell HS',
    startISO: '2026-10-27T16:15',
    endISO: '2026-10-27T17:55',
    direction: 'from',
    destinationId: 'school',
    rideTimeISO: '2026-10-27T17:55',
    needsRide: ['s48', 's49'],
  },
  {
    id: 'e-vball-tue',
    activityId: 'volleyball',
    title: 'Practice ends',
    detail: 'Main gym',
    where: 'Ray Braswell HS',
    startISO: '2026-10-27T16:30',
    endISO: '2026-10-27T18:00',
    direction: 'from',
    destinationId: 'school',
    rideTimeISO: '2026-10-27T18:00',
    needsRide: ['s35', 's38'],
  },
  {
    id: 'e-theater-tue',
    activityId: 'theater',
    title: 'Fall play rehearsal ends',
    detail: 'Act II blocking, auditorium',
    where: 'Ray Braswell HS',
    startISO: '2026-10-27T16:00',
    endISO: '2026-10-27T18:10',
    direction: 'from',
    destinationId: 'school',
    rideTimeISO: '2026-10-27T18:10',
    needsRide: ['s45', 's46'],
  },
  {
    id: 'e-robotics-wed',
    activityId: 'robotics',
    title: 'Build night ends',
    detail: 'Chassis needs to be done before the district meet',
    where: 'Ray Braswell HS',
    startISO: '2026-10-28T16:30',
    endISO: '2026-10-28T19:30',
    direction: 'from',
    destinationId: 'school',
    rideTimeISO: '2026-10-28T19:30',
    needsRide: ['s55', 's56', 's57'],
  },
  {
    id: 'e-vball-thu',
    activityId: 'volleyball',
    title: 'Away game at Little Elm',
    detail: 'JV at 5:30, varsity at 6:30',
    where: 'Little Elm HS',
    startISO: '2026-10-29T17:30',
    endISO: '2026-10-29T20:30',
    direction: 'to',
    destinationId: 'little-elm',
    rideTimeISO: '2026-10-29T17:00',
    needsRide: ['s35', 's36', 's37', 's38', 's39', 's40', 's41', 's42', 's43', 's44'],
  },
  {
    id: 'e-xc-fri',
    activityId: 'xc',
    title: 'District meet',
    detail: 'First gun at 7:30 a.m.',
    where: 'North Lakes Park, Denton',
    startISO: '2026-10-30T07:30',
    endISO: '2026-10-30T11:00',
    direction: 'to',
    destinationId: 'north-lakes',
    rideTimeISO: '2026-10-30T06:00',
    needsRide: ['s48', 's49', 's55', 's56'],
  },
  {
    id: 'e-band-sat',
    activityId: 'band',
    title: 'UIL Area Marching Contest — ride home',
    detail: 'Contest at Pennington Field, Bedford. Buses get back to Braswell at 11:30 p.m.',
    where: 'Ray Braswell HS (bus drop-off)',
    startISO: '2026-10-31T12:00',
    endISO: '2026-10-31T23:30',
    direction: 'from',
    destinationId: 'school',
    rideTimeISO: '2026-10-31T23:30',
    // The whole band needs a ride home from this one. This is the event the
    // "Fill the Gaps" demo runs on.
    needsRide: [
      's01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12',
      's13','s14','s15','s16','s17','s18','s19','s20','s21','s22','s23','s24',
      's25','s26','s27','s28','s29','s30','s31','s32','s33','s34',
    ],
  },
];


/* ===========================================================================
   RIDE OFFERS — "I have N open seats on this trip."
   ===========================================================================
   An offer is attached to a TRIP, not to an activity. A theater senior can
   offer seats on the band's trip home, and the algorithm will use them. That
   is the point: seats are a school-wide resource.

   COLUMNS: id, driverId, eventId, seats, note
   (direction / destination / time / neighborhood are copied off the event and
    the driver by buildSeedState below, so they can never drift apart.)
=========================================================================== */
// prettier-ignore
const OFFER_ROWS = [
  // --- Monday, 5:45 a.m. to school --------------------------------------
  ['of-mon-p04','p04','e-band-mon', 2, 'Already taking Micah, room for one more'],
  ['of-mon-p09','p09','e-band-mon', 3, 'Heading in early anyway'],
  ['of-mon-s60','s60','e-band-mon', 2, 'Taking my sister, can grab one friend'],

  // --- Tuesday evening, 5:55-6:10 p.m. home from school -----------------
  // These two offers are what the cross-activity demo runs on.
  ['of-tue-p01','p01','e-vball-tue', 4, 'Minivan, four open'],
  ['of-tue-p09','p09','e-xc-tue',    2, 'Picking up Tessa, two spare seats'],

  // --- Wednesday: nobody has offered. This is a real state, not a bug. ---

  // --- Thursday, 5:00 p.m. to Little Elm HS -----------------------------
  ['of-thu-p07','p07','e-vball-thu', 2, 'Going to the game anyway'],
  ['of-thu-p03','p03','e-vball-thu', 2, 'Full already'],
  ['of-thu-p02','p02','e-vball-thu', 2, 'Full already'],
  ['of-thu-s59','s59','e-vball-thu', 3, 'Three seats, but I just got my license'],

  // --- Friday, 6:00 a.m. to the XC meet ---------------------------------
  ['of-fri-p09','p09','e-xc-fri',  2, 'Full already'],
  ['of-fri-p10','p10','e-xc-fri',  2, 'Happy to help if anyone is close by'],
  ['of-fri-s51','s51','e-xc-fri',  2, 'Two seats'],

  // --- Saturday, 11:30 p.m. home from the contest -----------------------
  // Five cars are already full (parents who claimed seats when the trip was
  // posted) and seven have room. The provisional teen's three seats are the
  // interesting case: curfew makes all three unusable.
  ['of-sat-p01','p01','e-band-sat', 4, 'Full already'],
  ['of-sat-p02','p02','e-band-sat', 4, 'Full already'],
  ['of-sat-p03','p03','e-band-sat', 4, 'Full already'],
  ['of-sat-p04','p04','e-band-sat', 3, 'Full already'],
  ['of-sat-p05','p05','e-band-sat', 3, 'Full already'],
  ['of-sat-p07','p07','e-band-sat', 3, 'Three open, Savannah and nearby'],
  ['of-sat-p08','p08','e-band-sat', 4, 'Four open, happy to do two trips'],
  ['of-sat-p09','p09','e-band-sat', 3, 'Three open'],
  ['of-sat-p06','p06','e-band-sat', 2, 'Two open'],
  ['of-sat-s53','s53','e-band-sat', 2, 'Picking up my sister, two more fit'],
  ['of-sat-s52','s52','e-band-sat', 3, 'Three open'],
  ['of-sat-s54','s54','e-band-sat', 3, 'Three open'],
  // Held back from the automatic run on purpose: a chaperone's car is
  // something the director decides to use, not something the matcher spends.
  ['of-sat-rivera','c-rivera','e-band-sat', 4, 'Chaperone — assign by hand'],
];


/* ===========================================================================
   RIDE REQUESTS — "I need a ride on this trip."
   COLUMNS: studentId, eventId, status
     status 'assigned' = already in a car (see SEEDED_RIDES below)
            'pending'  = waiting for a match. These are the ones Fill the Gaps
                         works on.
=========================================================================== */
// prettier-ignore
const REQUEST_ROWS = [
  // Monday early rehearsal
  ['s13','e-band-mon','assigned'], ['s14','e-band-mon','assigned'],
  ['s19','e-band-mon','assigned'], ['s20','e-band-mon','pending'],
  ['s22','e-band-mon','pending'],  ['s26','e-band-mon','pending'],
  ['s27','e-band-mon','pending'],

  // Tuesday evening — three different activities, one 15-minute window
  ['s48','e-xc-tue','pending'],      ['s49','e-xc-tue','pending'],
  ['s35','e-vball-tue','pending'],   ['s38','e-vball-tue','pending'],
  ['s45','e-theater-tue','pending'], ['s46','e-theater-tue','pending'],

  // Wednesday robotics — requests exist, but nobody has offered seats
  ['s55','e-robotics-wed','pending'], ['s56','e-robotics-wed','pending'],
  ['s57','e-robotics-wed','pending'],

  // Thursday away game
  ['s41','e-vball-thu','assigned'], ['s42','e-vball-thu','assigned'],
  ['s43','e-vball-thu','assigned'], ['s44','e-vball-thu','assigned'],
  ['s35','e-vball-thu','pending'],  ['s36','e-vball-thu','pending'],
  ['s37','e-vball-thu','pending'],  ['s38','e-vball-thu','pending'],
  ['s39','e-vball-thu','pending'],  ['s40','e-vball-thu','pending'],

  // Friday XC meet
  ['s48','e-xc-fri','assigned'], ['s49','e-xc-fri','assigned'],
  ['s55','e-xc-fri','pending'],  ['s56','e-xc-fri','pending'],

  // Saturday contest, ride home at 11:30 p.m.
  // 18 already in a car, 16 still waiting. Fill the Gaps seats 14 of the 16.
  ['s01','e-band-sat','assigned'], ['s02','e-band-sat','assigned'],
  ['s03','e-band-sat','assigned'], ['s04','e-band-sat','assigned'],
  ['s05','e-band-sat','assigned'], ['s06','e-band-sat','assigned'],
  ['s07','e-band-sat','assigned'], ['s08','e-band-sat','assigned'],
  ['s09','e-band-sat','assigned'], ['s10','e-band-sat','assigned'],
  ['s11','e-band-sat','assigned'], ['s12','e-band-sat','assigned'],
  ['s13','e-band-sat','assigned'], ['s14','e-band-sat','assigned'],
  ['s15','e-band-sat','assigned'], ['s16','e-band-sat','assigned'],
  ['s17','e-band-sat','assigned'], ['s18','e-band-sat','assigned'],
  ['s19','e-band-sat','pending'],  ['s20','e-band-sat','pending'],
  ['s21','e-band-sat','pending'],  ['s22','e-band-sat','pending'],
  ['s23','e-band-sat','pending'],  ['s24','e-band-sat','pending'],
  ['s25','e-band-sat','pending'],  ['s26','e-band-sat','pending'],
  ['s27','e-band-sat','pending'],  ['s28','e-band-sat','pending'],
  ['s29','e-band-sat','pending'],  ['s30','e-band-sat','pending'],
  ['s31','e-band-sat','pending'],  ['s32','e-band-sat','pending'],
  ['s33','e-band-sat','pending'],  ['s34','e-band-sat','pending'],
];


/* ===========================================================================
   SEEDED RIDES — cars that already exist before Fill the Gaps runs.
   These are the "assigned" requests above, grouped into their cars.
   COLUMNS: offerId, riderIds
=========================================================================== */
// prettier-ignore
const SEEDED_RIDE_ROWS = [
  ['of-mon-p04', ['s13','s14']],
  // Trey already has Jalen in the car. One seat left, and his sister Sofia is
  // still waiting for it — which is also how the demo shows that a sibling
  // does not count against the provisional-license passenger limit.
  ['of-mon-s60', ['s19']],

  ['of-thu-p03', ['s41','s42']],
  ['of-thu-p02', ['s43','s44']],

  ['of-fri-p09', ['s48','s49']],

  ['of-sat-p01', ['s01','s02','s03','s04']],
  ['of-sat-p02', ['s05','s06','s07','s08']],
  ['of-sat-p03', ['s09','s10','s11','s12']],
  ['of-sat-p04', ['s13','s14','s15']],
  ['of-sat-p05', ['s16','s17','s18']],
];


/* ===========================================================================
   buildSeedState()
   ===========================================================================
   Assembles one plain object that the whole app reads from, and returns a
   FRESH copy every time it is called. That is what makes the "Reset demo"
   button work: it just throws the old object away and asks for a new one.

   This is also where offers and requests inherit direction / destination /
   time from their event, and the driver's neighborhood from the driver. Those
   fields are never typed twice, so a demo can't get into a state where an
   offer says 6:00 and its event says 6:10.
=========================================================================== */
export function buildSeedState() {
  const eventsById = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
  const peopleById = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

  const offers = OFFER_ROWS.map(([id, driverId, eventId, seats, note]) => {
    const event = eventsById[eventId];
    return {
      id, driverId, eventId, seats, note,
      // The matcher never spends a chaperone's seats; an organizer assigns
      // them deliberately from the unmatched list.
      manualOnly: peopleById[driverId].role === 'chaperone',
      direction: event.direction,
      destinationId: event.destinationId,
      timeISO: event.rideTimeISO,
      neighborhoodId: peopleById[driverId].neighborhoodId,
    };
  });

  const requests = REQUEST_ROWS.map(([studentId, eventId, status]) => {
    const event = eventsById[eventId];
    return {
      id: `rq-${eventId}-${studentId}`,
      studentId, eventId, status,
      // The activity is carried for DISPLAY only — so a car can be labeled
      // "Volleyball / Theater / Cross Country". The matcher never reads it.
      activityId: event.activityId,
      direction: event.direction,
      destinationId: event.destinationId,
      timeISO: event.rideTimeISO,
      neighborhoodId: peopleById[studentId].neighborhoodId,
    };
  });

  const rides = SEEDED_RIDE_ROWS.map(([offerId, riderIds]) => {
    const offer = offers.find((o) => o.id === offerId);
    return {
      id: `ride-${offerId}`,
      offerId,
      driverId: offer.driverId,
      eventId: offer.eventId,
      riderIds: [...riderIds],
      // Which request each rider is riding on, so a student's event row and
      // their ride card always agree.
      requestIds: riderIds.map((sid) => `rq-${offer.eventId}-${sid}`),
      pickedUp: false,
      matchedBy: 'seed', // 'seed' or 'fill-the-gaps'
    };
  });

  return {
    neighborhoods: NEIGHBORHOODS.map((n) => ({ ...n })),
    places: PLACES.map((p) => ({ ...p })),
    activities: ACTIVITIES.map((a) => ({ ...a, groups: [...a.groups] })),
    people: PEOPLE.map((p) => ({ ...p })),
    memberships: MEMBERSHIPS.map(([studentId, activityId, group]) => ({ studentId, activityId, group })),
    events: EVENTS.map((e) => ({ ...e, needsRide: [...e.needsRide] })),
    offers,
    requests,
    rides,
    // Settings the organizer can change on the dashboard.
    settings: { timeWindowMinutes: 15, maxDetourMiles: 3 },
  };
}

/* ===========================================================================
   DEMO ACCOUNTS — who each role tab signs you in as.
=========================================================================== */
export const DEMO_ACCOUNTS = {
  student:   { id: 's19', label: 'Student',     caption: 'Jalen M., 11th grade — Marching Band, trumpets' },
  parent:    { id: 'p01', label: 'Parent',      caption: 'Dana M. — parent of Jalen and Aaliyah' },
  driver:    { id: 's59', label: 'Teen driver', caption: 'Bianca O., 11th grade — license is 4 months old' },
  organizer: { id: 'o-moreno', label: 'Organizer', caption: 'Mr. Moreno — Director of Bands' },
};
