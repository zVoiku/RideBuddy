/* global React, ReactDOM */
/**
 * /estimate — the customer app's fare estimate, on the web.
 *
 * Mirrors frontend/app/home.tsx (the form) and frontend/app/booking/summary.tsx
 * (the result): trip type, pickup and destination from Google Places, pickup
 * date and time, return date and the stay question for round trips, hours for
 * hourly; then the routed distance and drive time go through the same fare
 * engine the backend runs, and the result shows one number plus the app's
 * inclusion lines. Booking is not on the website — the result leads to the
 * waitlist.
 */
import { estimate, formatINR, roundTripDays } from './fare-engine.js';
import * as maps from './maps.js';

const { useState, useEffect, useRef } = React;

// Design-system primitives, with plain fallbacks so a bundle hiccup degrades
// to unstyled inputs rather than a blank page.
const DS = window.RideBuddyDesignSystem_f63581 || {};
const Button = DS.Button || (({ children, fullWidth, size, variant, ...rest }) => <button className="rb-btn rb-btn--primary" {...rest}>{children}</button>);
const Chip = DS.Chip || (({ selected, children, ...rest }) => <button type="button" aria-pressed={selected} className="rb-chip" {...rest}>{children}</button>);
const Badge = DS.Badge || (({ children }) => <span className="rb-badge">{children}</span>);
const Input = DS.Input || (({ label, icon, error, ...rest }) => (
  <label className="rb-field"><span className="rb-label">{label}</span><input className="rb-input" {...rest} />{error && <span className="rb-error-msg">{error}</span>}</label>
));

// Icons from the artboard.
const Icon = ({ d, size = 18, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0';
const NAV = 'm3 11 19-9-9 19-2-8-8-2z';
const CHAT = 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z';
const CLOCK = ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'];

function track(event, payload) {
  (window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, payload || {}));
}

/**
 * Saves a form through the site's Worker (website/worker/index.js). Resolves
 * to { ok: true } or { ok: false, error, errors } and never throws: a failure
 * is shown to the visitor, who can try again. The /beta artboard carries the
 * same helper (artboard-patches.mjs).
 */
async function postForm(path, body) {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || 'We couldn’t save that just now. Please try again.', errors: data.errors || {} };
  } catch (e) {
    return { ok: false, error: 'We couldn’t reach RideBuddy. Check your connection and try again.', errors: {} };
  }
}

/** Today's date in IST, +offset days — the page prices on Indian wall-clock time whatever the visitor's zone. */
function istDate(offsetDays = 0) {
  return new Date(Date.now() + (330 + offsetDays * 1440) * 60000).toISOString().slice(0, 10);
}

function fmtDuration(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

const TRIP_TYPES = [
  { id: 'round', label: 'Round Trip' },
  { id: 'one', label: 'One Way' },
  { id: 'hourly', label: 'Hourly' },
];

// ----- Place field: the web twin of CityPicker.tsx --------------------------------

function PlaceField({ label, icon, placeholder, kind, value, onChange, onSelect, onBusy, onOpenMap, error, disabled }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (onBusy) onBusy(busy); }, [busy]);
  const session = useRef(null);
  const box = useRef(null);

  // Debounced suggestions, min two characters, one Places session per field
  // interaction (the session closes when a place is chosen).
  useEffect(() => {
    if (value.place || !value.text || value.text.trim().length < 2) { setItems([]); return undefined; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        if (!session.current) session.current = await maps.newSession();
        const list = await maps.placesAutocomplete(value.text.trim(), { kind, sessionToken: session.current });
        if (!cancelled) { setItems(list); setOpen(true); }
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value.text, value.place, kind]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = async (s) => {
    setBusy(true);
    setOpen(false);
    try {
      const det = await maps.getPlaceDetails(s);
      session.current = null;
      if (!det) { onSelect(null, 'Could not load that place. Try another.'); return; }
      const check = maps.withinService(kind, det);
      if (!check.ok) { onSelect(null, check.message); return; }
      onSelect({ ...det, description: s.description, main_text: s.main_text, place_id: s.place_id });
    } catch (e) {
      onSelect(null, 'Could not load that place. Try another.');
    } finally {
      setBusy(false);
      setItems([]);
    }
  };

  return (
    <div className="rb-place" ref={box}>
      <Input label={label} icon={icon} placeholder={placeholder} value={value.text} error={error || undefined}
        onChange={(e) => onChange(e.target.value)} onFocus={() => items.length && setOpen(true)}
        autoComplete="off" disabled={disabled} />
      {busy && <span className="rb-place__busy" aria-hidden="true" />}
      {onOpenMap && (
        <button type="button" className="rb-place__map" onClick={() => { setOpen(false); onOpenMap(); }}
          title="Pick the exact point on a map" aria-label={`Pick ${label.toLowerCase()} on a map`}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 4-6 2.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4z" />
            <path d="M9 4v13M15 6.5v13" />
          </svg>
        </button>
      )}
      {open && items.length > 0 && (
        <div className="rb-suggest" role="listbox">
          {items.map((s) => (
            <button type="button" key={s.place_id} className="rb-suggest__item" role="option"
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(s)}>
              <span className="rb-suggest__main">{s.main_text}</span>
              {s.secondary_text ? <span className="rb-suggest__sub">{s.secondary_text}</span> : null}
            </button>
          ))}
          <div className="rb-suggest__powered">Powered by Google</div>
        </div>
      )}
    </div>
  );
}

