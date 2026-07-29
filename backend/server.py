from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
import random
import string
import jwt
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from twilio.rest import Client as TwilioClient
from twilio.base.exceptions import TwilioRestException

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
# In-memory fallback: when USE_INMEMORY_DB is set we use mongomock-motor instead
# of connecting to a real mongod. Useful in sandboxes where a MongoDB server is
# unavailable. Defaults to a real connection via MONGO_URL.
if os.environ.get('USE_INMEMORY_DB', '').lower() in ('1', 'true', 'yes'):
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
else:
    client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = "ridebuddy-secret-key-dev-please-rotate-in-prod-32chars+"
JWT_ALGO = "HS256"

# Twilio config
TWILIO_SID = os.environ.get('TWILIO_ACCOUNT_SID')
TWILIO_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
TWILIO_FROM = os.environ.get('TWILIO_FROM_NUMBER')
TWILIO_VERIFIED_RAW = os.environ.get('TWILIO_VERIFIED_NUMBERS') or os.environ.get('TWILIO_VERIFIED_NUMBER') or ''
TWILIO_VERIFIED = {n.strip() for n in TWILIO_VERIFIED_RAW.split(',') if n.strip()}
twilio_client = TwilioClient(TWILIO_SID, TWILIO_TOKEN) if (TWILIO_SID and TWILIO_TOKEN) else None

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Razorpay config — real gateway when keys are set, otherwise a mock flow so the
# app keeps working without credentials.
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET')
razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    try:
        import razorpay
        razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
        logger.info("Razorpay payment gateway enabled")
    except Exception as e:
        logger.warning(f"Razorpay disabled ({e}); falling back to mock payments")

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------------- Models ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str
    name: Optional[str] = None
    email: Optional[str] = None
    is_new: bool = True
    created_at: str = Field(default_factory=now_iso)


