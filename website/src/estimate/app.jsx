/* global React, ReactDOM */
/**
 * /estimate — the customer app's fare estimate, on the web.
 *
 * Mirrors frontend/app/home.tsx (the form) and frontend/app/booking/summary.tsx
 * (the result): round trip or one way, pickup and destination from Google
 * Places, pickup date and time, return date and the stay question for round
 * trips; then the routed distance and drive time go through the same fare
 * engine the backend runs, and the result shows one number plus the app's
 * inclusion lines. Booking is not on the website — the result leads to the
 * waitlist. (The app also offers Hourly; the website does not.)
 */
import { FARE, estimate, formatINR, roundTripDays } from './fare-engine.js';
import * as maps from './maps.js';
import {
  Button, Chip, CodeStep, ConsentTick, CONSENT_ERROR, Done, Honeypot, Icon, Input, MOBILE, PHONE_ERROR, PhoneField,
  postForm, track, useCodeForm, WAITLIST_JOINED,
} from '../shared/ui.jsx';
import { SiteHeader } from '../shared/header.jsx';

const { useState, useEffect, useRef } = React;

// Icons from the artboard.
const PIN = 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0';
const NAV = 'm3 11 19-9-9 19-2-8-8-2z';
const CLOCK = ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'];
const ROUTE = ['M6 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', 'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'];
const ALERT = ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'];
const THUMB_UP = ['M7 10v12', 'M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'];
const THUMB_DOWN = ['M17 14V2', 'M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z'];

/** Today's date in IST, +offset days — the page prices on Indian wall-clock time whatever the visitor's zone. */
function istDate(offsetDays = 0) {
  return new Date(Date.now() + (330 + offsetDays * 1440) * 60000).toISOString().slice(0, 10);
}

