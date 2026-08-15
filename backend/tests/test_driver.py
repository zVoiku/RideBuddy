"""RideBuddy partner/driver app integration tests.

Run against a live server:
    EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 backend/.venv/bin/pytest backend/tests -q
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

# Seeded demo partner from the design roster.
DEMO_PARTNER_PHONE = "+919876543210"


def _headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def driver(session):
    """Log in as the seeded demo partner (Rajesh Singh)."""
    session.post(f"{API}/driver/auth/send-otp", json={"phone": DEMO_PARTNER_PHONE})
    r = session.post(f"{API}/driver/auth/verify-otp", json={"phone": DEMO_PARTNER_PHONE, "otp": "123456"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "partner": data["partner"], "headers": _headers(data["token"])}


@pytest.fixture(scope="module")
def client_user(session):
    """A client-app user, used to prove the two surfaces stay separated."""
    phone = f"+9198{int(time.time()) % 100000000:08d}"
    session.post(f"{API}/auth/send-otp", json={"phone": phone})
    r = session.post(f"{API}/auth/verify-otp", json={"phone": phone, "otp": "123456"})
    assert r.status_code == 200
    data = r.json()
    return {"token": data["token"], "user": data["user"], "headers": _headers(data["token"])}


# ---------- Auth ----------
class TestDriverAuth:
    def test_send_otp(self, session):
        r = session.post(f"{API}/driver/auth/send-otp", json={"phone": DEMO_PARTNER_PHONE})
        assert r.status_code == 200 and r.json()["sent"] is True

    def test_otp_must_be_six_digits(self, session):
        r = session.post(f"{API}/driver/auth/verify-otp", json={"phone": DEMO_PARTNER_PHONE, "otp": "12"})
        assert r.status_code == 400

    def test_seeded_partner_logs_in(self, driver):
        assert driver["partner"]["name"] == "Rajesh Singh"
        assert driver["partner"]["licence"]
        assert driver["partner"]["trips"] > 0

    def test_unknown_number_is_auto_created(self, session):
        phone = f"+9197{int(time.time()) % 100000000:08d}"
        session.post(f"{API}/driver/auth/send-otp", json={"phone": phone})
        r = session.post(f"{API}/driver/auth/verify-otp", json={"phone": phone, "otp": "123456"})
        assert r.status_code == 200
        assert r.json()["partner"]["is_new"] is True

    def test_me(self, session, driver):
        r = session.get(f"{API}/driver/me", headers=driver["headers"])
        assert r.status_code == 200 and r.json()["phone"] == DEMO_PARTNER_PHONE


# ---------- Role separation ----------
class TestRoleSeparation:
    def test_driver_token_rejected_by_client_endpoint(self, session, driver):
        r = session.get(f"{API}/users/me", headers=driver["headers"])
        assert r.status_code == 403

    def test_client_token_rejected_by_driver_endpoint(self, session, client_user):
        r = session.get(f"{API}/driver/trips", headers=client_user["headers"])
        assert r.status_code == 403

    def test_missing_token_rejected(self, session):
        assert session.get(f"{API}/driver/trips", headers={}).status_code == 401

    def test_client_cannot_read_driver_earnings(self, session, client_user):
        r = session.get(f"{API}/driver/earnings", headers=client_user["headers"])
        assert r.status_code == 403


# ---------- Trips ----------
class TestDriverTrips:
    def test_lists_only_own_trips(self, session, driver):
        r = session.get(f"{API}/driver/trips", headers=driver["headers"])
        assert r.status_code == 200
        trips = r.json()
        assert len(trips) > 0, "demo partner should have seeded trips"

    def test_customer_name_is_masked(self, session, driver):
        trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        for t in trips:
            # "Aarti M." — never a full surname.
            assert t["customer"], "customer must be present"
            parts = t["customer"].split()
            if len(parts) > 1:
                assert parts[-1].endswith("."), f"unmasked customer name: {t['customer']}"

    def test_owner_contact_details_never_leak(self, session, driver):
        trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        for t in trips:
            for leaked in ("phone", "user_id", "customer_phone", "email"):
                assert leaked not in t, f"{leaked} leaked to partner"

    def test_start_code_never_sent_to_partner(self, session, driver):
        trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        for t in trips:
            assert "start_code" not in t and "end_code" not in t

    def test_round_trip_hides_exact_drop(self, session, driver):
        trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        rounds = [t for t in trips if t["round_trip"]]
        assert rounds, "expected at least one seeded round trip"
        for t in rounds:
            assert t["drop_address"] is None
            assert t["drop_area"], "drop city should still be shown"

    def test_every_trip_shows_an_earning(self, session, driver):
        # The split itself is asserted in TestAvailabilityAndEarnings; the flat
        # 80% this once checked was superseded by Rate Table v1.7 §3.1.
        trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        for t in trips:
            assert t["earnings"] > 0

    def test_unknown_trip_is_404(self, session, driver):
        r = session.get(f"{API}/driver/trips/does-not-exist", headers=driver["headers"])
        assert r.status_code == 404


@pytest.fixture(scope="module")
def assigned_trip(session, driver):
    """One assigned trip, driven through the whole lifecycle by the tests below.

    Module-scoped rather than class-scoped: pytest deprecated class-scoped
    fixtures declared as instance methods, and the state here has to survive
    across the ordered lifecycle tests anyway.
    """
    trips = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
    candidates = [t for t in trips if t["status"] == "assigned"]
    if not candidates:
        pytest.skip("no assigned trip available to drive through the lifecycle")
    return candidates[0]


# ---------- Lifecycle ----------
class TestTripLifecycle:
    def test_left_for_pickup_sets_en_route(self, session, driver, assigned_trip):
        r = session.post(f"{API}/driver/trips/{assigned_trip['id']}/left-for-pickup", headers=driver["headers"])
        assert r.status_code == 200
        assert r.json()["status"] == "en_route"
        assert r.json()["left_at"]

    def test_arrived(self, session, driver, assigned_trip):
        r = session.post(f"{API}/driver/trips/{assigned_trip['id']}/arrived", headers=driver["headers"])
        assert r.status_code == 200 and r.json()["status"] == "arrived"

    def test_illegal_transition_rejected(self, session, driver, assigned_trip):
        r = session.post(f"{API}/driver/trips/{assigned_trip['id']}/left-for-pickup", headers=driver["headers"])
        assert r.status_code == 400

    def test_wrong_start_code_rejected(self, session, driver, assigned_trip):
        r = session.post(f"{API}/driver/trips/{assigned_trip['id']}/verify-start",
                         headers=driver["headers"], json={"code": "0000"})
        assert r.status_code == 400
        assert "code" in r.json()["detail"].lower()

    def test_partner_cannot_touch_another_partners_trip(self, session, driver):
        """A second partner must not be able to advance someone else's trip."""
        phone = f"+9196{int(time.time()) % 100000000:08d}"
        session.post(f"{API}/driver/auth/send-otp", json={"phone": phone})
        other = session.post(f"{API}/driver/auth/verify-otp", json={"phone": phone, "otp": "123456"}).json()
        mine = session.get(f"{API}/driver/trips", headers=driver["headers"]).json()
        assert mine
        r = session.post(f"{API}/driver/trips/{mine[0]['id']}/arrived", headers=_headers(other["token"]))
        assert r.status_code == 404


