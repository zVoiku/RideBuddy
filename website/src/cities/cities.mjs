/**
 * The city pages' copy (DS03): /chandigarh/, /mohali/, /panchkula/, and the
 * nearby areas /zirakpur/, /kharar/, /new-chandigarh/. One layout (city.html,
 * built by build.mjs), and copy, trips, tips and localities of each city's own,
 * word for word from the Phase 1 design (CITY_PAGES), so the pages don't read
 * as copies of one another. "Driver" only where search needs it.
 *
 * What the design measured by hand comes from Google instead: each trip's
 * distance and drive time from the city's pickup point (routes.json, written by
 * test/measure-routes.mjs through the live estimator), and its "From" fare, the
 * estimator's own for a 9 AM pickup with the Buddy's stay included
 * (fare-engine.js). A tip's opening drive time ({time}) and the Amritsar day
 * trip's "Start back by" ({back}) are filled in from the same measurements.
 */
import { estimate, formatINR } from '../estimate/fare-engine.js';
import { CITIES } from './list.mjs';

export { CITIES };

export const CITY_PAGES = {
  'chandigarh': {
    // `pickup`: the words the estimator is opened with, looked up as the visitor's
    // first suggestion (maps.findPlace); the fare note says where, in its own words.
    name: 'Chandigarh', pickup: 'Sector 17, Chandigarh',
    eyebrow: 'Outstation trips from Chandigarh',
    h1: 'A driver for your own car in Chandigarh.',
    sub: 'A verified, trained Buddy drives your car to Shimla, Kasauli, Manali or Delhi. Booking opens soon. See your fare today.',
    intro: 'Skip the cab. Hire a driver for your own car and travel the way you already like to: your seats, your music, your family. Your Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from Chandigarh.',
    routesIntro: 'An outstation driver for every trip from Chandigarh, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from Sector 17. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in Chandigarh. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across Chandigarh.',
    pickupsLine: 'Your Buddy meets you at your door, in any sector of Chandigarh.',
    actingLine: 'Need an acting driver or a personal driver for one trip, not a full-time hire? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'shimla', dest: 'Shimla', type: 'Same-day round trip', line: 'Chandigarh to Shimla and back, in your own car. Home the same evening.' },
      { id: 'kasauli', dest: 'Kasauli', type: 'Same-day round trip', line: 'A day in the pines. Lunch in Kasauli, home by dinner.' },
      { id: 'manali', dest: 'Manali', type: '3-day round trip', line: 'Eight hours of hill road. Your Buddy drives it, you watch it.' },
      { id: 'delhi', dest: 'Delhi', type: 'One-way', line: "One-way to Delhi. Your Buddy's journey home is already in the fare." },
    ],
    tips: [
      { id: 'shimla', body: 'Snow weekends, December to February, bring slow traffic past Solan. Leave by 7 AM. Leaving at 6 AM or later also keeps the night charge off your fare.' },
      { id: 'kasauli', body: 'An easy day trip. The last stretch from Dharampur is narrow and winding, so drive it in daylight.' },
      { id: 'manali', body: '{time} via Bilaspur and Mandi. Leave by 7 AM to arrive in daylight. In the monsoon, July to September, check the Mandi–Kullu road before you go.' },
      { id: 'delhi', body: "{time} on NH-44. Leave after 5:45 AM and arrive before 10:15 PM, and there's no night charge." },
    ],
    localities: ['Manimajra', 'IT Park', 'Industrial Area', 'Dhanas', 'Maloya', 'Mauli Jagran', 'Daria', 'Hallomajra', 'Kishangarh', 'Sarangpur', 'Sector 17', 'Sector 22', 'Sector 35', 'Sector 43'],
    nearby: ['new-chandigarh'],
  },
  'mohali': {
    name: 'Mohali', pickup: 'Phase 7, Mohali',
    eyebrow: 'Outstation trips from Mohali',
    h1: 'A driver for your own car in Mohali.',
    sub: 'A verified, trained Buddy drives your car to Shimla, Amritsar, Dharamshala or Delhi. Booking opens soon. See your fare today.',
    intro: 'Hire a driver for your own car and keep the trip yours: your seats, your music, your stops on the way. From Aerocity to Phase 11, your Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from Mohali.',
    routesIntro: 'An outstation driver for the hills, the Golden Temple or the capital, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from Phase 7. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in Mohali. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across Mohali.',
    pickupsLine: 'Your Buddy meets you at your door, from Aerocity to Phase 11.',
    actingLine: 'Looking for an acting driver or a personal driver in Mohali for a single trip? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'shimla', dest: 'Shimla', type: 'Same-day round trip', line: 'Up through Pinjore and Solan and back, in your own car. Home the same evening.' },
      { id: 'amritsar', dest: 'Amritsar', type: 'Same-day round trip', line: 'Golden Temple darshan in a day. Your Buddy drives both ways.' },
      { id: 'dharamshala', dest: 'Dharamshala', type: '2-day round trip', line: 'Via Ropar and Una to the Dhauladhars. A night up there, home the next day.' },
      { id: 'delhi', dest: 'Delhi', type: 'One-way', line: "One-way to Delhi. Your Buddy's journey home is already in the fare." },
    ],
    tips: [
      { id: 'shimla', body: 'From Mohali, take the Zirakpur–Pinjore road and leave by 7 AM. Snow weekends, December to February, slow traffic past Solan. Leaving at 6 AM or later keeps the night charge off your fare.' },
      { id: 'amritsar', body: 'Leave at 6 AM to reach before the midday crowd at the Golden Temple. Start back by {back} to finish inside the 12 hours in your fare.' },
      { id: 'dharamshala', body: '{time} via Ropar, Una and Kangra. Leave by 7 AM to arrive in daylight. In the monsoon, July to September, check the Kangra valley roads before you go.' },
      { id: 'delhi', body: "{time} on NH-44 via Zirakpur. Leave after 5:45 AM and arrive before 10:15 PM, and there's no night charge." },
    ],
    localities: ['Phase 3B2', 'Phase 5', 'Phase 7', 'Phase 10', 'Phase 11', 'Sector 66', 'Sector 70', 'Sector 71', 'Sector 79', 'Sector 82', 'Aerocity', 'IT City', 'Airport Road', 'Sohana'],
    nearby: ['kharar'],
  },
  'panchkula': {
    name: 'Panchkula', pickup: 'Sector 5, Panchkula',
    eyebrow: 'Outstation trips from Panchkula',
    h1: 'A driver for your own car in Panchkula.',
    sub: 'A verified, trained Buddy drives your car to Shimla, Kasauli, Mussoorie or Delhi. Booking opens soon. See your fare today.',
    intro: 'The hills start at Pinjore, and so does the drive. Hire a driver for your own car and sit back from the first bend: your seats, your music, your family. Your Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from Panchkula.',
    routesIntro: 'An outstation driver for the Shivalik roads and beyond, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from Sector 5. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in Panchkula. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across Panchkula.',
    pickupsLine: 'Your Buddy meets you at your door, from Sector 2 to Mansa Devi Complex and Pinjore.',
    actingLine: 'Need an acting driver or a personal driver in Panchkula for one trip? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'shimla', dest: 'Shimla', type: 'Same-day round trip', line: 'Pinjore, Parwanoo, Solan, Shimla. Back down the same evening, in your own car.' },
      { id: 'kasauli', dest: 'Kasauli', type: 'Same-day round trip', line: 'The closest hill day out. Up by mid-morning, home before dark.' },
      { id: 'mussoorie', dest: 'Mussoorie', type: '2-day round trip', line: 'Via Paonta Sahib and Dehradun. A night on the Mall Road, home the next day.' },
      { id: 'delhi', dest: 'Delhi', type: 'One-way', line: "One-way to Delhi. Your Buddy's journey home is already in the fare." },
    ],
    tips: [
      { id: 'shimla', body: 'From Panchkula you skip the city traffic and join the Kalka highway at Pinjore. Leave by 7 AM. On snow weekends, December to February, expect slow traffic past Solan.' },
      { id: 'kasauli', body: 'Turn off at Dharampur for the last climb. The road is narrow and winding, so plan to drive it in daylight.' },
      { id: 'mussoorie', body: '{time} via Naraingarh, Paonta Sahib and Dehradun. Leave by 8 AM to reach before the evening climb. Weekend traffic builds after Kempty Falls.' },
      { id: 'delhi', body: "{time} via Zirakpur and NH-44. Leave after 5:45 AM and arrive before 10:15 PM, and there's no night charge." },
    ],
    localities: ['Sector 2', 'Sector 4', 'Sector 5', 'Sector 8', 'Sector 9', 'Sector 11', 'Sector 12', 'Sector 15', 'Sector 20', 'Sector 21', 'Sector 25', 'Mansa Devi Complex', 'Industrial Area', 'Pinjore'],
    nearby: ['zirakpur'],
  },
  'zirakpur': {
    name: 'Zirakpur', pickup: 'VIP Road, Zirakpur',
    eyebrow: 'Outstation trips from Zirakpur',
    h1: 'A driver for your own car in Zirakpur.',
    sub: 'A verified, trained Buddy drives your car to Delhi, Shimla, Rishikesh or Manali. Booking opens soon. See your fare today.',
    intro: 'Zirakpur sits where the Delhi, Shimla and Patiala roads meet, so most trips start right outside your gate. Hire a driver for your own car and let your Buddy take the wheel. Every Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from Zirakpur.',
    routesIntro: 'An outstation driver for the highway, the hills and the Ganga, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from VIP Road. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in Zirakpur. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across Zirakpur.',
    pickupsLine: 'Your Buddy meets you at your door, from VIP Road to Dhakoli and Baltana.',
    actingLine: 'Looking for an acting driver or a personal driver in Zirakpur for one long drive? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'delhi', dest: 'Delhi', type: 'One-way', line: "Straight down NH-44 from your door. Your Buddy's journey home is already in the fare." },
      { id: 'shimla', dest: 'Shimla', type: 'Same-day round trip', line: 'Up the Kalka highway and back, in your own car. Home the same evening.' },
      { id: 'rishikesh', dest: 'Rishikesh', type: '2-day round trip', line: 'Evening aarti at the ghats, a night by the river, home the next day.' },
      { id: 'manali', dest: 'Manali', type: '3-day round trip', line: 'The long hill road, three days, one Buddy who knows it.' },
    ],
    tips: [
      { id: 'delhi', body: "{time} on NH-44. Leave after 5:45 AM and arrive before 10:15 PM, and there's no night charge. Weekday mornings past Panipat are the slowest stretch." },
      { id: 'shimla', body: 'Join the Kalka highway at the Zirakpur flyover and leave by 7 AM. On snow weekends, December to February, expect slow traffic past Solan.' },
      { id: 'rishikesh', body: '{time} via Ambala, Yamunanagar and Dehradun. Leave by 8 AM to reach in time for the evening aarti at Triveni Ghat.' },
      { id: 'manali', body: '{time} via Kharar, Kiratpur, Bilaspur and Mandi. Leave by 7 AM to arrive in daylight. In the monsoon, July to September, check the Mandi–Kullu road first.' },
    ],
    localities: ['VIP Road', 'Patiala Road', 'Ambala Highway', 'Dhakoli', 'Baltana', 'Peer Muchalla', 'Bhabat', 'Lohgarh', 'Gazipur', 'Nagla', 'Kishanpura', 'Singhpura'],
    nearby: ['panchkula', 'mohali'],
  },
  'kharar': {
    name: 'Kharar', pickup: 'Sunny Enclave, Kharar',
    eyebrow: 'Outstation trips from Kharar',
    h1: 'A driver for your own car in Kharar.',
    sub: 'A verified, trained Buddy drives your car to Manali, Dalhousie, Amritsar or Shimla. Booking opens soon. See your fare today.',
    intro: 'From Kharar the Manali highway is minutes away and Amritsar is a straight run west. Hire a driver for your own car and keep the trip yours: your seats, your music, your stops. Your Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from Kharar.',
    routesIntro: 'An outstation driver for the Himachal valleys and Punjab, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from Sunny Enclave. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in Kharar. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across Kharar.',
    pickupsLine: 'Your Buddy meets you at your door, from Sunny Enclave to Gillco Valley and Landran Road.',
    actingLine: 'Need an acting driver or a personal driver in Kharar for one trip, not a monthly hire? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'manali', dest: 'Manali', type: '3-day round trip', line: 'Kharar is already on the Manali road. Your Buddy drives the climb, you watch it.' },
      { id: 'dalhousie', dest: 'Dalhousie', type: '3-day round trip', line: 'Pines, old churches and Khajjiar a short drive away. Three days, one Buddy.' },
      { id: 'amritsar', dest: 'Amritsar', type: 'Same-day round trip', line: 'Golden Temple darshan in a day. Your Buddy drives both ways.' },
      { id: 'shimla', dest: 'Shimla', type: 'Same-day round trip', line: 'Shimla and back in your own car. Home the same evening.' },
    ],
    tips: [
      { id: 'manali', body: '{time} via Ropar, Kiratpur, Bilaspur and Mandi. Leave by 7 AM to arrive in daylight. In the monsoon, July to September, check the Mandi–Kullu road first.' },
      { id: 'dalhousie', body: '{time} via Ropar, Una and Pathankot. Leave by 7 AM; the last climb from Banikhet is best driven in daylight. Snow can close the Khajjiar road in January.' },
      { id: 'amritsar', body: 'Leave at 6 AM to reach before the midday crowd at the Golden Temple. Start back by {back} to finish inside the 12 hours in your fare.' },
      { id: 'shimla', body: '{time} via Zirakpur and Pinjore. Leave by 7 AM; leaving at 6 AM or later keeps the night charge off your fare.' },
    ],
    localities: ['Sunny Enclave', 'Gillco Valley', 'Shivalik City', 'Landran Road', 'Desumajra', 'Santemajra', 'Chajju Majra', 'Kharar Main Bazaar', 'Sector 115', 'Sector 125'],
    nearby: ['mohali', 'new-chandigarh'],
  },
  'new-chandigarh': {
    // The design's "Mullanpur, New Chandigarh" finds Mullanpur's cricket stadium first; these words find the town.
    name: 'New Chandigarh', pickup: 'Mullanpur Garibdass',
    eyebrow: 'Outstation trips from New Chandigarh',
    h1: 'A driver for your own car in New Chandigarh.',
    sub: 'A verified, trained Buddy drives your car to Manali, Dharamshala, Kasauli or Delhi. Booking opens soon. See your fare today.',
    intro: 'Mullanpur sits at the foot of the Shivaliks, so the hills are closer than the city. Hire a driver for your own car and start the trip from your door: your seats, your music, your family. Your Buddy is verified, trained and rated after every trip.',
    routesH2: 'Popular trips from New Chandigarh.',
    routesIntro: 'An outstation driver for the hills on your doorstep and the capital beyond, priced before you go. Pick a trip to see your exact fare.',
    fareNote: 'Fares are estimates for a 9 AM pickup from Mullanpur. Your fare depends on your pickup point, dates and time. Estimates are indicative, not a quote.',
    step2: 'Your Buddy arrives at your door in New Chandigarh. Background-checked. Rated by customers.',
    pickupsH2: 'Pickups across New Chandigarh.',
    pickupsLine: 'Your Buddy meets you at your door, from Mullanpur to Eco City and DLF Hyde Park.',
    actingLine: 'Looking for an acting driver or a personal driver in New Chandigarh for one trip? Your Buddy drives your car for the days you travel, and only those.',
    routes: [
      { id: 'manali', dest: 'Manali', type: '3-day round trip', line: 'Out via Kurali and Kiratpur, up through Mandi. Your Buddy drives it, you watch it.' },
      { id: 'dharamshala', dest: 'Dharamshala', type: '2-day round trip', line: 'Via Ropar and Una to the Dhauladhars. A night up there, home the next day.' },
      { id: 'kasauli', dest: 'Kasauli', type: 'Same-day round trip', line: 'A day in the pines. Lunch in Kasauli, home by dinner.' },
      { id: 'delhi', dest: 'Delhi', type: 'One-way', line: "One-way to Delhi. Your Buddy's journey home is already in the fare." },
    ],
    tips: [
      { id: 'manali', body: '{time} via Kurali, Kiratpur, Bilaspur and Mandi, with no city traffic to clear first. Leave by 7 AM to arrive in daylight. In the monsoon, check the Mandi–Kullu road first.' },
      { id: 'dharamshala', body: '{time} via Ropar, Una and Kangra. Leave by 7 AM to arrive in daylight. In the monsoon, July to September, check the Kangra valley roads before you go.' },
      { id: 'kasauli', body: 'Cross over via Baddi road or Pinjore, then climb from Dharampur. The last stretch is narrow and winding, so drive it in daylight.' },
      { id: 'delhi', body: "{time} via Zirakpur and NH-44. Leave after 5:45 AM and arrive before 10:15 PM, and there's no night charge." },
    ],
    localities: ['Mullanpur', 'Omaxe New Chandigarh', 'DLF Hyde Park', 'Eco City 1', 'Eco City 2', 'Siswan Road', 'Kurali Road', 'Baddi Road'],
    nearby: ['mohali', 'kharar'],
  },
};

