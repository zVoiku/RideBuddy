/* @ds-bundle: {"format":3,"namespace":"RideBuddyDesignSystem_f63581","components":[{"name":"BuddyCard","sourcePath":"components/booking/BuddyCard.jsx"},{"name":"CarCard","sourcePath":"components/booking/CarCard.jsx"},{"name":"FareRow","sourcePath":"components/booking/FareRow.jsx"},{"name":"TripCard","sourcePath":"components/booking/TripCard.jsx"},{"name":"TripTypeCard","sourcePath":"components/booking/TripTypeCard.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"OtpInput","sourcePath":"components/core/OtpInput.jsx"},{"name":"BottomSheet","sourcePath":"components/feedback/BottomSheet.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"BottomNav","sourcePath":"components/navigation/BottomNav.jsx"}],"sourceHashes":{"components/booking/BuddyCard.jsx":"ee3dabe440ff","components/booking/CarCard.jsx":"0e6c3b2d5484","components/booking/FareRow.jsx":"bce5a4b46efd","components/booking/TripCard.jsx":"715b1e67af08","components/booking/TripTypeCard.jsx":"d27c19f3eb74","components/core/Badge.jsx":"935b913a9b78","components/core/Button.jsx":"935eef1713f0","components/core/Card.jsx":"c99d6e17dc10","components/core/Chip.jsx":"dd5188f9c331","components/core/Input.jsx":"dadc5e8b0f1b","components/core/OtpInput.jsx":"c0b5f20f097d","components/feedback/BottomSheet.jsx":"b1f3e4b4222b","components/feedback/Toast.jsx":"e95d39668e98","components/navigation/BottomNav.jsx":"0581dd5ba3f8","ui_kits/customer_app/AccountScreen.jsx":"15c755afe943","ui_kits/customer_app/App.jsx":"e0c6a56948ec","ui_kits/customer_app/BookingScreen.jsx":"3fe99f32dc15","ui_kits/customer_app/HomeScreen.jsx":"5cf2d744e57b","ui_kits/customer_app/PhoneFrame.jsx":"a07f9af9996d","ui_kits/customer_app/SignInScreen.jsx":"be5461f6f3fd","ui_kits/customer_app/TripsScreen.jsx":"f180862c9341","ui_kits/customer_app/icons.jsx":"ba3d2a16d5b5"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.RideBuddyDesignSystem_f63581 = window.RideBuddyDesignSystem_f63581 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/booking/BuddyCard.jsx
try { (() => {
const CSS = `
.rb-buddy{ background:var(--surface-card); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-md); border:0.5px solid var(--border-hairline); box-sizing:border-box; }
.rb-buddy-top{ display:flex; align-items:center; gap:var(--space-3); margin-bottom:var(--space-4); }
.rb-buddy-avatar{
  width:56px; height:56px; border-radius:var(--radius-full); background:var(--color-green-100);
  display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;
  font-family:var(--font-display); font-weight:var(--weight-bold); font-size:20px; color:var(--color-green-700);
}
.rb-buddy-avatar img{ width:100%; height:100%; object-fit:cover; }
.rb-buddy-name{ font-family:var(--font-display); font-size:var(--text-lead); font-weight:var(--weight-bold); color:var(--text-primary); }
.rb-buddy-rating{ display:flex; align-items:center; gap:var(--space-1); margin-top:3px; }
.rb-buddy-star{ color:var(--star); font-size:14px; }
.rb-buddy-score{ font-family:var(--font-body); font-size:var(--text-ui); font-weight:var(--weight-medium); color:var(--text-primary); }
.rb-buddy-trips{ font-size:var(--text-caption); color:#888; }
.rb-buddy-details{ display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); margin-bottom:var(--space-4); }
.rb-buddy-detail{ background:var(--surface-soft); border-radius:var(--radius-md); padding:var(--space-2) var(--space-3); }
.rb-buddy-detail-label{ font-size:var(--text-micro); color:#888; display:block; }
.rb-buddy-detail-value{ font-family:var(--font-body); font-size:var(--text-label); font-weight:var(--weight-medium); color:var(--text-primary); margin-top:2px; display:block; letter-spacing:.02em; }
.rb-buddy-actions{ display:grid; grid-template-columns:1fr 1fr; gap:var(--space-2); }
.rb-buddy-action{
  border:1.5px solid var(--brand-primary); border-radius:var(--radius-lg); padding:var(--space-3);
  background:transparent; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:var(--space-2);
  font-family:var(--font-body); font-size:var(--text-label); font-weight:var(--weight-medium); color:var(--brand-primary);
  transition:all var(--duration-fast) var(--ease-default);
}
.rb-buddy-action:hover{ background:var(--color-green-50); box-shadow:var(--shadow-sm); }
.rb-buddy-action svg{ width:16px; height:16px; }
`;
const Phone = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M13.8 10.2a13 13 0 0 0 6 6l2-2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V19a1 1 0 0 1-1 1A17 17 0 0 1 3 5a1 1 0 0 1 1-1h3.4a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.2 1z",
  transform: "translate(-1.5 -1.5)"
}));
const Chat = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.9-.9L3 20l1.9-4.1A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.4 8.4 0 0 1 21 11.5z"
}));
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-buddy-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-buddy-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}
function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/**
 * Buddy (driver) card shown after assignment. Trust-first: avatar, rating,
 * masked license + phone, and masked Message / Call actions.
 */
