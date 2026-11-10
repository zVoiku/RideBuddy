/**
 * Assembles dist/ — the directory Cloudflare serves.
 *
 *   dist/index.html      holding page (from src/)
 *   dist/estimate/       the fare estimator: React page precompiled with esbuild
 *   dist/about/          About and Contact: static pages (src/about, src/contact),
 *   dist/contact/          with the closing band and footer filled in from src/shared
 *   dist/shared/         what those three pages share: site.css, pages.js (the About
 *                        and Contact pages' header, pop-ups and forms), img/
 *   dist/beta/           the design-canvas artboard from ../Webpage
 *   dist/_ds/            the design system (tokens + component bundle), shared
 *   dist/vendor/         React / ReactDOM, shared
 *
 * ../Webpage is the single source of truth for the artboard and is never
 * modified. Several things are fixed up on the way through, all of which
 * matter in production:
 *
 *   1. The artboard is named "RideBuddy Website.dc.html" — a space in a URL.
 *      It becomes beta/index.html so /beta/ resolves.
 *   2. support.js pulls React, ReactDOM and @babel/standalone from unpkg.com at
 *      runtime. A third-party CDN outage would blank the page, so they are
 *      vendored from node_modules and the URLs rewritten to relative paths.
 *   3. The three hero PNGs total ~4.8 MB. They are re-encoded to WebP and the
 *      references rewritten. Most of our traffic is Indian mobile.
 *   4. The artboard's own estimator is superseded by /estimate/. Every CTA that
 *      opened it now navigates there, so there is one estimator, not two.
 *   5. Its About and Contact pages, and its "Apply to be a Buddy" form, are
 *      superseded by /about/ and /contact/ (/contact/#apply): their links lead
 *      there, old /beta/#about, #contact and #apply links are sent on, and
 *      what remains — Home and its "Join the Waitlist" pop-up — saves through
 *      the site's Worker (website/worker).
 *
 * 4 and 5 are text patches, listed in artboard-patches.mjs.
 *
 * The fare rates come from rates.json at the repo root — the file the backend
 * reads — compiled into /estimate/ and into the artboard's rate-config.js, so
 * a rate changes in one place for every platform.
 *
 * Every page — holding page, estimator, About, Contact, artboard — also gets
 * the site's own analytics, src/site.js, served as /site.js.
 *
 * The scripts and stylesheet built here (VERSIONED) are asked for by their
 * content, "/site.js?v=<hash>": pages are checked with Cloudflare on every
 * visit and those files are kept a year (src/_headers), so a page always
 * arrives with the files built with it — never a cached page with a newer
 * script, or the other way round.
 *
 * The Google Maps browser key comes from GOOGLE_MAPS_BROWSER_KEY — a
 * git-ignored website/.env locally, a build variable on Cloudflare.
 */
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build as esbuild, transform } from 'esbuild';
import sharp from 'sharp';
import { ARTBOARD_PATCHES } from './artboard-patches.mjs';

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, 'src');
const CANVAS = path.join(HERE, '..', 'Webpage');
const OUT = path.join(HERE, 'dist');
const BETA = path.join(OUT, 'beta');

// Where Home lives — the artboard, until it moves to the root. The standalone
// pages' logo, header and footer link here (__HOME__).
const HOME = '/beta/';
// The static pages built from src/<name>/index.html, beside the estimator.
const PAGES = ['about', 'contact', 'privacy', 'terms', 'buddy/terms'];
// Source folders that are not copied as they are: each is built below.
const BUILT = ['estimate', 'shared', ...PAGES];

// `exports` maps stop these packages resolving deep subpaths directly, so
// locate each package root via its package.json and join from there.
const pkgFile = (pkg, rel) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), rel);

const REACT = pkgFile('react', 'umd/react.production.min.js');
const REACT_DOM = pkgFile('react-dom', 'umd/react-dom.production.min.js');

/** unpkg URL -> the module file to vendor in its place. */
const VENDOR = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': REACT,
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': REACT_DOM,
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': pkgFile('@babel/standalone', 'babel.min.js'),
};

/**
 * Copied verbatim into beta/. Everything else in ../Webpage is authoring-only;
 * its rate-config.js is rebuilt from rates.json instead (step 4).
 */
const CARRY = ['_ds', 'assets'];

const kb = (n) => `${Math.round(n / 1024)} KB`;

