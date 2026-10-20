# RideBuddy — context for building the website

Written as a handoff for a separate session that will build the public/marketing
website. Everything here is taken from the shipped code and the locked Rate
Table v1.10, not from memory.

> **Do not trust `memory/PRD.md`.** It is the first iteration and is now wrong on
> nearly everything a website would copy: it says teal `#0E9B9B`, a 30% advance,
> ₹1,499/day, and new-user discounts. All superseded. This file and
> `rates.json` with `backend/server.py` are the sources of truth.

---

## 1. What RideBuddy is

**Car owners hire a vetted driver to drive their own car.** The customer keeps
their vehicle; RideBuddy supplies the person behind the wheel.

That is the whole proposition, and it is what makes the pricing shape unusual:
there is no vehicle cost, no per-km taxi meter. You are buying a driver's day.

**Business model:** aggregator. The driver is the service provider; RideBuddy
takes a commission on part of the fare. This is a deliberate legal position —
see §6.

**Who it is for:** owners of a car who cannot or would rather not drive it —
long highway runs, hill drives, multi-day trips, a day of meetings, an owner
who is unwell, tired, or wants a drink at the destination.

**Where it operates:** the Chandigarh tri-city (Chandigarh, Mohali, Panchkula)
running out to Himachal (Shimla, Kasauli, Manali, Dharamshala). This is the
seeded demo region and reflects the launch market.

---

## 2. Vocabulary — use these words

| Term | Meaning |
|---|---|
| **Buddy** | The driver. Never "chauffeur", rarely "driver" in customer-facing copy. |
| **Partner** | Internal/engineering word for a Buddy account. Not customer-facing. |
| **Ops** | The founder-facing operations console. |
| **Drop & Return** | Buddy drives you to the destination, then travels home alone. |
| **Reach & Drive** | Buddy travels to you, then drives you back. |
| **Trip day** | The billing unit. Includes 300 km and 12 hours. |

**Drop & Return** and **Reach & Drive** are marketing language only — in the
system both are ordinary one-way bookings. They exist because they explain the
two shapes a one-way trip takes, and the ₹0.99/km return charge covers the
Buddy's solo leg in both cases.

A useful angle the rate table calls out explicitly: two paired one-way bookings
price *materially below* an equivalent round trip, for a customer travelling
several days who does not need driving at the destination.

---

## 3. Pricing — Rate Table v1.10 (locked, founder sign-off 11 Oct 2026)

All rates are charm-priced and are configurable variables in **`rates.json`** at
the repo root — the one file the backend (`backend/server.py`) and the website
build both read. **Fares shown to customers are GST-inclusive.**

The fare pays for the Buddy's **time**: a Trip Day is 12 hours of duty from the
booked pickup, breaks included. Distance is not charged, except the one-way
return charge.

### Rates

| Component | Rate |
|---|---|
| Day rate | ₹1,200 / Trip Day — **internal, never shown to customers** |
| Extra time | **₹1.99 / minute** beyond the 12 hours (15 free minutes at each end); a final-fare item, never in an estimate |
| Buddy return charge | **₹0.99 / km** of one-way trip distance (one way only) |
| Food allowance | **₹299 / Trip Day** |
| Stay | **₹499 / night** (round-trip overnights unless the customer arranges the stay; long-drive added days) |
| Night charge | **₹249 flat** |

**Night charge** applies when more than 15 minutes of duty fall between 10 PM
and 6 AM (a trip that ends by 10:15 PM, or starts at or after 5:45 AM, does not
trigger it). Crossing midnight does not add a Trip Day.

**Long drives** (more than 12 hours of driving on a one-way trip or on any day
of a round trip): Trip Days = ceiling(drive time ÷ 12 h), each added day with
food and ₹499. The default plan is a rest stop (12 hours of duty, 9 hours'
rest); a drive-through is priced only behind a switch, and only if the customer
and the Buddy both agree.

### One-way

```
fare = (trip_days × 1,200) + (0.99 × one_way_km) + (299 × trip_days)
     + (499 × (trip_days − 1)) + (249 if night)
```

### Round trip

```
fare = (trip_days × 1,200) + (299 × trip_days)
     + (499 × overnights, unless the customer arranges the stay)
     + (249 if night on any leg)
```

