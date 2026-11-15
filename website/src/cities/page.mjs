/**
 * A city page's HTML (DS03), as the Phase 1 design lays it out: the hero, the
 * popular trips, how it works, what the fare covers, the Buddy standard, the
 * pickups, tips for the drive, and the bilingual Buddy band; then the closing
 * band and the footer (<!-- partial: --> markers, filled by build.mjs like
 * every page's). Copy from cities.mjs; trips and tips with their measured
 * distances, drive times and fares (cityRoutes, cityTips). The styles are
 * site.css's "City pages" section.
 */
import { bandHtml } from '../shared/buddy.mjs';
import { CITIES, CITY_PAGES, cityDescription, cityTitle } from './cities.mjs';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ARROW = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const TICK = '<span class="rb-covers__tick" aria-hidden="true"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>';
const DOT = '<span class="rb-covers__dot" aria-hidden="true"><span></span></span>';
const icon = (paths) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;

const STEPS = (city) => [
  ['01', 'Estimate your trip.', 'Route, dates, trip type. A specific fare in seconds.'],
  ['02', 'Meet your Buddy.', city.step2],
  ['03', 'Ride in your own car.', 'Your seats. Your music. Your family. Your Buddy handles the road.'],
];

const COVERS = [
  ['In your fare', TICK, [
    "12 hours of your Buddy's time from pickup",
    "Your Buddy's food",
    "Your Buddy's stay on multi-day round trips. Arranging it yourself? It comes off. Many hotels give your Buddy a room at no cost.",
    'A rest stop for your Buddy on trips with more than 12 hours of driving',
    "On one-way trips, your Buddy's journey home",
  ]],
  ['Paid by you on the road', DOT, ["Fuel. It's your car.", 'Tolls and parking, by FASTag or cash']],
  ['Only if it applies', DOT, ['Extra time beyond 12 hours', 'Night charge, for driving between 10 PM and 6 AM. The first 15 minutes are free.']],
];

const PILLARS = [
  [['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'], 'Background-verified.', 'Every Buddy is verified before their first trip.'],
  [['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'], 'Formally trained.', 'Hill roads, night driving, customer care — trained for all of it.'],
  [['m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z'], 'Continuously rated.', 'Every trip is rated. Only trusted Buddies stay on the road.'],
];

/** The hero and trust photos, in two widths each (build.mjs makes them). */
export const CITY_IMAGES = {
  hero: { file: 'hero-mountain-road.png', name: 'city-hero', widths: [640, 1200] },
  trust: { file: 'buddy-solo.png', name: 'buddy-solo', widths: [480, 960] },
};
const srcset = ({ name, widths }) => widths.map((w) => `/shared/img/${name}-${w}.webp ${w}w`).join(', ');
const src = ({ name, widths }) => `/shared/img/${name}-${widths.at(-1)}.webp`;
const HERO_SIZES = '(min-width: 1248px) 568px, (min-width: 932px) calc(50vw - 56px), calc(100vw - 48px)';
const TRUST_SIZES = '(min-width: 760px) 448px, calc(100vw - 48px)';