/** Every page loads the site's own analytics (src/site.js, served as /site.js). */
const SITE_SCRIPT = '<script src="/site.js" defer></script>';
function withSiteScript(html, what) {
  if (html.includes(SITE_SCRIPT)) return html;
  const out = html.replace(/<\/head>/i, `${SITE_SCRIPT}\n</head>`);
  if (out === html) throw new Error(`could not add /site.js to ${what}: no </head>`);
  return out;
}

// What the pages load that this build makes, by its path in dist/.
const VERSIONED = ['estimate/app.js', 'shared/pages.js', 'shared/site.css', 'site.js'];

/**
 * Every page in dist/ asks for VERSIONED by content: src="/site.js" becomes
 * src="/site.js?v=<hash of the file>". _headers keeps those files a year, so a
 * page that would still ask for one by its bare name fails the build.
 */
async function versionAssets() {
  const hashes = new Map();
  for (const file of VERSIONED) {
    hashes.set(`/${file}`, createHash('sha256').update(await readFile(path.join(OUT, file))).digest('hex').slice(0, 12));
  }
  for (const page of await htmlFiles(OUT)) {
    const file = path.join(OUT, page);
    const html = await readFile(file, 'utf8');
    const out = html.replace(/(src|href)="([^"?#]+)([^"]*)"/g, (all, attr, url, rest) => {
      if (!hashes.has(url)) return all;
      if (rest) throw new Error(`${page} asks for ${url}${rest}: build.mjs versions ${url} itself (versionAssets)`);
      return `${attr}="${url}?v=${hashes.get(url)}"`;
    });
    const bare = [...hashes.keys()].find((url) => out.includes(`${url}"`) || out.includes(`${url}'`));
    if (bare) throw new Error(`${page} asks for ${bare} where build.mjs can't version it (versionAssets)`);
    if (out !== html) await writeFile(file, out);
  }
}

/** Every .html file under `dir`, as paths relative to it. */
async function htmlFiles(dir, rel = '') {
  const found = [];
  for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
    const name = path.join(rel, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(dir, name)));
    else if (name.endsWith('.html')) found.push(name);
  }
  return found;
}

/**
 * A standalone page's HTML as served: the design system's folder and Home's
 * path filled in, each <!-- partial:name --> replaced by src/shared/name.html
 * (the closing band, the footer), and the analytics added.
 */
async function standalone(html, what, dsDir) {
  return withSiteScript((await fillPartials(html.replaceAll('__DS_DIR__', `/_ds/${dsDir}`))).replaceAll('__HOME__', HOME), what);
}

/** Each <!-- partial:name --> replaced by src/shared/name.html: the head's icons and sharing card, the closing band, the footer. */
async function fillPartials(html) {
  let out = html;
  for (const [marker, name] of [...out.matchAll(/<!-- partial:([a-z-]+) -->/g)]) {
    const part = (await readFile(path.join(SRC, 'shared', `${name}.html`), 'utf8')).trimEnd();
    out = out.replace(marker, () => part);
  }
  return out;
}

/** website/.env — KEY=VALUE lines. The process environment wins. */
async function loadEnv() {
  const file = path.join(HERE, '.env');
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, 'utf8')).split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

function mapsKey() {
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY || '';
  const ci = process.env.WORKERS_CI || process.env.CI;
  if (!key && ci) {
    throw new Error('GOOGLE_MAPS_BROWSER_KEY is not set. Add it under Workers → Settings → Build → Variables; the estimator cannot ship without it.');
  }
  if (!key) console.warn('  ! GOOGLE_MAPS_BROWSER_KEY not set — /estimate/ will build but Maps will not load (fine for the holding page).');
  return key;
}

/**
 * rates.json as the pages see it: the notes (keys starting "_") and the rates
 * only the backend uses — the app's Hourly rate, the commission, promo and GST
 * (rates.json `_app_only`) — are left out of the bundles. The engine never
 * reads them; test/parity.mjs, under Node, still sees the whole file.
 */
const APP_ONLY = ['hourly_rate', 'standard_commission_pct', 'promo_discount_pct', 'gst_rate_pct'];
const websiteRates = {
  name: 'website-rates',
  setup(b) {
    b.onLoad({ filter: /[\\/]rates\.json$/ }, async (args) => {
      const all = JSON.parse(await readFile(args.path, 'utf8'));
      const kept = Object.fromEntries(Object.entries(all).filter(([k]) => !k.startsWith('_') && !APP_ONLY.includes(k)));
      return { contents: JSON.stringify(kept), loader: 'json' };
    });
  },
};

