/**
 * Edits build.mjs makes to the design-canvas artboard (../Webpage) on its way
 * to /beta/. The canvas stays the source of truth and is never edited by hand.
 *
 * Each patch must match the artboard exactly `count` times (default 1), or the
 * build fails: a canvas re-export that changes one of these spots is caught
 * here, loudly, instead of shipping a half-patched page.
 */

// ----- Every "Estimate" CTA leads to /estimate/ ------------------------------------
// The artboard's own estimator is superseded: one estimator, not two.

const ESTIMATE = [
  {
    why: 'nav links: "Estimate Fare" leaves for /estimate/, the other pages get real URLs (/beta/#contact)',
    from: String.raw`    return (e) => {
      if (e) e.preventDefault();
      this.setState({ page, menuOpen: false });`,
    to: String.raw`    return (e) => {
      if (e) e.preventDefault();
      if (page === 'estimate') { window.location.href = '/estimate/'; return; }
      const hash = PAGE_HASH[page] || '';
      if (window.location.hash !== hash) history.pushState(null, '', hash || window.location.pathname + window.location.search);
      this.setState({ page, menuOpen: false });`,
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

// ----- Real URLs: /beta/, /beta/#how-it-works, #about, #contact, #apply ------------

const URLS = [
  {
    why: 'page <-> URL hash mapping',
    from: 'class Component extends DCLogic {',
    to: String.raw`// Real, shareable URLs for the artboard's pages (website/artboard-patches.mjs).
const PAGE_HASH = { home: '', how: '#how-it-works', about: '#about', contact: '#contact' };
const pageFromHash = () => Object.keys(PAGE_HASH).find((p) => PAGE_HASH[p] && PAGE_HASH[p] === window.location.hash) || 'home';

class Component extends DCLogic {`,
  },
  {
    why: 'open on the page the URL names',
    from: "      page: 'home',",
    to: '      page: pageFromHash(),',
  },
  {
    why: '/beta/#apply opens the Buddy application',
    from: '      applyOpen: false,',
    to: "      applyOpen: window.location.hash === '#apply',",
  },
  {
    why: 'closing a form opened by /beta/#apply leaves a plain URL',
    from: '  closeApply = () => this.setState({ applyOpen: false, applyErrors: {} });',
    to: String.raw`  closeApply = () => {
    if (window.location.hash === '#apply') history.replaceState(null, '', window.location.pathname + window.location.search);
    this.setState({ applyOpen: false, applyErrors: {} });
  };`,
  },
  {
    why: 'Back / Forward move between pages',
    from: String.raw`  componentDidMount() {
    import('./rate-config.js').then((m) => this.setState({ cfg: m }));
  }`,
    to: String.raw`  componentDidMount() {
    import('./rate-config.js').then((m) => this.setState({ cfg: m }));
    // Back, Forward and edited URLs move between pages as well.
    window.addEventListener('popstate', () => {
      if (window.location.hash === '#apply') { this.openApply(); return; }
      this.setState({ page: pageFromHash(), menuOpen: false, applyOpen: false });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }`,
  },
  {
    why: 'nav links carry their URL',
    from: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),",
    to: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),\n      href: id === 'estimate' ? '/estimate/' : PAGE_HASH[id] || window.location.pathname,",
  },
  {
    why: 'logo and "See the full journey" carry their URL',
    from: "      goHome: this.nav('home'), goHow: this.nav('how'),",
    to: "      goHome: this.nav('home'), goHow: this.nav('how'),\n      homeHref: window.location.pathname, howHref: PAGE_HASH.how,",
  },
  {
    why: 'Round trips card carries its URL',
    from: "there for every leg.', go: this.presetTrip('round') },",
    to: "there for every leg.', go: this.presetTrip('round'), href: '/estimate/?type=round' },",
  },
  {
    why: 'One-way trips card carries its URL',
    from: "your Buddy brings you back.', go: this.presetTrip('one') },",
    to: "your Buddy brings you back.', go: this.presetTrip('one'), href: '/estimate/?type=one' },",
  },
  {
    why: 'footer links carry their URLs (Terms and Privacy stay as they are)',
    from: String.raw`      footerCols: [
        { title: 'Pages', items: [
          { label: 'Home', go: this.nav('home') }, { label: 'Estimate Fare', go: this.nav('estimate') }, { label: 'How It Works', go: this.nav('how') },
          { label: 'About', go: this.nav('about') }, { label: 'Contact', go: this.nav('contact') },
        ] },
        { title: 'Services', items: [
          { label: 'Round trips', go: this.presetTrip('round') },
          { label: 'One-way trips', go: this.presetTrip('one') },
          { label: phase2 ? 'Get the app' : 'Estimate your trip', go: this.scrollToEstimator },
        ] },
        { title: 'More', items: [
          { label: 'Become a Buddy', go: this.openApply },
          { label: 'Terms', go: (e) => { if (e) e.preventDefault(); } },
          { label: 'Privacy', go: (e) => { if (e) e.preventDefault(); } },
        ] },
      ],`,
    to: String.raw`      footerCols: [
        { title: 'Pages', items: [
          { label: 'Home', go: this.nav('home'), href: window.location.pathname }, { label: 'Estimate Fare', go: this.nav('estimate'), href: '/estimate/' }, { label: 'How It Works', go: this.nav('how'), href: PAGE_HASH.how },
          { label: 'About', go: this.nav('about'), href: PAGE_HASH.about }, { label: 'Contact', go: this.nav('contact'), href: PAGE_HASH.contact },
        ] },
        { title: 'Services', items: [
          { label: 'Round trips', go: this.presetTrip('round'), href: '/estimate/?type=round' },
          { label: 'One-way trips', go: this.presetTrip('one'), href: '/estimate/?type=one' },
          { label: phase2 ? 'Get the app' : 'Estimate your trip', go: this.scrollToEstimator, href: '/estimate/' },
        ] },
        { title: 'More', items: [
          { label: 'Become a Buddy', go: this.openApply, href: '#apply' },
          { label: 'Terms', go: (e) => { if (e) e.preventDefault(); }, href: '#' },
          { label: 'Privacy', go: (e) => { if (e) e.preventDefault(); }, href: '#' },
        ] },
      ],`,
  },
  { why: 'logo link', from: '<a href="#" onClick="{{ goHome }}"', to: '<a href="{{ homeHref }}" onClick="{{ goHome }}"' },
  { why: 'header and mobile-menu links', from: '<a href="#" onClick="{{ l.go }}"', to: '<a href="{{ l.href }}" onClick="{{ l.go }}"', count: 2 },
  { why: '"See the full journey" link', from: '<a href="#" onClick="{{ goHow }}"', to: '<a href="{{ howHref }}" onClick="{{ goHow }}"' },
  { why: '"Estimate this trip" links', from: '<a href="#" onClick="{{ s.go }}"', to: '<a href="{{ s.href }}" onClick="{{ s.go }}"' },
  { why: 'About page "Get an Estimate" link', from: '<a href="#" onClick="{{ goEstimatorFromPage }}"', to: '<a href="/estimate/" onClick="{{ goEstimatorFromPage }}"' },
  { why: 'footer links', from: '<a href="#" onClick="{{ it.go }}"', to: '<a href="{{ it.href }}" onClick="{{ it.go }}"' },
];