/** The header's city menu, as the page arrives; SiteHeader (shared/header.jsx) takes it over. */
export function citySelectHtml(slug) {
  const groups = [...new Set(CITIES.map((c) => c.group))];
  const options = groups.map((g) => `<optgroup label="${esc(g)}">${CITIES.filter((c) => c.group === g)
    .map((c) => `<option value="${c.slug}"${c.slug === slug ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
  return `<div class="rb-citypick">
        <svg class="rb-citypick__pin" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5C2F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
        <select aria-label="Choose your city">${options}</select>
        <svg class="rb-citypick__chev" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E1E1A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </div>`;
}

/**
 * The page. `routes` and `tips` are cityRoutes() and cityTips(): the trips
 * with their measured distance, drive time, "From" fare and estimator link.
 */
export function cityPage(slug, { routes, tips }) {
  const city = CITY_PAGES[slug];
  const name = esc(city.name);
  const label = (part) => `${name} — ${part}`;
  const url = `https://ridebuddy.co.in/${slug}/`;
  const nearby = city.nearby.map((s) => `<a href="/${s}/">${esc(CITY_PAGES[s].name)}</a>`).join('\n          ');
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(cityTitle(slug))}</title>
<meta name="description" content="${esc(cityDescription(slug))}">
<meta name="theme-color" content="#F5F0E8">
<link rel="canonical" href="${url}">
<!-- partial:head -->
<meta property="og:title" content="${esc(cityTitle(slug))}">
<meta property="og:description" content="${esc(cityDescription(slug))}">
<meta property="og:url" content="${url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="image" href="${src(CITY_IMAGES.hero)}" imagesrcset="${srcset(CITY_IMAGES.hero)}" imagesizes="${HERO_SIZES}">
<link rel="stylesheet" href="__DS_DIR__/styles.css">
<link rel="stylesheet" href="/shared/site.css">
</head>
<body data-page="${slug}" data-city="${slug}">
<!-- SiteHeader (shared/header.jsx) renders the full header here; the logo and the city menu show while scripts load. -->
<header class="rb-header" id="rb-header">
  <div class="rb-header__in">
    <div class="rb-logo-group rb-has-city">
      <a class="rb-brand" href="__HOME__" aria-label="RideBuddy home">
        <img src="/logomark.svg" alt="">
        <span class="rb-brand__word"><span>RideBuddy</span><span class="rb-beta">beta</span></span>
      </a>
      ${citySelectHtml(slug)}
    </div>
  </div>
</header>
<main>
  <section class="rb-cityhero" data-screen-label="${label('Hero')}">
    <div class="rb-wrap">
      <nav class="rb-crumbs" aria-label="Breadcrumb">
        <ol>
          <li><a href="__HOME__">Home</a></li>
          <li aria-hidden="true">›</li>
          <li aria-current="page">${name}</li>
        </ol>
      </nav>
      <div class="rb-cityhero__grid">
        <div class="rb-cityhero__text">
          <span class="rb-cityeyebrow">${esc(city.eyebrow)}</span>
          <h1>${esc(city.h1)}</h1>
          <p class="rb-cityhero__sub">${esc(city.sub)}</p>
          <div class="rb-cityhero__ctas">
            <a class="rb-btn rb-btn--primary rb-btn--lg rb-btn--auto" href="/estimate/?city=${slug}">Get an Estimate</a>
            <button type="button" class="rb-btn rb-btn--outline rb-btn--lg rb-btn--auto" data-rb-waitlist>Join the Waitlist</button>
          </div>
          <p class="rb-cityhero__intro">${esc(city.intro)}</p>
        </div>
        <div class="rb-cityhero__photo">
          <img src="${src(CITY_IMAGES.hero)}" srcset="${srcset(CITY_IMAGES.hero)}" sizes="${HERO_SIZES}" width="1200" height="750"
            alt="A Buddy beside a white SUV on a mountain road in Himachal" fetchpriority="high">
        </div>
      </div>
    </div>
  </section>

  <section class="rb-citysec rb-citysec--white" data-screen-label="${label('Routes')}">
    <div class="rb-wrap">
      <h2 class="rb-cityh2">${esc(city.routesH2)}</h2>
      <p class="rb-citylede">${esc(city.routesIntro)}</p>
      <div class="rb-routes">
${routes.map((r) => `        <a class="rb-route" href="${esc(r.href)}" aria-label="${esc(r.aria)}" data-rb-label="Get Estimate: ${esc(r.dest)}">
          <span class="rb-route__top"><span class="rb-route__name">${esc(r.dest)}</span><span class="rb-route__type">${esc(r.type)}</span></span>
          <span class="rb-route__meta">${esc(r.meta)}</span>
          <span class="rb-route__from">From ${esc(r.from)}</span>
          <span class="rb-route__line">${esc(r.line)}</span>
          <span class="rb-route__go">Get Estimate${ARROW}</span>
        </a>`).join('\n')}
      </div>
      <p class="rb-farenote">${esc(city.fareNote)} <a href="/terms/">See Terms</a>.</p>
    </div>
  </section>

  <section class="rb-citysec" data-screen-label="${label('How it works')}">
    <div class="rb-wrap">
      <div class="rb-cityeyebrow">How it works</div>
      <h2 class="rb-cityh2 rb-cityh2--after">Your car. Your Buddy. That's it.</h2>
      <ol class="rb-steps">
${STEPS(city).map(([n, title, body]) => `        <li><span class="rb-steps__n">${n}</span><h3>${esc(title)}</h3><p>${esc(body)}</p></li>`).join('\n')}
      </ol>
    </div>
  </section>

  <section class="rb-citysec rb-citysec--green" data-screen-label="${label('Fare covers')}">
    <div class="rb-wrap">
      <h2 class="rb-cityh2">What your fare covers.</h2>
      <div class="rb-covers">
${COVERS.map(([title, mark, items]) => `        <div class="rb-covers__col">
          <h3>${esc(title)}</h3>
          <ul>
${items.map((t) => `            <li>${mark}<span>${esc(t)}</span></li>`).join('\n')}
          </ul>
        </div>`).join('\n')}
      </div>
      <p class="rb-covers__final">Final fare is calculated when your trip ends.</p>
    </div>
  </section>

  <section class="rb-citysec" data-screen-label="${label('Trust')}">
    <div class="rb-wrap rb-trust">
      <div class="rb-trust__photo">
        <img src="${src(CITY_IMAGES.trust)}" srcset="${srcset(CITY_IMAGES.trust)}" sizes="${TRUST_SIZES}" width="960" height="1200"
          alt="A Buddy beside a customer's car in the driveway" loading="lazy">
      </div>
      <div>
        <h2 class="rb-cityh2">Verified. Trained. Rated.</h2>
        <div class="rb-pillars">
${PILLARS.map(([paths, title, body]) => `          <div class="rb-pillar"><div class="rb-pillar__icon">${icon(paths)}</div><div><h3>${esc(title)}</h3><p>${esc(body)}</p></div></div>`).join('\n')}
        </div>
        <a class="rb-trust__more" href="/about/">About RideBuddy${ARROW}</a>
      </div>
    </div>
  </section>

  <section class="rb-citysec rb-citysec--white" data-screen-label="${label('Pickups')}">
    <div class="rb-wrap">
      <h2 class="rb-cityh2">${esc(city.pickupsH2)}</h2>
      <p class="rb-citylede">${esc(city.pickupsLine)}</p>
      <ul class="rb-localities">
${city.localities.map((l) => `        <li>${esc(l)}</li>`).join('\n')}
      </ul>
      <p class="rb-acting">${esc(city.actingLine)}</p>${nearby ? `
      <p class="rb-nearby">Also picking up nearby:
          ${nearby}
      </p>` : ''}
    </div>
  </section>

  <section class="rb-citysec" data-screen-label="${label('Plan the drive')}">
    <div class="rb-wrap">
      <h2 class="rb-cityh2">Plan the drive.</h2>
      <div class="rb-tips">
${tips.map((t) => `        <a class="rb-tip" href="${esc(t.href)}" aria-label="${esc(t.aria)}" data-rb-label="Estimate this trip: ${esc(t.title)}">
          <h3>${esc(t.title)}</h3>
          <p>${esc(t.body)}</p>
          <span class="rb-tip__go">Estimate this trip${ARROW}</span>
        </a>`).join('\n')}
      </div>
    </div>
  </section>

  ${bandHtml('city', label('Become a Buddy')).replace(/\n/g, '\n  ')}
</main>
<!-- partial:closer -->
<!-- partial:footer -->
<script src="/vendor/react.production.min.js"></script>
<script src="/vendor/react-dom.production.min.js"></script>
<script src="__DS_DIR__/_ds_bundle.js"></script>
<script src="/shared/pages.js"></script>
</body>
</html>
`;
}
