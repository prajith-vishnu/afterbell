# AfterBell

**Every spot filled.**

A ride-matching web app for students at Ray Braswell High School, Denton ISD.
Built for the Congressional App Challenge.

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

## Tech stack

- **Plain HTML, CSS and JavaScript** (ES modules). No framework, no build step,
  no bundler. You can read any file top to bottom.
- **Leaflet** with **OpenStreetMap** tiles for the maps. No API key.
- **Lucide** for icons.
- **Plus Jakarta Sans** from Google Fonts.
- **Firebase** (Authentication, Firestore, Hosting) — planned for Stage 2;
  Stage 1 runs entirely on local sample data.

### Project layout

| File | What it is |
| --- | --- |
| `js/matching.js` | The algorithm. Pure, dependency-free, tested. |
| `js/matching.test.js` | 23 tests. Run in a browser or with Node. |
| `js/seed.js` | All sample data: people, neighborhoods, events, offers. |
| `js/state.js` | The only place data changes. Stage 2 swaps this for Firestore. |
| `js/screens.js` | One function per screen, each returning HTML. |
| `js/app.js` | Router, bottom tab bar, and every button. |
| `js/map.js` | Leaflet setup and the map markers. |
| `js/export.js` | The ride-plan CSV. |
| `js/notifications.js` | The Rides tab, built from real app events. |
| `film.html`, `js/film.js`, `css/film.css` | The demo film, played start to finish for recording. |

## Running it

ES modules won't load from `file://`, so you need a local server:

```bash
cd "Congressional APP Challenge"
python3 -m http.server 8000
```

Then open **http://localhost:8000**.

| URL | What you get |
| --- | --- |
| `/` | The app. Use the demo chips at the top to switch role. |
| `/?role=organizer` | Opens straight into a role. |
| `/tests.html` | The algorithm test suite. |
| `/film.html` | The demo film. Press Start. `?seg=N` previews one segment, `?check=1` self-checks. |

Run the tests from a terminal instead:

```bash
node js/matching.test.js
```

## Deploying

### Option A — GitHub Pages (no setup needed)

1. Create a repository on GitHub. Don't add a README; this project has one.
2. In the project folder:
   ```bash
   git remote add origin https://github.com/YOUR-USERNAME/afterbell.git
   git branch -M main
   git push -u origin main
   ```
3. On GitHub, open **Settings → Pages**.
4. Under **Source**, choose **Deploy from a branch**.
5. Pick branch **main** and folder **/ (root)**, then **Save**.
6. Wait about a minute. Your site appears at
   `https://YOUR-USERNAME.github.io/afterbell/`.

Everything here is static, so nothing else is required.

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

---

Built by a student at Ray Braswell High School, Denton ISD.
