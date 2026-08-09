"""RideBuddy in-app chat integration tests.

Chat is the first surface both apps share, so most of what is worth testing
here is the seam between them: that either role can reach a thread they belong
to, that neither can reach one they do not, and that crossing the seam does not
carry the owner's contact details over to the partner.

Run against a live server:
    EXPO_PUBLIC_BACKEND_URL=http://localhost:8001 backend/.venv/bin/pytest backend/tests -q
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_PARTNER_PHONE = "+919876543210"
# Owner of the seeded in_progress trip (SEED_OWNERS[2], Karthik Nair). Both auth
# routes store the phone verbatim, so the +91 form is required to reach the
# seeded account rather than silently creating an empty new one.
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
def driver(session):
    d = _login(session, "/driver/auth/verify-otp", DEMO_PARTNER_PHONE)
    return {"headers": _headers(d["token"]), "partner": d["partner"]}


@pytest.fixture(scope="module")
def owner(session):
    d = _login(session, "/auth/verify-otp", DEMO_OWNER_PHONE)
    return {"headers": _headers(d["token"]), "user": d["user"]}


@pytest.fixture(scope="module")
def stranger(session):
    phone = f"+9196{int(time.time()) % 100000000:08d}"
    d = _login(session, "/auth/verify-otp", phone)
    return {"headers": _headers(d["token"])}


@pytest.fixture(scope="module")
def closed_thread(session, driver):
    """A finished trip — its history stays readable but takes no new messages."""
    closed = [t for t in session.get(f"{API}/chat/threads", headers=driver["headers"]).json()
              if t["closed"]]
    assert closed, "seed includes completed trips"
    return closed[0]["booking_id"]


@pytest.fixture(scope="module")
def thread(session, driver, owner):
    """A booking both fixtures are participants in."""
    dt = session.get(f"{API}/chat/threads", headers=driver["headers"]).json()
    ot = session.get(f"{API}/chat/threads", headers=owner["headers"]).json()
    dids = {t["booking_id"] for t in dt}
    shared = [t for t in ot if t["booking_id"] in dids and not t["closed"]]
    assert shared, "seed should give the demo partner and owner a live shared trip"
    return shared[0]["booking_id"]


# ---------- Thread listing ----------
class TestThreads:
    def test_driver_lists_only_own_threads(self, session, driver):
        """Regression: a dict built as {key: id, "driver_id": {"$ne": None}}
        collapses for the driver — the second entry replaces the first and the
        query matches every partner's trips."""
        r = session.get(f"{API}/chat/threads", headers=driver["headers"])
        assert r.status_code == 200
        threads = r.json()
        assert threads, "demo partner has seeded trips"
        mine = driver["partner"]["id"]
        for t in threads:
            detail = session.get(f"{API}/driver/trips/{t['booking_id']}", headers=driver["headers"])
            assert detail.status_code == 200, f"listed a thread it cannot open: {t['booking_id']}"
        assert mine  # partner identity resolved

    def test_owner_lists_only_own_threads(self, session, owner):
        threads = session.get(f"{API}/chat/threads", headers=owner["headers"]).json()
        for t in threads:
            r = session.get(f"{API}/bookings/{t['booking_id']}", headers=owner["headers"])
            assert r.status_code == 200

    def test_threads_require_an_assigned_partner(self, session, owner):
        for t in session.get(f"{API}/chat/threads", headers=owner["headers"]).json():
            assert t["with"]["name"]

    def test_unauthenticated_is_rejected(self, session):
        assert session.get(f"{API}/chat/threads", headers={}).status_code == 401


# ---------- The privacy seam ----------
class TestCounterpartyVisibility:
    def test_partner_sees_masked_owner_and_no_contact(self, session, driver, thread):
        t = [x for x in session.get(f"{API}/chat/threads", headers=driver["headers"]).json()
             if x["booking_id"] == thread][0]
        who = t["with"]
        assert who["name"].endswith("."), "owner should be masked to first name + initial"
        assert who["phone"] is None
        assert who["photo"] is None

    def test_owner_sees_the_partner_in_full(self, session, owner, thread):
        t = [x for x in session.get(f"{API}/chat/threads", headers=owner["headers"]).json()
             if x["booking_id"] == thread][0]
        who = t["with"]
        assert who["name"] == "Rajesh Singh"
        assert who["phone"], "the owner is handing over their car and may call the partner"

    def test_owner_contact_never_appears_in_the_partner_view(self, session, driver, owner):
        blob = str(session.get(f"{API}/chat/threads", headers=driver["headers"]).json())
        assert DEMO_OWNER_PHONE not in blob
        assert (owner["user"].get("name") or "Karthik Nair") not in blob


