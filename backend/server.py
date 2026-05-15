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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = "ridebuddy-secret-key-dev-please-rotate-in-prod-32chars+"
JWT_ALGO = "HS256"

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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
    status: Literal[
        "pending", "searching", "assigned", "arrived", "in_progress", "completed", "cancelled"
    ] = "pending"
    driver_id: Optional[str] = None
    start_code: Optional[str] = None
    end_code: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


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
def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing auth")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


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


async def auto_assign_driver(booking_id: str):
    """Background: after a delay, find an available driver matching transmission."""
    await asyncio.sleep(3)
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking or booking["status"] != "searching":
        return
    driver = await db.drivers.find_one(
        {"available": True, "transmissions": booking["transmission"]},
        {"_id": 0},
    )
    if not driver:
        return
    await db.bookings.update_one(
        {"id": booking_id},
        {
            "$set": {
                "driver_id": driver["id"],
                "status": "assigned",
                "start_code": gen_code(),
                "end_code": gen_code(),
            }
        },
    )


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "RideBuddy API"}


@api_router.post("/auth/send-otp")
async def send_otp(body: SendOtpIn):
    # MOCKED: any 6-digit otp accepted later
    return {"sent": True, "phone": body.phone, "hint": "Use any 6-digit code (e.g. 123456)"}


@api_router.post("/auth/verify-otp")
async def verify_otp(body: VerifyOtpIn):
    if not (body.otp.isdigit() and len(body.otp) == 6):
        raise HTTPException(400, "OTP must be 6 digits")
    existing = await db.users.find_one({"phone": body.phone}, {"_id": 0})
    if existing:
        token = make_token(existing["id"])
        return {"token": token, "user": existing}
    user = User(phone=body.phone)
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
    booking = Booking(
        user_id=user["id"],
        **body.dict(),
        base_fare=base,
        discount=discount,
        total_fare=total,
        paid_amount=paid,
        status="searching",
    )
    await db.bookings.insert_one(booking.dict())
    asyncio.create_task(auto_assign_driver(booking.id))
    return booking.dict()


async def _hydrate_booking(b: dict) -> dict:
    if b.get("driver_id"):
        drv = await db.drivers.find_one({"id": b["driver_id"]}, {"_id": 0})
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
    drivers = await db.drivers.find({}, {"_id": 0}).to_list(50)
    return drivers


# ---------------- Seeding ----------------
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
    count = await db.drivers.count_documents({})
    if count == 0:
        for d in SEED_DRIVERS:
            drv = Driver(**d)
            await db.drivers.insert_one(drv.dict())
        logger.info("Seeded %d drivers", len(SEED_DRIVERS))


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
    client.close()
