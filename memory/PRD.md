# RideBuddy Customer App – PRD

## Vision
Cross-platform mobile app for car owners (Expo React Native) to hire verified professional drivers to drive their own car. Customer-facing surface only this iteration.

## Visual Design (matched to user's Figma)
- Primary teal `#0E9B9B`, mint background `#D8EFEB`, white cards, near-black text
- Heavy-bold sans-serif headings, pill buttons, rounded-square teal feature icons
- Navigation: **Hamburger drawer** (Profile + My Bookings + Logout) — not bottom tabs

## Feature Set Shipped
1. **Auth**: Phone + Mock 6-digit OTP → JWT (any 6 digits, e.g. `123456`)
2. **Onboarding**: Car Make grid (6 brands) → Car Model grid → auto-stored in Garage
3. **Home – Reserve a Ride**:
   - Pickup / Destination pill cards (with swap UI), default Mumbai → Delhi
   - Trip Schedule: tappable Pickup and Return Date & Time pickers (calendar grid + time pills)
   - Recent Bookings strip
   - Fare Estimate primary CTA
4. **Booking Summary**: Pickup/Return dates, trip type, days, base fare, new-user discount card, total amount
5. **Payment**: Full Payment vs Partial Payment (30%) radio cards, UPI / Cards / Netbanking method tile (MOCKED gateway), live summary
6. **Finding a Ride Partner**: animated splash polling backend until driver auto-assigned (~3s)
7. **Booking Detail**:
   - Big 4-digit **Trip Code** in dashed teal box (handshake)
   - Driver card: photo, rating, trip count, Aadhaar/Police badges, Call/Message
   - **Live Trip Map** modal (MOCKED static map + simulated car marker + ETA)
   - During trip: SOS Emergency Help button + End Trip Code entry
   - Status auto-polls every 3s
8. **My Bookings**: Upcoming / Completed tabs with status pills (Finding Partner, Partner Assigned, On Trip, Completed)
9. **Hamburger Drawer**: profile snippet (name, phone, rating), My Bookings, Logout

## Pricing
- Round trip with return date → ₹1,499 / day × days, **₹200 / day off for new users**
- One-way → ₹199 base + ₹12/km, **10% off for new users**
- Hourly → ₹249/hour, 10% off for new users
- 30% advance payment option available for non-cash

## Out of Scope (this session)
- Real SMS OTP, real Google Maps, real payments
- Partner (driver) app
- Push notifications, in-app chat

## Tech
- Frontend: Expo Router (React Native), AsyncStorage, Ionicons
- Backend: FastAPI + Motor (MongoDB), JWT (HS256)
- All endpoints prefixed `/api`

## Test Credentials
See `/app/memory/test_credentials.md` — any 10-digit phone + any 6-digit OTP.
