/**
 * Assembles dist/ — the directory Cloudflare serves.
 *
 *   dist/index.html      holding page (from src/)
 *   dist/estimate/       the fare estimator: React page precompiled with esbuild
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
 *
 * The Google Maps browser key comes from GOOGLE_MAPS_BROWSER_KEY — a
 * git-ignored website/.env locally, a build variable on Cloudflare.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build as esbuild } from 'esbuild';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, 'src');
const CANVAS = path.join(HERE, '..', 'Webpage');
const OUT = path.join(HERE, 'dist');
const BETA = path.join(OUT, 'beta');

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

/** Copied verbatim into beta/. Everything else in ../Webpage is authoring-only. */
const CARRY = ['_ds', 'assets', 'image-slot.js', 'rate-config.js'];

/**
 * Artboard handlers that opened the in-page estimator, and what they become.
 * Each anchor must match exactly once; a canvas re-export that changes one of
 * them fails the build here rather than silently shipping two estimators.
 */
const ARTBOARD_PATCHES = [
  {
    why: 'nav "Estimate Fare" link',
    from: "    return (e) => {\n      if (e) e.preventDefault();\n      this.setState({ page, menuOpen: false });",
    to: "    return (e) => {\n      if (e) e.preventDefault();\n      if (page === 'estimate') { window.location.href = '/estimate/'; return; }\n      this.setState({ page, menuOpen: false });",
  },
  {
    why: 'hero / nav "Get an Estimate" CTAs',
    from: "    this.setState({ page: 'estimate', menuOpen: false });\n    window.scrollTo({ top: 0, behavior: 'auto' });\n    this.track('estimator_opened');",
    to: "    this.track('estimator_opened');\n    window.location.href = '/estimate/';",
  },
  {
    why: 'Round trips / One-way trips cards',
    from: "    this.setState({ tripType: type, view: 'form' });\n    this.scrollToEstimator();",
    to: "    window.location.href = '/estimate/?type=' + (type === 'round' ? 'round' : 'one');",
  },
  {
    why: '"Book a Buddy" (waitlist lives under the estimate result)',
    from: "    this.setState({ page: 'estimate', menuOpen: false });\n    this.track('book_a_buddy_clicked', { phase: String(this.props.phase ?? '1') });",
    to: "    this.track('book_a_buddy_clicked', { phase: String(this.props.phase ?? '1') });\n    window.location.href = '/estimate/';\n    return;",
  },
];

const kb = (n) => `${Math.round(n / 1024)} KB`;

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

function patchArtboard(html) {
  for (const p of ARTBOARD_PATCHES) {
    const n = html.split(p.from).length - 1;
    if (n !== 1) throw new Error(`artboard patch "${p.why}" matched ${n} times, expected 1 — the canvas changed; update ARTBOARD_PATCHES`);
    html = html.replace(p.from, p.to);
  }
  return html;
}

async function main() {
  await loadEnv();
  const key = mapsKey();

  await rm(OUT, { recursive: true, force: true });
  await mkdir(BETA, { recursive: true });

  // 1. Holding page, _headers, robots.txt.
  await cp(SRC, OUT, { recursive: true, filter: (s) => !s.includes(`${path.sep}estimate`) });

  // 2. Shared React and the design system.
  await mkdir(path.join(OUT, 'vendor'), { recursive: true });
  await cp(REACT, path.join(OUT, 'vendor', path.basename(REACT)));
  await cp(REACT_DOM, path.join(OUT, 'vendor', path.basename(REACT_DOM)));
  await cp(path.join(CANVAS, '_ds'), path.join(OUT, '_ds'), { recursive: true });
  const dsDir = (await readdir(path.join(CANVAS, '_ds'))).find((d) => !d.startsWith('.'));
  if (!dsDir) throw new Error('no design system folder in ../Webpage/_ds');

  // 3. The estimator: HTML shell + esbuild bundle with the key compiled in.
  await mkdir(path.join(OUT, 'estimate'), { recursive: true });
  const shell = (await readFile(path.join(SRC, 'estimate', 'index.html'), 'utf8')).replaceAll('__DS_DIR__', `/_ds/${dsDir}`);
  await writeFile(path.join(OUT, 'estimate', 'index.html'), shell);
  await esbuild({
    entryPoints: [path.join(SRC, 'estimate', 'app.jsx')],
    outfile: path.join(OUT, 'estimate', 'app.js'),
    bundle: true, minify: true, format: 'iife', target: ['es2020'],
    jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
    define: { __GOOGLE_MAPS_BROWSER_KEY__: JSON.stringify(key) },
    legalComments: 'none', logLevel: 'warning',
  });

  // 4. Carry the artboard's dependencies across.
  for (const entry of CARRY) {
    await cp(path.join(CANVAS, entry), path.join(BETA, entry), { recursive: true });
  }

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
  html = patchArtboard(html);

  // src/_headers also sends X-Robots-Tag, but Pages and Workers static assets
  // do not honour that file identically. The meta tag works on both, and a
  // browser-compiled "coming soon" artboard must not rank for the brand.
  const NOINDEX = '<meta name="robots" content="noindex, nofollow">';
  if (!html.includes('name="robots"')) {
    html = html.replace(/<head>/i, `<head>\n${NOINDEX}`);
    if (!html.includes(NOINDEX)) throw new Error('could not inject noindex: no <head> in the artboard');
  }
  await writeFile(path.join(BETA, 'index.html'), html);

  console.log(`\nBuilt dist/ from ${canvasFile} + src/estimate (Maps key ${key ? 'present' : 'MISSING'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