No return charge on a round trip — the Buddy comes back driving the customer's
car. `trip_days = return date − outbound date + 1`, plus any long-drive days. A
same-day round trip is one duty: out, and back on arrival.

Calculated on unrounded metres and minutes; only the total is rounded, to the
nearest rupee, halves up.

### Worked examples (the rate table's own; illustrative distances)

| Route | km | Drive | Pickup | Fare |
|---|---|---|---|---|
| Chandigarh → Shimla | 115 | 3 h 15 min | 9 AM | **₹1,613** |
| Chandigarh → Delhi | 250 | 4 h 30 min | 9 AM | **₹1,747** |
| Chandigarh → Manali | 300 | 8 h | 9 AM | **₹1,796** |
| Chandigarh → Jaipur | 500 | 9 h | 9 AM | **₹1,994** |
| Chandigarh → Leh, rest stop | 688 | 15 h 30 min | 9 AM | **₹4,178** |
| Chandigarh ⇄ Manali, 3 days, stay not arranged | 300 each way | 8 h | 9 AM | **₹5,495** |
| Chandigarh ⇄ Shimla, same day | 115 each way | 3 h 15 min | 9 AM | **₹1,499** |

Live estimates use Google's distance and drive time, so they differ a little
from these. All sixteen of the table's examples are asserted by
`website/test/parity.mjs`, on both the backend and the website engine.

### Payment and what the customer is told

- **20% deposit at booking** (Razorpay). Balance charged at trip end.
- Final fare is **calculated at trip end from actuals** — the booking figure is
  an estimate.
- **Tolls are outside the fare entirely.** The customer pays them directly
  during the trip, from their own FASTag or cash. Never present tolls as
  included, excluded-but-estimated, or a line item.
- **No component breakdown is shown to the customer.** One number, plus
  inclusion/exclusion conditions. The app deliberately does not itemise.
- **There is no discount of any kind.** Fixed rate table, no dynamic pricing,
  no promo codes, no new-user offer. Do not invent one for the website.

Exact customer-facing copy (Rate Table §2.4), shipped in the app and on the
website's estimator, worth reusing verbatim:

> Includes 12 hours of your Buddy's time from pickup.
> Includes your Buddy's food.
> Tolls are extra, paid by you on the road.
> Extra time is charged by the minute in the final fare.
> Final fare is calculated when your trip ends.
> Includes the Buddy's stay for 5 nights. Tell us if you're arranging it and we'll take it off.
> Tolls are not part of this fare. You pay them directly during the trip.
> **Final fare is calculated when your trip ends.**

---

## 4. Trust and safety — the real differentiators

These are shipped, not aspirational, and they are the strongest website material:

- **Verified Buddies.** Aadhaar and police verification are shown on the driver
  card. Ops runs an onboarding pipeline: applied → verification → verified. A
  Buddy cannot sign in or take a trip until verified.
- **A two-sided handshake.** The customer's app shows a 4-digit start code; the
  Buddy types it in to begin the trip. The code never travels through the
  system to the Buddy — only by voice. The **owner** ends the trip.
- **Customer privacy from the Buddy.** A Buddy sees `"Aarti M."` and nothing
  else. No phone, no email, no full name. On a round trip the exact drop
  address is withheld until the day of travel. Enforced server-side and tested.
- **In-app chat** so the two sides can talk without exchanging numbers. Chat is
  currently the Buddy's *only* channel to the customer.
- **SOS / Safety** in the Buddy app during a live trip.
- The customer *can* see and call their Buddy in full — the asymmetry is
  deliberate: you are handing over your car.

---

## 5. Brand

Taken from `RideBuddy-partner/src/theme.ts`. The apps are built entirely from
these tokens; the website should match.

### Trail Green scale

| Token | Hex | Use |
|---|---|---|
| green50 | `#EDF0E8` | Page background, lightest fill |
| green100 | `#C5D4A8` | Light fills, hover, avatars |
| green300 | `#8FA96A` | Mid tone, secondary accent |
| **green500** | **`#4A5C2F`** | **Primary brand** |
| green700 | `#384522` | Dark fills, pressed |
| green800 | `#262F17` | Very dark |
| green900 | `#131A0C` | Near-black with green undertone |

