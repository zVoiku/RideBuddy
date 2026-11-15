/**
 * The city pages (DS03), one per city at /<slug>/: the three cities first, then
 * the nearby areas, as the header's city menu groups them. One list for the
 * header (shared/header.jsx), the build (build.mjs, with the copy in
 * cities.mjs) and the Worker, which sends other spellings of a city's address
 * (/Chandigarh, /new_chandigarh) to its page (worker/index.js).
 */
export const CITIES = [
  { slug: 'chandigarh', name: 'Chandigarh', group: 'Cities' },
  { slug: 'mohali', name: 'Mohali', group: 'Cities' },
  { slug: 'panchkula', name: 'Panchkula', group: 'Cities' },
  { slug: 'zirakpur', name: 'Zirakpur', group: 'Nearby areas' },
  { slug: 'kharar', name: 'Kharar', group: 'Nearby areas' },
  { slug: 'new-chandigarh', name: 'New Chandigarh', group: 'Nearby areas' },
];

/** The menu's groups, in order. */
export const CITY_GROUPS = ['Cities', 'Nearby areas'];

/** A path as a visitor might type a city's address: letters only, lower case. */
const squash = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

/**
 * The city page a path names in some other spelling: any case, with or without
 * the slash, a space, hyphen or underscore anywhere ("/New%20Chandigarh",
 * "/newchandigarh/"). Its slug, or null. The page's own address is not
 * matched here: Cloudflare serves it before the Worker sees it.
 */
export function cityFromPath(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch { return null; }
  const parts = p.split('/').filter(Boolean);
  if (parts.length !== 1 || parts[0].length > 40) return null;
  const want = squash(parts[0]);
  const hit = CITIES.find((c) => squash(c.slug) === want);
  return hit ? hit.slug : null;
}