// ----- Map picker: drop a pin when the address isn't precise enough ---------------

/**
 * A map in a modal: tap one of Google's places to select it by name, or drag
 * the map under the fixed centre pin to place an arbitrary point, then
 * confirm. Centres on whatever the field already holds, otherwise on the
 * Tricity (pickups) or the wider service region (destinations).
 *
 * The point is what matters — routing and the fare use its coordinates. The
 * name is only a label, so a project without the Geocoding API still gets a
 * working picker, captioned with coordinates.
 */
function MapPicker({ kind, initial, onClose, onPick }) {
  const el = useRef(null);
  const map = useRef(null);
  const timer = useRef(null);
  // A place tapped on the map knows its own name; reverse geocoding must not
  // overwrite it with a street address once the pan settles.
  const named = useRef(initial && initial.place_id ? { ...initial, address: initial.description } : null);
  const [point, setPoint] = useState(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [label, setLabel] = useState(initial ? { address: initial.description, main_text: initial.main_text } : null);
  const [naming, setNaming] = useState(false);
  const [failed, setFailed] = useState(false);

  const gate = point ? maps.withinService(kind, point) : { ok: true };
  /** The tapped place, while the pin is still on it. */
  const atNamed = () => (named.current && point && maps.haversineKm(point, named.current) < 0.01 ? named.current : null);

  useEffect(() => {
    document.body.classList.add('rb-lock');
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.classList.remove('rb-lock'); document.removeEventListener('keydown', onKey); clearTimeout(timer.current); window.__rbPickerMap = null; window.__rbPickerNamed = null; };
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const g = await maps.loadGoogleMaps();
        const { Map } = await g.importLibrary('maps');
        if (dead || !el.current) return;
        const centre = initial ? { lat: initial.lat, lng: initial.lng } : maps.CHANDIGARH;
        const m = new Map(el.current, {
          center: centre, zoom: initial ? 16 : (kind === 'pickup' ? 12 : 8),
          disableDefaultUI: true, zoomControl: true, clickableIcons: true, gestureHandling: 'greedy',
        });
        map.current = m;
        // Handles for the end-to-end check in test/verify.mjs, which needs to
        // aim a click at a place icon and see which place came back.
        window.__rbPickerMap = m;
        window.__rbPickerNamed = null;
        m.addListener('click', async (e) => {
          // Google's own places carry a placeId. Take the place itself —
          // e.stop() suppresses Google's info window, which we replace with
          // the name in the footer.
          if (e.placeId) {
            e.stop();
            setNaming(true);
            const poi = await maps.getPlaceById(e.placeId);
            if (poi && !dead) {
              named.current = poi;
              window.__rbPickerNamed = poi;
              setLabel({ address: poi.address, main_text: poi.main_text });
              setPoint({ lat: poi.lat, lng: poi.lng });
              setNaming(false);
              m.panTo({ lat: poi.lat, lng: poi.lng });
              return;
            }
            setNaming(false);
          }
          // Anywhere else: recentre, so a point can be placed without dragging.
          m.panTo(e.latLng);
        });
        // The pin is fixed to the centre of the viewport; the map moves under it.
        m.addListener('idle', () => {
          const c = m.getCenter();
          const next = { lat: c.lat(), lng: c.lng() };
          setPoint((prev) => (prev && maps.haversineKm(prev, next) < 0.005 ? prev : next));
        });
      } catch (e) {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; };
  }, []);

  // Name the point once it settles — debounced, and only inside the service area.
  useEffect(() => {
    if (!point) return undefined;
    clearTimeout(timer.current);
    if (!maps.withinService(kind, point).ok) { setLabel(null); return undefined; }
    const poi = atNamed();
    if (poi) { setLabel({ address: poi.address, main_text: poi.main_text }); setNaming(false); return undefined; }
    named.current = null;
    window.__rbPickerNamed = null;
    setNaming(true);
    timer.current = setTimeout(async () => {
      const got = await maps.reverseGeocode(point);
      setLabel(got);
      setNaming(false);
    }, 400);
    return () => clearTimeout(timer.current);
  }, [point, kind]);

  const confirm = () => {
    if (!point || !gate.ok) return;
    const poi = atNamed();
    const where = poi?.address || label?.address || maps.coordLabel(point);
    onPick({
      lat: point.lat, lng: point.lng,
      address: where,
      description: where,
      main_text: poi?.main_text || label?.main_text || 'Pinned location',
      place_id: poi?.place_id || null,
    });
  };

  return (
    <div className="rb-picker" role="dialog" aria-modal="true" aria-label={`Choose ${kind === 'pickup' ? 'pickup' : 'destination'} on the map`}>
      <div className="rb-picker__sheet">
        <div className="rb-picker__head">
          <h3>{kind === 'pickup' ? 'Choose your pickup point' : 'Choose your destination'}</h3>
          <button type="button" className="rb-picker__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="rb-picker__map">
          <div ref={el} className="rb-picker__canvas" />
          {failed
            ? <div className="rb-picker__fallback">Map unavailable right now.</div>
            : (
              <div className="rb-picker__pin" aria-hidden="true">
                <svg width="38" height="46" viewBox="0 0 38 46">
                  <path d="M19 45c0-12 12-17 12-27A12 12 0 1 0 7 18c0 10 12 15 12 27z" fill="#4A5C2F" stroke="#F5F0E8" strokeWidth="2.5" />
                  <circle cx="19" cy="18" r="4.4" fill="#F5F0E8" />
                </svg>
              </div>
            )}
          <p className="rb-picker__hint">Tap a place to select it, or drag the map to drop a pin</p>
        </div>
        <div className="rb-picker__foot">
          <div className="rb-picker__where">
            {!gate.ok
              ? <span className="rb-picker__bad">{gate.message}</span>
              : <>
                  <span className="rb-picker__addr">{naming ? 'Finding this place…' : (label?.main_text || (point ? 'Pinned location' : '—'))}</span>
                  {label?.address && !naming && <span className="rb-picker__sub">{label.address}</span>}
                  {point && <span className="rb-picker__coord">{maps.coordLabel(point)}</span>}
                </>}
          </div>
          <Button size="lg" onClick={confirm} disabled={!point || !gate.ok || failed}>Use this location</Button>
        </div>
      </div>
    </div>
  );
}