/** The days each kind of trip covers, as the cards name them. */
export const TRIP_DAYS = { 'Same-day round trip': 1, '2-day round trip': 2, '3-day round trip': 3, 'One-way': 1 };

/** The trip a card prices: round or one way. */
export const tripOf = (route) => (route.type === 'One-way' ? 'one' : 'round');

/** The time of the pickup the "From" fares are for (the fare note says 9 AM). */
export const PICKUP_TIME = '09:00';

/** A distance as the cards show it: to the nearest 5 km. */
export const roundKm = (km) => Math.max(5, Math.round(km / 5) * 5);

/** A drive time to the nearest 15 minutes. */
const nearest15 = (min) => Math.max(15, Math.round(min / 15) * 15);

/** "3 h 15 min", "2 h": a card's drive time ("about …"). */
export function cardTime(min) {
  const m = nearest15(min);
  const h = Math.floor(m / 60), r = m % 60;
  return [h ? `${h} h` : '', r ? `${r} min` : ''].filter(Boolean).join(' ');
}

/** "About 8 hours", "About 4 h 30 min": how a tip opens. */
export function tipTime(min) {
  const m = nearest15(min);
  const h = Math.floor(m / 60), r = m % 60;
  if (!r) return `About ${h} hour${h === 1 ? '' : 's'}`;
  return `About ${cardTime(m)}`;
}