/** A drive time for display: rounded to the nearest 5 minutes (§2.4); the fare uses the exact one. */
function fmtDuration(min) {
  const t = Math.round(min / 5) * 5;
  const h = Math.floor(t / 60), m = t % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** "22:00" -> "10 PM", "06:30" -> "6:30 AM": the night window as the conditions say it. */
function fmtClock(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * An id for each fare shown. A 👍/👎 and a waitlist signup made under the same
 * fare carry it, so the Worker keeps them on one row of the waitlist download.
 */
function newEstimateId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `est_${[...bytes].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20)}`;
}

/** The trip a fare is for, ["Round Trip", "2 days"]: two rows, first under the route map. */
function tripParts(result) {
  const d = result.trip_days;
  return [result.labels.round ? 'Round Trip' : 'One Way', `${d} day${d === 1 ? '' : 's'}`];
}

/** "Round Trip · 2 days": the same, in one line under the route. */
const tripDetail = (result) => tripParts(result).join(' · ');

/** What the Worker words into the Trip column, plus the fare, which has its own. */
function tripOf(result) {
  const l = result.labels;
  return {
    type: l.round ? 'round' : 'one',
    from: l.pickup, to: l.destination, date: l.date, ret: l.ret, time: l.time,
    fare: result.total_fare,
  };
}

// ----- Small parts of the result ---------------------------------------------------

/**
 * Under the route map, three sections: the trip the fare is for in two rows
 * ("Round Trip" over "2 days"), then the drive time and the distance, each way
 * too on a round trip.
 */
function TripTiles({ route, round, detail }) {
  const km = Math.round(route.distance_km);
  const min = route.duration_min;
  const tile = (icon, label, value, note) => (
    <div className="rb-tile">
      <Icon d={icon} size={20} stroke="#4A5C2F" />
      <div>
        <div className="rb-tile__label">{label}</div>
        <div className="rb-tile__value">{value}</div>
        <div className="rb-tile__note">{note}</div>
      </div>
    </div>
  );
  return (
    <div className="rb-tiles">
      <div className="rb-tile rb-tile--trip">
        <div className="rb-tile__trip"><span>{detail[0]}</span><span>{detail[1]}</span></div>
      </div>
      {tile(CLOCK, 'Est. trip time', fmtDuration(round ? 2 * min : min), round ? `${fmtDuration(min)} each way` : 'One way')}
      {tile(ROUTE, 'Est. distance', `${(round ? 2 * km : km).toLocaleString('en-IN')} km`, round ? `${km.toLocaleString('en-IN')} km each way` : 'One way')}
    </div>
  );
}

/**
 * More than 12 hours of driving (§1C): the plan the fare is for, in PRD 6.5's
 * words, and the switch that shows the drive-through price instead of the
 * default rest stop. The result's list of lines doesn't repeat it.
 */
function LongDrive({ driveThrough, onChange }) {
  return (
    <div className="rb-long" role="note">
      <Icon d={ALERT} size={20} stroke="#8A5A00" />
      <div className="rb-long__body">
        <p className="rb-long__warn">
          {driveThrough
            ? 'Driving through without a rest stop. You and your Buddy both agree before the trip.'
            : `This trip needs more than ${FARE.long_drive_threshold_h} hours of driving. Your Buddy needs rest for a safe trip. The fare includes a rest stop.`}
        </p>
        <label className="rb-switch" htmlFor="rb-drive-through">
          <input id="rb-drive-through" type="checkbox" role="switch" checked={driveThrough} onChange={(e) => onChange(e.target.checked)} />
          <span className="rb-switch__track" aria-hidden="true"><span className="rb-switch__thumb" /></span>
          <span>
            <span className="rb-switch__label">Drive through without a rest stop</span>
            <span className="rb-switch__sub">Only if you and your Buddy both agree.</span>
          </span>
        </label>
      </div>
    </div>
  );
}

/**
 * The fare, and 👍/👎 on it. A 👎 opens an optional comment. Each vote is saved
 * at once (POST /api/feedback); the latest vote counts and a comment stays when
 * the vote changes. Keyed by the estimate, so a new fare starts unvoted.
 */
function FarePanel({ fare, estimateId, trip }) {
  const [vote, setVote] = useState(null);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [thanks, setThanks] = useState(false);

  const cast = async (next) => {
    if (next === vote) return;
    const before = vote;
    setVote(next);
    setOpen(next === 'down');
    setError('');
    setThanks(false);
    const r = await postForm('/api/feedback', { estimate_id: estimateId, vote: next, trip });
    if (!r.ok) {
      setVote(before);
      setOpen(false);
      track('save_failed', { form: 'feedback' });
      return;
    }
    track('fare_feedback', { vote: next, change: !!before });
  };

  const send = async () => {
    if (sending) return;
    const text = comment.trim();
    // Nothing written: the 👎 is already saved, so Send just closes the box.
    if (!text) { setOpen(false); return; }
    setSending(true);
    const r = await postForm('/api/feedback', { estimate_id: estimateId, vote: 'down', comment: text, trip });
    setSending(false);
    if (!r.ok) {
      setError(r.errors.comment || r.error);
      if (!r.errors.comment) track('save_failed', { form: 'feedback' });
      return;
    }
    setOpen(false);
    setThanks(true);
    track('fare_feedback', { vote: 'down', comment: true });
  };

  const thumb = (v, icon, label, title) => (
    <button type="button" className="rb-thumb" aria-pressed={vote === v} aria-label={label} title={title} onClick={() => cast(v)}>
      <Icon d={icon} size={18} />
    </button>
  );

  return (
    <div className="rb-farepanel">
      <div className="rb-farepanel__row">
        <div>
          <div className="rb-fare__label">Estimated fare</div>
          <div className="rb-fare__value" data-testid="fare-estimate">{formatINR(fare)}</div>
          <div className="rb-fare__tax">Inclusive of all taxes</div>
        </div>
        <div className="rb-thumbs" role="group" aria-label="Does this fare work for you?">
          {thumb('up', THUMB_UP, 'Yes, this fare works for me', 'This fare works for me')}
          {thumb('down', THUMB_DOWN, 'No, this fare doesn’t work for me', 'This fare doesn’t work for me')}
        </div>
      </div>
      {open && (
        <div className={'rb-fb' + (error ? ' rb-fb--error' : '')}>
          <label htmlFor="rb-fare-comment">What would make this work for you?</label>
          <textarea id="rb-fare-comment" rows={3} maxLength={280} placeholder="Optional" value={comment}
            onChange={(e) => { setComment(e.target.value); setError(''); }} />
          <div className="rb-fb__foot">
            <span className={'rb-fb__count' + (comment.length >= 280 ? ' rb-fb__count--max' : '')}>{comment.length} / 280</span>
            <Button size="sm" fullWidth={false} onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
          </div>
          {error && <span className="rb-error-msg" role="alert">{error}</span>}
        </div>
      )}
      {thanks && <p className="rb-fb__thanks" role="status">Thank you. Noted.</p>}
    </div>
  );
}

const TRIP_TYPES = [
  { id: 'round', label: 'Round Trip' },
  { id: 'one', label: 'One Way' },
];

// ----- Pickup time: an hour, and the minutes in 15-minute steps ----------------------

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTES = [0, 15, 30, 45];
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Two dropdowns for "HH:MM", the hour as "7 AM", "7 PM" and the minutes as 00,
 * 15, 30 or 45, in one field drawn like the date fields beside it.
 */
function TimeField({ label, value, onChange }) {
  const [h, m] = value.split(':').map(Number);
  return (
    <div className="rb-field" role="group" aria-labelledby="rb-pickup-time-label">
      <span className="rb-label" id="rb-pickup-time-label">{label}</span>
      <div className="rb-time">
        <select id="rb-pickup-hour" className="rb-time__hour" aria-label="Hour" value={h} onChange={(e) => onChange(`${pad2(e.target.value)}:${pad2(m)}`)}>
          {HOURS.map((x) => <option key={x} value={x}>{`${x % 12 || 12} ${x < 12 ? 'AM' : 'PM'}`}</option>)}
        </select>
        <span className="rb-time__sep" aria-hidden="true" />
        <select id="rb-pickup-minute" className="rb-time__min" aria-label="Minutes" value={m} onChange={(e) => onChange(`${pad2(h)}:${pad2(e.target.value)}`)}>
          {MINUTES.map((x) => <option key={x} value={x}>{pad2(x)}</option>)}
        </select>
      </div>
    </div>
  );
}

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
      if (!check.ok) {
        // Demand from outside the service area: where, by area only.
        track('place_refused', { kind, city: det.city || '', area: det.area || '' });
        onSelect(null, check.message);
        return;
      }
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
        <div className="rb-suggest" role="listbox" data-rb-private="place suggestion">
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
      area: (poi || label)?.area || '',
      city: (poi || label)?.city || '',
    });
  };

  return (
    <div className="rb-picker" role="dialog" aria-modal="true" aria-label={`Choose ${kind === 'pickup' ? 'pickup' : 'destination'} on the map`} data-rb-region="map picker">
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

function RouteMap({ route, pickup, joined }) {
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

        if (route) {
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
  }, [route, pickup]);

  // Re-layout after toggling fullscreen, exactly as the app refits on expand.
  useEffect(() => {
    document.body.classList.toggle('rb-lock', full);
    const m = map.current;
    if (!m) return undefined;
    const t = setTimeout(() => {
      window.google.maps.event.trigger(m, 'resize');
      const bounds = route?.result?.routes?.[0]?.bounds;
      if (bounds) m.fitBounds(bounds, 40);
      else m.setCenter(pickup);
    }, 60);
    return () => clearTimeout(t);
  }, [full]);

  useEffect(() => () => document.body.classList.remove('rb-lock'), []);

  return (
    <div className={'rb-map' + (full ? ' rb-map--full' : '') + (joined ? ' rb-map--joined' : '')}>
      <div ref={el} className="rb-map__canvas" />
      {failed && <div className="rb-map__fallback">Map unavailable right now.</div>}
      <button type="button" className="rb-map__toggle" onClick={() => setFull((f) => !f)}>
        {full ? 'Close' : 'Tap to expand'}
      </button>
    </div>
  );
}

