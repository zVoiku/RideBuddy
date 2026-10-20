"""RideBuddy backend integration tests"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://trip-tracker-114.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth(session):
    phone = f"+9199{int(time.time())%100000000:08d}"
    r = session.post(f"{API}/auth/send-otp", json={"phone": phone})
    assert r.status_code == 200 and r.json()["sent"]
    r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data and "user" in data
    return {"token": data["token"], "user": data["user"], "phone": phone,
            "headers": {"Content-Type": "application/json", "Authorization": f"Bearer {data['token']}"}}


# ---------- Auth ----------
class TestAuth:
    def test_send_otp(self, session):
        r = session.post(f"{API}/auth/send-otp", json={"phone": "+919876543210"})
        assert r.status_code == 200
        assert r.json()["sent"] is True

    def test_verify_invalid_otp(self, session):
        r = session.post(f"{API}/auth/verify-otp", json={"phone": "+919876543299", "otp": "abc"})
        assert r.status_code == 400

    def test_verify_short_otp(self, session):
        r = session.post(f"{API}/auth/verify-otp", json={"phone": "+919876543299", "otp": "123"})
        assert r.status_code == 400

    def test_verify_valid_otp_new_user(self, auth):
        assert auth["user"]["is_new"] is True
        assert auth["user"]["phone"] == auth["phone"]

    def test_me_endpoint(self, session, auth):
        r = session.get(f"{API}/users/me", headers=auth["headers"])
        assert r.status_code == 200
        assert r.json()["id"] == auth["user"]["id"]

    def test_me_no_auth(self, session):
        r = requests.get(f"{API}/users/me")
        assert r.status_code == 401


# ---------- User ----------
class TestUser:
    def test_update_profile(self, session, auth):
        r = session.put(f"{API}/users/me", headers=auth["headers"],
                        json={"name": "TEST User", "email": "test@example.com"})
        assert r.status_code == 200
        u = r.json()
        assert u["name"] == "TEST User"
        assert u["email"] == "test@example.com"
        # Verify persistence
        r2 = session.get(f"{API}/users/me", headers=auth["headers"])
        assert r2.json()["name"] == "TEST User"
        # Note: is_new becomes False after profile update per spec


# ---------- Cars / Garage ----------
class TestCars:
    def test_car_crud(self, session, auth):
        r = session.post(f"{API}/users/me/cars", headers=auth["headers"],
                         json={"make": "Honda", "model": "City", "transmission": "Automatic"})
        assert r.status_code == 200
        car = r.json()
        assert car["make"] == "Honda"
        car_id = car["id"]

        # List
        r = session.get(f"{API}/users/me/cars", headers=auth["headers"])
        assert r.status_code == 200
        assert any(c["id"] == car_id for c in r.json())

        # Delete
        r = session.delete(f"{API}/users/me/cars/{car_id}", headers=auth["headers"])
        assert r.status_code == 200
        # Verify
        r = session.get(f"{API}/users/me/cars", headers=auth["headers"])
        assert not any(c["id"] == car_id for c in r.json())


# ---------- Estimate ----------
class TestEstimate:
    def test_estimate_one_way_matches_rate_table(self, session, auth):
        """Rate Table v1.10 §2.3 — the doc's own Chandigarh examples, 9 AM pickups.
        Delhi's ₹1,746.50 shows the total rounds halves up."""
        for km, hours, want in [(115, 3.25, 1613), (250, 4.5, 1747), (300, 8, 1796), (500, 9, 1994)]:
            r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                             json={"trip_type": "point_to_point", "one_way": True, "distance_km": km,
                                   "duration_hours": hours, "scheduled_at": "2026-10-25T09:00:00+05:30"})
            assert r.status_code == 200, r.text
            assert r.json()["total_fare"] == want, f"{km}km -> {r.json()['total_fare']}, want {want}"
            assert r.json()["trip_days"] == 1 and r.json()["long_drive"] is False

    def test_estimate_has_no_discount(self, session, auth):
        """The rate table is fixed: pricing does not vary by user."""
        phone = f"+9199{int(time.time()*1000)%100000000:08d}"
        session.post(f"{API}/auth/send-otp", json={"phone": phone})
        v = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"}).json()
        h = {"Content-Type": "application/json", "Authorization": f"Bearer {v['token']}"}
        body = {"trip_type": "point_to_point", "one_way": True, "distance_km": 115}
        fresh = session.post(f"{API}/bookings/estimate", headers=h, json=body).json()
        existing = session.post(f"{API}/bookings/estimate", headers=auth["headers"], json=body).json()
        assert fresh["total_fare"] == existing["total_fare"] == 1613
        assert fresh["discount"] == 0

    def test_estimate_deposit_is_20_pct(self, session, auth):
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "point_to_point", "one_way": True, "distance_km": 115})
        d = r.json()
        assert d["deposit_pct"] == 20
        assert d["deposit"] == round(d["total_fare"] * 0.20)

    def test_night_charge_triggers_on_early_pickup(self, session, auth):
        """§1B is an IST wall-clock rule: more than 15 minutes of duty between 22:00 and 06:00."""
        base = {"trip_type": "point_to_point", "one_way": True, "distance_km": 115, "duration_hours": 3}
        day = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                           json={**base, "scheduled_at": "2026-09-01T09:00:00+05:30"}).json()
        early = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                             json={**base, "scheduled_at": "2026-09-01T05:30:00+05:30"}).json()
        assert day["night_charge_applied"] is False
        assert early["night_charge_applied"] is True
        assert early["total_fare"] - day["total_fare"] == 249

    def test_night_charge_is_evaluated_in_ist_whatever_the_offset(self, session, auth):
        """The app serialises pickups as UTC (`toISOString()`), so a 09:00 IST
        pickup arrives as 03:30Z. The night window must be applied to the IST
        wall clock, never to the hour as received."""
        base = {"trip_type": "point_to_point", "one_way": True, "distance_km": 115, "duration_hours": 3}
        def night(ts):
            return session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                                json={**base, "scheduled_at": ts}).json()["night_charge_applied"]
        assert night("2026-09-01T03:30:00Z") is False          # 09:00 IST
        assert night("2026-09-01T03:30:00.000Z") is False      # exactly what toISOString() sends
        assert night("2026-09-01T00:00:00Z") is True           # 05:30 IST
        assert night("2026-09-01T16:30:00Z") is True           # 22:00 IST pickup -> 01:00 arrival
        assert night("2026-09-01T09:00:00") is False           # no offset: taken as IST

    def test_late_arrival_adds_the_night_charge_but_no_day(self, session, auth):
        """A 16:00 IST departure on an 8h drive arrives at midnight: §1B adds the
        night charge, and since v1.9 crossing midnight no longer adds a Trip Day."""
        base = {"trip_type": "point_to_point", "one_way": True, "distance_km": 300, "duration_hours": 8}
        def est(at):
            return session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                                json={**base, "scheduled_at": f"2026-09-01T{at}:00+05:30"}).json()
        noon, late = est("09:00"), est("16:00")
        assert noon["trip_days"] == 1 and noon["night_charge_applied"] is False
        assert late["trip_days"] == 1 and late["night_charge_applied"] is True
        assert late["total_fare"] - noon["total_fare"] == 249
        # §1B: a trip that ends by 10:15 PM does not trigger it; a minute later does.
        assert est("14:15")["night_charge_applied"] is False
        assert est("14:16")["night_charge_applied"] is True
        # …nor does one that starts at or after 5:45 AM.
        assert est("05:45")["night_charge_applied"] is False
        assert est("05:44")["night_charge_applied"] is True

    def test_long_drive_rest_stop_and_drive_through(self, session, auth):
        """§1C and §2.3: Chandigarh → Leh, 688 km and 15 h 30 min from 9 AM. The
        rest stop is the default; the drive-through runs into the night."""
        body = {"trip_type": "point_to_point", "one_way": True, "distance_km": 688,
                "duration_hours": 15.5, "scheduled_at": "2026-10-25T09:00:00+05:30"}
        rest = session.post(f"{API}/bookings/estimate", headers=auth["headers"], json=body).json()
        through = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                               json={**body, "drive_through": True}).json()
        assert rest["total_fare"] == 4178 and through["total_fare"] == 4427
        assert rest["trip_days"] == through["trip_days"] == 2
        assert rest["long_drive"] is through["long_drive"] is True
        assert rest["drive_through"] is False and through["drive_through"] is True
        assert rest["night_charge_applied"] is False and through["night_charge_applied"] is True
        # The rest stop's ₹499 is an overnight stay; the drive-through's is not.
        assert rest["stay_nights"] == 1 and through["stay_nights"] == 0
        assert rest["long_drive_hours"] == 12

    def test_same_day_round_trips(self, session, auth):
        """§5.4: a same-day round trip is one duty, out and back."""
        def est(km, hours, at, **extra):
            return session.post(f"{API}/bookings/estimate", headers=auth["headers"], json={
                "trip_type": "point_to_point", "one_way": False, "distance_km": km, "duration_hours": hours,
                "days": 1, "scheduled_at": f"2026-10-25T{at}:00+05:30", **extra}).json()
        assert est(115, 3.25, "09:00")["total_fare"] == 1499
        assert est(115, 3.25, "16:00")["total_fare"] == 1748  # home at 10:30 PM
        jaipur = est(500, 9, "09:00")  # 18 h of driving: a rest stop and a second day
        assert jaipur["total_fare"] == 3497 and jaipur["trip_days"] == 2 and jaipur["long_drive"] is True
        assert est(500, 9, "09:00", drive_through=True)["total_fare"] == 3746  # home at 3 AM

    def test_estimate_hourly(self, session, auth):
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "hourly", "duration_hours": 3})
        assert r.status_code == 200
        # base = 3 * 249 = 747
        assert r.json()["base_fare"] == 747.0

    def test_estimate_round_trip_matches_rate_table(self, session, auth):
        """§5.4 — Chandigarh->Manali round trip, 3 days, customer not providing
        stay: 3 × 1,200 + 3 × 299 + 2 × 499. Distance is not charged.
        """
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "point_to_point", "one_way": False,
                               "distance_km": 300, "days": 3})
        d = r.json()
        assert d["total_fare"] == 5495, f"got {d['total_fare']}"
        assert d["trip_days"] == 3
        assert d["overnights"] == 2
        assert d["stay_included"] is True

    def test_customer_provided_stay_removes_the_allowance(self, session, auth):
        body = {"trip_type": "point_to_point", "one_way": False, "distance_km": 300, "days": 3}
        without = session.post(f"{API}/bookings/estimate", headers=auth["headers"], json=body).json()
        with_stay = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                                 json={**body, "customer_stay": True}).json()
        # Two overnights at 499.
        assert without["total_fare"] - with_stay["total_fare"] == 998
        assert with_stay["stay_included"] is False

    def test_round_trip_has_no_return_charge(self, session, auth):
        """§5.1 #3: the Buddy returns driving the customer's car."""
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "point_to_point", "one_way": False,
                               "distance_km": 300, "days": 3})
        assert r.json()["breakdown"]["return_leg"] == 0

    def test_a_booking_is_always_the_rest_stop(self, session, auth):
        """§1C "Legal": drive-through needs both Terms of Use to allow it before
        an app offers it, so a booking ignores the estimate-only switch."""
        payload = {
            "trip_type": "point_to_point", "one_way": True,
            "pickup_address": "TEST Leh Pickup", "drop_address": "TEST Leh",
            "distance_km": 688, "duration_hours": 15.5, "schedule_now": False,
            "scheduled_at": "2026-10-25T09:00:00+05:30", "drive_through": True,
            "transmission": "Automatic", "payment_method": "upi", "pay_partial": True,
        }
        b = session.post(f"{API}/bookings", headers=auth["headers"], json=payload).json()
        assert b["total_fare"] == 4178 and b["fare"]["drive_through"] is False

    def test_create_booking_with_days_persists(self, session):
        """Booking creation must accept and persist `days` and `return_at` from BookingIn."""
        phone = f"+9197{int(time.time()*1000)%100000000:08d}"
        session.post(f"{API}/auth/send-otp", json={"phone": phone})
        v = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"}).json()
        h = {"Content-Type": "application/json", "Authorization": f"Bearer {v['token']}"}
        payload = {
            "trip_type": "point_to_point", "one_way": False,
            "pickup_address": "TEST RT Pickup", "drop_address": "TEST RT Drop",
            "distance_km": 0, "duration_hours": 0,
            "days": 27,
            "schedule_now": False,
            "scheduled_at": "2026-02-01T09:00:00Z",
            "return_at": "2026-02-28T18:00:00Z",
            "transmission": "Automatic", "payment_method": "upi", "pay_partial": False,
        }
        r = session.post(f"{API}/bookings", headers=h, json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["days"] == 27, f"`days` was not persisted (got {b.get('days')}). BookingIn schema likely missing `days` field"
        assert b["return_at"] is not None, "`return_at` was not persisted. BookingIn schema likely missing `return_at` field"
        # 27 Trip Days at the v1.10 table, no distance, customer not providing stay.
        expected = 27 * 1200 + 27 * 299 + 26 * 499
        assert b["total_fare"] == expected, f"total_fare={b['total_fare']} (expected {expected})"
        assert b["fare"]["trip_days"] == 27


# ---------- Booking lifecycle ----------
class TestBookingLifecycle:
    def test_full_booking_flow(self, session, auth):
        # Create
        payload = {
            "trip_type": "point_to_point", "one_way": True,
            "pickup_address": "TEST Pickup", "drop_address": "TEST Drop",
            "distance_km": 15, "schedule_now": True,
            "intersect_at_owner": True, "transmission": "Automatic",
            "payment_method": "upi", "pay_partial": False,
        }
        r = session.post(f"{API}/bookings", headers=auth["headers"], json=payload)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["status"] == "searching"
        assert b["driver_id"] is None
        bid = b["id"]

        # Poll for assignment (~4 seconds)
        assigned = None
        for _ in range(10):
            time.sleep(1)
            r = session.get(f"{API}/bookings/{bid}", headers=auth["headers"])
            assert r.status_code == 200
            cur = r.json()
            if cur["status"] == "assigned":
                assigned = cur
                break
        assert assigned is not None, "Driver not auto-assigned in time"
        assert assigned["driver_id"]
        assert assigned["start_code"] and len(assigned["start_code"]) == 4
        assert assigned["end_code"] and len(assigned["end_code"]) == 4
        assert assigned.get("driver") is not None
        assert "name" in assigned["driver"]

        # Wrong start code
        r = session.post(f"{API}/bookings/{bid}/verify-start", headers=auth["headers"], json={"code": "0000"})
        if assigned["start_code"] != "0000":
            assert r.status_code == 400

        # Correct start code
        r = session.post(f"{API}/bookings/{bid}/verify-start", headers=auth["headers"],
                         json={"code": assigned["start_code"]})
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

        # Wrong end code
        r = session.post(f"{API}/bookings/{bid}/verify-end", headers=auth["headers"], json={"code": "9999"})
        if assigned["end_code"] != "9999":
            assert r.status_code == 400

        # Correct end code
        r = session.post(f"{API}/bookings/{bid}/verify-end", headers=auth["headers"],
                         json={"code": assigned["end_code"]})
        assert r.status_code == 200
        completed = r.json()
        assert completed["status"] == "completed"
        assert completed["paid_amount"] == completed["total_fare"]

    def test_cancel_booking(self, session, auth):
        payload = {
            "trip_type": "point_to_point", "one_way": True,
            "pickup_address": "TEST", "drop_address": "TEST",
            "distance_km": 5, "schedule_now": True,
            "transmission": "Automatic", "payment_method": "cash", "pay_partial": False,
        }
        r = session.post(f"{API}/bookings", headers=auth["headers"], json=payload)
        bid = r.json()["id"]
        r = session.post(f"{API}/bookings/{bid}/cancel", headers=auth["headers"])
        assert r.status_code == 200
        r = session.get(f"{API}/bookings/{bid}", headers=auth["headers"])
        assert r.json()["status"] == "cancelled"

    def test_list_bookings_sorted(self, session, auth):
        r = session.get(f"{API}/bookings", headers=auth["headers"])
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        if len(items) > 1:
            assert items[0]["created_at"] >= items[1]["created_at"]
