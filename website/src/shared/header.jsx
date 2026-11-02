/* global React, __HOME__ */
/**
 * The site header of the standalone pages: the /beta artboard's, value for
 * value — logo, the pages, "Get an Estimate", and a full-screen menu below
 * 1120px. Its styles are in shared/site.css.
 */
import { Button } from './ui.jsx';

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
 * `current` is the page shown ('about', 'contact'), underlined as on /beta.
 * "Get an Estimate" goes to /estimate/, unless `onGetEstimate` handles it
 * (the estimator itself brings back its form instead of reloading).
 */
export function SiteHeader({ current = null, onGetEstimate = null }) {
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
    else window.location.href = '/estimate/';
  };
  const link = (l) => (
    <a key={l.id} href={l.href} aria-current={l.id === current ? 'page' : undefined} onClick={() => setOpen(false)}>{l.label}</a>
  );

  return (
    <>
      <div className="rb-header__in">
        <a className="rb-brand" href={HOME} aria-label="RideBuddy home">
          <img src="/logomark.svg" alt="" />
          <span>RideBuddy</span>
        </a>
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