class Car(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    make: str
    model: str
    transmission: Literal["Manual", "Automatic"]
    color: Optional[str] = None
    plate: Optional[str] = None


class Driver(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    phone: str
    rating: float = 4.7
    trips: int = 0
    photo: str
    aadhaar_verified: bool = True
    police_verified: bool = True
    transmissions: List[str] = ["Manual", "Automatic"]
    available: bool = True
    eta_minutes: int = 5


class Partner(BaseModel):
    """A driver/partner account ("Buddy").

    Supersedes the seed-only `Driver` record: a Partner is a real, loginable
    account with credentials, verification state and onboarding stage. It keeps
    every field the client app's driver card renders (photo, rating, trips,
    aadhaar_verified, police_verified) so booking hydration is unchanged.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    phone: str                                   # login identity, 10-digit local
    name: Optional[str] = None
    email: Optional[str] = None
    licence: Optional[str] = None
    photo: Optional[str] = None
    rating: float = 0.0
    trips: int = 0
    # Verification — hardcoded true for now (documents flow deferred, see §12)
    aadhaar_verified: bool = True
    police_verified: bool = True
    transmissions: List[str] = ["Manual", "Automatic"]
    # active   = admin-enabled (Ops can deactivate a partner)
    # available= the partner's own online/offline toggle
    active: bool = True
    available: bool = True
    eta_minutes: int = 5
    onboarding: bool = False
    stage: Optional[Literal["applied", "verification", "verified"]] = None
    is_new: bool = True
    joined: str = Field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())
    created_at: str = Field(default_factory=now_iso)


class Booking(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    trip_type: Literal["point_to_point", "hourly"]
    one_way: bool = True  # for point_to_point
    pickup_address: str
    drop_address: Optional[str] = None
    pickup_lat: float = 19.0760
    pickup_lng: float = 72.8777
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    distance_km: float = 0
    duration_hours: float = 0  # for hourly
    days: int = 0  # for round trips (number of days)
    schedule_now: bool = True
    scheduled_at: Optional[str] = None
    return_at: Optional[str] = None
    intersect_at_owner: bool = True  # True = driver comes to owner; False = owner picks up driver
    transmission: Literal["Manual", "Automatic"] = "Automatic"
    car_id: Optional[str] = None
    base_fare: float = 0
    discount: float = 0
    total_fare: float = 0
    payment_method: Literal["upi", "card", "cash"] = "upi"
    pay_partial: bool = False  # 30% advance
    paid_amount: float = 0
    # en_route ("Left for Pickup") sits between assigned and arrived: the partner
    # has set off but has not yet reached the owner. Set from the driver app only.
    status: Literal[
        "pending", "searching", "assigned", "en_route", "arrived",
        "in_progress", "completed", "cancelled"
    ] = "pending"
    driver_id: Optional[str] = None
    start_code: Optional[str] = None
    end_code: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    left_at: Optional[str] = None
    arrived_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    rating: Optional[int] = None
    comment: Optional[str] = None


# ---------------- Schemas ----------------
class SendOtpIn(BaseModel):
    phone: str


class VerifyOtpIn(BaseModel):
    phone: str
    otp: str


class UpdateUserIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class CarIn(BaseModel):
    make: str
    model: str
    transmission: Literal["Manual", "Automatic"]
    color: Optional[str] = None
    plate: Optional[str] = None


class EstimateIn(BaseModel):
    trip_type: Literal["point_to_point", "hourly"]
    one_way: bool = True
    distance_km: float = 0
    duration_hours: float = 0
    days: int = 0


class BookingIn(BaseModel):
    trip_type: Literal["point_to_point", "hourly"]
    one_way: bool = True
    pickup_address: str
    drop_address: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None
    drop_lat: Optional[float] = None
    drop_lng: Optional[float] = None
    distance_km: float = 0
    duration_hours: float = 0
    days: int = 0
    schedule_now: bool = True
    scheduled_at: Optional[str] = None
    return_at: Optional[str] = None
    intersect_at_owner: bool = True
    transmission: Literal["Manual", "Automatic"] = "Automatic"
    car_id: Optional[str] = None
    payment_method: Literal["upi", "card", "cash"] = "upi"
    pay_partial: bool = False


class CodeIn(BaseModel):
    code: str


# ---------------- Helpers ----------------
def make_token(user_id: str, role: str = "user") -> str:
    """Issue a JWT carrying the caller's role.

    One auth system serves every surface: "user" (the client app), "driver" (the
    partner app) and — when the Ops console lands — "ops". Tokens minted before
    roles existed have no `role` claim and are read as "user".
    """
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def _decode(authorization: Optional[str]) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing auth")
    token = authorization.split(" ", 1)[1]
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    payload = _decode(authorization)
    # Legacy tokens predate the role claim; absence means the client app.
    if payload.get("role", "user") != "user":
        raise HTTPException(403, "This endpoint is for the client app")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def get_current_driver(authorization: Optional[str] = Header(None)) -> dict:
    payload = _decode(authorization)
    if payload.get("role") != "driver":
        raise HTTPException(403, "This endpoint is for the partner app")
    partner = await db.partners.find_one({"id": payload["sub"]}, {"_id": 0})
    if not partner:
        raise HTTPException(401, "Partner not found")
    if not partner.get("active", True):
        raise HTTPException(403, "This partner account has been deactivated")
    return partner


def compute_fare(trip_type: str, one_way: bool, distance_km: float, duration_hours: float, is_new_user: bool, days: int = 0):
    if trip_type == "point_to_point":
        if not one_way and days > 0:
            # Round trip = days-based pricing
            base = days * 1499
            discount = days * 200 if is_new_user else 0
            total = base - discount
            return float(base), float(discount), float(total)
        base = 199 + distance_km * 12
    else:  # hourly
        base = max(1, duration_hours) * 249
    discount = round(base * 0.10, 2) if is_new_user else 0.0
    total = round(base - discount, 2)
    return round(base, 2), discount, total


def gen_code() -> str:
    return "".join(random.choices(string.digits, k=4))


# Partners keep 80% of the trip fare; the platform commission is 20%. Rounded to
# the nearest ₹10 so the figure the partner sees is always a clean number.
COMMISSION_RATE = 0.20


def partner_earnings(booking: dict) -> float:
    fare = booking.get("total_fare") or 0
    return float(round(fare * (1 - COMMISSION_RATE) / 10) * 10)


def mask_name(name: Optional[str]) -> str:
    """Partners only ever see the owner's first name + last initial.

    Full names and phone numbers stay server-side — a partner has no need for
    them and the design masks them on every screen.
    """
    parts = (name or "").strip().split()
    if not parts:
        return "Customer"
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}."


async def assign_partner(booking_id: str, partner_id: str) -> bool:
    """Assign a partner to a booking and mint the handshake codes.

    Ops owns assignment in the product design. Until the Ops console ships,
    `auto_assign_driver` calls this on a timer so bookings made in the client
    app still reach a partner. The conditional update keeps it single-winner.
    """
    res = await db.bookings.update_one(
        {"id": booking_id, "driver_id": None},
        {
            "$set": {
                "driver_id": partner_id,
                "status": "assigned",
                "start_code": gen_code(),
                "end_code": gen_code(),
            }
        },
    )
    return res.modified_count > 0


async def auto_assign_driver(booking_id: str):
    """Background: after a delay, assign an available partner matching transmission.

    Interim stand-in for the Ops console's assignment step.
    """
    await asyncio.sleep(3)
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking or booking["status"] != "searching":
        return
    partner = await db.partners.find_one(
        {"available": True, "active": True, "transmissions": booking["transmission"]},
        {"_id": 0},
    )
    if not partner:
        return
    await assign_partner(booking_id, partner["id"])


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "RideBuddy API"}


@api_router.post("/auth/send-otp")
async def send_otp(body: SendOtpIn):
    phone = body.phone.strip()
    code = "".join(random.choices(string.digits, k=6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires.isoformat(), "verified": False}},
        upsert=True,
    )
    sent_via = "mock"
    error_msg = None
    # Real SMS only when Twilio configured AND phone matches verified trial number
    if twilio_client and TWILIO_FROM and phone in TWILIO_VERIFIED:
        try:
            twilio_client.messages.create(
                body=f"Your RideBuddy verification code is {code}. Valid for 5 minutes.",
                from_=TWILIO_FROM,
                to=phone,
            )
            sent_via = "twilio"
            logger.info("Sent Twilio OTP to %s", phone)
        except TwilioRestException as e:
            error_msg = str(e)
            logger.warning("Twilio failed for %s: %s", phone, e)
    resp = {"sent": True, "phone": phone, "channel": sent_via}
    if sent_via == "mock":
        resp["hint"] = f"Mock mode — use the code {code} or any 6 digits"
    if error_msg:
        resp["twilio_error"] = error_msg
    return resp


@api_router.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtpIn):
    phone = body.phone.strip()
    if not (body.otp.isdigit() and len(body.otp) == 6):
        raise HTTPException(400, "OTP must be 6 digits")
    record = await db.otps.find_one({"phone": phone}, {"_id": 0})
    # For real Twilio SMS to a whitelisted number, strict check
    if twilio_client and phone in TWILIO_VERIFIED:
        if not record or record.get("code") != body.otp:
            raise HTTPException(400, "Invalid OTP")
        expires = datetime.fromisoformat(record["expires_at"])
        if datetime.now(timezone.utc) > expires:
            raise HTTPException(400, "OTP expired, please request a new one")
        await db.otps.update_one({"phone": phone}, {"$set": {"verified": True}})
    # else: mock mode — accept any 6-digit code (backward compatible)

    existing = await db.users.find_one({"phone": phone}, {"_id": 0})
    if existing:
        token = make_token(existing["id"])
        return {"token": token, "user": existing}
    user = User(phone=phone)
    await db.users.insert_one(user.dict())
    token = make_token(user.id)
    return {"token": token, "user": user.dict()}


@api_router.get("/users/me")
async def me(user=Depends(get_current_user)):
    return user


@api_router.put("/users/me")
async def update_me(body: UpdateUserIn, user=Depends(get_current_user)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": {**updates, "is_new": False}})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0})


@api_router.get("/users/me/cars")
async def list_cars(user=Depends(get_current_user)):
    cars = await db.cars.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)
    return cars


@api_router.post("/users/me/cars")
async def add_car(body: CarIn, user=Depends(get_current_user)):
    car = Car(user_id=user["id"], **body.dict())
    await db.cars.insert_one(car.dict())
    return car.dict()


@api_router.delete("/users/me/cars/{car_id}")
async def delete_car(car_id: str, user=Depends(get_current_user)):
    await db.cars.delete_one({"id": car_id, "user_id": user["id"]})
    return {"deleted": True}


@api_router.post("/bookings/estimate")
async def estimate(body: EstimateIn, user=Depends(get_current_user)):
    base, discount, total = compute_fare(
        body.trip_type, body.one_way, body.distance_km, body.duration_hours, user.get("is_new", True), body.days
    )
    per_day_discount = 200 if (not body.one_way and body.days > 0 and user.get("is_new", True)) else 0
    return {
        "base_fare": base,
        "discount": discount,
        "total_fare": total,
        "new_user_discount": user.get("is_new", True),
        "advance_30": round(total * 0.30, 2),
        "days": body.days,
        "per_day_rate": 1499 if (not body.one_way and body.days > 0) else 0,
        "per_day_discount": per_day_discount,
    }


@api_router.post("/bookings")
async def create_booking(body: BookingIn, user=Depends(get_current_user)):
    base, discount, total = compute_fare(
        body.trip_type, body.one_way, body.distance_km, body.duration_hours, user.get("is_new", True), body.days
    )
    paid = 0.0
    if body.payment_method != "cash":
        paid = round(total * 0.30, 2) if body.pay_partial else total
    # Drop None values so Booking model defaults (e.g. pickup_lat=Mumbai) kick in only when not supplied
    body_data = {k: v for k, v in body.dict().items() if v is not None}
    booking = Booking(
        user_id=user["id"],
        **body_data,
        base_fare=base,
        discount=discount,
        total_fare=total,
        paid_amount=paid,
        status="searching",
    )
    await db.bookings.insert_one(booking.dict())
    asyncio.create_task(auto_assign_driver(booking.id))
    return booking.dict()


# ---------------- Payments (Razorpay) ----------------
class CreateOrderIn(BaseModel):
    amount: float  # amount in rupees


class VerifyPaymentIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api_router.post("/payments/create-order")
async def create_payment_order(body: CreateOrderIn, user=Depends(get_current_user)):
    amount_paise = int(round(body.amount * 100))
    if amount_paise <= 0:
        raise HTTPException(400, "Invalid amount")
    if razorpay_client:
        order = razorpay_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": f"rb_{uuid.uuid4().hex[:12]}",
            "notes": {"user_id": user["id"]},
        })
        return {
            "mock": False,
            "order_id": order["id"],
            "key_id": RAZORPAY_KEY_ID,
            "amount": amount_paise,
            "currency": "INR",
        }
    # No credentials configured — return a mock order so the app still completes.
    return {
        "mock": True,
        "order_id": f"mock_{uuid.uuid4().hex[:12]}",
        "key_id": "",
        "amount": amount_paise,
        "currency": "INR",
    }


@api_router.post("/payments/verify")
async def verify_payment(body: VerifyPaymentIn, user=Depends(get_current_user)):
    if razorpay_client:
        try:
            razorpay_client.utility.verify_payment_signature({
                "razorpay_order_id": body.razorpay_order_id,
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_signature": body.razorpay_signature,
            })
        except Exception:
            raise HTTPException(400, "Payment signature verification failed")
        return {"verified": True}
    # Mock mode — nothing to verify.
    return {"verified": True, "mock": True}


async def _hydrate_booking(b: dict) -> dict:
    if b.get("driver_id"):
        drv = await db.partners.find_one({"id": b["driver_id"]}, {"_id": 0})
        if drv:
            # The owner never sees the partner's login/onboarding internals.
            drv = {k: v for k, v in drv.items() if k not in ("is_new", "stage", "onboarding", "active")}
        b["driver"] = drv
    return b


@api_router.get("/bookings")
async def list_bookings(user=Depends(get_current_user)):
    items = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await _hydrate_booking(b) for b in items]


@api_router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Booking not found")
    return await _hydrate_booking(b)


@api_router.post("/bookings/{booking_id}/verify-start")
async def verify_start(booking_id: str, body: CodeIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    if b["status"] not in ("assigned", "arrived"):
        raise HTTPException(400, "Not ready to start")
    if body.code != b.get("start_code"):
        raise HTTPException(400, "Invalid start code")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": "in_progress", "started_at": now_iso()}},
    )
    return await _hydrate_booking(await db.bookings.find_one({"id": booking_id}, {"_id": 0}))


@api_router.post("/bookings/{booking_id}/verify-end")
async def verify_end(booking_id: str, body: CodeIn, user=Depends(get_current_user)):
    b = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    if b["status"] != "in_progress":
        raise HTTPException(400, "Trip not in progress")
    if body.code != b.get("end_code"):
        raise HTTPException(400, "Invalid end code")
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "status": "completed",
                "completed_at": now_iso(),
                "paid_amount": b["total_fare"],
            }
        },
    )
    await db.users.update_one({"id": user["id"]}, {"$set": {"is_new": False}})
    return await _hydrate_booking(await db.bookings.find_one({"id": booking_id}, {"_id": 0}))


@api_router.post("/bookings/{booking_id}/cancel")
async def cancel_booking(booking_id: str, user=Depends(get_current_user)):
    await db.bookings.update_one(
        {"id": booking_id, "user_id": user["id"]},
        {"$set": {"status": "cancelled"}},
    )
    return {"cancelled": True}


@api_router.post("/bookings/{booking_id}/simulate-arrived")
async def simulate_arrived(booking_id: str, user=Depends(get_current_user)):
    """Demo helper: mark driver as arrived."""
    await db.bookings.update_one(
        {"id": booking_id, "user_id": user["id"], "status": "assigned"},
        {"$set": {"status": "arrived"}},
    )
    return await _hydrate_booking(await db.bookings.find_one({"id": booking_id}, {"_id": 0}))


@api_router.get("/drivers")
async def list_drivers():
    drivers = await db.partners.find(
        {"active": True, "onboarding": False},
        {"_id": 0, "is_new": 0, "stage": 0},
    ).to_list(50)
    return drivers


# ==================== Partner / Driver app ====================
# Auth mirrors the client flow (phone + OTP) but mints a role="driver" token and
# resolves against the `partners` collection. `get_current_driver` rejects client
# tokens, and `get_current_user` rejects partner tokens, so the two surfaces can
# never reach into each other.

class DriverUpdateIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    licence: Optional[str] = None


class AvailabilityIn(BaseModel):
    available: bool


@api_router.post("/driver/auth/send-otp")
async def driver_send_otp(body: SendOtpIn):
    # Same OTP store and Twilio rules as the client app.
    return await send_otp(body)


@api_router.post("/driver/auth/verify-otp")
async def driver_verify_otp(body: VerifyOtpIn):
    phone = body.phone.strip()
    if not (body.otp.isdigit() and len(body.otp) == 6):
        raise HTTPException(400, "OTP must be 6 digits")
    record = await db.otps.find_one({"phone": phone}, {"_id": 0})
    if twilio_client and phone in TWILIO_VERIFIED:
        if not record or record.get("code") != body.otp:
            raise HTTPException(400, "Invalid OTP")
        if datetime.now(timezone.utc) > datetime.fromisoformat(record["expires_at"]):
            raise HTTPException(400, "OTP expired, please request a new one")
        await db.otps.update_one({"phone": phone}, {"$set": {"verified": True}})
    # else: mock mode — any 6-digit code passes.

    existing = await db.partners.find_one({"phone": phone}, {"_id": 0})
    if existing:
        if not existing.get("active", True):
            raise HTTPException(403, "This partner account has been deactivated")
        return {"token": make_token(existing["id"], "driver"), "partner": existing}

    # TODO(onboarding): the design gates login on an Ops-managed whitelist and
    # shows "This number isn't authorised. Contact the admin." Self-signup is
    # enabled for now so any number can be tested on-device; replace this with a
    # whitelist lookup + document verification when Ops onboarding ships.
    partner = Partner(phone=phone)
    await db.partners.insert_one(partner.dict())
    return {"token": make_token(partner.id, "driver"), "partner": partner.dict()}


@api_router.get("/driver/me")
async def driver_me(partner=Depends(get_current_driver)):
    return partner


@api_router.put("/driver/me")
async def driver_update_me(body: DriverUpdateIn, partner=Depends(get_current_driver)):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        await db.partners.update_one({"id": partner["id"]}, {"$set": {**updates, "is_new": False}})
    return await db.partners.find_one({"id": partner["id"]}, {"_id": 0})


@api_router.patch("/driver/availability")
async def driver_availability(body: AvailabilityIn, partner=Depends(get_current_driver)):
    """Online/offline toggle. Going offline never releases an accepted trip —
    the partner stays responsible for work already assigned to them."""
    await db.partners.update_one({"id": partner["id"]}, {"$set": {"available": body.available}})
    return {"available": body.available}


async def _driver_view(b: dict) -> dict:
    """Project a booking into what a partner is allowed to see.

    Drops the owner's identity (masked to "Vikram S."), swaps the fare for the
    partner's own earnings, and — for round trips — withholds the exact drop
    address until the day of travel, matching the design.
    """
    owner = await db.users.find_one({"id": b["user_id"]}, {"_id": 0})
    car = await db.cars.find_one({"id": b["car_id"]}, {"_id": 0}) if b.get("car_id") else None
    round_trip = not b.get("one_way", True)
    return {
        "id": b["id"],
        "status": b["status"],
        "customer": mask_name((owner or {}).get("name")),
        "trip_type": b["trip_type"],
        "one_way": b.get("one_way", True),
        "round_trip": round_trip,
        "pickup_address": b.get("pickup_address"),
        # Round trips share only the drop city up front; the exact address is
        # handed over on the day.
        "drop_address": None if round_trip else b.get("drop_address"),
        "drop_area": b.get("drop_address"),
        "pickup_lat": b.get("pickup_lat"),
        "pickup_lng": b.get("pickup_lng"),
        "drop_lat": b.get("drop_lat"),
        "drop_lng": b.get("drop_lng"),
        "distance_km": b.get("distance_km"),
        "duration_hours": b.get("duration_hours"),
        "days": b.get("days"),
        "transmission": b.get("transmission"),
        "car": f"{car['make']} {car['model']}" if car else None,
        "make": car["make"] if car else None,
        "model": car["model"] if car else None,
        "scheduled_at": b.get("scheduled_at"),
        "return_at": b.get("return_at"),
        "schedule_now": b.get("schedule_now", True),
        "intersect_at_owner": b.get("intersect_at_owner", True),
        "earnings": partner_earnings(b),
        # The partner is shown the start code only after the owner reads it out —
        # it is never sent to the partner app.
        "created_at": b.get("created_at"),
        "left_at": b.get("left_at"),
        "arrived_at": b.get("arrived_at"),
        "started_at": b.get("started_at"),
        "completed_at": b.get("completed_at"),
        "rating": b.get("rating"),
        "comment": b.get("comment"),
    }


@api_router.get("/driver/trips")
async def driver_trips(partner=Depends(get_current_driver)):
    """Every trip assigned to this partner, newest pickup first.

    There is no open pool: assignment is Ops-owned, so a partner only ever sees
    work that is already theirs.
    """
    items = await db.bookings.find(
        {"driver_id": partner["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    return [await _driver_view(b) for b in items]


@api_router.get("/driver/trips/{booking_id}")
async def driver_trip(booking_id: str, partner=Depends(get_current_driver)):
    b = await db.bookings.find_one({"id": booking_id, "driver_id": partner["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Trip not found")
    return await _driver_view(b)


async def _advance(booking_id: str, partner_id: str, allowed_from: List[str], to: str, stamp: str):
    b = await db.bookings.find_one({"id": booking_id, "driver_id": partner_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Trip not found")
    if b["status"] not in allowed_from:
        raise HTTPException(400, f"Cannot move a trip from {b['status']} to {to}")
    await db.bookings.update_one({"id": booking_id}, {"$set": {"status": to, stamp: now_iso()}})
    return await _driver_view(await db.bookings.find_one({"id": booking_id}, {"_id": 0}))


@api_router.post("/driver/trips/{booking_id}/left-for-pickup")
async def driver_left_for_pickup(booking_id: str, partner=Depends(get_current_driver)):
    return await _advance(booking_id, partner["id"], ["assigned"], "en_route", "left_at")


@api_router.post("/driver/trips/{booking_id}/arrived")
async def driver_arrived(booking_id: str, partner=Depends(get_current_driver)):
    return await _advance(booking_id, partner["id"], ["assigned", "en_route"], "arrived", "arrived_at")


@api_router.post("/driver/trips/{booking_id}/verify-start")
async def driver_verify_start(booking_id: str, body: CodeIn, partner=Depends(get_current_driver)):
    """The partner types the 4-digit code the owner reads out to them.

    The owner's app displays the code; this endpoint is the partner-side half of
    that handshake. Ending the trip stays with the owner (`/bookings/{id}/verify-end`).
    """
    b = await db.bookings.find_one({"id": booking_id, "driver_id": partner["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Trip not found")
    if b["status"] not in ("assigned", "en_route", "arrived"):
        raise HTTPException(400, "Not ready to start")
    if body.code != b.get("start_code"):
        raise HTTPException(400, "Incorrect code. Ask the customer to check their app.")
    await db.bookings.update_one(
        {"id": booking_id}, {"$set": {"status": "in_progress", "started_at": now_iso()}}
    )
    return await _driver_view(await db.bookings.find_one({"id": booking_id}, {"_id": 0}))


@api_router.post("/driver/trips/{booking_id}/cancel")
async def driver_cancel(booking_id: str, partner=Depends(get_current_driver)):
    """Drop an assigned trip. It returns to the pool for Ops to reassign, and
    this partner is blocked from being auto-assigned to it again."""
    b = await db.bookings.find_one({"id": booking_id, "driver_id": partner["id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Trip not found")
    if b["status"] in ("in_progress", "completed", "cancelled"):
        raise HTTPException(400, "This trip can no longer be dropped")
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {"driver_id": None, "status": "searching", "start_code": None, "end_code": None},
            "$addToSet": {"declined_by": partner["id"]},
        },
    )
    return {"dropped": True}


@api_router.get("/driver/earnings")
async def driver_earnings(partner=Depends(get_current_driver)):
    """Real earnings computed from completed trips, plus per-trip rows so the
    app can bucket them into week/month/quarter/year itself."""
    items = await db.bookings.find(
        {"driver_id": partner["id"], "status": "completed"}, {"_id": 0}
    ).sort("completed_at", -1).to_list(500)
    trips = [
        {
            "id": b["id"],
            "earnings": partner_earnings(b),
            "fare": b.get("total_fare", 0),
            "completed_at": b.get("completed_at"),
            "pickup_address": b.get("pickup_address"),
            "drop_address": b.get("drop_address"),
            "rating": b.get("rating"),
        }
        for b in items
    ]
    return {
        "lifetime": round(sum(t["earnings"] for t in trips), 2),
        "trips_completed": len(trips),
        "commission_rate": COMMISSION_RATE,
        "trips": trips,
    }


# ---------------- Seeding ----------------
# Partners are re-seeded on every startup (upsert by phone) so partner login
# always works, including after an in-memory DB restart.
SEED_PARTNERS = [
    {
        "phone": "+919876543210", "name": "Rajesh Singh", "licence": "PB-0220190034521",
        "rating": 4.9, "trips": 128, "joined": "2025-11-02", "is_new": False,
        "photo": "https://images.unsplash.com/photo-1718434127037-efa9c3043f7f?w=300",
    },
    {
        "phone": "+919814203356", "name": "Harpreet Kaur", "licence": "PB-0820180012204",
        "rating": 4.8, "trips": 96, "joined": "2025-12-14", "is_new": False,
        "photo": "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=300",
    },
    {
        "phone": "+919988123047", "name": "Manpreet Gill", "licence": "PB-1020190077310",
        "rating": 4.7, "trips": 74, "joined": "2026-01-09", "is_new": False,
        "photo": "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300",
    },
    {
        "phone": "+919418876620", "name": "Vikas Thakur", "licence": "HP-0420170045129",
        "rating": 4.9, "trips": 152, "joined": "2025-10-21", "is_new": False,
        "photo": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300",
    },
    {
        "phone": "+919736650912", "name": "Sunil Verma", "licence": "HP-0720200033418",
        "rating": 4.6, "trips": 41, "joined": "2026-02-18", "is_new": False,
        "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300",
    },
]

# Mock owners + their cars, so seeded trips render a real customer and vehicle.
SEED_OWNERS = [
    {"name": "Vikram Saini", "phone": "+919814552210", "make": "Maruti Suzuki", "model": "Swift Dzire", "transmission": "Manual"},
    {"name": "Aarti Mehta", "phone": "+919988012245", "make": "Hyundai", "model": "Creta", "transmission": "Automatic"},
    {"name": "Karthik Nair", "phone": "+919845512300", "make": "Hyundai", "model": "Creta", "transmission": "Automatic"},
    {"name": "Nisha Rao", "phone": "+919876004412", "make": "Hyundai", "model": "Verna", "transmission": "Automatic"},
    {"name": "Sandeep Kohli", "phone": "+919023440561", "make": "Tata", "model": "Harrier", "transmission": "Automatic"},
    {"name": "Kavya Nair", "phone": "+919417001288", "make": "Maruti Suzuki", "model": "Ertiga", "transmission": "Manual"},
    {"name": "Imran Sheikh", "phone": "+919888110234", "make": "Honda", "model": "City", "transmission": "Automatic"},
    {"name": "Arjun Reddy", "phone": "+919216770340", "make": "Toyota", "model": "Innova Crysta", "transmission": "Manual"},
]

# Chandigarh tri-city → Himachal hill routes, matching the design's demo region.
PLACES = {
    "Chandigarh": (30.7415, 76.7836, "Sector 17 Plaza, Chandigarh"),
    "Mohali": (30.7140, 76.6960, "Phase 9, Sector 63, Mohali"),
    "Panchkula": (30.6890, 76.8540, "Sector 9 Market, Panchkula"),
    "Shimla": (31.1033, 77.1722, "The Ridge, Shimla"),
    "Kasauli": (30.8980, 76.9655, "Mall Road, Kasauli"),
    "Manali": (32.2580, 77.1810, "Old Manali"),
    "Dharamshala": (32.2400, 76.3200, "McLeod Ganj, Dharamshala"),
}

# (owner_idx, from, to, one_way, days, status, day_offset, fare, distance, rating, comment)
# day_offset is relative to server start, so the demo never goes stale.
SEED_TRIPS = [
    (2, "Chandigarh", "Kasauli", True, 0, "in_progress", 0, 3200, 62, None, None),
    (0, "Mohali", "Kasauli", True, 0, "assigned", 1, 3200, 68, None, None),
    (1, "Chandigarh", "Shimla", False, 3, "assigned", 2, 6800, 113, None, None),
    # Completed history is spread from a couple of days ago out to ~6 months so
    # the Earnings screen has content in every period filter (week → annual).
    (3, "Mohali", "Kasauli", True, 0, "completed", -2, 3300, 68, 5, "Smooth, careful drive up."),
    (6, "Chandigarh", "Kasauli", True, 0, "completed", -4, 3100, 62, 5, None),
    (4, "Chandigarh", "Shimla", False, 2, "completed", -9, 7200, 113, 4, None),
    (5, "Panchkula", "Manali", False, 3, "completed", -17, 10800, 290, 5, "Knows the hill roads well."),
    (7, "Chandigarh", "Manali", False, 4, "completed", -34, 12400, 305, 5, "Excellent across all four days."),
    (3, "Panchkula", "Shimla", True, 0, "completed", -58, 4400, 118, 4, None),
    (4, "Chandigarh", "Dharamshala", True, 0, "completed", -96, 4600, 240, 5, None),
    (6, "Mohali", "Dharamshala", False, 2, "completed", -142, 9200, 245, 4, None),
]


async def seed_partner_demo_data():
    """Seed partners, mock owners/cars and the trips already assigned to them.

    Without this the partner app opens on an empty Home: assignment is Ops-owned
    and the Ops console does not exist yet.
    """
    for p in SEED_PARTNERS:
        existing = await db.partners.find_one({"phone": p["phone"]}, {"_id": 0})
        if not existing:
            await db.partners.insert_one(Partner(**p).dict())

    demo = await db.partners.find_one({"phone": SEED_PARTNERS[0]["phone"]}, {"_id": 0})
    if not demo:
        return
    if await db.bookings.count_documents({"driver_id": demo["id"]}) > 0:
        return  # already seeded

    owner_ids = []
    for o in SEED_OWNERS:
        user = await db.users.find_one({"phone": o["phone"]}, {"_id": 0})
        if not user:
            user = User(phone=o["phone"], name=o["name"], is_new=False).dict()
            await db.users.insert_one(user)
            car = Car(
                user_id=user["id"], make=o["make"], model=o["model"],
                transmission=o["transmission"], plate="CH01AB" + str(random.randint(1000, 9999)),
            )
            await db.cars.insert_one(car.dict())
        owner_ids.append(user["id"])

    now = datetime.now(timezone.utc)
    for (oi, src, dst, one_way, days, status, offset, fare, dist, rating, comment) in SEED_TRIPS:
        p_lat, p_lng, p_addr = PLACES[src]
        d_lat, d_lng, d_addr = PLACES[dst]
        owner = await db.users.find_one({"id": owner_ids[oi]}, {"_id": 0})
        car = await db.cars.find_one({"user_id": owner_ids[oi]}, {"_id": 0})
        out = now + timedelta(days=offset)
        completed = status == "completed"
        booking = Booking(
            user_id=owner_ids[oi],
            trip_type="point_to_point",
            one_way=one_way,
            days=days,
            pickup_address=p_addr,
            drop_address=d_addr,
            pickup_lat=p_lat, pickup_lng=p_lng,
            drop_lat=d_lat, drop_lng=d_lng,
            distance_km=dist,
            schedule_now=False,
            scheduled_at=out.isoformat(),
            return_at=(out + timedelta(days=days)).isoformat() if days else None,
            transmission=(car or {}).get("transmission", "Automatic"),
            car_id=(car or {}).get("id"),
            base_fare=fare, discount=0, total_fare=fare,
            payment_method="upi",
            paid_amount=fare if completed else round(fare * 0.30, 2),
            status=status,
            driver_id=demo["id"],
            start_code=gen_code(),
            end_code=gen_code(),
            created_at=(out - timedelta(days=2)).isoformat(),
            started_at=out.isoformat() if status in ("in_progress", "completed") else None,
            completed_at=(out + timedelta(days=days, hours=6)).isoformat() if completed else None,
            rating=rating,
            comment=comment,
        )
        await db.bookings.insert_one(booking.dict())
    logger.info("Seeded %d partners and %d demo trips", len(SEED_PARTNERS), len(SEED_TRIPS))


SEED_DRIVERS = [
    {
        "name": "Rajesh Kumar",
        "phone": "+919900000001",
        "rating": 4.9,
        "trips": 1280,
        "photo": "https://images.unsplash.com/photo-1718434127037-efa9c3043f7f?w=300",
        "eta_minutes": 4,
    },
    {
        "name": "Amit Sharma",
        "phone": "+919900000002",
        "rating": 4.8,
        "trips": 942,
        "photo": "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=300",
        "eta_minutes": 6,
    },
    {
        "name": "Suresh Patil",
        "phone": "+919900000003",
        "rating": 4.7,
        "trips": 612,
        "photo": "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=300",
        "eta_minutes": 8,
    },
    {
        "name": "Vikram Singh",
        "phone": "+919900000004",
        "rating": 4.9,
        "trips": 2105,
        "photo": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300",
        "eta_minutes": 5,
    },
    {
        "name": "Mohan Reddy",
        "phone": "+919900000005",
        "rating": 4.6,
        "trips": 480,
        "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300",
        "eta_minutes": 7,
    },
]


@app.on_event("startup")
async def seed_drivers():
    """Seed the partner roster.

    The original five seed drivers become mock partner accounts so bookings that
    already reference them still hydrate; the design's roster is added alongside.
    Partners are the single source of truth — the legacy `drivers` collection is
    no longer read.
    """
    for d in SEED_DRIVERS:
        if not await db.partners.find_one({"phone": d["phone"]}):
            await db.partners.insert_one(
                Partner(
                    phone=d["phone"], name=d["name"], rating=d["rating"], trips=d["trips"],
                    photo=d["photo"], eta_minutes=d["eta_minutes"], is_new=False,
                    licence="MH-0120190000000",
                ).dict()
            )
    await seed_partner_demo_data()


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    if hasattr(client, "close"):
        client.close()
