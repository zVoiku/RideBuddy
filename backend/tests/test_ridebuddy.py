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
    def test_estimate_new_user_p2p_oneway(self, session, auth):
        # Use a fresh user to ensure is_new
        phone = f"+9199{int(time.time()*1000)%100000000:08d}"
        session.post(f"{API}/auth/send-otp", json={"phone": phone})
        v = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"}).json()
        h = {"Content-Type": "application/json", "Authorization": f"Bearer {v['token']}"}
        r = session.post(f"{API}/bookings/estimate", headers=h,
                         json={"trip_type": "point_to_point", "one_way": True, "distance_km": 10})
        assert r.status_code == 200
        d = r.json()
        # base = 199 + 10*12 = 319; discount = 31.9; total = 287.1
        assert d["base_fare"] == 319.0
        assert d["discount"] == 31.9
        assert d["total_fare"] == 287.1
        assert d["new_user_discount"] is True
        assert d["advance_30"] == round(287.1 * 0.30, 2)

    def test_estimate_hourly(self, session, auth):
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "hourly", "duration_hours": 3})
        assert r.status_code == 200
        # base = 3 * 249 = 747
        assert r.json()["base_fare"] == 747.0

    def test_estimate_round_trip_days_27_new_user(self, session):
        """Spec: 27 days round trip, new user → base=40473, discount=5400, total=35073, per_day_rate=1499, per_day_discount=200"""
        phone = f"+9198{int(time.time()*1000)%100000000:08d}"
        session.post(f"{API}/auth/send-otp", json={"phone": phone})
        v = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"}).json()
        h = {"Content-Type": "application/json", "Authorization": f"Bearer {v['token']}"}
        r = session.post(f"{API}/bookings/estimate", headers=h,
                         json={"trip_type": "point_to_point", "one_way": False, "distance_km": 0, "days": 27})
        assert r.status_code == 200
        d = r.json()
        assert d["base_fare"] == 40473.0, f"base_fare={d['base_fare']}"
        assert d["discount"] == 5400.0, f"discount={d['discount']}"
        assert d["total_fare"] == 35073.0, f"total={d['total_fare']}"
        assert d["per_day_rate"] == 1499, f"per_day_rate={d['per_day_rate']}"
        assert d["per_day_discount"] == 200, f"per_day_discount={d['per_day_discount']}"
        assert d["days"] == 27

    def test_estimate_round_trip_days_existing_user_no_discount(self, session, auth):
        # auth fixture user already did profile update -> is_new=False
        r = session.post(f"{API}/bookings/estimate", headers=auth["headers"],
                         json={"trip_type": "point_to_point", "one_way": False, "distance_km": 0, "days": 5})
        d = r.json()
        assert d["base_fare"] == 5 * 1499
        assert d["discount"] == 0
        assert d["per_day_discount"] == 0

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
        assert b["base_fare"] == 40473.0, f"base_fare={b['base_fare']} (expected 40473 = 27*1499)"
        assert b["total_fare"] == 35073.0, f"total_fare={b['total_fare']} (expected 35073)"


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