// ----- Route map: the web twin of LiveMap + the summary screen's tap-to-expand ----

function RouteMap({ route, pickup, hourly }) {
  const el = useRef(null);
  const map = useRef(null);
  const renderer = useRef(null);
  const markers = useRef([]);
  const [full, setFull] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const g = await maps.loadGoogleMaps();
        const { Map } = await g.importLibrary('maps');
        await g.importLibrary('marker');
        if (dead || !el.current) return;
        if (!map.current) {
          map.current = new Map(el.current, {
            center: pickup, zoom: 11, disableDefaultUI: true, zoomControl: true,
            gestureHandling: 'cooperative', clickableIcons: false,
          });
        }
        const m = map.current;
        markers.current.forEach((mk) => mk.setMap(null));
        markers.current = [];
        if (renderer.current) renderer.current.setMap(null);

        const pin = (position, color, label) => new g.Marker({
          position, map: m,
          label: { text: label, color: '#F5F0E8', fontWeight: '700', fontFamily: 'DM Sans, sans-serif' },
          icon: { path: g.SymbolPath.CIRCLE, scale: 13, fillColor: color, fillOpacity: 1, strokeColor: '#F5F0E8', strokeWeight: 2 },
        });

        if (route && !hourly) {
          const { DirectionsRenderer } = await g.importLibrary('routes');
          renderer.current = new DirectionsRenderer({
            map: m, directions: route.result, suppressMarkers: true,
            polylineOptions: { strokeColor: '#4A5C2F', strokeWeight: 5, strokeOpacity: 0.85 },
          });
          markers.current.push(pin(route.start, '#4A5C2F', 'A'), pin(route.end, '#C62828', 'B'));
        } else {
          markers.current.push(pin(pickup, '#4A5C2F', 'A'));
          m.setCenter(pickup);
          m.setZoom(13);
        }
      } catch (e) {
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; };
  }, [route, pickup, hourly]);

  // Re-layout after toggling fullscreen, exactly as the app refits on expand.
  useEffect(() => {
    document.body.classList.toggle('rb-lock', full);
    const m = map.current;
    if (!m) return undefined;
    const t = setTimeout(() => {
      window.google.maps.event.trigger(m, 'resize');
      const bounds = route?.result?.routes?.[0]?.bounds;
      if (bounds && !hourly) m.fitBounds(bounds, 40);
      else m.setCenter(pickup);
    }, 60);
    return () => clearTimeout(t);
  }, [full]);

  useEffect(() => () => document.body.classList.remove('rb-lock'), []);

  return (
    <div className={'rb-map' + (full ? ' rb-map--full' : '')}>
      <div ref={el} className="rb-map__canvas" />
      {failed && <div className="rb-map__fallback">Map unavailable right now.</div>}
      <button type="button" className="rb-map__toggle" onClick={() => setFull((f) => !f)}>
        {full ? 'Close' : 'Tap to expand'}
      </button>
    </div>
  );
}