// ----- The page ------------------------------------------------------------------

const PRESET = new URLSearchParams(window.location.search).get('type');
// The furthest ahead a trip can be priced: today + 180 days.
const MAX_DAYS_AHEAD = 180;

function App() {
  const [tripType, setTripType] = useState(['round', 'one'].includes(PRESET) ? PRESET : 'round');
  const [pickup, setPickup] = useState({ text: '', place: null });
  const [destination, setDestination] = useState({ text: '', place: null });
  const [departDate, setDepartDate] = useState(istDate(1));
  const [returnDate, setReturnDate] = useState(istDate(2));
  const [pickupTime, setPickupTime] = useState('07:00');
  const [stayArranged, setStayArranged] = useState(false);
  const [errors, setErrors] = useState({});
  const [view, setView] = useState('form');
  const [route, setRoute] = useState(null);
  const [result, setResult] = useState(null);
  const [mapsDown, setMapsDown] = useState('');
  // Each fare shown gets an id: its 👍/👎 and a signup made under it share a row.
  const [estimateId, setEstimateId] = useState('');
  const [waPhone, setWaPhone] = useState('');
  const [waConsent, setWaConsent] = useState(false);
  const [waDone, setWaDone] = useState(false);
  const [waErrors, setWaErrors] = useState({});
  // The one-time code step (website/worker/otp.js).
  const wa = useCodeForm('/api/waitlist', 'rb-waitlist-code');
  const honeypot = useRef(null);
  // Place details resolve asynchronously after a suggestion is chosen; the
  // estimate must not run against a half-selected field.
  const [busyFields, setBusyFields] = useState({});
  const resolving = Object.values(busyFields).some(Boolean);
  // Which field, if any, is currently choosing a point on the map.
  const [picker, setPicker] = useState(null);
  // Analytics: the first time the visitor touches the form, and maps failing (once each).
  const started = useRef(false);
  const markStarted = () => { if (!started.current) { started.current = true; track('estimate_started'); } };
  const mapsFailed = useRef(false);

  const isRound = tripType === 'round';
  // The stay question is for round trips over more than one day (§5.2).
  const multiDay = isRound && !!departDate && !!returnDate && returnDate > departDate;

  useEffect(() => {
    track('estimator_opened');
    const onFail = () => {
      setMapsDown('Maps are unavailable right now, so we can’t look up routes. Please try again shortly.');
      if (!mapsFailed.current) { mapsFailed.current = true; track('maps_failed'); }
    };
    window.addEventListener('rb-maps-auth-failure', onFail);
    maps.loadGoogleMaps().catch(onFail);
    return () => window.removeEventListener('rb-maps-auth-failure', onFail);
  }, []);

  // The header's "Get an Estimate": back to the top, and from a result back to
  // the form with the trip still filled in.
  useEffect(() => {
    const toForm = () => {
      setView((v) => (v === 'result' ? 'form' : v));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('rb-get-estimate', toForm);
    return () => window.removeEventListener('rb-get-estimate', toForm);
  }, []);

  const err = (field, msg) => setErrors((e) => ({ ...e, [field]: msg }));

  // Get Estimate stays disabled until the trip is complete; this line says what is missing.
  const missing = (() => {
    const when = isRound ? 'departure' : 'pickup';
    if (!pickup.place) return 'Choose your pickup from the suggestions or on the map.';
    if (!destination.place) return 'Choose your destination from the suggestions or on the map.';
    if (!departDate) return `Pick the ${when} date.`;
    if (departDate < istDate(0)) return `The ${when} date has already passed.`;
    if (departDate > istDate(MAX_DAYS_AHEAD)) return `Pick a ${when} date within the next ${MAX_DAYS_AHEAD} days.`;
    if (isRound && !returnDate) return 'Pick the return date.';
    if (isRound && returnDate > istDate(MAX_DAYS_AHEAD)) return `Pick a return date within the next ${MAX_DAYS_AHEAD} days.`;
    if (isRound && !(roundTripDays(departDate, returnDate) >= 1)) return 'The return date is before the departure date.';
    if (!pickupTime) return 'Pick the pickup time.';
    return '';
  })();

  const getEstimate = async () => {
    if (resolving || missing) return;
    const next = {};
    if (!pickup.place) next.pickup = 'Pick your pickup point from the suggestions.';
    if (!destination.place) next.destination = 'Pick a destination from the suggestions.';
    let days = 1;
    if (isRound) {
      days = roundTripDays(departDate, returnDate);
      if (!(days >= 1)) next.date = 'Return date falls before departure.';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setView('loading');
    try {
      const r = await maps.getDirections(pickup.place, destination.place);
      if (!r) throw new Error('no-route');
      const inputs = {
        tripType: 'point_to_point', oneWay: !isRound,
        distanceKm: r.distance_km, durationHours: r.duration_min / 60, days,
        pickup: { date: departDate, time: pickupTime }, customerStay: multiDay && stayArranged, driveThrough: false,
      };
      // Snapshot what the result describes: the form can change under it once
      // the customer taps "Edit trip details", and the result must not.
      const est = priced(inputs, {
        pickup: pickup.place.main_text, destination: destination.place.main_text, round: isRound,
        date: departDate, ret: isRound ? returnDate : null, time: pickupTime,
      });
      setRoute(r);
      setView('result');
      // What people price, for the demand numbers on /admin: areas and cities,
      // never an address.
      track('estimate_completed', {
        trip: tripType,
        pickup_area: pickup.place.area || '', pickup_city: pickup.place.city || '',
        dest_city: destination.place.city || '',
        km: Math.round(r.distance_km),
        fare: est.total_fare,
        ahead: Math.round((Date.parse(departDate) - Date.parse(istDate(0))) / 864e5),
        days: est.trip_days || 0,
        hour: Number(pickupTime.slice(0, 2)),
        weekday: new Date(`${departDate}T00:00:00Z`).getUTCDay(),
        night: !!est.night_charge_applied,
      });
    } catch (e) {
      // Google answers "no route" either with no legs or by refusing with ZERO_RESULTS / NOT_FOUND.
      if (e.message === 'no-route' || /ZERO_RESULTS|NOT_FOUND/.test(String(e?.code || e?.message || ''))) {
        setView('form');
        track('route_not_found');
        err('destination', 'We couldn’t find a driving route between those places.');
        return;
      }
      setView('error');
      track('route_failed');
    }
  };

  const editTrip = () => { setView('form'); };

  // The fare for these inputs, shown as a new estimate: its own id, so a
  // 👍/👎 is always on the fare the visitor saw.
  const priced = (inputs, labels) => {
    const est = { ...estimate(inputs), inputs, labels };
    setResult(est);
    setEstimateId(newEstimateId());
    // Exposed for the end-to-end check in test/verify.mjs: the exact inputs
    // the engine priced, so the same trip can be re-priced by the backend.
    window.__rbLastEstimate = { inputs, result: est };
    return est;
  };

  // The long-drive switch: the same route, priced on the other plan (§1C).
  const setDriveThrough = (on) => {
    priced({ ...result.inputs, driveThrough: on }, result.labels);
    track('long_drive_plan', { plan: on ? 'drive_through' : 'rest_stop' });
  };

  // Joins the waitlist with the trip just priced, so the call back starts from
  // what the customer wants, and any 👍/👎 on this fare lands on the same row.
  // The Worker validates the number and words the trip.
  const submitWaitlist = () => {
    if (wa.sending) return;
    const next = {};
    if (!MOBILE.test(waPhone)) next.phone = PHONE_ERROR;
    if (!waConsent) next.consent = CONSENT_ERROR;
    setWaErrors(next);
    if (Object.keys(next).length) {
      if (next.phone) track('phone_invalid', { form: 'estimate' });
      return;
    }
    sendWaitlist('');
  };

  // The first POST sends a code to the number and the waitlist asks for it;
  // the same POST with the code saves.
  const sendWaitlist = async (code) => {
    const r = await wa.submit({
      phone: waPhone, consent: true, source: 'estimate', estimate_id: estimateId,
      website: honeypot.current?.value || '', trip: tripOf(result),
    }, { form: 'estimate', code });
    if (!r) return;
    if (!r.ok) { setWaErrors(r.errors.phone || r.errors.consent ? r.errors : { phone: r.error }); return; }
    setWaDone(true);
    track('waitlist_joined', { source: 'estimate' });
  };

  // The conditions, as PRD 6.5 words them (QA audit v2.3, R01–R03). A long
  // drive's plan is said once, beside its switch (LongDrive).
  const conditions = result ? (() => {
    const out = [];
    out.push({ text: `Includes ${result.duty_hours_per_day} hours of your Buddy's time from pickup.` });
    out.push({ text: "Includes your Buddy's food." });
    if (result.stay_included) out.push({ text: `Includes your Buddy's stay for ${result.stay_nights} ${result.stay_nights === 1 ? 'night' : 'nights'}.` });
    if (result.night_charge_applied) out.push({ text: `Includes a night charge. Your trip runs between ${fmtClock(FARE.night_start)} and ${fmtClock(FARE.night_end)}.` });
    out.push({ text: 'Tolls are extra, paid by you on the road.', excluded: true });
    out.push({ text: `Extra time is ${formatINR(FARE.extra_time_per_min)} a minute, added to the final fare.`, excluded: true });
    return out;
  })() : [];

  const routeLine = result
    ? `${result.labels.pickup} → ${result.labels.destination} · ${tripDetail(result)}`
    : '';
  const disclaimer = 'Indicative fare for the route, date and time you entered, using the route’s standard drive time without traffic. This is not a booking or an offer. Rates can change before booking opens. Terms of Use apply.';

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
              <div className="rb-stack" data-rb-region="estimate form" onClickCapture={markStarted} onInputCapture={markStarted}>
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

                <PlaceField label="Destination" icon={<Icon d={NAV} />} placeholder="Where are you headed" kind="destination"
                  value={destination} error={errors.destination} onBusy={(b) => setBusyFields((m) => ({ ...m, destination: b }))}
                  onOpenMap={() => setPicker('destination')}
                  onChange={(text) => { setDestination({ text, place: null }); err('destination', ''); }}
                  onSelect={(place, msg) => { setDestination(place ? { text: place.description, place } : { text: destination.text, place: null }); err('destination', msg || ''); }} />

                <div className="rb-grid">
                  <Input label={isRound ? 'Departure date' : 'Pickup date'} type="date" value={departDate} min={istDate(0)} max={istDate(MAX_DAYS_AHEAD)}
                    onChange={(e) => { setDepartDate(e.target.value); err('date', ''); }} />
                  {isRound && (
                    <Input label="Return date" type="date" value={returnDate} min={departDate} max={istDate(MAX_DAYS_AHEAD)} error={errors.date || undefined}
                      onChange={(e) => { setReturnDate(e.target.value); err('date', ''); }} />
                  )}
                  <TimeField label="Pickup time" value={pickupTime} onChange={setPickupTime} />
                </div>

                {multiDay && (
                  <div className="rb-stay">
                    <span className="rb-stay__q">Will you arrange your Buddy's overnight stay?</span>
                    <div className="rb-chips">
                      <Chip selected={!stayArranged} onClick={() => setStayArranged(false)} data-rb-label="Arranging the stay: No">No</Chip>
                      <Chip selected={stayArranged} onClick={() => setStayArranged(true)} data-rb-label="Arranging the stay: Yes">Yes</Chip>
                    </div>
                    <span className="rb-stay__hint">Many hotels provide driver stay at no cost.</span>
                  </div>
                )}

                <div className="rb-actions">
                  <Button size="lg" onClick={getEstimate} disabled={!!mapsDown || resolving || !!missing}>Get Estimate</Button>
                  {missing && !mapsDown && !resolving && <p className="rb-hint" role="status">{missing}</p>}
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

          {view === 'error' && (
            <div className="rb-failed" role="alert" data-rb-region="estimate error">
              <p className="rb-failed__title">The estimate didn’t load.</p>
              <p className="rb-failed__sub">Check your connection and try again.</p>
              <Button onClick={getEstimate}>Try again</Button>
              <button type="button" className="rb-edit" onClick={editTrip}>Edit trip details</button>
            </div>
          )}

          {view === 'result' && result && (
            <div className="rb-result" data-rb-region="estimate result">
              <p className="rb-result__route">{routeLine}</p>

              <RouteMap route={route} pickup={pickup.place} joined />
              <TripTiles route={route} round={result.labels.round} detail={tripParts(result)} />

              {result.long_drive && <LongDrive driveThrough={result.drive_through} onChange={setDriveThrough} />}
              <FarePanel key={estimateId} fare={result.total_fare} estimateId={estimateId} trip={tripOf(result)} />
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
              <p className="rb-disclaimer">{disclaimer}</p>
              <button type="button" className="rb-edit" onClick={editTrip}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
                Edit trip details
              </button>

              <div className="rb-book">
                {waDone ? (
                  <Done>{WAITLIST_JOINED}</Done>
                ) : (
                  <div id="waitlist" className="rb-waitlist">
                    <div>
                      <h3>Join the waitlist.</h3>
                      <p>Booking opens soon. Waitlist members go first.</p>
                    </div>
                    {wa.step === 'code' ? (
                      <CodeStep f={wa} onVerify={() => sendWaitlist(wa.code)} onResend={() => sendWaitlist('')} />
                    ) : (
                      <>
                        <PhoneField id="rb-waitlist-phone" value={waPhone} error={waErrors.phone}
                          onChange={(v) => { setWaPhone(v); setWaErrors((e) => ({ ...e, phone: '' })); }}
                          onError={(msg) => setWaErrors((e) => ({ ...e, phone: msg }))} />
                        <ConsentTick id="rb-waitlist-consent" checked={waConsent} error={waErrors.consent}
                          onChange={(v) => { setWaConsent(v); setWaErrors((e) => ({ ...e, consent: '' })); }} />
                        <Honeypot ref={honeypot} />
                        <Button onClick={submitWaitlist} disabled={wa.sending}>{wa.sending ? 'Joining…' : 'Join the Waitlist'}</Button>
                        <small>One message when the app is live. Nothing else.</small>
                      </>
                    )}
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

// The header's "Get an Estimate" stays on this page and brings back the form.
ReactDOM.createRoot(document.getElementById('rb-header')).render(<SiteHeader onGetEstimate={() => window.dispatchEvent(new CustomEvent('rb-get-estimate'))} />);
ReactDOM.createRoot(document.getElementById('app')).render(<App />);