# ---------- Sending and reading ----------
class TestMessaging:
    def test_round_trip_between_the_two_apps(self, session, driver, owner, thread):
        sent = session.post(f"{API}/chat/{thread}/messages", headers=driver["headers"],
                            json={"body": "Five minutes away."})
        assert sent.status_code == 200, sent.text
        assert sent.json()["sender_role"] == "driver"

        conv = session.get(f"{API}/chat/{thread}/messages", headers=owner["headers"])
        assert conv.status_code == 200
        data = conv.json()
        assert data["me"] == "user"
        assert any(m["body"] == "Five minutes away." for m in data["messages"])

        reply = session.post(f"{API}/chat/{thread}/messages", headers=owner["headers"],
                             json={"body": "Coming down now."})
        assert reply.status_code == 200
        assert reply.json()["sender_role"] == "user"

    def test_messages_are_ordered_oldest_first(self, session, owner, thread):
        msgs = session.get(f"{API}/chat/{thread}/messages", headers=owner["headers"]).json()["messages"]
        assert msgs == sorted(msgs, key=lambda m: m["created_at"])

    def test_empty_and_oversized_bodies_are_rejected(self, session, driver, thread):
        for body in ("", "   ", "x" * 2001):
            r = session.post(f"{API}/chat/{thread}/messages", headers=driver["headers"],
                             json={"body": body})
            assert r.status_code == 400, f"accepted {len(body)} chars"


class TestUnread:
    def test_unread_rises_for_the_recipient_and_clears_on_read(self, session, driver, owner, thread):
        session.post(f"{API}/chat/{thread}/read", headers=owner["headers"])
        before = session.get(f"{API}/chat/unread", headers=owner["headers"]).json()["unread"]

        session.post(f"{API}/chat/{thread}/messages", headers=driver["headers"],
                     json={"body": "Traffic on the bypass."})
        after = session.get(f"{API}/chat/unread", headers=owner["headers"]).json()["unread"]
        assert after == before + 1

        session.post(f"{API}/chat/{thread}/read", headers=owner["headers"])
        assert session.get(f"{API}/chat/unread", headers=owner["headers"]).json()["unread"] == 0

    def test_your_own_message_does_not_count_as_unread_to_you(self, session, driver, thread):
        session.post(f"{API}/chat/{thread}/read", headers=driver["headers"])
        session.post(f"{API}/chat/{thread}/messages", headers=driver["headers"],
                     json={"body": "Parked outside."})
        t = [x for x in session.get(f"{API}/chat/threads", headers=driver["headers"]).json()
             if x["booking_id"] == thread][0]
        assert t["unread"] == 0


# ---------- Authorization ----------
class TestAccessControl:
    def test_stranger_cannot_read_or_write(self, session, stranger, thread):
        assert session.get(f"{API}/chat/{thread}/messages", headers=stranger["headers"]).status_code == 403
        r = session.post(f"{API}/chat/{thread}/messages", headers=stranger["headers"],
                         json={"body": "hello"})
        assert r.status_code == 403

    def test_unauthenticated_cannot_read(self, session, thread):
        assert session.get(f"{API}/chat/{thread}/messages", headers={}).status_code == 401

    def test_unknown_booking_is_404(self, session, driver):
        r = session.get(f"{API}/chat/00000000-0000-0000-0000-000000000000/messages",
                        headers=driver["headers"])
        assert r.status_code == 404

    def test_both_roles_reach_the_same_route(self, session, driver, owner, thread):
        """Neither get_current_user nor get_current_driver can express this."""
        assert session.get(f"{API}/chat/{thread}/messages", headers=driver["headers"]).status_code == 200
        assert session.get(f"{API}/chat/{thread}/messages", headers=owner["headers"]).status_code == 200


class TestClosedThreads:
    def test_history_stays_readable(self, session, driver, closed_thread):
        assert session.get(f"{API}/chat/{closed_thread}/messages",
                           headers=driver["headers"]).status_code == 200

    def test_sending_is_refused(self, session, driver, closed_thread):
        r = session.post(f"{API}/chat/{closed_thread}/messages", headers=driver["headers"],
                         json={"body": "one more thing"})
        assert r.status_code == 409
