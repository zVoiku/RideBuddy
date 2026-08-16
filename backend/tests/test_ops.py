"""RideBuddy Ops console integration tests.

Ops is the third role on one auth system. The interesting surface is therefore
the seam again: that the phone number alone decides which app you land in, that
neither of the other two roles can reach any Ops route, and that Ops — unlike a
partner — sees customers unmasked.

Run against a live server:
    EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 backend/.venv/bin/pytest backend/tests -q
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

OPS_PHONE = "+919999999999"
DEMO_PARTNER_PHONE = "+919876543210"
DEMO_OWNER_PHONE = "+919845512300"


def _headers(token):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}


def _login(session, path, phone):
    session.post(f"{API}{path.replace('verify', 'send')}", json={"phone": phone})
    r = session.post(f"{API}{path}", json={"phone": phone, "otp": "123456"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def ops(session):
    d = _login(session, "/driver/auth/verify-otp", OPS_PHONE)
    return {"headers": _headers(d["token"]), "login": d}


@pytest.fixture(scope="module")
def driver(session):
    d = _login(session, "/driver/auth/verify-otp", DEMO_PARTNER_PHONE)
    return {"headers": _headers(d["token"]), "partner": d["partner"]}


@pytest.fixture(scope="module")
def customer(session):
    d = _login(session, "/auth/verify-otp", DEMO_OWNER_PHONE)
    return {"headers": _headers(d["token"])}


OPS_READ_ROUTES = ["/ops/me", "/ops/metrics", "/ops/bookings", "/ops/buddies"]


@pytest.fixture(scope="module")
def m(session, ops):
    """The dashboard payload. Module-scoped: pytest deprecated class-scoped
    fixtures declared as instance methods."""
    r = session.get(f"{API}/ops/metrics", headers=ops["headers"])
    assert r.status_code == 200
    return r.json()


# ---------- Role routing ----------
class TestOpsAuth:
    def test_whitelisted_number_lands_in_ops(self, ops):
        assert ops["login"]["role"] == "ops"
        assert ops["login"]["ops"]["phone"] == OPS_PHONE
        assert "partner" not in ops["login"], "an Ops login must not mint a partner session"

    def test_ordinary_number_still_lands_in_partner(self, driver):
        assert driver["partner"]["phone"] == DEMO_PARTNER_PHONE

    def test_one_login_screen_serves_both(self, session):
        """Both roles come back from the same endpoint, tagged by role."""
        a = _login(session, "/driver/auth/verify-otp", OPS_PHONE)["role"]
        b = _login(session, "/driver/auth/verify-otp", DEMO_PARTNER_PHONE)["role"]
        assert (a, b) == ("ops", "driver")

    def test_ops_me(self, session, ops):
        r = session.get(f"{API}/ops/me", headers=ops["headers"])
        assert r.status_code == 200 and r.json()["phone"] == OPS_PHONE


class TestRoleSeparation:
    @pytest.mark.parametrize("route", OPS_READ_ROUTES)
    def test_driver_token_rejected(self, session, driver, route):
        assert session.get(f"{API}{route}", headers=driver["headers"]).status_code == 403

    @pytest.mark.parametrize("route", OPS_READ_ROUTES)
    def test_customer_token_rejected(self, session, customer, route):
        assert session.get(f"{API}{route}", headers=customer["headers"]).status_code == 403

    @pytest.mark.parametrize("route", OPS_READ_ROUTES)
    def test_unauthenticated_rejected(self, session, route):
        assert session.get(f"{API}{route}", headers={}).status_code == 401

    def test_ops_token_rejected_by_the_other_two_apps(self, session, ops):
        assert session.get(f"{API}/users/me", headers=ops["headers"]).status_code == 403
        assert session.get(f"{API}/driver/trips", headers=ops["headers"]).status_code == 403

    def test_ops_write_routes_are_guarded_too(self, session, driver):
        r = session.post(f"{API}/ops/buddies", headers=driver["headers"],
                         json={"phone": "+919000000001"})
        assert r.status_code == 403


# ---------- Partner-mode switch ----------
class TestPartnerModeSwitch:
    def test_switch_returns_a_working_driver_session(self, session, ops):
        r = session.post(f"{API}/ops/switch-to-partner", headers=ops["headers"])
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "driver"
        assert r.json()["partner"]["phone"] == OPS_PHONE
        h = _headers(r.json()["token"])
        assert session.get(f"{API}/driver/trips", headers=h).status_code == 200

    def test_partner_mode_cannot_reach_ops(self, session, ops):
        h = _headers(session.post(f"{API}/ops/switch-to-partner",
                                  headers=ops["headers"]).json()["token"])
        assert session.get(f"{API}/ops/metrics", headers=h).status_code == 403

    def test_signing_in_again_returns_to_ops(self, session):
        """The only route back: sign out, sign in, and the whitelist wins again."""
        assert _login(session, "/driver/auth/verify-otp", OPS_PHONE)["role"] == "ops"

    def test_switch_is_idempotent(self, session, ops):
        a = session.post(f"{API}/ops/switch-to-partner", headers=ops["headers"]).json()
        b = session.post(f"{API}/ops/switch-to-partner", headers=ops["headers"]).json()
        assert a["partner"]["id"] == b["partner"]["id"], "must reuse the same Buddy account"


# ---------- Visibility ----------
class TestOpsVisibility:
    def test_ops_sees_customers_unmasked(self, session, ops):
        rows = session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()
        assert rows
        named = [r for r in rows if r["customer"]["name"]]
        assert named, "expected seeded bookings with a named customer"
        for r in named:
            assert not r["customer"]["name"].endswith("."), "Ops must not see the partner's mask"
            assert r["customer"]["phone"], "Ops needs a number to call the customer"

    def test_partner_still_sees_the_mask(self, session, driver):
        """The unmasking is scoped to Ops — the partner surface is unchanged."""
        for t in session.get(f"{API}/driver/trips", headers=driver["headers"]).json():
            parts = t["customer"].split()
            if len(parts) > 1:
                assert parts[-1].endswith(".")
            assert "phone" not in t

    def test_detail_carries_fare_and_payout(self, session, ops):
        row = session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()[0]
        d = session.get(f"{API}/ops/bookings/{row['id']}", headers=ops["headers"]).json()
        assert "breakdown" in d and "commission" in d
        assert d["deposit"] == round(d["fare"] * 0.20), "deposit is 20% per Rate Table v1.7"


# ---------- Dashboard ----------
class TestMetrics:
    def test_every_tile_has_a_value(self, m):
        for k in ("total", "pending", "in_progress", "completed", "cancelled",
                  "completion_rate", "active_buddies", "avg_rating", "utilisation_pct",
                  "payment_rate", "revenue", "refunds_pending", "punjab", "himachal",
                  "in_pipeline", "applied", "in_verification", "verified_ready"):
            assert k in m, f"missing metric {k}"
            assert m[k] is not None

    def test_seed_populates_every_group(self, m):
        """A dashboard of zeroes proves nothing, so the seed must exercise each."""
        assert m["pending"] > 0, "no pending queue to assign from"
        assert m["cancelled"] > 0 and m["refunds_pending"] > 0, "no refund queue"
        assert m["in_pipeline"] > 0, "no acquisition funnel"
        assert m["payments_failed"] > 0, "payment rate would be a flat 100%"

    def test_rates_are_percentages(self, m):
        for k in ("completion_rate", "cancellation_rate", "payment_rate", "utilisation_pct"):
            assert 0 <= m[k] <= 100, f"{k}={m[k]}"

    def test_completion_and_cancellation_are_complementary(self, m):
        assert m["completion_rate"] + m["cancellation_rate"] == 100

    def test_pipeline_stages_sum_to_the_pipeline(self, m):
        assert m["applied"] + m["in_verification"] + m["verified_ready"] == m["in_pipeline"]

    def test_regions_do_not_exceed_the_roster(self, m):
        assert m["punjab"] + m["himachal"] == m["active_buddies"]


# ---------- Bookings ----------
class TestBookings:
    def test_open_scope_excludes_finished_trips(self, session, ops):
        rows = session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()
        assert rows
        for r in rows:
            assert r["status"] not in ("completed", "cancelled")

    def test_scopes(self, session, ops):
        for scope, want in (("completed", "completed"), ("cancelled", "cancelled")):
            rows = session.get(f"{API}/ops/bookings?scope={scope}", headers=ops["headers"]).json()
            assert rows, f"no {scope} bookings seeded"
            assert all(r["status"] == want for r in rows)

    def test_sort_by_fare(self, session, ops):
        rows = session.get(f"{API}/ops/bookings?sort=fare", headers=ops["headers"]).json()
        assert [r["fare"] for r in rows] == sorted([r["fare"] for r in rows], reverse=True)

    def test_unknown_booking_is_404(self, session, ops):
        assert session.get(f"{API}/ops/bookings/nope", headers=ops["headers"]).status_code == 404

    def test_cancelled_becomes_closed_once_refunded(self, session, ops):
        rows = session.get(f"{API}/ops/bookings?scope=cancelled", headers=ops["headers"]).json()
        for r in rows:
            assert r["label"] == ("Closed" if r["refund_done"] else "Cancelled")


class TestAssign:
    def test_assign_moves_a_pending_trip_to_confirmed(self, session, ops):
        pend = [b for b in session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()
                if b["label"] == "Received"]
        if not pend:
            pytest.skip("pending queue already drained by an earlier run")
        free = [b for b in session.get(f"{API}/ops/buddies", headers=ops["headers"]).json()
                if b["active"] and not b["on_duty"]]
        assert free, "no assignable Buddy"
        r = session.post(f"{API}/ops/bookings/{pend[0]['id']}/assign",
                         headers=ops["headers"], json={"buddy_id": free[0]["id"]})
        assert r.status_code == 200, r.text
        assert r.json()["label"] == "Confirmed"
        assert r.json()["buddy"]["id"] == free[0]["id"]

        # Assigning again must not silently move a Buddy off a live trip.
        again = session.post(f"{API}/ops/bookings/{pend[0]['id']}/assign",
                             headers=ops["headers"], json={"buddy_id": free[0]["id"]})
        assert again.status_code == 400

    def test_unknown_buddy_is_404(self, session, ops):
        pend = [b for b in session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()
                if b["label"] == "Received"]
        if not pend:
            pytest.skip("pending queue drained")
        r = session.post(f"{API}/ops/bookings/{pend[0]['id']}/assign",
                         headers=ops["headers"], json={"buddy_id": "nope"})
        assert r.status_code == 404


class TestRefunds:
    def test_settling_a_refund_closes_the_booking(self, session, ops):
        queue = [b for b in session.get(f"{API}/ops/bookings?scope=cancelled",
                                        headers=ops["headers"]).json() if not b["refund_done"]]
        if not queue:
            pytest.skip("refund queue already drained")
        bid = queue[0]["id"]
        r = session.post(f"{API}/ops/bookings/{bid}/refund", headers=ops["headers"])
        assert r.status_code == 200 and r.json()["ok"] is True
        assert session.get(f"{API}/ops/bookings/{bid}", headers=ops["headers"]).json()["label"] == "Closed"
        assert session.post(f"{API}/ops/bookings/{bid}/refund", headers=ops["headers"]).status_code == 400

    def test_cannot_refund_a_live_trip(self, session, ops):
        live = session.get(f"{API}/ops/bookings", headers=ops["headers"]).json()[0]
        assert session.post(f"{API}/ops/bookings/{live['id']}/refund",
                            headers=ops["headers"]).status_code == 400


# ---------- Buddies ----------
class TestBuddies:
    def test_roster_shape(self, session, ops):
        rows = session.get(f"{API}/ops/buddies", headers=ops["headers"]).json()
        assert rows
        for k in ("id", "name", "phone", "rating", "active", "region", "earnings", "on_duty"):
            assert k in rows[0], f"missing {k}"

    def test_profile_includes_recent_trips(self, session, ops, driver):
        r = session.get(f"{API}/ops/buddies/{driver['partner']['id']}", headers=ops["headers"])
        assert r.status_code == 200
        assert isinstance(r.json()["recent"], list)
        assert r.json()["completed"] >= 0

    def test_add_buddy_enters_the_pipeline(self, session, ops):
        phone = f"+9195{int(time.time()) % 100000000:08d}"
        r = session.post(f"{API}/ops/buddies", headers=ops["headers"],
                         json={"phone": phone, "name": "Test Applicant", "licence": "PB-0000"})
        assert r.status_code == 200, r.text
        assert r.json()["onboarding"] is True and r.json()["stage"] == "applied"
        assert r.json()["applied_at"], "pipeline age needs a timestamp"
        assert session.post(f"{API}/ops/buddies", headers=ops["headers"],
                            json={"phone": phone}).status_code == 400

    def test_cannot_add_an_ops_number_as_a_buddy(self, session, ops):
        r = session.post(f"{API}/ops/buddies", headers=ops["headers"], json={"phone": OPS_PHONE})
        assert r.status_code == 400

    def test_verifying_an_applicant_promotes_them(self, session, ops):
        phone = f"+9194{int(time.time()) % 100000000:08d}"
        made = session.post(f"{API}/ops/buddies", headers=ops["headers"],
                            json={"phone": phone, "name": "Promote Me"}).json()
        r = session.patch(f"{API}/ops/buddies/{made['id']}", headers=ops["headers"],
                          json={"stage": "verified"})
        assert r.status_code == 200
        assert r.json()["stage"] == "verified"
        assert r.json()["onboarding"] is False, "a verified Buddy joins the active roster"

    def test_deactivating_blocks_their_login(self, session, ops):
        phone = f"+9193{int(time.time()) % 100000000:08d}"
        made = session.post(f"{API}/ops/buddies", headers=ops["headers"],
                            json={"phone": phone, "name": "Deactivate Me"}).json()
        session.patch(f"{API}/ops/buddies/{made['id']}", headers=ops["headers"],
                      json={"active": False})
        session.post(f"{API}/driver/auth/send-otp", json={"phone": phone})
        r = session.post(f"{API}/driver/auth/verify-otp", json={"phone": phone, "otp": "123456"})
        assert r.status_code == 403

    def test_unknown_buddy_is_404(self, session, ops):
        assert session.get(f"{API}/ops/buddies/nope", headers=ops["headers"]).status_code == 404
        assert session.patch(f"{API}/ops/buddies/nope", headers=ops["headers"],
                             json={"active": True}).status_code == 404