### Neutrals and utility

`charcoal #1E1E1A` (primary text) · `parchment #F5F0E8` (warm surface, inputs)
· `white #FFFFFF` (cards) · `grey500 #888888` (secondary text) ·
`grey400 #A8A39A` (placeholder)

`success #2E7D32` · `warning #E65100` · `error #C62828` · `info #1565C0` ·
`star #F59E0B`

### Type

- **Display:** Urbanist — Bold (700) and ExtraBold (800). Headings, numbers, names.
- **Body:** DM Sans — Regular (400), Medium (500), SemiBold (600).

Both are Google Fonts, so they are directly available to a website.

### Feel

Warm, outdoorsy, calm. Not a neon tech startup. Generous rounded corners
(12–20px, pill buttons), soft diffused shadows, never dramatic. The logo mark
is a **steering wheel** in parchment on Trail Green — see
`RideBuddy-partner/assets/images/icon.png`, which the website can reuse.

---

## 6. Commission and the legal position

Relevant if the website has pricing, terms, or a Buddy-recruitment page.

- **Aggregator model.** The Buddy is the service provider. RideBuddy charges
  commission on margin-bearing components only: the per-day rate and distance
  overage. The return charge, food, stay and night charges pass through to the
  Buddy at 100%.
- **Standard commission 25%**, currently discounted 15 points as a launch promo
  → **10% effective**. Ramping to 25% over time.
- **GST 18% applies to the commission only**, and is absorbed within it — never
  added on top of the customer's fare.
- At launch, on a ₹1,199 trip day: Buddy takes ₹1,079, RideBuddy ₹120, of which
  ₹18 is GST, leaving ₹102 net.

**Compliance items still open** (founder/legal, not resolved): written CA
opinion on GST classification, the Buddy agreement and customer T&Cs papering
the aggregator position, and e-commerce operator obligations (GST registration,
TCS). **The website should not make tax or legal claims** beyond "fares are
GST-inclusive" until those close.

---

## 7. What exists today

Monorepo: **`zVoiku/RideBuddy`**, active branch
`claude/ridebuddy-driver-partner-setup-jku820`.

```
backend/            FastAPI + MongoDB (Motor). Serves all three apps.
frontend/           Customer app — React Native + Expo (Expo Router, SDK 54)
RideBuddy-partner/  Buddy app AND Ops console (one binary, role by phone number)
docs/               This file and other handoffs
```

**Three surfaces, one backend, one auth system.** The phone number decides the
role: `user` (customer), `driver` (Buddy), `ops`.

- **Customer app** — book a trip, fare estimate, payment, live trip, chat.
- **Buddy app** — assigned trips, navigation mode, earnings, chat, safety.
- **Ops console** — dashboard, bookings, assign a Buddy, refunds, Buddy roster
  and onboarding pipeline.

**Mocked for MVP:** OTP (real Twilio optional), payments (Razorpay optional),
driver matching. Everything else is real.

**No website exists yet.** This is a greenfield build.

---

## 8. Notes for whoever builds the website

**Stack is an open question.** Nothing constrains it — the apps are Expo, but a
marketing site has no reason to be. Next.js or Astro would both be reasonable.
Decide with the founder.

**Where it should live** is also open: a new repo, or a `website/` folder in
this monorepo. The monorepo is deliberately *not* an npm workspace (hoisting
breaks Expo's Metro resolution), so a website folder would be its own npm
project like the others.

**The backend is reusable.** `GET /api/` returns `{"message": "RideBuddy API"}`.
If the site needs a live fare calculator, `POST /api/bookings/estimate` already
implements the whole rate table — but it currently requires a customer JWT, so
a public endpoint would need adding rather than exposing auth to the browser.

**Things that would make good pages**, given what is actually built: how it
works (the handshake is genuinely interesting), pricing (real numbers, real
routes), safety and verification, become a Buddy (the earnings split is
attractive and honest), and the service region.

**Do not claim:** app store availability (the apps are dev builds only),
insurance, 24/7 support, city coverage beyond the region above, or any discount.

---

*Generated from the RideBuddy codebase at commit `e42fb8e`; pricing updated to
Rate Table v1.10, locked with founder sign-off. The fare figures above are
asserted by tests.*
