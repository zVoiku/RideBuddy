/**
 * Assembles dist/ — the directory Cloudflare Pages serves.
 *
 *   dist/index.html   holding page (from src/)
 *   dist/beta/        the design-canvas artboard from ../Webpage
 *
 * ../Webpage is the single source of truth and is never modified. Three things
 * are fixed up on the way through, all of which matter in production:
 *
 *   1. The artboard is named "RideBuddy Website.dc.html" — a space in a URL.
 *      It becomes beta/index.html so /beta/ resolves.
 *   2. support.js pulls React, ReactDOM and @babel/standalone from unpkg.com at
 *      runtime. A third-party CDN outage would blank the page, so they are
 *      vendored from node_modules and the URLs rewritten to relative paths.
 *   3. The three hero PNGs total ~4.8 MB. They are re-encoded to WebP and the
 *      references rewritten. Most of our traffic is Indian mobile.
 */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, 'src');
const CANVAS = path.join(HERE, '..', 'Webpage');
const OUT = path.join(HERE, 'dist');
const BETA = path.join(OUT, 'beta');

/** unpkg URL -> the module file to vendor in its place. */
// `exports` maps stop these packages resolving deep subpaths directly, so
// locate each package root via its package.json and join from there.
const pkgFile = (pkg, rel) =>
  path.join(path.dirname(require.resolve(`${pkg}/package.json`)), rel);

const VENDOR = {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js':
    pkgFile('react', 'umd/react.production.min.js'),
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js':
    pkgFile('react-dom', 'umd/react-dom.production.min.js'),
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js':
    pkgFile('@babel/standalone', 'babel.min.js'),
};

/** Copied verbatim into beta/. Everything else in ../Webpage is authoring-only. */
const CARRY = ['_ds', 'assets', 'image-slot.js', 'rate-config.js'];

const kb = (n) => `${Math.round(n / 1024)} KB`;

async function main() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(BETA, { recursive: true });

  // 1. Holding page, _headers, robots.txt.
  await cp(SRC, OUT, { recursive: true });

  // 2. Carry the artboard's dependencies across.
  for (const entry of CARRY) {
    await cp(path.join(CANVAS, entry), path.join(BETA, entry), { recursive: true });
  }

  // 3. Vendor the runtime deps and repoint support.js at them.
  await mkdir(path.join(BETA, 'vendor'), { recursive: true });
  let support = await readFile(path.join(CANVAS, 'support.js'), 'utf8');
  for (const [url, file] of Object.entries(VENDOR)) {
    const name = path.basename(file);
    await cp(file, path.join(BETA, 'vendor', name));
    if (!support.includes(url)) throw new Error(`support.js no longer references ${url}`);
    support = support.replaceAll(url, `./vendor/${name}`);
  }
  await writeFile(path.join(BETA, 'support.js'), support);

  // 4. PNG -> WebP, and rewrite the references.
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

  // 5. The artboard itself becomes beta/index.html.
  const canvasFile = (await readdir(CANVAS)).find((f) => f.endsWith('.dc.html'));
  if (!canvasFile) throw new Error('no *.dc.html found in ../Webpage');
  let html = await readFile(path.join(CANVAS, canvasFile), 'utf8');
  for (const [from, to] of rewrites) html = html.replaceAll(from, to);
  await writeFile(path.join(BETA, 'index.html'), html);

  console.log(`\nBuilt dist/ from ${canvasFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