function BuddyCard({
  name,
  rating,
  trips,
  license,
  phone,
  photo,
  onMessage,
  onCall,
  className = ''
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("div", {
    className: `rb-buddy ${className}`.trim()
  }, /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-avatar"
  }, photo ? /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: name
  }) : initials(name)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-name"
  }, name), /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-rating"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-star"
  }, "\u2605"), /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-score"
  }, rating), trips != null && /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-trips"
  }, "\xB7 ", trips, " trips")))), (license || phone) && /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-details"
  }, license && /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-detail"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-detail-label"
  }, "License"), /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-detail-value"
  }, license)), phone && /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-detail"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-detail-label"
  }, "Phone"), /*#__PURE__*/React.createElement("span", {
    className: "rb-buddy-detail-value"
  }, phone))), /*#__PURE__*/React.createElement("div", {
    className: "rb-buddy-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "rb-buddy-action",
    onClick: onMessage
  }, /*#__PURE__*/React.createElement(Chat, null), " Message Buddy"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "rb-buddy-action",
    onClick: onCall
  }, /*#__PURE__*/React.createElement(Phone, null), " Call Buddy")));
}
Object.assign(__ds_scope, { BuddyCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/BuddyCard.jsx", error: String((e && e.message) || e) }); }

// components/booking/CarCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-car-card{
  border-radius:var(--radius-lg); padding:var(--space-3); cursor:pointer; box-sizing:border-box;
  border:1.5px solid var(--border-control); background:var(--surface-card); width:100%; text-align:left;
  transition:all var(--duration-base) var(--ease-calm);
}
.rb-car-card:hover{ border-color:var(--color-green-300); }
.rb-car-card[aria-pressed="true"]{ border-color:var(--brand-primary); background:var(--color-green-50); }
.rb-car-photo{
  width:100%; height:56px; border-radius:var(--radius-md); background:#F0EDE8;
  display:flex; align-items:center; justify-content:center; margin-bottom:var(--space-2);
  overflow:hidden; color:var(--color-green-500);
}
.rb-car-photo svg{ width:30px; height:30px; }
.rb-car-photo img{ width:100%; height:100%; object-fit:cover; }
.rb-car-card[aria-pressed="true"] .rb-car-photo{ background:var(--color-green-100); }
.rb-car-make{ font-size:var(--text-micro); color:#888; display:block; }
.rb-car-model{ font-family:var(--font-display); font-size:var(--text-ui); font-weight:var(--weight-bold); color:var(--text-primary); display:block; }
.rb-car-plate{ font-size:var(--text-micro); color:#888; margin-top:2px; display:block; letter-spacing:.03em; }
`;
const CarGlyph = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "7",
  cy: "17",
  r: "2"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "17",
  cy: "17",
  r: "2"
}));
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-car-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-car-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Car selection card — photo slot (or placeholder) + make / model / plate.
 */
function CarCard({
  make,
  model,
  plate,
  photo,
  selected = false,
  className = '',
  ...rest
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-pressed": selected,
    className: `rb-car-card ${className}`.trim()
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "rb-car-photo"
  }, photo ? /*#__PURE__*/React.createElement("img", {
    src: photo,
    alt: `${make} ${model}`
  }) : /*#__PURE__*/React.createElement(CarGlyph, null)), /*#__PURE__*/React.createElement("span", {
    className: "rb-car-make"
  }, make), /*#__PURE__*/React.createElement("span", {
    className: "rb-car-model"
  }, model), plate && /*#__PURE__*/React.createElement("span", {
    className: "rb-car-plate"
  }, plate));
}
Object.assign(__ds_scope, { CarCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/CarCard.jsx", error: String((e && e.message) || e) }); }

// components/booking/FareRow.jsx
try { (() => {
const CSS = `
.rb-fare-row{
  display:flex; justify-content:space-between; align-items:center;
  padding:var(--space-2) 0; border-bottom:0.5px solid var(--border-hairline);
  font-family:var(--font-body); font-size:var(--text-ui);
}
.rb-fare-row:last-child{ border-bottom:none; }
.rb-fare-label{ color:#888; }
.rb-fare-value{ color:var(--text-primary); font-weight:var(--weight-medium); }
.rb-fare-row--total{ padding-top:var(--space-3); }
.rb-fare-row--total .rb-fare-label{ color:var(--text-primary); font-weight:var(--weight-medium); font-size:var(--text-body); }
.rb-fare-row--total .rb-fare-value{ font-family:var(--font-display); font-size:var(--text-h3); color:var(--brand-primary); font-weight:var(--weight-bold); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-fare-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-fare-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * A single label/value row in a fare breakdown. Use `total` for the summary row.
 */
function FareRow({
  label,
  value,
  total = false,
  className = ''
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("div", {
    className: `rb-fare-row ${total ? 'rb-fare-row--total' : ''} ${className}`.trim()
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-fare-label"
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "rb-fare-value"
  }, value));
}
Object.assign(__ds_scope, { FareRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/FareRow.jsx", error: String((e && e.message) || e) }); }

// components/booking/TripCard.jsx
try { (() => {
const CSS = `
.rb-trip-card{ background:var(--surface-card); border-radius:var(--radius-lg); padding:var(--space-4); box-shadow:var(--shadow-md); border:0.5px solid var(--border-hairline); box-sizing:border-box; }
.rb-trip-card-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-3); }
.rb-trip-id{ font-family:var(--font-body); font-size:var(--text-caption); color:#888; letter-spacing:.02em; }
.rb-trip-route{ display:flex; align-items:flex-start; gap:var(--space-3); }
.rb-route-col{ display:flex; flex-direction:column; align-items:center; gap:2px; padding-top:6px; flex-shrink:0; }
.rb-route-dot{ width:8px; height:8px; border-radius:var(--radius-full); background:var(--brand-primary); }
.rb-route-connector{ width:2px; height:22px; background:var(--color-green-100); }
.rb-route-dot-end{ width:8px; height:8px; border-radius:var(--radius-full); border:2px solid var(--brand-primary); background:transparent; box-sizing:border-box; }
.rb-trip-cities{ display:flex; flex-direction:column; gap:14px; flex:1; }
.rb-trip-city{ font-family:var(--font-display); font-size:var(--text-body); font-weight:var(--weight-bold); color:var(--text-primary); line-height:1; }
.rb-trip-details{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--space-2); margin-top:var(--space-4); }
.rb-trip-pill{ background:var(--surface-soft); border-radius:var(--radius-md); padding:var(--space-2); text-align:center; }
.rb-trip-pill-label{ font-size:var(--text-overline); color:#888; text-transform:uppercase; letter-spacing:.05em; display:block; }
.rb-trip-pill-value{ font-family:var(--font-body); font-size:var(--text-label); font-weight:var(--weight-medium); color:var(--text-primary); margin-top:2px; display:block; }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-tripcard-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-tripcard-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Upcoming trip card — route visualizer (origin → destination), status badge,
 * booking id and a 3-up detail pill row.
 */
function TripCard({
  from,
  to,
  bookingId,
  badge,
  details = [],
  className = ''
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("div", {
    className: `rb-trip-card ${className}`.trim()
  }, /*#__PURE__*/React.createElement("div", {
    className: "rb-trip-card-head"
  }, badge, bookingId && /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-id"
  }, bookingId)), /*#__PURE__*/React.createElement("div", {
    className: "rb-trip-route"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rb-route-col"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-route-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "rb-route-connector"
  }), /*#__PURE__*/React.createElement("span", {
    className: "rb-route-dot-end"
  })), /*#__PURE__*/React.createElement("div", {
    className: "rb-trip-cities"
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-city"
  }, from), /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-city"
  }, to))), details.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "rb-trip-details"
  }, details.map((d, i) => /*#__PURE__*/React.createElement("div", {
    className: "rb-trip-pill",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-pill-label"
  }, d.label), /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-pill-value"
  }, d.value)))));
}
Object.assign(__ds_scope, { TripCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/TripCard.jsx", error: String((e && e.message) || e) }); }

// components/booking/TripTypeCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-trip-type{
  border-radius:var(--radius-lg); padding:var(--space-4) var(--space-3);
  cursor:pointer; box-sizing:border-box; text-align:center; width:100%;
  border:1.5px solid var(--border-control); background:var(--surface-card);
  transition:all var(--duration-base) var(--ease-calm);
}
.rb-trip-type:hover{ border-color:var(--color-green-300); background:var(--color-green-50); }
.rb-trip-type[aria-pressed="true"]{ border-color:var(--brand-primary); background:var(--color-green-50); }
.rb-trip-type-icon{ font-size:24px; line-height:1; color:var(--color-green-300); margin-bottom:var(--space-2); display:flex; justify-content:center; }
.rb-trip-type-icon svg{ width:24px; height:24px; }
.rb-trip-type[aria-pressed="true"] .rb-trip-type-icon{ color:var(--brand-primary); }
.rb-trip-type-name{ font-family:var(--font-display); font-size:var(--text-body); font-weight:var(--weight-bold); color:var(--text-primary); display:block; }
.rb-trip-type[aria-pressed="true"] .rb-trip-type-name{ color:var(--brand-primary); }
.rb-trip-type-desc{ font-size:var(--text-micro); color:#888; margin-top:2px; display:block; }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-triptype-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-triptype-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Trip-type selection card (Outstation / In City). Use two side by side.
 */
function TripTypeCard({
  icon,
  name,
  description,
  selected = false,
  className = '',
  ...rest
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-pressed": selected,
    className: `rb-trip-type ${className}`.trim()
  }, rest), icon && /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-type-icon"
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-type-name"
  }, name), description && /*#__PURE__*/React.createElement("span", {
    className: "rb-trip-type-desc"
  }, description));
}
Object.assign(__ds_scope, { TripTypeCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/booking/TripTypeCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-badge{
  display:inline-flex; align-items:center; gap:var(--space-1);
  border-radius:var(--radius-sm); padding:var(--space-1) var(--space-2);
  font-family:var(--font-body); font-size:var(--text-caption); font-weight:var(--weight-medium);
  white-space:nowrap;
}
.rb-badge--confirmed  { background:var(--badge-confirmed-bg);  color:var(--badge-confirmed-fg); }
.rb-badge--pending    { background:var(--badge-pending-bg);    color:var(--badge-pending-fg); }
.rb-badge--assigned   { background:var(--badge-assigned-bg);   color:var(--badge-assigned-fg); }
.rb-badge--cancelled  { background:var(--badge-cancelled-bg);  color:var(--badge-cancelled-fg); }
.rb-badge--in-progress{ background:var(--badge-inprogress-bg); color:var(--badge-inprogress-fg); }
.rb-badge--completed  { background:var(--badge-completed-bg);  color:var(--badge-completed-fg); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-badge-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-badge-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Small status pill for booking & trip states.
 */
function Badge({
  status = 'confirmed',
  children,
  className = '',
  ...rest
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `rb-badge rb-badge--${status} ${className}`.trim()
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-btn{
  display:inline-flex; align-items:center; justify-content:center; gap:var(--space-2);
  width:100%; border:none; cursor:pointer; box-sizing:border-box;
  font-family:var(--font-body); font-size:var(--text-body); font-weight:var(--weight-medium);
  border-radius:var(--radius-lg); min-height:var(--space-12);
  padding:var(--space-3) var(--space-6);
  transition:background-color var(--duration-fast) var(--ease-default),
             box-shadow var(--duration-fast) var(--ease-default),
             transform var(--duration-fast) var(--ease-default),
             border-color var(--duration-fast) var(--ease-default);
}
.rb-btn:active{ transform:scale(0.98); }
.rb-btn:disabled,.rb-btn[disabled]{ opacity:.45; cursor:not-allowed; pointer-events:none; }

.rb-btn--sm{ min-height:40px; font-size:var(--text-ui); padding:var(--space-2) var(--space-5); }
.rb-btn--lg{ min-height:56px; }
.rb-btn--auto{ width:auto; }

.rb-btn--primary{ background:var(--brand-primary); color:var(--text-on-brand); }
.rb-btn--primary:hover{ background:var(--brand-primary-hover); box-shadow:var(--shadow-md); }
.rb-btn--primary:active{ background:var(--brand-primary-press); }

.rb-btn--secondary{ background:transparent; color:var(--brand-primary); border:1.5px solid var(--brand-primary); }
.rb-btn--secondary:hover{ background:var(--color-green-50); box-shadow:var(--shadow-sm); }
.rb-btn--secondary:active{ background:var(--color-green-100); }

.rb-btn--ghost{ background:transparent; color:var(--color-error); min-height:40px; font-size:var(--text-ui); }
.rb-btn--ghost:hover{ background:rgba(198,40,40,0.06); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-btn-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-btn-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * RideBuddy primary action button. Full-width by default on mobile.
 */
function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  leadingIcon,
  trailingIcon,
  children,
  className = '',
  ...rest
}) {
  injectCSS();
  const cls = ['rb-btn', `rb-btn--${variant}`, size === 'sm' ? 'rb-btn--sm' : size === 'lg' ? 'rb-btn--lg' : '', fullWidth ? '' : 'rb-btn--auto', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls
  }, rest), leadingIcon, children, trailingIcon);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-card{
  background:var(--surface-card); border-radius:var(--radius-lg);
  padding:var(--space-4); box-shadow:var(--shadow-md);
  border:0.5px solid var(--border-hairline); box-sizing:border-box;
}
.rb-card--flat{ box-shadow:none; }
.rb-card--accent{ background:var(--color-green-50); border-color:transparent; box-shadow:none; }
.rb-card-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-3); }
.rb-card-title{ font-family:var(--font-display); font-size:var(--text-title); font-weight:var(--weight-bold); color:var(--text-primary); margin:0; }
.rb-card-meta{ font-family:var(--font-body); font-size:var(--text-caption); color:var(--text-secondary); }
.rb-card-divider{ border:none; border-top:0.5px solid var(--border-hairline); margin:var(--space-3) 0; }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-card-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-card-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Standard surface container — white, radius-lg, soft shadow, hairline border.
 */
function Card({
  title,
  meta,
  variant = 'default',
  children,
  className = '',
  ...rest
}) {
  injectCSS();
  const cls = ['rb-card', variant === 'flat' ? 'rb-card--flat' : '', variant === 'accent' ? 'rb-card--accent' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), (title || meta) && /*#__PURE__*/React.createElement("div", {
    className: "rb-card-header"
  }, title && /*#__PURE__*/React.createElement("h3", {
    className: "rb-card-title"
  }, title), meta && /*#__PURE__*/React.createElement("span", {
    className: "rb-card-meta"
  }, meta)), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-chip{
  display:inline-flex; align-items:center; gap:var(--space-1);
  border-radius:var(--radius-full); padding:var(--space-1) var(--space-4);
  min-height:34px; box-sizing:border-box;
  font-family:var(--font-body); font-size:var(--text-label); font-weight:var(--weight-regular);
  cursor:pointer; border:1.5px solid var(--border-control); background:var(--color-white); color:#666;
  transition:all var(--duration-fast) var(--ease-default);
}
.rb-chip:hover{ border-color:var(--color-green-300); }
.rb-chip[aria-pressed="true"]{
  border-color:var(--brand-primary); background:var(--color-green-50);
  color:var(--brand-primary); font-weight:var(--weight-medium);
}
.rb-chip:disabled{ opacity:.45; cursor:not-allowed; }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-chip-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-chip-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Pill selection chip — single-select toggle (Round Trip / One Way, payment type).
 */
function Chip({
  selected = false,
  children,
  className = '',
  ...rest
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-pressed": selected,
    className: `rb-chip ${className}`.trim()
  }, rest), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-field{ display:flex; flex-direction:column; gap:var(--space-2); }
.rb-label{ font-family:var(--font-body); font-size:var(--text-label); font-weight:var(--weight-medium); color:#888; }
.rb-input-wrap{ position:relative; display:flex; align-items:center; }
.rb-input-glyph{
  position:absolute; left:14px; top:50%; transform:translateY(-50%);
  font-size:18px; color:var(--text-placeholder); pointer-events:none; display:flex;
}
.rb-input{
  width:100%; box-sizing:border-box; border:none; border-radius:var(--radius-lg);
  padding:var(--space-3) var(--space-4); font-family:var(--font-body); font-size:var(--text-body);
  outline:none; background:var(--surface-input); color:var(--text-primary);
  transition:box-shadow var(--duration-fast) var(--ease-default), background-color var(--duration-fast) var(--ease-default);
}
.rb-input::placeholder{ color:var(--text-placeholder); }
.rb-input--icon{ padding-left:42px; }
.rb-input:focus{ box-shadow:var(--ring-focus); }
.rb-input--error{ background:#FFF5F5; box-shadow:0 0 0 1.5px var(--color-error); }
.rb-error-msg{ font-family:var(--font-body); font-size:var(--text-caption); color:var(--color-error); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-input-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-input-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Filled (parchment) text input with optional label, leading icon and error state.
 */
function Input({
  label,
  icon,
  error,
  className = '',
  id,
  ...rest
}) {
  injectCSS();
  const inputId = id || (label ? `rb-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const inputCls = ['rb-input', icon ? 'rb-input--icon' : '', error ? 'rb-input--error' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("div", {
    className: "rb-field"
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "rb-label",
    htmlFor: inputId
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "rb-input-wrap"
  }, icon && /*#__PURE__*/React.createElement("span", {
    className: "rb-input-glyph"
  }, icon), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    className: inputCls
  }, rest))), error && typeof error === 'string' && /*#__PURE__*/React.createElement("span", {
    className: "rb-error-msg"
  }, error));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/OtpInput.jsx
try { (() => {
const CSS = `
.rb-otp-group{ display:flex; gap:var(--space-2); }
.rb-otp-input{
  width:44px; height:52px; border:none; border-radius:var(--radius-lg);
  background:var(--surface-input); font-family:var(--font-display); font-size:22px;
  font-weight:var(--weight-bold); text-align:center; color:var(--text-primary);
  outline:none; caret-color:var(--brand-primary);
  transition:box-shadow var(--duration-fast) var(--ease-default);
}
.rb-otp-input:focus{ box-shadow:var(--ring-focus); }
.rb-otp-input.rb-otp--filled{ box-shadow:0 0 0 1.5px var(--color-green-300); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-otp-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-otp-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * 6-box one-time-passcode input used in the sign-up / verification flow.
 */
function OtpInput({
  length = 6,
  value = '',
  onChange = () => {}
}) {
  injectCSS();
  const refs = React.useRef([]);
  const chars = value.padEnd(length).slice(0, length).split('');
  const setChar = (i, ch) => {
    const next = chars.slice();
    next[i] = ch.slice(-1);
    const joined = next.join('').trimEnd();
    onChange(joined);
    if (ch && i < length - 1) refs.current[i + 1]?.focus();
  };
  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !chars[i].trim() && i > 0) refs.current[i - 1]?.focus();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "rb-otp-group"
  }, Array.from({
    length
  }).map((_, i) => /*#__PURE__*/React.createElement("input", {
    key: i,
    ref: el => refs.current[i] = el,
    className: `rb-otp-input ${chars[i].trim() ? 'rb-otp--filled' : ''}`.trim(),
    inputMode: "numeric",
    maxLength: 1,
    value: chars[i].trim(),
    onChange: e => setChar(i, e.target.value),
    onKeyDown: e => onKeyDown(i, e),
    "aria-label": `Digit ${i + 1}`
  })));
}
Object.assign(__ds_scope, { OtpInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/OtpInput.jsx", error: String((e && e.message) || e) }); }

// components/feedback/BottomSheet.jsx
try { (() => {
const CSS = `
.rb-sheet-overlay{
  position:absolute; inset:0; background:rgba(30,30,26,0.5);
  z-index:var(--z-sheet); display:flex; align-items:flex-end;
  animation:rb-overlay-in var(--duration-base) var(--ease-default) both;
}
@keyframes rb-overlay-in{ from{ opacity:0; } to{ opacity:1; } }
.rb-sheet{
  width:100%; box-sizing:border-box; background:var(--surface-card);
  border-radius:var(--radius-xl) var(--radius-xl) 0 0;
  padding:var(--space-5) var(--space-4) var(--space-6);
  box-shadow:var(--shadow-lg); z-index:calc(var(--z-sheet) + 1);
  animation:rb-sheet-up var(--duration-slow) var(--ease-enter) both;
}
@keyframes rb-sheet-up{ from{ transform:translateY(100%); } to{ transform:translateY(0); } }
.rb-sheet-handle{ width:36px; height:4px; border-radius:var(--radius-full); background:rgba(100,100,100,0.2); margin:0 auto var(--space-4); }
.rb-sheet-title{ font-family:var(--font-display); font-size:var(--text-h3); font-weight:var(--weight-bold); color:var(--text-primary); margin:0 0 var(--space-1); }
.rb-sheet-sub{ font-size:var(--text-ui); color:#888; margin:0 0 var(--space-4); }
`;
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-sheet-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-sheet-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Bottom sheet — slides up from the bottom for fare breakdowns, payment,
 * pickers and confirmations. Renders an overlay + handle + title block.
 */
function BottomSheet({
  open = true,
  title,
  subtitle,
  onClose,
  children
}) {
  injectCSS();
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "rb-sheet-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "rb-sheet",
    onClick: e => e.stopPropagation(),
    role: "dialog",
    "aria-modal": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "rb-sheet-handle"
  }), title && /*#__PURE__*/React.createElement("h3", {
    className: "rb-sheet-title"
  }, title), subtitle && /*#__PURE__*/React.createElement("p", {
    className: "rb-sheet-sub"
  }, subtitle), children));
}
Object.assign(__ds_scope, { BottomSheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/BottomSheet.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.rb-toast{
  display:flex; align-items:flex-start; gap:var(--space-3); box-sizing:border-box;
  border-radius:var(--radius-lg); padding:var(--space-3) var(--space-4);
  box-shadow:var(--shadow-xl); max-width:420px;
  animation:rb-toast-enter var(--duration-enter) var(--ease-enter) both;
}
@keyframes rb-toast-enter{ from{ opacity:0; transform:translateY(var(--space-4)); } to{ opacity:1; transform:translateY(0); } }
.rb-toast--success{ background:#E8F5E9; border-left:3px solid var(--color-success); }
.rb-toast--warning{ background:#FFF3E0; border-left:3px solid var(--color-warning); }
.rb-toast--error{   background:#FFEBEE; border-left:3px solid var(--color-error); }
.rb-toast--info{    background:#E3F2FD; border-left:3px solid var(--color-info); }
.rb-toast-icon{ font-size:18px; line-height:1; flex-shrink:0; margin-top:1px; }
.rb-toast--success .rb-toast-icon{ color:var(--color-success); }
.rb-toast--warning .rb-toast-icon{ color:var(--color-warning); }
.rb-toast--error .rb-toast-icon{ color:var(--color-error); }
.rb-toast--info .rb-toast-icon{ color:var(--color-info); }
.rb-toast-body{ flex:1; }
.rb-toast-title{ font-family:var(--font-body); font-size:var(--text-ui); font-weight:var(--weight-medium); color:var(--text-primary); }
.rb-toast-sub{ font-size:var(--text-caption); color:#666; margin-top:1px; }
`;
const ICONS = {
  success: '✓',
  warning: '!',
  error: '×',
  info: 'i'
};
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-toast-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-toast-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Toast / inline alert with a severity accent stripe. Slides up on enter.
 */
function Toast({
  type = 'success',
  title,
  children,
  icon,
  className = '',
  ...rest
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `rb-toast rb-toast--${type} ${className}`.trim(),
    role: "status"
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "rb-toast-icon"
  }, icon ?? ICONS[type]), /*#__PURE__*/React.createElement("div", {
    className: "rb-toast-body"
  }, title && /*#__PURE__*/React.createElement("div", {
    className: "rb-toast-title"
  }, title), children && /*#__PURE__*/React.createElement("div", {
    className: "rb-toast-sub"
  }, children)));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/navigation/BottomNav.jsx
try { (() => {
const CSS = `
.rb-bottom-nav{
  display:flex; box-sizing:border-box; width:100%;
  background:var(--surface-card); border-top:0.5px solid rgba(100,100,100,0.12);
  border-radius:var(--radius-xl) var(--radius-xl) 0 0; box-shadow:var(--shadow-lg);
  padding:var(--space-2) 0 var(--space-1);
}
.rb-nav-item{
  flex:1; display:flex; flex-direction:column; align-items:center; gap:3px;
  cursor:pointer; padding:var(--space-2) 0; border:none; background:transparent;
  transition:color var(--duration-base) var(--ease-calm);
}
.rb-nav-icon{ color:var(--color-grey-nav); display:flex; transition:color var(--duration-base) var(--ease-calm); }
.rb-nav-icon svg{ width:22px; height:22px; }
.rb-nav-label{ font-family:var(--font-body); font-size:var(--text-micro); color:var(--color-grey-nav); transition:color var(--duration-base) var(--ease-calm); }
.rb-nav-dot{ width:4px; height:4px; border-radius:var(--radius-full); background:var(--brand-primary); opacity:0; transition:opacity var(--duration-fast) var(--ease-default); }
.rb-nav-item[aria-current="page"] .rb-nav-icon{ color:var(--brand-primary); }
.rb-nav-item[aria-current="page"] .rb-nav-label{ color:var(--brand-primary); font-weight:var(--weight-medium); }
.rb-nav-item[aria-current="page"] .rb-nav-dot{ opacity:1; }
`;
const I = p => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, p);
const ICONS = {
  home: I(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 22V12h6v10"
  }))),
  trips: I(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "19",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "5",
    r: "3"
  }))),
  messages: I(/*#__PURE__*/React.createElement("path", {
    d: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
  })),
  account: I(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 21a8 8 0 0 0-16 0"
  })))
};
const DEFAULT_TABS = [{
  id: 'home',
  label: 'Home',
  icon: 'home'
}, {
  id: 'trips',
  label: 'My Trips',
  icon: 'trips'
}, {
  id: 'messages',
  label: 'Messages',
  icon: 'messages'
}, {
  id: 'account',
  label: 'Account',
  icon: 'account'
}];
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('rb-nav-css')) return;
  const el = document.createElement('style');
  el.id = 'rb-nav-css';
  el.textContent = CSS;
  document.head.appendChild(el);
}

/**
 * Fixed bottom navigation bar. Active tab shows Trail Green icon, label and dot.
 */
function BottomNav({
  tabs = DEFAULT_TABS,
  active = 'home',
  onChange = () => {}
}) {
  injectCSS();
  return /*#__PURE__*/React.createElement("nav", {
    className: "rb-bottom-nav"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    type: "button",
    className: "rb-nav-item",
    "aria-current": active === t.id ? 'page' : undefined,
    onClick: () => onChange(t.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "rb-nav-icon"
  }, ICONS[t.icon] || ICONS.home), /*#__PURE__*/React.createElement("span", {
    className: "rb-nav-label"
  }, t.label), /*#__PURE__*/React.createElement("span", {
    className: "rb-nav-dot"
  }))));
}
Object.assign(__ds_scope, { BottomNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/BottomNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/AccountScreen.jsx
try { (() => {
// RideBuddy UI kit — Account tab.
(function () {
  const I = window.RBIcons;
  const {
    TabHeader
  } = window.RBScreens;
  const ITEMS = [['User', 'Profile', 'Rahul Mehta · +91 98XXX XXXXX'], ['Car', 'My Cars', '2 saved vehicles'], ['CreditCard', 'Payments', 'UPI · default'], ['Users', 'Family', 'Add riders to your account'], ['Bell', 'Notifications', 'SMS & in-app'], ['Headset', 'Help & Support', 'Chat with us'], ['Gift', 'Refer & Earn', 'Invite a friend']];
  function AccountScreen() {
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-scroll",
      style: {
        paddingBottom: 96
      }
    }, window.RBScreens.TabHeader({
      title: 'Account'
    }), /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'var(--color-green-50)',
        borderRadius: 12,
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 52,
        height: 52,
        borderRadius: 9999,
        background: 'var(--color-green-100)',
        color: 'var(--color-green-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 18
      }
    }, "RM"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 17,
        color: 'var(--text-primary)'
      }
    }, "Rahul Mehta"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-secondary)'
      }
    }, "+91 98XXX XXXXX"))), /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-hairline)',
        borderRadius: 12,
        padding: '4px 16px',
        boxShadow: 'var(--shadow-sm)'
      }
    }, ITEMS.map(([ic, title, sub]) => /*#__PURE__*/React.createElement("div", {
      className: "rb-acct-item",
      key: title
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-acct-icon"
    }, React.createElement(I[ic])), /*#__PURE__*/React.createElement("div", {
      className: "rb-acct-txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-acct-title"
    }, title), /*#__PURE__*/React.createElement("div", {
      className: "rb-acct-sub"
    }, sub)), /*#__PURE__*/React.createElement("span", {
      className: "rb-acct-chev"
    }, /*#__PURE__*/React.createElement(I.ChevronRight, null)))))));
  }
  window.RBScreens = Object.assign(window.RBScreens || {}, {
    AccountScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/AccountScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/App.jsx
try { (() => {
// RideBuddy UI kit — App orchestrator (auth → tabs + booking flow).
(function () {
  const {
    PhoneFrame
  } = window.RBShell;
  const S = window.RBScreens;
  const I = window.RBIcons;
  const BUDDY = {
    name: 'Rajesh Singh',
    rating: '4.9',
    trips: 312,
    license: 'PB ●●●● 4521',
    phone: '+91 98●●● ●●321'
  };
  function MessagesScreen({
    trip
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-scroll",
      style: {
        paddingBottom: 96
      }
    }, S.TabHeader({
      title: 'Messages'
    }), /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, trip ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-hairline)',
        borderRadius: 12,
        padding: 16,
        boxShadow: 'var(--shadow-sm)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 9999,
        background: 'var(--color-green-100)',
        color: 'var(--color-green-700)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: 700
      }
    }, "RS"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 15,
        color: 'var(--text-primary)'
      }
    }, "Rajesh Singh"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-secondary)'
      }
    }, "He\u2019ll be there at 5:45 AM sharp."))) : /*#__PURE__*/React.createElement("div", {
      className: "rb-trips-empty"
    }, "No messages yet.")));
  }
  function App() {
    const {
      BottomNav,
      Toast
    } = window.RideBuddyDesignSystem_f63581;
    const [authed, setAuthed] = React.useState(false);
    const [view, setView] = React.useState('tabs'); // 'tabs' | 'booking'
    const [tab, setTab] = React.useState('home');
    const [trip, setTrip] = React.useState(null);
    const [buddy, setBuddy] = React.useState(null);
    const [toast, setToast] = React.useState(null);
    const flash = (node, ms = 2600) => {
      setToast(node);
      window.clearTimeout(flash._t);
      flash._t = window.setTimeout(() => setToast(null), ms);
    };
    if (!authed) {
      return /*#__PURE__*/React.createElement(PhoneFrame, {
        tone: "dark"
      }, /*#__PURE__*/React.createElement(S.SignInScreen, {
        onDone: () => setAuthed(true)
      }));
    }
    if (view === 'booking') {
      return /*#__PURE__*/React.createElement(PhoneFrame, {
        tone: "dark"
      }, /*#__PURE__*/React.createElement(S.BookingScreen, {
        onBack: () => setView('tabs'),
        onConfirm: t => {
          setTrip(t);
          setBuddy(null);
          setView('tabs');
          setTab('home');
          flash(/*#__PURE__*/React.createElement(Toast, {
            type: "success",
            title: "Trip confirmed."
          }));
          window.setTimeout(() => {
            setBuddy(BUDDY);
            flash(/*#__PURE__*/React.createElement(Toast, {
              type: "info",
              title: "Buddy assigned"
            }, "Rajesh \xB7 \u2605 4.9"));
          }, 3000);
        }
      }));
    }
    const tone = tab === 'home' ? 'light' : 'dark';
    return /*#__PURE__*/React.createElement(PhoneFrame, {
      tone: tone
    }, tab === 'home' && /*#__PURE__*/React.createElement(S.HomeScreen, {
      trip: trip,
      buddy: buddy,
      onBook: () => setView('booking')
    }), tab === 'trips' && /*#__PURE__*/React.createElement(S.TripsScreen, {
      trip: trip
    }), tab === 'messages' && /*#__PURE__*/React.createElement(MessagesScreen, {
      trip: trip
    }), tab === 'account' && /*#__PURE__*/React.createElement(S.AccountScreen, null), toast && /*#__PURE__*/React.createElement("div", {
      className: "rb-toast-host"
    }, toast), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingBottom: 14,
        background: 'var(--surface-card)'
      }
    }, /*#__PURE__*/React.createElement(BottomNav, {
      active: tab,
      onChange: setTab
    })));
  }
  window.RBApp = App;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/BookingScreen.jsx
