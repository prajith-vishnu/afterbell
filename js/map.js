/* ===========================================================================
   AfterBell — map.js
   Leaflet + OpenStreetMap, in greyscale.
   ===========================================================================
   PRIVACY: the only coordinates this app owns are NEIGHBOURHOOD CENTRES and
   a handful of public places. There is no address field in the data model, so
   there is nothing finer than "Savannah" to plot even by accident. A route
   line is drawn straight from a neighbourhood centre to the destination —
   it is a diagram of who is grouped with whom, not a set of directions.

   No API key and no routing service: tiles come from OpenStreetMap and the
   lines are straight.

   The maps are deliberately non-interactive. They are a picture of the trip,
   every fact on them is also written in text next to them, and a map you
   cannot pan is a map that cannot drift mid-recording. They are marked
   aria-hidden for that reason.
=========================================================================== */

const SCHOOL_PLACE = 'school';

/** Lat/lng for a place id, falling back to the school. */
function placeLatLng(state, placeId) {
  const COORDS = {
    // PLACEHOLDER COORDINATES — same caveat as the neighbourhood list.
    school: [33.2614, -96.9469],
    'little-elm': [33.1700, -96.9350],
    'north-lakes': [33.2290, -97.1500],
  };
  return COORDS[placeId] || COORDS[SCHOOL_PLACE];
}

function icon(className, size) {
  return window.L.divIcon({
    className: '',
    html: `<span class="${className}"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/**
 * Draw a map into `el`.
 *
 * options:
 *   neighborhoods  every neighbourhood to show as a small dot
 *   highlight      neighbourhood ids to draw as "me" dots (black, white ring)
 *   destination    place id to mark with the square school pin
 *   routes         neighbourhood ids to join to the destination with a line
 *   searching      true to pulse a ring on the first highlighted neighbourhood
 */
export function drawMap(el, state, options = {}) {
  if (!el) return null;

  // Leaflet comes off a CDN. If it did not load, leave a readable note
  // instead of an empty grey box — every fact on the map is in text anyway.
  if (!window.L) {
    el.innerHTML = `<p class="map__fallback">Map needs an internet connection.
      Everything it shows is written out below.</p>`;
    return null;
  }

  // Re-drawing the same container: tear the old instance down first.
  if (el._abMap) {
    el._abMap.remove();
    el._abMap = null;
  }
  el.innerHTML = '';

  const map = window.L.map(el, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
  });
  el._abMap = map;
  el.setAttribute('aria-hidden', 'true');

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    crossOrigin: true,
  }).addTo(map);

  const points = [];
  const highlight = new Set(options.highlight || []);

  // Every neighbourhood centre as a small black dot.
  for (const hood of options.neighborhoods || state.neighborhoods) {
    const latLng = [hood.lat, hood.lng];
    points.push(latLng);
    const isMine = highlight.has(hood.id);
    window.L.marker(latLng, {
      icon: icon(isMine ? 'pin-me' : 'pin-dot', isMine ? 16 : 10),
      interactive: false,
      keyboard: false,
    }).addTo(map);
  }

  // The destination, as a square pin.
  if (options.destination) {
    const dest = placeLatLng(state, options.destination);
    points.push(dest);
    window.L.marker(dest, {
      icon: icon('pin-school', 16),
      interactive: false,
      keyboard: false,
    }).addTo(map);

    // Straight lines from each riding neighbourhood to the destination.
    for (const hoodId of options.routes || []) {
      const hood = state.neighborhoods.find((n) => n.id === hoodId);
      if (!hood) continue;
      window.L.polyline([[hood.lat, hood.lng], dest], {
        color: '#000000',
        weight: 2.5,
        opacity: 0.85,
        interactive: false,
      }).addTo(map);
    }
  }

  // The "finding your ride" pulse.
  if (options.searching && highlight.size) {
    const first = state.neighborhoods.find((n) => highlight.has(n.id));
    if (first) {
      window.L.marker([first.lat, first.lng], {
        icon: icon('pin-search', 18),
        interactive: false,
        keyboard: false,
      }).addTo(map);
    }
  }

  if (points.length > 1) {
    map.fitBounds(window.L.latLngBounds(points), { padding: [40, 40] });
  } else if (points.length === 1) {
    map.setView(points[0], 13);
  } else {
    map.setView(placeLatLng(state, SCHOOL_PLACE), 12);
  }

  // Leaflet measures the container on creation; if it was laid out after
  // that (a bottom sheet settling, a tour section mounting) it needs a nudge.
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

/** Draw every map on the page that is marked up with data-map. */
export function drawAllMaps(state, root = document) {
  root.querySelectorAll('[data-map]').forEach((el) => {
    let options = {};
    try {
      options = JSON.parse(el.dataset.map || '{}');
    } catch {
      options = {};
    }
    drawMap(el, state, options);
  });
}
