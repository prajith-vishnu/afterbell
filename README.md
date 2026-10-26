<img src="brand/afterbell-logo.svg" alt="AfterBell — by Prajith Vishnu" width="340">

**Every spot filled.**

A ride-matching web app for students at Ray Braswell High School, Denton ISD.
Built for the Congressional App Challenge.

**[Open the live app](https://prajith-vishnu.github.io/afterbell/)** — press
**Try the demo** on the welcome screen to use it with a week of sample
students, no sign-up.

---

## The problem

At a big suburban high school, the hardest part of being in an activity often
isn't the activity. It's getting there.

Marching band calls at 6:15 a.m. The volleyball team leaves for an away game at
5:00 p.m. on a school night. The fall play rehearses until 6:10. The UIL contest
bus gets back at 11:30 at night. School buses don't cover any of it, and not
every family has an adult free to drive at those hours.

When one person can't get a ride, it isn't one person's problem. A marching band
drill is a geometric formation — one missing player leaves a visible hole in the
field for the entire show. A volleyball team plays short. A cast rehearses
without its lead. **The cost of a missing ride is paid by the whole group.**

Here's the part nobody notices: the students who could solve this for each other
are already standing outside the same door. Volleyball practice ends at 6:00.
Theater rehearsal ends at 6:10. Cross country gets back at 5:55. Three coaches,
three group chats, three separate problems — and four students from the same two
neighborhoods, fifteen minutes apart, all needing to get home.

Nobody puts them in the same car, because no one is looking at the same list.

## What AfterBell does

AfterBell groups ride requests by **where the car meets**, **which direction
it's going**, and **when** — and deliberately *not* by activity. That one
decision is the whole product.

## Trying the demo

The app has no accounts yet, so everything runs on a built-in week of sample
students. Press **Try the demo** on the welcome screen and you are in.

Once you are in, a **Demo data** bar sits at the top of every screen with:

- a **role switcher** — Student, Parent, Driver and Organizer (the director
  view). Switching role is the same as signing in as that person;
- a **Reset demo** button, which puts the sample week back exactly as it
  started. Nothing you do in the demo is permanent, so click freely.

### See Fill the Gaps work, in four steps

1. Switch to **Organizer** (Mr. Moreno, Director of Bands).
2. In **Which trip**, choose **SAT 10/31 6:00a — UIL Area Morning Rehearsal**.
   The dial reads **7 of 34 have rides**.
3. Press **Fill the Gaps**. It climbs to **32 of 34**, the ticks fill in the
   order the algorithm seated people, and a *What just happened* card says:
   *Seated 25 students from your roster into 9 cars. It put 7 students from
   Volleyball in those same cars.* Those 7 are the point — they are not on the
   band roster, and nothing else would have put them in these cars.
4. Switch to **Student** (Marcus T., trumpets). He had no ride a moment ago;
   now he is in **Lisa L.'s** car with **Jada W.** — a volleyball parent
   driving a band kid, because they live in the same neighborhood and leave
   within fifteen minutes of each other. Open the ride card to see the handoff
   code.

Also worth a look: **Coach Rivera**, the chaperone with four seats, appears on
the organizer's *assign a driver* list for the students the algorithm will not
seat by law — the human override for when the rules run out.

### Features

- **Request a ride** for any event you're on the roster for.
- **Offer seats** as a parent or a licensed student driver.
- **Fill the Gaps** — an organizer presses one button and the matcher builds
  cars for everyone waiting on that trip, across every activity.
- **Readiness dial** — one tick per roster member, so a director can see at a
  glance how many of their students can actually get there.
- **Plain-English explanations** for every student the algorithm couldn't seat,
  naming the rule that stopped it.
- **Assign an adult driver** by hand when the algorithm runs out of legal
  options — the organizer's override, with seat counts still enforced.
- **Handoff codes** — a 3-digit number the rider and the driver both see, so a
  student never gets into the wrong car.
- **Export ride plan** — a CSV of the whole trip, including the students with no
  ride and the reason, so the plan never quietly drops them.
- **Parent approval** — a student can't request or accept a ride until a parent
  approves their account.
- **Cross-activity view** — the cars carrying students from more than one
  activity, which is the thing nothing else does.

## How the matching algorithm works

All of it lives in [`js/matching.js`](js/matching.js), which imports nothing —
no framework, no Firebase, no network — so it can be tested on its own.

**Step 1 — Bucket.** Every ride request goes into a group based on three things:
the shared endpoint, the direction, and the time (requests within 15 minutes of
each other count as the same trip). The activity is deliberately not part of
that key. That's what lets a volleyball player and a theater kid share a car.

**Step 2 — Cluster by neighborhood.** Every neighborhood has one approximate
center point, and distances between them come from the haversine formula — the
great-circle distance between two points on a sphere. No maps API, and no home
addresses: a neighborhood name is as precise as this app ever gets.

**Step 3 — Assign.** For each driver, fill their open seats with the nearest
unassigned riders, stopping for four rules:

1. **Seat capacity** — a car never holds more people than it has seats.
2. **Texas provisional passenger limit** — a teen in their first 12 months of
   licensure may carry at most **one** passenger under 21 who isn't a family
   member. Siblings don't count against the limit.
3. **Texas provisional curfew** — a driver in their first 12 months can't be
   given a trip between midnight and 5 a.m. The check covers the whole drive,
   so an 11:30 p.m. pickup that lands at 12:15 a.m. is correctly refused.
4. **Maximum detour** — 3 miles by default, between neighborhood centers.

**Step 4 — Explain.** Return the assignments *and* every student still without
a ride, each with a sentence an organizer can act on. Not an error code —
something like *"The only driver near Sandbrock Ranch is a teen in their first
year of driving, and this trip runs past midnight."* That tells the director
exactly what to go find: one adult driver on the north side.

### Why it's deterministic

There is no randomness and no scoring function anywhere. Same input, same
output, every time. Every tie is broken by an explicit rule:

- **Drivers** are tried unrestricted-first (parents and fully licensed seniors),
  then by most open seats, then alphabetically by id.
- **Riders** are picked nearest-neighborhood-first, then alphabetically.

Unrestricted drivers go first because a brand-new teen driver has exactly one
legal seat for a non-family passenger. That seat is the scarcest resource in the
system, so it gets spent last.

## Privacy by design

- **No home address is stored anywhere.** There is no field for one in the data
  model, so there is nothing finer than a neighborhood to leak even by accident.
- A student's location is a **neighborhood name** and nothing more precise.
- Names are stored and displayed as a **first name plus a last initial**. The
  full last name is never collected.
- A **household id**, not an address, is what tells a sibling apart from a
  friend for the Texas passenger rule.
- Map views plot **neighborhood centers and public places only**. Route lines
  are straight lines between those centers — a diagram of who is grouped with
  whom, not directions to anyone's door.
- **Delete my account and data** really deletes: ride requests, seat offers,
  cars, roster memberships and notifications all go.

## Safety

Privacy is only half of it. The rest is who is allowed to drive whom.

- **A parent has to approve a student's account** before that student can
  request or accept a ride. The check sits in `state.js`, so an unapproved
  student cannot create a request at all and can never be matched into a car.
- **Only parents and staff can offer seats** in the sample data, and the
  matcher applies the Texas provisional-licence rules to any teen driver: at
  most one non-family passenger under 21 in their first 12 months, and no trip
  between midnight and 5 a.m. The curfew check covers the **whole drive**, so
  an 11:30 p.m. pickup landing at 12:15 a.m. is refused.
- **Handoff codes.** Rider and driver each see the same 3-digit number. If it
  does not match, it is not your car. The app says exactly that on the card.
- **Nobody is quietly dropped.** Every student the algorithm cannot seat comes
  back with a sentence naming the rule that stopped it, and they stay on the
  exported ride plan with that reason attached.
- **A human can always override.** When the rules run out of legal options, the
  organizer can assign an adult driver by hand. That override skips the detour
  preference but still enforces seat counts and the licence rules, because
  those are law rather than preference.

## Tech stack

- **Plain HTML, CSS and JavaScript** (ES modules). No framework, no build step,
  no bundler. You can read any file top to bottom.
- **Leaflet** with **OpenStreetMap** tiles for the maps. No API key.
- **Lucide** for icons.
- **Plus Jakarta Sans** from Google Fonts.
- **Firebase** (Authentication, Firestore, Hosting) — planned for Stage 2.
  Stage 1 runs entirely on local sample data: there is no Firebase project, no
  SDK, no config and no API key anywhere in this repository.

Everything is pinned to an exact version and loaded from a public CDN. Nothing
here needs an API key, and the app makes no network calls of its own — the only
requests a browser makes are the font, the icon library, Leaflet, and
OpenStreetMap map tiles.

### Credits

- [**Leaflet**](https://leafletjs.com) 1.9.4 — BSD 2-Clause.
- [**OpenStreetMap**](https://www.openstreetmap.org/copyright) map tiles — map
  data © OpenStreetMap contributors, ODbL. Tiles are attributed in-app.
- [**Lucide**](https://lucide.dev) 0.460.0 icons — ISC.
- [**Plus Jakarta Sans**](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
  — SIL Open Font License 1.1.

No third-party UI kit or template was used. The screens, the colour system and
every component class in `css/app.css` were written for this project.

### AI use

I used AI tools (Claude) while building AfterBell, under my direction. I decided
what the app should do, how the matching should work, which rules it had to
respect, and what every screen should say; I used AI as a coding assistant to
help write and refactor the code, talk through approaches, and check my work.
The Texas provisional-licence rules, the privacy design, the sample data and the
product decisions are mine, and I have read and understood every file in this
repository.

### Project layout

| File | What it is |
| --- | --- |
| `js/matching.js` | The algorithm. Pure, dependency-free, tested. |
| `js/matching.test.js` | 31 tests. Run in a browser or with Node. |
| `js/seed.js` | All sample data: people, neighborhoods, events, offers. |
| `js/state.js` | The only place data changes. Stage 2 swaps this for Firestore. |
| `js/screens.js` | One function per screen, each returning HTML. |
| `js/app.js` | Router, bottom tab bar, and every button. |
| `js/map.js` | Leaflet setup and the map markers. |
| `js/export.js` | The ride-plan CSV. |
| `js/notifications.js` | The Rides tab, built from real app events. |
| `js/view.js` | What the viewer is currently looking at. Never ride data. |

## Running it

ES modules won't load from `file://`, so you need a local server:

```bash
cd "Congressional APP Challenge"
python3 -m http.server 8000
```

Then open **http://localhost:8000**.

| URL | What you get |
| --- | --- |
| `/` | The app. Press **Try the demo**, then use the role chips at the top. |
| `/?role=organizer` | A shortcut straight into one role of the demo. |
| `/tests.html` | The algorithm test suite, run in the browser. |

Run the tests from a terminal instead:

```bash
node js/matching.test.js
```

## Deploying

### Option A — GitHub Pages (this is what is live now)

AfterBell is already deployed this way, from the `main` branch at the repository
root, and serves at
<https://prajith-vishnu.github.io/afterbell/>.

Everything here is static — no build step, no bundler — so **publishing an
update is just a push**:

```bash
git add -A
git commit -m "Describe the change"
git push
```

Pages rebuilds in about a minute. To set this up again from scratch on another
account: push the project, then **Settings → Pages → Source → Deploy from a
branch**, branch `main`, folder `/ (root)`, and **Save**.

### Option B — Firebase Hosting

1. Install the CLI (one time):
   ```bash
   npm install -g firebase-tools
   ```
2. Sign in:
   ```bash
   firebase login
   ```
3. Create a project at <https://console.firebase.google.com> → **Add project**.
   Name it `afterbell`, and you can turn Google Analytics off.
4. In the project folder:
   ```bash
   firebase init hosting
   ```
   Answer:
   - **Use an existing project** → pick `afterbell`
   - **Public directory** → type `.` (a single dot — the app is at the root)
   - **Configure as a single-page app?** → **No**
   - **Set up automatic builds with GitHub?** → **No**
   - **Overwrite index.html?** → **No** (this matters — say no)
5. Deploy:
   ```bash
   firebase deploy --only hosting
   ```
6. The CLI prints your live URL, something like
   `https://afterbell.web.app`.

To update the site later, just run `firebase deploy --only hosting` again.

## Placeholder coordinates

Every coordinate in the app is an **eyeballed centre point**, not a surveyed
one, and each is still marked `PLACEHOLDER` in the source. They only ever get
compared against each other ("is Savannah closer to Paloma Creek than to Oak
Point?"), never navigated to, so they do not need to be exact — but they are
worth a check. `grep -rn PLACEHOLDER .` finds all sixteen.

**13 neighbourhood centres** in [`js/seed.js`](js/seed.js):

| Neighbourhood | lat | lng |
| --- | --- | --- |
| Savannah | 33.2546 | -96.9230 |
| Paloma Creek | 33.2470 | -96.9690 |
| Paloma Creek South | 33.2385 | -96.9705 |
| Providence Village | 33.2365 | -96.9480 |
| Winn Ridge | 33.2290 | -96.9265 |
| Union Park | 33.2240 | -96.9800 |
| Sandbrock Ranch | 33.3065 | -96.9900 |
| Arrow Brooke | 33.2900 | -96.9710 |
| Silverado | 33.2795 | -96.9450 |
| Cross Oak Ranch | 33.2160 | -96.9880 |
| Aubrey | 33.3040 | -96.9860 |
| Oak Point | 33.1870 | -96.9920 |
| Lakewood Village | 33.1600 | -96.9700 |

**3 endpoint coordinates** in [`js/map.js`](js/map.js):

| Place | lat | lng |
| --- | --- | --- |
| Ray Braswell HS | 33.2614 | -96.9469 |
| Little Elm HS | 33.1700 | -96.9350 |
| North Lakes Park, Denton | 33.2290 | -97.1500 |

To correct one: open a map, drop a pin roughly in the middle, copy the two
numbers over the old ones and delete the `PLACEHOLDER` comment. Nothing else
has to change. For scale, around here 0.01 degrees of latitude is about
0.69 miles and 0.01 degrees of longitude is about 0.58 miles.

## Brand

The mark is a map pin with a school bell cut out of it as negative space — the
two halves of what this app does, in one shape. It is drawn as a single flat
path with `fill-rule="evenodd"`, so the bell is the pin's own colour showing
through rather than a second shape stacked on top. No gradients, no shadows,
no 3D. Orange `#FF6A13`, text in `#1A1A1A`.

| File | What it is |
| --- | --- |
| [`brand/afterbell-logo.svg`](brand/afterbell-logo.svg) | Full logo: mark, wordmark, byline |
| [`brand/afterbell-logo-dark.svg`](brand/afterbell-logo-dark.svg) | The same lockup white-on-dark |
| [`brand/afterbell-mark.svg`](brand/afterbell-mark.svg) | The symbol on its own |
| [`brand/afterbell-mark-white.svg`](brand/afterbell-mark-white.svg) | The symbol in white, for dark surfaces |
| [`brand/afterbell-cover.jpg`](brand/afterbell-cover.jpg) | Cover image, 600×800 |
| [`brand/afterbell-cover.svg`](brand/afterbell-cover.svg) | The cover as vector |
| [`favicon.svg`](favicon.svg) | The mark, as the site icon |

The wordmark is Plus Jakarta Sans Bold and the byline is Plus Jakarta Sans
Medium, both **converted to outline paths** rather than left as `<text>`. That
means every file renders identically everywhere — on GitHub, in a browser, in
a slide deck — without shipping a font or relying on one being installed.

## License

[MIT](LICENSE).

---

Built by **Prajith Vishnu, Braswell High School.**
