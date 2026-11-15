/* global React, __HOME__ */
/**
 * The site header of the standalone pages: the /beta artboard's, value for
 * value — logo with its beta tag, the pages, "Get an Estimate", and a
 * full-screen menu below 1120px — plus, on a city page, the city menu beside
 * the logo. Its styles are in shared/site.css.
 */
import { CITIES, CITY_GROUPS } from '../cities/list.mjs';
import { Button, track } from './ui.jsx';

const { useState, useEffect } = React;

// Where Home lives: HOME in build.mjs, compiled in.
const HOME = __HOME__;

// "Get an Estimate" is the estimator's link, so there is no "Estimate Fare" item.
const LINKS = [
  { id: 'home', label: 'Home', href: HOME },
  { id: 'about', label: 'About', href: '/about/' },
  { id: 'contact', label: 'Contact', href: '/contact/' },
];

/**
 * A city page's menu of the other cities (src/cities/list.mjs): choosing one
 * goes to its page (city_switched).
 */
function CityPick({ city }) {
  const go = (e) => {
    const to = e.target.value;
    if (to === city) return;
    track('city_switched', { from: city, to });
    window.location.href = (window.rbCarry || String)(`/${to}/`);
  };
  return (
    <div className="rb-citypick">
      <svg className="rb-citypick__pin" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4A5C2F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></svg>
      <select aria-label="Choose your city" value={city} onChange={go}>
        {CITY_GROUPS.map((g) => (
          <optgroup key={g} label={g}>
            {CITIES.filter((c) => c.group === g).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </optgroup>
        ))}
      </select>
      <svg className="rb-citypick__chev" aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1E1E1A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

/**
 * `current` is the page shown ('about', 'contact'), underlined as on /beta;
 * `city`, a city page's slug, adds the city menu. "Get an Estimate" goes to
 * /estimate/, unless `onGetEstimate` handles it (the estimator itself brings
 * back its form instead of reloading).
 */
export function SiteHeader({ current = null, city = null, onGetEstimate = null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const toEstimate = () => {
    setOpen(false);
    if (onGetEstimate) onGetEstimate();
    // With any campaign parameters the page arrived with (src/site.js rbCarry).
    else window.location.href = (window.rbCarry || String)('/estimate/');
  };
  const link = (l) => (
    <a key={l.id} href={l.href} aria-current={l.id === current ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</a>
  );

  return (
    <>
      <div className="rb-header__in">
        <div className={'rb-logo-group' + (city ? ' rb-has-city' : '')}>
          <a className="rb-brand" href={HOME} aria-label="RideBuddy home">
            <img src="/logomark.svg" alt="" />
            <span className="rb-brand__word"><span>RideBuddy</span><span className="rb-beta">beta</span></span>
          </a>
          {city && <CityPick city={city} />}
        </div>
        <nav className="rb-nav" aria-label="Main">
          {LINKS.map(link)}
          <div className="rb-nav__cta">
            <Button fullWidth={false} size="sm" onClick={toEstimate}><span style={{ whiteSpace: 'nowrap' }}>Get an Estimate</span></Button>
          </div>
        </nav>
        <button type="button" className="rb-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      {open && (
        <div className="rb-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="rb-menu__top">
            <button type="button" className="rb-menu__close" aria-label="Close" onClick={() => setOpen(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="rb-menu__links">
            {LINKS.map(link)}
            <div className="rb-menu__cta"><Button onClick={toEstimate}>Get an Estimate</Button></div>
          </div>
        </div>
      )}
    </>
  );
}
