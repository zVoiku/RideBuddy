/* global React, ReactDOM */
/**
 * /about/, /contact/, the legal pages and the city pages are static pages
 * (src/about, src/contact, src/cities …). This adds what needs a script: the
 * site header (with a city page's city menu), the "Join the Waitlist" pop-up
 * behind every [data-rb-waitlist] button, the Contact page's waitlist card, the
 * Buddy application behind every [data-rb-apply] link or button — opened
 * straight away by a /contact/#apply link, the one shared to recruit Buddies —
 * and the Buddy bands and footer link in the visitor's language (buddy.mjs).
 */
import { initBuddyLang } from './buddy.mjs';
import { SiteHeader } from './header.jsx';
import { track } from './ui.jsx';
import { ContactWaitlist, WaitlistPopup } from './waitlist.jsx';
import { ApplyPopup } from './apply.jsx';

const { useState, useEffect } = React;

/** The page, as body[data-page] names it: 'about', 'contact', a city's slug — also the `page` of a waitlist signup made on it (forms.js PAGES). */
const PAGE = document.body.getAttribute('data-page') || '';
/** A city page's city (body[data-city]): the header shows the city menu. */
const CITY = document.body.getAttribute('data-city') || null;
const APPLY = '#apply';

function Popups() {
  const [waitlist, setWaitlist] = useState(false);
  const [apply, setApply] = useState(false);

  useEffect(() => {
    const openApply = (via) => {
      setWaitlist(false);
      setApply(true);
      track('buddy_application_opened', via ? { via } : undefined);
    };
    if (window.location.hash === APPLY) openApply('link');
    const onClick = (e) => {
      const el = e.target instanceof Element && e.target.closest('[data-rb-waitlist], [data-rb-apply]');
      if (!el) return;
      e.preventDefault();
      if (el.hasAttribute('data-rb-apply')) { openApply(); return; }
      setApply(false);
      setWaitlist(true);
      track('waitlist_opened', { from: PAGE });
    };
    const onHash = () => { if (window.location.hash === APPLY) openApply('link'); };
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', onHash);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const closeApply = () => {
    // Closing a form opened by a /contact/#apply link leaves a plain URL.
    if (window.location.hash === APPLY) history.replaceState(null, '', window.location.pathname + window.location.search);
    setApply(false);
  };

  return (
    <>
      <WaitlistPopup open={waitlist} page={PAGE} onClose={() => setWaitlist(false)} />
      <ApplyPopup open={apply} onClose={closeApply} />
    </>
  );
}

initBuddyLang();
ReactDOM.createRoot(document.getElementById('rb-header')).render(<SiteHeader current={PAGE} city={CITY} />);
const card = document.getElementById('rb-contact-waitlist');
if (card) ReactDOM.createRoot(card).render(<ContactWaitlist />);
ReactDOM.createRoot(document.body.appendChild(document.createElement('div'))).render(<Popups />);