// ----- Site header: the main site's, as on /beta ----------------------------------

// Where the rest of the site lives. When the beta moves to the root, change this.
const SITE = '/beta/';

const SITE_LINKS = [
  { label: 'Home', href: SITE },
  { label: 'Estimate Fare', href: '/estimate/', here: true },
  { label: 'How It Works', href: `${SITE}#how-it-works` },
  { label: 'About', href: `${SITE}#about` },
  { label: 'Contact', href: `${SITE}#contact` },
];

/**
 * The /beta artboard's header — logo, the five pages, "Get an Estimate", and a
 * full-screen menu below 1120px — with this page as the current one. Here
 * "Get an Estimate" and "Estimate Fare" stay on the page and bring back the
 * form (inputs kept) instead of reloading it.
 */
function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toForm = (e) => {
    e.preventDefault();
    setOpen(false);
    window.dispatchEvent(new CustomEvent('rb-get-estimate'));
  };
  const link = (l) => (
    <a key={l.label} href={l.href} aria-current={l.here ? 'page' : undefined} onClick={l.here ? toForm : () => setOpen(false)}>{l.label}</a>
  );

  return (
    <>
      <div className="rb-header__in">
        <a className="rb-brand" href={SITE} aria-label="RideBuddy home">
          <img src="/logomark.svg" alt="" />
          <span>RideBuddy</span>
        </a>
        <nav className="rb-nav" aria-label="Main">
          {SITE_LINKS.map(link)}
          <div className="rb-nav__cta">
            <Button fullWidth={false} size="sm" onClick={toForm}><span style={{ whiteSpace: 'nowrap' }}>Get an Estimate</span></Button>
          </div>
        </nav>
        <button type="button" className="rb-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      {open && (
        <div className="rb-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="rb-menu__top">
            <button type="button" className="rb-menu__close" aria-label="Close" onClick={() => setOpen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="rb-menu__links">
            {SITE_LINKS.map(link)}
            <div className="rb-menu__cta"><Button onClick={toForm}>Get an Estimate</Button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ----- The page ------------------------------------------------------------------

const PRESET = new URLSearchParams(window.location.search).get('type');

function App() {
  const [tripType, setTripType] = useState(['round', 'one', 'hourly'].includes(PRESET) ? PRESET : 'round');
  const [pickup, setPickup] = useState({ text: '', place: null });
  const [destination, setDestination] = useState({ text: '', place: null });
  const [departDate, setDepartDate] = useState(istDate(1));
  const [returnDate, setReturnDate] = useState(istDate(2));
  const [pickupTime, setPickupTime] = useState('09:00');
  const [stayArranged, setStayArranged] = useState(false);
  const [hours, setHours] = useState('4');
  const [errors, setErrors] = useState({});
  const [view, setView] = useState('form');
  const [route, setRoute] = useState(null);
  const [result, setResult] = useState(null);
  const [mapsDown, setMapsDown] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [waDone, setWaDone] = useState(false);
  const [waError, setWaError] = useState('');
  const [waSending, setWaSending] = useState(false);
  // The field people never see and bots fill in; the Worker drops what arrives with it.
  const honeypot = useRef(null);
  // Place details resolve asynchronously after a suggestion is chosen; the
  // estimate must not run against a half-selected field.
  const [busyFields, setBusyFields] = useState({});
  const resolving = Object.values(busyFields).some(Boolean);
  // Which field, if any, is currently choosing a point on the map.
  const [picker, setPicker] = useState(null);

  const isRound = tripType === 'round';
  const isHourly = tripType === 'hourly';

  useEffect(() => {
    track('estimator_opened');
    const onFail = () => setMapsDown('Maps are unavailable right now, so we can’t look up routes. Please try again shortly.');
    window.addEventListener('rb-maps-auth-failure', onFail);
    maps.loadGoogleMaps().catch(() => setMapsDown('Maps are unavailable right now, so we can’t look up routes. Please try again shortly.'));
    return () => window.removeEventListener('rb-maps-auth-failure', onFail);
  }, []);

  // The header's "Get an Estimate" / "Estimate Fare": back to the top, and from a
  // result back to the form with the trip still filled in.
  useEffect(() => {
    const toForm = () => {
      setView((v) => (v === 'result' ? 'form' : v));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('rb-get-estimate', toForm);
    return () => window.removeEventListener('rb-get-estimate', toForm);
  }, []);

  const err = (field, msg) => setErrors((e) => ({ ...e, [field]: msg }));

  const getEstimate = async () => {
    if (resolving) return;
    const next = {};
    if (!pickup.place) next.pickup = 'Pick your pickup point from the suggestions.';
    if (!isHourly && !destination.place) next.destination = 'Pick a destination from the suggestions.';
    let days = 1;
    if (isRound) {
      days = roundTripDays(departDate, returnDate);
      if (!(days >= 1)) next.date = 'Return date falls before departure.';
    }
    const h = parseFloat(hours);
    if (isHourly && !(h > 0)) next.hours = 'How many hours do you need your Buddy for?';
    setErrors(next);
    if (Object.keys(next).length) return;

    setView('loading');
    try {
      let est, r = null;
      if (isHourly) {
        est = estimate({ tripType: 'hourly', oneWay: true, distanceKm: 0, durationHours: h, pickup: { date: departDate, time: pickupTime } });
      } else {
        r = await maps.getDirections(pickup.place, destination.place);
        if (!r) throw new Error('no-route');
        est = estimate({
          tripType: 'point_to_point', oneWay: !isRound,
          distanceKm: r.distance_km, durationHours: r.duration_min / 60, days,
          pickup: { date: departDate, time: pickupTime }, customerStay: stayArranged,
        });
      }
      // Snapshot what the result describes: the form can change under it once
      // the customer taps "Edit trip details", and the result must not.
      est.labels = {
        pickup: pickup.place.main_text, destination: destination.place?.main_text || '', round: isRound,
        date: departDate, ret: isRound ? returnDate : null, time: pickupTime,
      };
      setRoute(r);
      setResult(est);
      setView('result');
      // Exposed for the end-to-end check in test/verify.mjs: the exact inputs
      // the engine priced, so the same trip can be re-priced by the backend.
      window.__rbLastEstimate = {
        inputs: isHourly
          ? { tripType: 'hourly', oneWay: true, distanceKm: 0, durationHours: h, pickup: { date: departDate, time: pickupTime } }
          : { tripType: 'point_to_point', oneWay: !isRound, distanceKm: r.distance_km, durationHours: r.duration_min / 60, days, pickup: { date: departDate, time: pickupTime }, customerStay: stayArranged },
        result: est,
      };
      track('estimate_completed', { trip_type: tripType, amount: est.total_fare, destination: destination.place?.main_text });
    } catch (e) {
      setView('form');
      err('destination', e.message === 'no-route'
        ? 'We couldn’t find a driving route between those places.'
        : 'We couldn’t calculate that route. Please try again.');
    }
  };

  const editTrip = () => { setView('form'); };

  // Joins the waitlist with the trip just priced, so the call back starts from
  // what the customer wants. The Worker validates the number and words the trip.
  const submitWhatsapp = async () => {
    if (waSending) return;
    if (!whatsapp.trim()) { setWaError('Enter your phone number.'); return; }
    setWaSending(true);
    setWaError('');
    const l = result.labels;
    const r = await postForm('/api/waitlist', {
      phone: whatsapp,
      source: 'estimate',
      website: honeypot.current?.value || '',
      trip: {
        type: result.hourly ? 'hourly' : l.round ? 'round' : 'one',
        from: l.pickup, to: l.destination, date: l.date, ret: l.ret, time: l.time,
        hours: result.hourly ? result.hours : undefined,
        fare: result.total_fare,
      },
    });
    setWaSending(false);
    if (!r.ok) { setWaError(r.errors.phone || r.error); return; }
    setWaDone(true);
    track('whatsapp_number_submitted');
  };

  // The app's inclusion lines (summary.tsx), verbatim.
  const conditions = result ? (() => {
    const out = [];
    if (result.hourly) {
      out.push({ text: `Includes your Buddy for ${result.hours} hour${result.hours === 1 ? '' : 's'}.` });
      out.push({ text: 'Extra time beyond that is added to the final fare.' });
    } else {
      out.push({ text: `Includes ${result.included_km.toLocaleString('en-IN')} km and ${result.included_hours} hours${result.trip_days > 1 ? ` across ${result.trip_days} days` : ''}.` });
      out.push({ text: 'Extra distance or time beyond that is added to the final fare.' });
      if (result.stay_included) out.push({ text: `Includes the Buddy's stay for ${result.overnights} ${result.overnights === 1 ? 'night' : 'nights'}. Tell us if you're arranging it and we'll take it off.` });
      if (result.night_charge_applied) out.push({ text: 'Includes a night charge — pickup is before 6 AM or arrival is after 10 PM.' });
    }
    out.push({ text: 'Tolls are not part of this fare. You pay them directly during the trip.', excluded: true });
    return out;
  })() : [];

  const routeLine = result ? (
    result.hourly
      ? `${result.labels.pickup} · Hourly · ${result.hours} hour${result.hours === 1 ? '' : 's'}`
      : `${result.labels.pickup} → ${result.labels.destination} · ${result.labels.round ? 'Round Trip' : 'One Way'} · ${result.trip_days} day${result.trip_days === 1 ? '' : 's'}`
  ) : '';
  const routeMeta = route ? `${route.distance_km.toFixed(1)} km each way · about ${fmtDuration(route.duration_min)} driving` : '';

  return (
    <>
      <div className="rb-intro">
        <h1>What will your trip cost.</h1>
        <p>Outstation trips from the Chandigarh Tricity, in your own car. Enter the route and see the fare.</p>
      </div>
      {mapsDown && <div className="rb-banner" role="alert">{mapsDown}</div>}
      <div className="rb-est">
        <div className="rb-overline">Trip estimate</div>
        <div className="rb-card">

          {view === 'form' && (
            <div>
              <h2>Know your fare. Before anything else.</h2>
              <p className="rb-lede">A specific estimate for your exact trip. No calls. No haggling.</p>
              <div className="rb-stack">
                <div className="rb-group">
                  <span className="rb-group__label">Trip type</span>
                  <div className="rb-chips">
                    {TRIP_TYPES.map((t) => (
                      <Chip key={t.id} selected={tripType === t.id} onClick={() => { setTripType(t.id); setErrors({}); }}>{t.label}</Chip>
                    ))}
                  </div>
                </div>

                <PlaceField label="Pickup" icon={<Icon d={PIN} />} placeholder="Sector, area or landmark in the Tricity" kind="pickup"
                  value={pickup} error={errors.pickup} onBusy={(b) => setBusyFields((m) => ({ ...m, pickup: b }))}
                  onOpenMap={() => setPicker('pickup')}
                  onChange={(text) => { setPickup({ text, place: null }); err('pickup', ''); }}
                  onSelect={(place, msg) => { setPickup(place ? { text: place.description, place } : { text: pickup.text, place: null }); err('pickup', msg || ''); }} />

                {!isHourly && (
                  <PlaceField label="Destination" icon={<Icon d={NAV} />} placeholder="Where are you headed" kind="destination"
                    value={destination} error={errors.destination} onBusy={(b) => setBusyFields((m) => ({ ...m, destination: b }))}
                    onOpenMap={() => setPicker('destination')}
                    onChange={(text) => { setDestination({ text, place: null }); err('destination', ''); }}
                    onSelect={(place, msg) => { setDestination(place ? { text: place.description, place } : { text: destination.text, place: null }); err('destination', msg || ''); }} />
                )}

                <div className="rb-grid">
                  <Input label={isRound ? 'Departure date' : 'Pickup date'} type="date" value={departDate} min={istDate(0)}
                    onChange={(e) => { setDepartDate(e.target.value); err('date', ''); }} />
                  {isRound && (
                    <Input label="Return date" type="date" value={returnDate} min={departDate} error={errors.date || undefined}
                      onChange={(e) => { setReturnDate(e.target.value); err('date', ''); }} />
                  )}
                  <Input label="Pickup time" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
                  {isHourly && (
                    <Input label="Hours" type="number" min="1" step="0.5" inputMode="decimal" icon={<Icon d={CLOCK} />} value={hours}
                      error={errors.hours || undefined} onChange={(e) => { setHours(e.target.value); err('hours', ''); }} />
                  )}
                </div>

                {isRound && (
                  <div className="rb-stay">
                    <span className="rb-stay__q">Will you arrange your Buddy's overnight stay?</span>
                    <div className="rb-chips">
                      <Chip selected={!stayArranged} onClick={() => setStayArranged(false)}>No</Chip>
                      <Chip selected={stayArranged} onClick={() => setStayArranged(true)}>Yes</Chip>
                    </div>
                    <span className="rb-stay__hint">Many hotels provide driver stay at no cost.</span>
                  </div>
                )}

                <div className="rb-actions">
                  <Button size="lg" onClick={getEstimate} disabled={!!mapsDown || resolving}>Get Estimate</Button>
                </div>
              </div>
            </div>
          )}

          {view === 'loading' && (
            <div className="rb-loading">
              <p>Calculating your fare.</p>
              <div className="rb-loading__bar" />
            </div>
          )}

          {view === 'result' && result && (
            <div className="rb-result">
              <p className="rb-result__route">{routeLine}</p>
              {routeMeta && <p className="rb-result__meta">{routeMeta}</p>}

              <RouteMap route={route} pickup={pickup.place} hourly={result.hourly} />

              <div className="rb-fare">
                <div className="rb-fare__label">Estimated fare</div>
                <div className="rb-fare__value" data-testid="fare-estimate">{formatINR(result.total_fare)}</div>
              </div>
              <ul className="rb-conds">
                {conditions.map((c, i) => (
                  <li key={i} className={c.excluded ? 'rb-excluded' : ''}>
                    {c.excluded
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A8A39A" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14" /></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8FA96A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>}
                    <span>{c.text}</span>
                  </li>
                ))}
              </ul>
              <p className="rb-final">Final fare is calculated when your trip ends.</p>
              <button type="button" className="rb-edit" onClick={editTrip}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                Edit trip details
              </button>

              <div className="rb-book">
                <div className="rb-book__row">
                  <div style={{ width: 'auto' }}>
                    <Button fullWidth={false} size="lg" onClick={() => { track('book_a_buddy_clicked'); document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}>Book a Buddy</Button>
                  </div>
                  <Badge status="pending">Coming soon</Badge>
                </div>
                {waDone ? (
                  <div className="rb-done">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
                    <span>You're on the waitlist. We'll message you once.</span>
                  </div>
                ) : (
                  <div id="waitlist" className="rb-waitlist">
                    <div>
                      <h3>Join the waitlist.</h3>
                      <p>Booking opens soon. Waitlist members go first.</p>
                    </div>
                    <Input label="WhatsApp number" icon={<Icon d={CHAT} />} type="tel" placeholder="+91 ●●●●● ●●●●●" value={whatsapp}
                      error={waError || undefined} onChange={(e) => { setWhatsapp(e.target.value); setWaError(''); }} />
                    <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="rb-hp" />
                    <Button onClick={submitWhatsapp} disabled={waSending}>{waSending ? 'Joining…' : 'Join the Waitlist'}</Button>
                    <small>One message when the app is live. Nothing else.</small>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
      {picker && (
        <MapPicker
          kind={picker}
          initial={(picker === 'pickup' ? pickup : destination).place}
          onClose={() => setPicker(null)}
          onPick={(place) => {
            const set = picker === 'pickup' ? setPickup : setDestination;
            set({ text: place.description, place });
            err(picker, '');
            track('map_point_picked', { field: picker });
            setPicker(null);
          }}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('rb-header')).render(<SiteHeader />);
ReactDOM.createRoot(document.getElementById('app')).render(<App />);
