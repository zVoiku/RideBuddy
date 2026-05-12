# RideBuddy Customer App – PRD

## Vision
Mobile app for car owners to hire verified professional drivers to drive their own car for local point-to-point or hourly rentals across India.

## MVP Scope (Customer App)
1. **Auth**: Phone + Mock 6-digit OTP → JWT (any 6-digit code accepted; default `123456`)
2. **Profile & Garage**: name/email + CRUD list of cars (make, model, transmission)
3. **Booking Engine**:
   - Trip types: Point-to-Point (one-way / round-trip) or Hourly Rental
   - Pickup & drop addresses, distance/duration inputs
   - Schedule Now or Later
   - Owner-Driver intersect toggle (driver comes to me / I pick up driver)
   - Transmission preference (Automatic / Manual)
4. **Fare Estimation**: Server computes base fare + auto 10% new-user discount + 30% advance option
5. **Payment** (MOCKED UI only): UPI / Card / Cash; full or 30% advance
6. **Driver Auto-Assign**: 5 seeded drivers; closest matching driver assigned after 3-second background task
7. **Safety Handshake**: 4-digit Start Trip Code + 4-digit End Trip Code, validated server-side
8. **Live Tracking** (MOCKED): map background with simulated car marker + ETA; status polled every 3s
9. **Driver Card**: photo, rating, trip count, Aadhaar/Police verified badges, call/chat (call uses tel:)
10. **Trip History**: list of past/upcoming bookings + mock downloadable invoice

## Out of Scope (this session)
- Real SMS OTP, real Google Maps, real payments
- Partner (driver) app
- Push notifications, in-app chat

## Tech
- Frontend: Expo Router (React Native), AsyncStorage, expo-blur ready, Ionicons
- Backend: FastAPI + Motor (MongoDB), JWT auth (HS256)
- All endpoints prefixed `/api`