/**
 * A day trip left at 6 AM ends inside the 12 hours in the fare when the drive
 * back starts by 6 PM less the drive (counted up to the next 15 minutes):
 * "1:30 PM" for 4 h 30 min.
 */
export function startBackBy(min) {
  const back = Math.ceil(min / 15) * 15;
  const t = 18 * 60 - back;
  const h = Math.floor(t / 60), m = t % 60;
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * A trip's fare at the estimator: one way, or a round trip of the card's days,
 * from a 9 AM pickup, the Buddy's stay included. `km` and `min` are one way.
 * The date only names a day; the fare doesn't depend on it.
 */
export function fromFare(route, { km, min }) {
  const days = TRIP_DAYS[route.type];
  const est = estimate({
    tripType: 'point_to_point', oneWay: tripOf(route) === 'one', distanceKm: km, durationHours: min / 60,
    days, pickup: { date: '2026-12-01', time: PICKUP_TIME }, customerStay: false, driveThrough: false,
  });
  // The card names the days: a long drive's added day would make it wrong.
  if (est.trip_days !== days) throw new Error(`${route.dest}: priced as ${est.trip_days} days, the card says ${route.type}`);
  return est.total_fare;
}

/** The estimator, opened on a trip: its type, the city's pickup point and the destination. Dates are the visitor's. */
export function estimateLink(slug, route) {
  const q = new URLSearchParams({ type: tripOf(route), from: CITY_PAGES[slug].pickup, to: route.dest, city: slug });
  return `/estimate/?${q}`;
}

/** routes.json's measurements as `measured[slug][route.id]` = { km, min }, one way, exact. */
export function measuredRoutes(json) {
  return Object.fromEntries(Object.entries(json.routes).map(([slug, routes]) => [
    slug, Object.fromEntries(Object.entries(routes).map(([id, r]) => [id, { km: r.metres / 1000, min: r.seconds / 60 }])),
  ]));
}

/**
 * A city's trips as its page shows them, from the measurements in routes.json
 * (measuredRoutes).
 */
export function cityRoutes(slug, measured) {
  const city = CITY_PAGES[slug];
  return city.routes.map((r) => {
    const m = measured?.[slug]?.[r.id];
    if (!m) throw new Error(`routes.json has no ${slug} → ${r.dest}: run test/measure-routes.mjs`);
    const from = formatINR(fromFare(r, m));
    return {
      ...r,
      trip: tripOf(r),
      meta: `${roundKm(m.km)} km · about ${cardTime(m.min)}`,
      from,
      href: estimateLink(slug, r),
      aria: `Get Estimate for ${city.name} to ${r.dest} ${tripOf(r) === 'round' ? 'round trip' : 'one-way trip'}, from ${from}`,
    };
  });
}

/** A city's tips, their drive times filled in. */
export function cityTips(slug, measured) {
  const city = CITY_PAGES[slug];
  return city.tips.map((t) => {
    const route = city.routes.find((r) => r.id === t.id);
    const m = measured[slug][t.id];
    return {
      ...t,
      title: route.dest,
      body: t.body.replace('{time}', tipTime(m.min)).replace('{back}', startBackBy(m.min)),
      href: estimateLink(slug, route),
      aria: `Estimate the ${city.name} to ${route.dest} trip`,
    };
  });
}

/** The page's title and description: what search shows. */
export const cityTitle = (slug) => `Driver for your own car in ${CITY_PAGES[slug].name} · RideBuddy`;
export const cityDescription = (slug) => CITY_PAGES[slug].sub;