// ----- The forms save through the Worker (website/worker) ---------------------------

// A field people never see and bots fill in; the Worker drops what arrives with it.
const honeypot = (id) => `<input type="text" name="website" id="${id}" tabIndex="-1" autoComplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0">`;

const FORMS = [
  {
    why: 'postForm() and honeypot() helpers',
    from: '  track(event, payload) {',
    to: String.raw`  /**
   * Saves a form through the site's Worker. Resolves to { ok: true } or
   * { ok: false, error, errors } and never throws: a failure is shown to the
   * visitor, who can try again — never a success that saved nothing.
   */
  async postForm(path, body) {
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return { ok: true };
      return { ok: false, error: data.error || 'We couldn’t save that just now. Please try again.', errors: data.errors || {} };
    } catch (e) {
      return { ok: false, error: 'We couldn’t reach RideBuddy. Check your connection and try again.', errors: {} };
    }
  }

  honeypot(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  track(event, payload) {`,
  },
  {
    why: 'Buddy application: POST /api/buddy instead of opening the mail app',
    from: String.raw`  /**
   * No backend in the prototype — the application is handed to the user's mail client,
   * pre-addressed with the subject and body the ops team expects.
   */
  submitApply = () => {
    const { applyName, applyPhone, applyLicence } = this.state;
    const errors = {};
    if (applyName.trim().length < 3) errors.name = 'Enter your full name.';
    if (applyPhone.replace(/\D/g, '').length < 10) errors.phone = 'Enter a 10-digit mobile number.';
    if (applyLicence.trim().length < 6) errors.licence = 'Enter your licence number.';
    if (Object.keys(errors).length) { this.setState({ applyErrors: errors }); return; }

    const body = [
      'Name: ' + applyName.trim(),
      'Phone Number: ' + applyPhone.trim(),
      'Driving License Number: ' + applyLicence.trim(),
    ].join('\r\n');
    const href = 'mailto:support@ridebuddy.co.in'
      + '?subject=' + encodeURIComponent('Buddy Application')
      + '&body=' + encodeURIComponent(body);
    window.location.href = href;
    this.setState({ applyErrors: {}, applySent: true });
    this.track('buddy_application_submitted');
  };`,
    to: String.raw`  /**
   * Saved by the site's Worker (POST /api/buddy -> D1), which normalises the
   * phone number and has the final word on every field.
   */
  submitApply = async () => {
    const { applyName, applyPhone, applyLicence, applySending } = this.state;
    if (applySending) return;
    const errors = {};
    if (!applyName.trim()) errors.name = 'Enter your full name.';
    if (!applyPhone.trim()) errors.phone = 'Enter your phone number.';
    if (!applyLicence.trim()) errors.licence = 'Enter your licence number.';
    if (Object.keys(errors).length) { this.setState({ applyErrors: errors }); return; }

    this.setState({ applySending: true, applyErrors: {} });
    const r = await this.postForm('/api/buddy', {
      name: applyName, phone: applyPhone, licence: applyLicence, website: this.honeypot('rb-hp-apply'),
    });
    if (!r.ok) {
      this.setState({ applySending: false, applyErrors: Object.keys(r.errors).length ? r.errors : { form: r.error } });
      return;
    }
    this.setState({ applySending: false, applySent: true });
    this.track('buddy_application_submitted');
  };`,
  },
  {
    why: 'Contact page waitlist: POST /api/waitlist',
    from: String.raw`  submitContact = () => {
    if (!/\d{10}/.test(this.state.contactPhone.replace(/\D/g, ''))) {
      this.setState({ contactError: 'Enter a 10-digit mobile number.' });
      return;
    }
    // TODO(open item #3): POST to the same launch-alert endpoint as the estimator waitlist.
    this.setState({ contactError: '', contactDone: true });
    this.track('waitlist_joined', { source: 'contact' });
  };`,
    to: String.raw`  submitContact = async () => {
    const { contactPhone, contactSending } = this.state;
    if (contactSending) return;
    if (!contactPhone.trim()) { this.setState({ contactError: 'Enter your phone number.' }); return; }
    this.setState({ contactSending: true, contactError: '' });
    const r = await this.postForm('/api/waitlist', { phone: contactPhone, source: 'contact', website: this.honeypot('rb-hp-contact') });
    if (!r.ok) { this.setState({ contactSending: false, contactError: r.errors.phone || r.error }); return; }
    this.setState({ contactSending: false, contactDone: true });
    this.track('waitlist_joined', { source: 'contact' });
  };`,
  },
  {
    why: 'Buddy form state for the template',
    from: "      applyLicenceError: s.applyErrors.licence || '',",
    to: "      applyLicenceError: s.applyErrors.licence || '',\n      applyFormError: s.applyErrors.form || '',\n      applySending: !!s.applySending, applyCta: s.applySending ? 'Sending…' : 'Send Application',",
  },
  {
    why: 'Contact form state for the template',
    from: '      contactDone: s.contactDone, contactPending: !s.contactDone,',
    to: "      contactDone: s.contactDone, contactPending: !s.contactDone,\n      contactSending: !!s.contactSending, contactCta: s.contactSending ? 'Joining…' : 'Join the Waitlist',",
  },
  {
    why: 'Contact form: honeypot, and a button that shows it is working',
    from: '<x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ submitContact }}" hint-size="100%,48px">Join the Waitlist</x-import>',
    to: `${honeypot('rb-hp-contact')}
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ submitContact }}" disabled="{{ contactSending }}" hint-size="100%,48px">{{ contactCta }}</x-import>`,
  },
  {
    why: 'Buddy form: honeypot, working button, and a line for save errors in place of the mail-app note',
    from: `<x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" size="lg" onClick="{{ submitApply }}" hint-size="100%,52px">Send Application</x-import>
            <span style="font-family:var(--font-body),sans-serif;font-size:12px;line-height:1.5;color:var(--color-grey-500)">Opens your email app with the application addressed to support@ridebuddy.co.in.</span>`,
    to: `${honeypot('rb-hp-apply')}
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" size="lg" onClick="{{ submitApply }}" disabled="{{ applySending }}" hint-size="100%,52px">{{ applyCta }}</x-import>
            <sc-if value="{{ applyFormError }}">
              <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.5;color:var(--color-error)">{{ applyFormError }}</span>
            </sc-if>`,
  },
  {
    why: 'Buddy form confirmation',
    from: "Your email app is open with the application ready. Send it and we'll be in touch.",
    to: "Application received. We'll call you to take it forward.",
  },
];

export const ARTBOARD_PATCHES = [...ESTIMATE, ...URLS, ...FORMS];