function patchArtboard(html) {
  for (const p of ARTBOARD_PATCHES) {
    if (p.cut) {
      // Everything from the first marker up to (not including) the second goes;
      // each marker must appear exactly once, in that order.
      const [start, end] = p.cut;
      const counts = [start, end].map((m) => html.split(m).length - 1);
      const i = html.indexOf(start), j = html.indexOf(end);
      if (counts.join() !== '1,1' || j < i) throw new Error(`artboard cut "${p.why}": markers found ${counts.join(' and ')} times — the canvas changed; update artboard-patches.mjs`);
      html = html.slice(0, i) + (p.to || '') + html.slice(j);
      continue;
    }
    const want = p.count ?? 1;
    const n = html.split(p.from).length - 1;
    if (n !== want) throw new Error(`artboard patch "${p.why}" matched ${n} times, expected ${want} — the canvas changed; update artboard-patches.mjs`);
    html = html.replaceAll(p.from, () => p.to);
  }
  return html;
}

async function main() {
  await loadEnv();
  const key = mapsKey();

  await rm(OUT, { recursive: true, force: true });
  await mkdir(BETA, { recursive: true });

  // 1. Holding page, _headers, robots.txt, sitemap.xml, site.js.
  const built = BUILT.map((d) => path.join(SRC, d));
  await cp(SRC, OUT, { recursive: true, filter: (s) => !built.some((d) => s === d || s.startsWith(d + path.sep)) });
  const holding = path.join(OUT, 'index.html');
  await writeFile(holding, withSiteScript(await fillPartials(await readFile(holding, 'utf8')), 'the holding page'));
  const site = await transform(await readFile(path.join(SRC, 'site.js'), 'utf8'), { minify: true, target: 'es2019', legalComments: 'none' });
  await writeFile(path.join(OUT, 'site.js'), site.code);

  // 2. Shared React and the design system.
  await mkdir(path.join(OUT, 'vendor'), { recursive: true });
  await cp(REACT, path.join(OUT, 'vendor', path.basename(REACT)));
  await cp(REACT_DOM, path.join(OUT, 'vendor', path.basename(REACT_DOM)));
  await cp(path.join(CANVAS, '_ds'), path.join(OUT, '_ds'), { recursive: true });
  const dsDir = (await readdir(path.join(CANVAS, '_ds'))).find((d) => !d.startsWith('.'));
  if (!dsDir) throw new Error('no design system folder in ../Webpage/_ds');

  // 3. The estimator: HTML shell + esbuild bundle with the key compiled in.
  const jsx = {
    bundle: true, minify: true, format: 'iife', target: ['es2020'],
    jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    define: { __HOME__: JSON.stringify(HOME) },
    legalComments: 'none', logLevel: 'warning', plugins: [websiteRates],
  };
  await mkdir(path.join(OUT, 'estimate'), { recursive: true });
  const shell = await standalone(await readFile(path.join(SRC, 'estimate', 'index.html'), 'utf8'), 'the estimator', dsDir);
  await writeFile(path.join(OUT, 'estimate', 'index.html'), shell);
  await esbuild({
    ...jsx,
    entryPoints: [path.join(SRC, 'estimate', 'app.jsx')],
    outfile: path.join(OUT, 'estimate', 'app.js'),
    define: { ...jsx.define, __GOOGLE_MAPS_BROWSER_KEY__: JSON.stringify(key) },
  });

  // 3b. About and Contact: static pages, and the script for their header,
  //     pop-ups and forms; the stylesheet all three pages share; the About
  //     hero in two sizes (most of our traffic is Indian mobile).
  for (const page of PAGES) {
    await mkdir(path.join(OUT, page), { recursive: true });
    const html = await standalone(await readFile(path.join(SRC, page, 'index.html'), 'utf8'), `the ${page} page`, dsDir);
    if (/__[A-Z_]+__|<!-- partial:/.test(html)) throw new Error(`the ${page} page has a placeholder build.mjs does not fill`);
    await writeFile(path.join(OUT, page, 'index.html'), html);
  }
  const SHARED = path.join(OUT, 'shared');
  await mkdir(path.join(SHARED, 'img'), { recursive: true });
  await esbuild({ ...jsx, entryPoints: [path.join(SRC, 'shared', 'pages.jsx')], outfile: path.join(SHARED, 'pages.js') });
  const css = await transform(await readFile(path.join(SRC, 'shared', 'site.css'), 'utf8'), { loader: 'css', minify: true, legalComments: 'none' });
  await writeFile(path.join(SHARED, 'site.css'), css.code);
  for (const width of [800, 1360]) {
    await sharp(path.join(CANVAS, 'assets', 'family-departure.png')).resize({ width, withoutEnlargement: true })
      .webp({ quality: 80 }).toFile(path.join(SHARED, 'img', `family-departure-${width}.webp`));
  }
  await cp(path.join(CANVAS, 'assets', 'ridebuddy-logomark-parchment.svg'), path.join(SHARED, 'img', 'logomark-parchment.svg'));
  // Every page's icons and sharing card (src/shared/head.html): the logomark as
  // PNGs for browsers that take no SVG icon, and the Home hero cropped to 1200×630.
  const mark = path.join(SRC, 'logomark.svg');
  await sharp(mark, { density: 300 }).resize(32, 32).png().toFile(path.join(SHARED, 'img', 'favicon-32.png'));
  await sharp(mark, { density: 300 }).resize(140, 140).extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#F5F0E8' })
    .flatten({ background: '#F5F0E8' }).png().toFile(path.join(SHARED, 'img', 'apple-touch-icon.png'));
  await sharp(path.join(CANVAS, 'assets', 'hero-mountain-road.png')).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 })
    .toFile(path.join(SHARED, 'img', 'og.jpg'));

  // 4. Carry the artboard's dependencies across, and give it the shared rates
  //    and engine in place of the canvas's own copy.
  for (const entry of CARRY) {
    await cp(path.join(CANVAS, entry), path.join(BETA, entry), { recursive: true });
  }
  await esbuild({
    entryPoints: [path.join(SRC, 'estimate', 'artboard-rates.js')],
    outfile: path.join(BETA, 'rate-config.js'),
    bundle: true, minify: true, format: 'esm', target: ['es2020'],
    legalComments: 'none', logLevel: 'warning', plugins: [websiteRates],
  });

  // 5. Vendor the artboard's runtime deps and repoint support.js at them.
  await mkdir(path.join(BETA, 'vendor'), { recursive: true });
  let support = await readFile(path.join(CANVAS, 'support.js'), 'utf8');
  for (const [url, file] of Object.entries(VENDOR)) {
    const name = path.basename(file);
    await cp(file, path.join(BETA, 'vendor', name));
    if (!support.includes(url)) throw new Error(`support.js no longer references ${url}`);
    support = support.replaceAll(url, `./vendor/${name}`);
  }
  await writeFile(path.join(BETA, 'support.js'), support);

  // 6. PNG -> WebP, and rewrite the references.
  const pngs = (await readdir(path.join(CANVAS, 'assets'))).filter((f) => f.endsWith('.png'));
  const rewrites = new Map();
  for (const png of pngs) {
    const from = path.join(CANVAS, 'assets', png);
    const webp = png.replace(/\.png$/, '.webp');
    const before = (await readFile(from)).length;
    await sharp(from).webp({ quality: 82 }).toFile(path.join(BETA, 'assets', webp));
    await rm(path.join(BETA, 'assets', png), { force: true });
    const after = (await readFile(path.join(BETA, 'assets', webp))).length;
    rewrites.set(`assets/${png}`, `assets/${webp}`);
    console.log(`  ${png}  ${kb(before)} -> ${kb(after)}`);
  }

  // 7. The artboard itself becomes beta/index.html.
  const canvasFile = (await readdir(CANVAS)).find((f) => f.endsWith('.dc.html'));
  if (!canvasFile) throw new Error('no *.dc.html found in ../Webpage');
  let html = await readFile(path.join(CANVAS, canvasFile), 'utf8');
  for (const [from, to] of rewrites) html = html.replaceAll(from, to);
  html = await fillPartials(patchArtboard(html));

  // src/_headers also sends X-Robots-Tag, but Pages and Workers static assets
  // do not honour that file identically. The meta tag works on both, and a
  // browser-compiled "coming soon" artboard must not rank for the brand.
  const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
  if (!html.includes('name="robots"')) {
    html = html.replace(/<head>/i, `<head>\n${NOINDEX}`);
    if (!html.includes(NOINDEX)) throw new Error('could not inject noindex: no <head> in the artboard');
  }
  await writeFile(path.join(BETA, 'index.html'), withSiteScript(html, 'the artboard'));

  // 8. Every page asks for the scripts and stylesheet built with it, by content.
  await versionAssets();

  console.log(`\nBuilt dist/ from ${canvasFile} + src/estimate (Maps key ${key ? 'present' : 'MISSING'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