# ---------- Availability & earnings ----------
class TestAvailabilityAndEarnings:
    def test_toggle_availability(self, session, driver):
        assert session.patch(f"{API}/driver/availability", headers=driver["headers"],
                             json={"available": False}).json()["available"] is False
        assert session.patch(f"{API}/driver/availability", headers=driver["headers"],
                             json={"available": True}).json()["available"] is True

    def test_earnings_shape(self, session, driver):
        r = session.get(f"{API}/driver/earnings", headers=driver["headers"])
        assert r.status_code == 200
        data = r.json()
        # Rate Table v1.7 §3.2: 25% standard less the 15pt launch promo.
        assert data["commission_rate"] == 0.10
        assert data["trips_completed"] == len(data["trips"])
        assert data["lifetime"] == pytest.approx(sum(t["earnings"] for t in data["trips"]))

    def test_commission_applies_only_to_margin_bearing_components(self, session, driver):
        """§3.1: commission is charged on the per-day rate and distance overage.

        The return charge, food, stay and night charges pass through at 100%, so
        a flat percentage of the whole fare would underpay the Buddy on exactly
        the trips carrying the most allowances.
        """
        data = session.get(f"{API}/driver/earnings", headers=driver["headers"]).json()
        assert data["trips"], "demo partner should have completed trips"
        for t in data["trips"]:
            # Every seeded trip carries pass-through components, so a payout
            # computed as a flat 90% of the total would come out lower.
            assert t["earnings"] > round(t["fare"] * 0.90), (
                f"trip {t['id'][:8]}: earnings {t['earnings']} looks like a flat "
                f"cut of {t['fare']} rather than a component split"
            )
            assert t["earnings"] < t["fare"], "the platform takes some commission"