try { (() => {
// RideBuddy UI kit — Booking flow (trip details → fare sheet → confirm & pay).
(function () {
  const I = window.RBIcons;
  function BookingScreen({
    onBack,
    onConfirm
  }) {
    const {
      Button,
      Input,
      Chip,
      TripTypeCard,
      CarCard,
      BottomSheet,
      FareRow
    } = window.RideBuddyDesignSystem_f63581;
    const [tripType, setTripType] = React.useState('out');
    const [direction, setDirection] = React.useState('oneway');
    const [car, setCar] = React.useState('creta');
    const [pickup, setPickup] = React.useState('Sector 17, Chandigarh');
    const [dest, setDest] = React.useState('Shimla, Himachal Pradesh');
    const [sheet, setSheet] = React.useState(false);
    const [pay, setPay] = React.useState('partial');
    const total = direction === 'round' ? 4200 : 2400;
    const deposit = Math.round(total * 0.25);
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-screen"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-topbar"
    }, /*#__PURE__*/React.createElement("button", {
      className: "rb-back",
      onClick: onBack,
      "aria-label": "Back"
    }, /*#__PURE__*/React.createElement(I.ArrowLeft, null)), /*#__PURE__*/React.createElement("span", {
      className: "ttl"
    }, "Book a Buddy")), /*#__PURE__*/React.createElement("div", {
      className: "rb-scroll"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Trip Type"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement(TripTypeCard, {
      icon: /*#__PURE__*/React.createElement(I.Mountain, null),
      name: "Outstation",
      description: "Intercity & hill trips",
      selected: tripType === 'out',
      onClick: () => setTripType('out')
    }), /*#__PURE__*/React.createElement(TripTypeCard, {
      icon: /*#__PURE__*/React.createElement(I.Building, null),
      name: "In City",
      description: "Local rides & commute",
      selected: tripType === 'city',
      onClick: () => setTripType('city')
    })), /*#__PURE__*/React.createElement(Input, {
      label: "Pickup",
      icon: /*#__PURE__*/React.createElement(I.MapPin, {
        style: {
          width: 18,
          height: 18
        }
      }),
      value: pickup,
      onChange: e => setPickup(e.target.value)
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Destination",
      icon: /*#__PURE__*/React.createElement(I.Navigation, {
        style: {
          width: 18,
          height: 18
        }
      }),
      value: dest,
      onChange: e => setDest(e.target.value)
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-2)'
      }
    }, /*#__PURE__*/React.createElement(Chip, {
      selected: direction === 'round',
      onClick: () => setDirection('round')
    }, "Round Trip"), /*#__PURE__*/React.createElement(Chip, {
      selected: direction === 'oneway',
      onClick: () => setDirection('oneway')
    }, "One Way")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Date",
      icon: /*#__PURE__*/React.createElement(I.Calendar, {
        style: {
          width: 18,
          height: 18
        }
      }),
      defaultValue: "Thu, 5 Jun"
    }), /*#__PURE__*/React.createElement(Input, {
      label: "Pickup time",
      icon: /*#__PURE__*/React.createElement(I.Clock, {
        style: {
          width: 18,
          height: 18
        }
      }),
      defaultValue: "5:45 AM"
    })), /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Your Car"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-3)'
      }
    }, /*#__PURE__*/React.createElement(CarCard, {
      make: "Hyundai",
      model: "Creta",
      plate: "PB 65 AB 1234",
      selected: car === 'creta',
      onClick: () => setCar('creta')
    }), /*#__PURE__*/React.createElement(CarCard, {
      make: "Maruti",
      model: "Ertiga",
      plate: "PB 10 CX 7788",
      selected: car === 'ertiga',
      onClick: () => setCar('ertiga')
    })))), /*#__PURE__*/React.createElement("div", {
      className: "rb-sticky-cta"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setSheet(true)
    }, "Get Estimate")), sheet && /*#__PURE__*/React.createElement(BottomSheet, {
      title: "Fare Breakdown",
      subtitle: `${pickup.split(',')[0]} → ${dest.split(',')[0]} · ${direction === 'round' ? 'Round Trip' : 'One Way'}`,
      onClose: () => setSheet(false)
    }, /*#__PURE__*/React.createElement(FareRow, {
      label: "Base fare",
      value: `₹${(total - 400).toLocaleString('en-IN')}`
    }), /*#__PURE__*/React.createElement(FareRow, {
      label: "Tolls & permits",
      value: "\u20B9240"
    }), /*#__PURE__*/React.createElement(FareRow, {
      label: "Driver allowance",
      value: "\u20B90"
    }), /*#__PURE__*/React.createElement(FareRow, {
      label: "GST (5%)",
      value: "\u20B9160"
    }), /*#__PURE__*/React.createElement(FareRow, {
      label: "Total",
      value: `₹${total.toLocaleString('en-IN')}`,
      total: true
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        margin: '16px 0 4px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-section-label",
      style: {
        marginBottom: 10
      }
    }, "Payment"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 'var(--space-2)'
      }
    }, /*#__PURE__*/React.createElement(Chip, {
      selected: pay === 'full',
      onClick: () => setPay('full')
    }, "Full Payment"), /*#__PURE__*/React.createElement(Chip, {
      selected: pay === 'partial',
      onClick: () => setPay('partial')
    }, "Partial Deposit"))), pay === 'partial' && /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--color-green-50)',
        color: 'var(--color-green-700)',
        borderRadius: 8,
        padding: 12,
        fontSize: 12,
        lineHeight: 1.5,
        marginBottom: 14
      }
    }, "Pay \u20B9", deposit.toLocaleString('en-IN'), " now to confirm. Balance of \u20B9", (total - deposit).toLocaleString('en-IN'), " due at trip end."), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => onConfirm({
        from: pickup.split(',')[0],
        to: dest.split(',')[0],
        date: 'Thu 5 Jun',
        time: '5:45 AM',
        tripType: direction === 'round' ? 'Round' : 'One Way',
        id: '#RB2049'
      })
    }, "Confirm & Pay \u20B9", (pay === 'partial' ? deposit : total).toLocaleString('en-IN'))));
  }
  window.RBScreens = Object.assign(window.RBScreens || {}, {
    BookingScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/BookingScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/HomeScreen.jsx
try { (() => {
// RideBuddy UI kit — Home screen (contextual: booking launcher OR upcoming trip).
(function () {
  const I = window.RBIcons;
  function HomeScreen({
    trip,
    buddy,
    onBook
  }) {
    const {
      Button,
      Badge,
      TripCard,
      BuddyCard
    } = window.RideBuddyDesignSystem_f63581;
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-scroll",
      style: {
        paddingBottom: 96
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-appbar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-appbar-row"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "greeting"
    }, "Good morning"), /*#__PURE__*/React.createElement("div", {
      className: "name"
    }, "Rahul Mehta")), /*#__PURE__*/React.createElement("button", {
      className: "rb-iconbtn",
      "aria-label": "Notifications"
    }, /*#__PURE__*/React.createElement(I.Bell, null)))), !trip ? /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 26,
        color: 'var(--text-primary)'
      }
    }, "Where to?"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: 'var(--text-secondary)',
        marginTop: 4
      }
    }, "Book a verified Buddy for your next trip.")), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      leadingIcon: /*#__PURE__*/React.createElement(I.Navigation, {
        style: {
          width: 18,
          height: 18
        }
      }),
      onClick: onBook
    }, "Book a Buddy"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        marginTop: 4
      }
    }, [['Shield', 'Verified'], ['User', 'Trained'], ['MapPin', 'Local']].map(([ic, t]) => /*#__PURE__*/React.createElement("div", {
      key: t,
      style: {
        flex: 1,
        background: 'var(--surface-card)',
        border: '0.5px solid var(--border-hairline)',
        borderRadius: 12,
        padding: '14px 10px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-sm)'
      }
    }, React.createElement(I[ic], {
      style: {
        width: 20,
        height: 20,
        color: 'var(--brand-primary)',
        margin: '0 auto 6px'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--text-primary)'
      }
    }, t))))) : /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Upcoming Trip"), /*#__PURE__*/React.createElement(TripCard, {
      from: trip.from,
      to: trip.to,
      bookingId: trip.id,
      badge: /*#__PURE__*/React.createElement(Badge, {
        status: buddy ? 'assigned' : 'confirmed'
      }, buddy ? 'Buddy Assigned' : 'Confirmed'),
      details: [{
        label: 'Date',
        value: trip.date
      }, {
        label: 'Pickup',
        value: trip.time
      }, {
        label: 'Type',
        value: trip.tripType
      }]
    }), buddy ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Your Buddy"), /*#__PURE__*/React.createElement(BuddyCard, {
      name: buddy.name,
      rating: buddy.rating,
      trips: buddy.trips,
      license: buddy.license,
      phone: buddy.phone
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        background: 'var(--color-green-50)',
        borderRadius: 12,
        padding: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-finding"
    }, /*#__PURE__*/React.createElement(I.Loader, {
      className: "rb-spin"
    }), " Finding your Buddy."), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'var(--text-secondary)',
        marginTop: 6
      }
    }, "We\u2019ll notify you the moment your Buddy is assigned.")), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      onClick: onBook
    }, "Book another trip")));
  }
  window.RBScreens = Object.assign(window.RBScreens || {}, {
    HomeScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/PhoneFrame.jsx
try { (() => {
// RideBuddy UI kit — device shell (status bar, notch, home indicator).
(function () {
  const I = window.RBIcons;
  function StatusBar({
    tone = 'dark'
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: `rb-statusbar rb-statusbar--${tone}`
    }, /*#__PURE__*/React.createElement("span", null, "9:41"), /*#__PURE__*/React.createElement("div", {
      className: "right"
    }, /*#__PURE__*/React.createElement(I.Signal, null), /*#__PURE__*/React.createElement(I.Wifi, null), /*#__PURE__*/React.createElement(I.Battery, null)));
  }

  // tone = status bar / home-indicator color theme ('light' over green, 'dark' over white)
  function PhoneFrame({
    tone = 'dark',
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-phone"
    }, /*#__PURE__*/React.createElement("div", {
      className: "rb-notch"
    }), /*#__PURE__*/React.createElement(StatusBar, {
      tone: tone
    }), /*#__PURE__*/React.createElement("div", {
      className: "rb-screen"
    }, children), /*#__PURE__*/React.createElement("div", {
      className: `rb-home-indicator ${tone === 'light' ? 'rb-home-indicator--light' : ''}`
    }));
  }
  window.RBShell = {
    PhoneFrame,
    StatusBar
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/PhoneFrame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/SignInScreen.jsx
try { (() => {
// RideBuddy UI kit — Sign-in screen (phone entry → OTP verification).
(function () {
  function SignInScreen({
    onDone
  }) {
    const {
      Button,
      Input,
      OtpInput
    } = window.RideBuddyDesignSystem_f63581;
    const [step, setStep] = React.useState('phone'); // 'phone' | 'otp'
    const [phone, setPhone] = React.useState('');
    const [code, setCode] = React.useState('');
    const valid = phone.replace(/\D/g, '').length >= 10;
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-auth"
    }, /*#__PURE__*/React.createElement("div", {
      className: "brand"
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/ridebuddy-logomark.svg",
      alt: ""
    }), /*#__PURE__*/React.createElement("span", {
      className: "wm"
    }, "RideBuddy")), step === 'phone' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Your car. A Buddy you can trust."), /*#__PURE__*/React.createElement("p", null, "Verified drivers for scheduled trips, daily commutes, and outstation journeys."), /*#__PURE__*/React.createElement(Input, {
      label: "Phone number",
      placeholder: "+91 98XXX XXXXX",
      inputMode: "tel",
      value: phone,
      onChange: e => setPhone(e.target.value)
    }), /*#__PURE__*/React.createElement("div", {
      className: "spacer"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      disabled: !valid,
      onClick: () => setStep('otp')
    }, "Continue")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h1", null, "Enter the code."), /*#__PURE__*/React.createElement("p", null, "Sent to ", phone || '+91 98XXX XXXXX', " by SMS."), /*#__PURE__*/React.createElement(OtpInput, {
      value: code,
      onChange: setCode
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 16,
        fontSize: 13,
        color: 'var(--text-secondary)'
      }
    }, "Didn\u2019t get it? ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--brand-primary)',
        fontWeight: 500
      }
    }, "Resend in 0:24")), /*#__PURE__*/React.createElement("div", {
      className: "spacer"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      disabled: code.length < 6,
      onClick: onDone
    }, "Verify")));
  }
  window.RBScreens = Object.assign(window.RBScreens || {}, {
    SignInScreen
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/SignInScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/TripsScreen.jsx
try { (() => {
// RideBuddy UI kit — My Trips tab.
(function () {
  function TabHeader({
    title
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '58px 24px 18px',
        background: 'var(--surface-card)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 26,
        color: 'var(--text-primary)'
      }
    }, title));
  }
  function TripsScreen({
    trip
  }) {
    const {
      Badge,
      TripCard,
      Card
    } = window.RideBuddyDesignSystem_f63581;
    return /*#__PURE__*/React.createElement("div", {
      className: "rb-scroll",
      style: {
        paddingBottom: 96
      }
    }, /*#__PURE__*/React.createElement(TabHeader, {
      title: "My Trips"
    }), /*#__PURE__*/React.createElement("div", {
      className: "rb-body"
    }, trip && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Upcoming"), /*#__PURE__*/React.createElement(TripCard, {
      from: trip.from,
      to: trip.to,
      bookingId: trip.id,
      badge: /*#__PURE__*/React.createElement(Badge, {
        status: "confirmed"
      }, "Confirmed"),
      details: [{
        label: 'Date',
        value: trip.date
      }, {
        label: 'Pickup',
        value: trip.time
      }, {
        label: 'Type',
        value: trip.tripType
      }]
    })), /*#__PURE__*/React.createElement("span", {
      className: "rb-section-label"
    }, "Past"), /*#__PURE__*/React.createElement(TripCard, {
      from: "Chandigarh",
      to: "Kasauli",
      bookingId: "#RB1840",
      badge: /*#__PURE__*/React.createElement(Badge, {
        status: "completed"
      }, "Completed"),
      details: [{
        label: 'Date',
        value: '18 May'
      }, {
        label: 'Fare',
        value: '₹1,950'
      }, {
        label: 'Buddy',
        value: '★ 4.8'
      }]
    }), /*#__PURE__*/React.createElement(Card, {
      variant: "flat",
      style: {
        textAlign: 'center',
        padding: 18
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-secondary)'
      }
    }, "Your completed trips appear here."))));
  }
  window.RBScreens = Object.assign(window.RBScreens || {}, {
    TripsScreen,
    TabHeader
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/TripsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/customer_app/icons.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// RideBuddy UI kit — Lucide-style icon set (2px stroke). Attached to window.
(function () {
  const s = children => function Icon(props) {
    return /*#__PURE__*/React.createElement("svg", _extends({
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, props), children);
  };
  const Icons = {
    Menu: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 6h18"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 12h18"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 18h18"
    }))),
    Bell: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10.3 21a1.94 1.94 0 0 0 3.4 0"
    }))),
    ArrowLeft: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M19 12H5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m12 19-7-7 7-7"
    }))),
    ArrowRight: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M5 12h14"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m12 5 7 7-7 7"
    }))),
    ChevronRight: s(/*#__PURE__*/React.createElement("path", {
      d: "m9 18 6-6-6-6"
    })),
    MapPin: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "10",
      r: "3"
    }))),
    Navigation: s(/*#__PURE__*/React.createElement("path", {
      d: "M3 11l19-9-9 19-2-8-8-2z"
    })),
    Calendar: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      width: "18",
      height: "18",
      x: "3",
      y: "4",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 10h18M8 2v4M16 2v4"
    }))),
    Clock: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7v5l3 2"
    }))),
    Mountain: s(/*#__PURE__*/React.createElement("path", {
      d: "m8 3 4 8 5-5 5 15H2L8 3z"
    })),
    Building: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 7h4M10 11h4M10 15h4"
    }))),
    Shield: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m9 12 2 2 4-4"
    }))),
    User: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "8",
      r: "5"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M20 21a8 8 0 0 0-16 0"
    }))),
    Car: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "7",
      cy: "17",
      r: "2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "17",
      cy: "17",
      r: "2"
    }))),
    CreditCard: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      width: "20",
      height: "14",
      x: "2",
      y: "5",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 10h20"
    }))),
    Users: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "7",
      r: "4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M22 21v-2a4 4 0 0 0-3-3.9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M16 3.1A4 4 0 0 1 16 11"
    }))),
    Gift: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      width: "20",
      height: "5",
      x: "2",
      y: "7",
      rx: "1"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 22V7M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"
    }))),
    Help: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 17h.01"
    }))),
    Headset: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 14v-3a9 9 0 0 1 18 0v3"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"
    }))),
    Loader: s(/*#__PURE__*/React.createElement("path", {
      d: "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"
    })),
    Wifi: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M5 13a10 10 0 0 1 14 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8.5 16.5a5 5 0 0 1 7 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M2 8.8a15 15 0 0 1 20 0"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 20h.01"
    }))),
    Signal: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"
    }))),
    Battery: s(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      width: "16",
      height: "10",
      x: "2",
      y: "7",
      rx: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M22 11v2"
    })))
  };
  window.RBIcons = Icons;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/customer_app/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.BuddyCard = __ds_scope.BuddyCard;

__ds_ns.CarCard = __ds_scope.CarCard;

__ds_ns.FareRow = __ds_scope.FareRow;

__ds_ns.TripCard = __ds_scope.TripCard;

__ds_ns.TripTypeCard = __ds_scope.TripTypeCard;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.OtpInput = __ds_scope.OtpInput;

__ds_ns.BottomSheet = __ds_scope.BottomSheet;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.BottomNav = __ds_scope.BottomNav;

})();
