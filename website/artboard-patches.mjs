/**
 * Edits build.mjs makes to the design-canvas artboard (../Webpage) on its way
 * to /beta/. The canvas stays the source of truth and is never edited by hand.
 *
 * Each patch must match the artboard exactly `count` times (default 1), or the
 * build fails: a canvas re-export that changes one of these spots is caught
 * here, loudly, instead of shipping a half-patched page. A `cut` patch removes
 * everything between two markers, each of which must appear exactly once.
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

// ----- Real URLs: /beta/, /beta/#about, #contact, #apply ----------------------------

const URLS = [
  {
    why: 'page <-> URL hash mapping',
    from: 'class Component extends DCLogic {',
    to: String.raw`// Real, shareable URLs for the artboard's pages (website/artboard-patches.mjs).
const PAGE_HASH = { home: '', about: '#about', contact: '#contact' };
const pageFromHash = () => Object.keys(PAGE_HASH).find((p) => PAGE_HASH[p] && PAGE_HASH[p] === window.location.hash) || 'home';
// The How It Works page is gone: an old link to it opens Home, at a plain URL.
if (window.location.hash === '#how-it-works') history.replaceState(null, '', window.location.pathname + window.location.search);

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
      if (window.location.hash === '#apply') { this.setState({ wlOpen: false }); this.openApply(); return; }
      this.setState({ page: pageFromHash(), menuOpen: false, applyOpen: false, wlOpen: false });
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    // Escape closes either pop-up.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.state.applyOpen) this.closeApply();
      if (this.state.wlOpen) this.closeWaitlist();
    });
    // Opened straight from a shared /beta/#apply link: counts as opening the form.
    if (this.state.applyOpen) this.track('buddy_application_opened', { via: 'link' });
    // The code steps count down to "Resend OTP".
    setInterval(() => {
      const s = this.state;
      if (s.wlStep === 'code' || s.contactStep === 'code' || s.applyStep === 'code') this.setState({ otpNow: Date.now() });
    }, 1000);
  }`,
  },
  {
    why: 'nav links carry their URL',
    from: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),",
    to: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),\n      href: id === 'estimate' ? '/estimate/' : PAGE_HASH[id] || window.location.pathname,",
  },
  {
    why: 'the logo carries its URL',
    from: "      goHome: this.nav('home'), goHow: this.nav('how'),",
    to: "      goHome: this.nav('home'), goHow: this.nav('how'),\n      homeHref: window.location.pathname,",
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
    why: 'footer links carry their URLs (Terms and Privacy stay as they are); no How It Works',
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
          { label: 'Home', go: this.nav('home'), href: window.location.pathname }, { label: 'Estimate Fare', go: this.nav('estimate'), href: '/estimate/' },
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
  { why: '"Estimate this trip" links', from: '<a href="#" onClick="{{ s.go }}"', to: '<a href="{{ s.href }}" onClick="{{ s.go }}"' },
  { why: 'About page "Get an Estimate" link', from: '<a href="#" onClick="{{ goEstimatorFromPage }}"', to: '<a href="/estimate/" onClick="{{ goEstimatorFromPage }}"' },
  { why: 'footer links', from: '<a href="#" onClick="{{ it.go }}"', to: '<a href="{{ it.href }}" onClick="{{ it.go }}"' },
];

// ----- Booking isn't open yet ------------------------------------------------------

const BOOKING = [
  {
    why: 'home hero "Book a Buddy · Coming soon" becomes "Join the Waitlist", which opens the waitlist pop-up (WAITLIST)',
    from: `<button type="button" onClick="{{ bookBuddy }}" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;white-space:nowrap;min-height:52px;padding:0 20px 0 26px;cursor:pointer;background:transparent;border:1.5px solid rgba(245,240,232,.72);border-radius:var(--radius-lg);font-family:var(--font-body),DM Sans,sans-serif;font-size:16px;font-weight:500;color:var(--color-parchment)" style-hover="background:rgba(245,240,232,.14);border-color:var(--color-parchment)" style-active="transform:scale(0.98)" style-focus="box-shadow:0 0 0 3px rgba(245,240,232,.28);outline:none">
                Book a Buddy
                <span style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:var(--radius-sm);background:rgba(245,240,232,.16);font-family:var(--font-body),DM Sans,sans-serif;font-size:11px;font-weight:500;letter-spacing:0.02em;color:rgba(245,240,232,.92)">Coming soon</span>
              </button>`,
    to: `<button type="button" onClick="{{ openWaitlist }}" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;white-space:nowrap;min-height:52px;padding:0 26px;cursor:pointer;background:transparent;border:1.5px solid rgba(245,240,232,.72);border-radius:var(--radius-lg);font-family:var(--font-body),DM Sans,sans-serif;font-size:16px;font-weight:500;color:var(--color-parchment)" style-hover="background:rgba(245,240,232,.14);border-color:var(--color-parchment)" style-active="transform:scale(0.98)" style-focus="box-shadow:0 0 0 3px rgba(245,240,232,.28);outline:none">Join the Waitlist</button>`,
  },
  {
    why: 'header and phone menu: no "Estimate Fare" ("Get an Estimate" is the same page), no How It Works',
    from: "navLinks: [link('home', 'Home'), link('estimate', 'Estimate Fare'), link('how', 'How It Works'), ",
    to: "navLinks: [link('home', 'Home'), ",
  },
];

// ----- The forms save through the Worker (website/worker) ---------------------------

// A field people never see and bots fill in; the Worker drops what arrives with it.
const honeypot = (id) => `<input type="text" name="website" id="${id}" tabIndex="-1" autoComplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0">`;

/**
 * A phone form's code step (website/worker/otp.js), as in the Phase 1 design:
 * where the code went and "Change number", the 6-digit code, Verify Number,
 * and "Resend OTP" after a countdown. `p` is the form's state prefix (wl,
 * contact, apply), whose values codeValues() provides; `id` the code field's.
 * One field rather than six boxes, so a pasted or auto-filled code lands whole.
 */
const codeStep = (p, id) => `<div style="display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:4px 12px">
                <span style="font-family:var(--font-body),sans-serif;font-size:14px;line-height:1.5;color:var(--color-charcoal)">{{ ${p}SentTo }}</span>
                <button type="button" onClick="{{ ${p}ChangeNumber }}" style="border:none;background:transparent;padding:10px 0;cursor:pointer;font-family:var(--font-body),sans-serif;font-size:14px;font-weight:500;color:var(--color-green-500)" style-hover="color:var(--color-green-700)">Change number</button>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <label for="${id}" style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">6-digit code</label>
                <input id="${id}" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" aria-invalid="{{ ${p}CodeInvalid }}" value="{{ ${p}Code }}" onChange="{{ ${p}OnCode }}" placeholder="••••••" style="width:100%;box-sizing:border-box;min-height:52px;border-radius:var(--radius-lg);border:1.5px solid {{ ${p}CodeBorder }};background:var(--color-parchment);padding:0 16px;outline:none;font-family:var(--font-body),DM Sans,sans-serif;font-size:22px;font-weight:600;letter-spacing:0.4em;text-align:center;color:var(--color-charcoal)" style-focus="border-color:var(--color-green-500);box-shadow:0 0 0 3px rgba(74,92,47,.18)">
                <sc-if value="{{ ${p}CodeError }}">
                  <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828">{{ ${p}CodeError }}</span>
                </sc-if>
              </div>
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ ${p}Verify }}" disabled="{{ ${p}CantVerify }}" hint-size="100%,48px">{{ ${p}VerifyCta }}</x-import>
              <div style="display:flex;justify-content:center;align-items:center;min-height:40px">
                <sc-if value="{{ ${p}CanResend }}">
                  <button type="button" onClick="{{ ${p}Resend }}" style="border:none;background:transparent;padding:10px 12px;cursor:pointer;font-family:var(--font-body),sans-serif;font-size:14px;font-weight:500;color:var(--color-green-500)" style-hover="color:var(--color-green-700)">Resend OTP</button>
                </sc-if>
                <sc-if value="{{ ${p}ResendWait }}">
                  <span style="font-family:var(--font-body),sans-serif;font-size:14px;color:var(--color-grey-500)">{{ ${p}ResendLabel }}</span>
                </sc-if>
              </div>
            </div>`;

const FORMS = [
  {
    why: 'postForm() and honeypot() helpers',
    from: '  track(event, payload) {',
    to: String.raw`  /**
   * Saves a form through the site's Worker. Resolves to { ok: true }; to
   * { ok: false, otp: 'sent', sentTo, resendIn } when the Worker has sent a
   * one-time code to the number and wants it back (website/worker/otp.js); or
   * to { ok: false, error, errors, reason }. Never throws: a failure is shown
   * to the visitor, who can try again — never a success that saved nothing.
   */
  async postForm(path, body) {
    try {
      const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) return { ok: true };
      if (res.status === 202 && data.otp === 'sent') return { ok: false, otp: 'sent', sentTo: data.sentTo, resendIn: data.resendIn || 30, errors: {} };
      return { ok: false, error: data.error || 'We couldn’t save that just now. Please try again.', errors: data.errors || {}, reason: data.reason || '' };
    } catch (e) {
      return { ok: false, error: 'We couldn’t reach RideBuddy. Check your connection and try again.', errors: {} };
    }
  }

  honeypot(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  /** A one-time code went out: the form (state prefix p: wl, contact, apply) moves to its code step. */
  codeSent(p, r, form, fieldId) {
    this.setState({ [p + 'Step']: 'code', [p + 'Code']: '', [p + 'CodeError']: '', [p + 'SentTo']: r.sentTo, [p + 'ResendAt']: Date.now() + r.resendIn * 1000, otpNow: Date.now() });
    this.track('otp_sent', { form });
    // Into the code field as soon as it is on the page.
    const focus = (tries) => {
      const el = document.getElementById(fieldId);
      if (el) el.focus();
      else if (tries > 0) setTimeout(() => focus(tries - 1), 50);
    };
    setTimeout(() => focus(20), 0);
  }

  /** The template values of a form's code step (codeStep() in artboard-patches.mjs). */
  codeValues(p, verify, resend) {
    const s = this.state;
    const left = Math.max(0, Math.ceil(((s[p + 'ResendAt'] || 0) - (s.otpNow || 0)) / 1000));
    const error = s[p + 'CodeError'] || '';
    return {
      [p + 'SentTo']: 'Code sent to ' + (s[p + 'SentTo'] || '') + '.',
      [p + 'Code']: s[p + 'Code'] || '',
      [p + 'OnCode']: (e) => this.setState({ [p + 'Code']: String(e.target.value).replace(/\D/g, '').slice(0, 6), [p + 'CodeError']: '' }),
      [p + 'CodeError']: error,
      [p + 'CodeBorder']: error ? '#C62828' : 'rgba(100,100,100,.18)',
      [p + 'CodeInvalid']: error ? 'true' : 'false',
      [p + 'CantVerify']: !!s[p + 'Sending'] || (s[p + 'Code'] || '').length !== 6,
      [p + 'VerifyCta']: s[p + 'Sending'] ? 'Checking…' : 'Verify Number',
      [p + 'Verify']: verify,
      [p + 'CanResend']: left === 0 && !s[p + 'Sending'],
      [p + 'ResendWait']: left > 0,
      [p + 'ResendLabel']: 'Resend OTP in 0:' + String(left).padStart(2, '0'),
      [p + 'Resend']: resend,
      [p + 'ChangeNumber']: () => this.setState({ [p + 'Step']: 'form', [p + 'Code']: '', [p + 'CodeError']: '' }),
    };
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
   * Saved by the site's Worker (POST /api/buddy -> D1): an individual Buddy or a
   * driver agency. The Worker normalises the number and has the final word on
   * every field. With one-time codes on, its first answer is a code sent to the
   * number, and the form asks for it before the application saves.
   */
  submitApply = async () => {
    const s = this.state;
    if (s.applySending) return;
    const agency = s.applyType === 'agency';
    const errors = {};
    if (agency && !s.applyAgency.trim()) errors.agency = 'Enter the agency name.';
    if (!s.applyName.trim()) errors.name = agency ? 'Enter the contact person’s name.' : 'Enter your full name.';
    if (!/^[6-9]\d{9}$/.test(s.applyPhone)) errors.phone = 'Enter a 10-digit mobile number.';
    if (!agency && !s.applyLicence.trim()) errors.licence = 'Enter your licence number.';
    if (!s.applyCity.trim()) errors.city = 'Enter your city or base.';
    if (Object.keys(errors).length) {
      // A number typed but short is a mistyped number; anything else, a form sent incomplete.
      this.track(errors.phone && s.applyPhone ? 'phone_invalid' : 'form_invalid', { form: agency ? 'agency' : 'buddy' });
      this.setState({ applyErrors: errors });
      return;
    }
    this.sendApply('');
  };

  verifyApply = () => this.sendApply(this.state.applyCode);
  resendApply = () => this.sendApply('');

  sendApply = async (code) => {
    const s = this.state;
    if (s.applySending) return;
    const agency = s.applyType === 'agency';
    const form = agency ? 'agency' : 'buddy';
    const atCode = s.applyStep === 'code';
    this.setState({ applySending: true, applyErrors: {}, applyCodeError: '' });
    const fields = agency
      ? { type: 'agency', agency: s.applyAgency, contact: s.applyName, phone: s.applyPhone, city: s.applyCity, drivers: s.applyFleet || null, email: s.applyEmail, gstin: s.applyGstin }
      : { type: 'individual', name: s.applyName, phone: s.applyPhone, licence: s.applyLicence, city: s.applyCity };
    const r = await this.postForm('/api/buddy', Object.assign(fields, { website: this.honeypot('rb-hp-apply') }, code ? { code } : {}));
    this.setState({ applySending: false });
    if (r.otp === 'sent') { this.codeSent('apply', r, form, 'apply-code'); return; }
    if (!r.ok) {
      // For the site's analytics: a code that didn't go through, a mistyped number, another field, or a save that failed.
      if (r.reason) this.track('otp_failed', { form, kind: r.reason });
      else this.track(r.errors.phone ? 'phone_invalid' : Object.keys(r.errors).length ? 'form_invalid' : 'save_failed', { form });
      if (atCode) { this.setState({ applyCodeError: r.errors.code || r.error }); return; }
      // The Worker calls the agency's contact person "contact"; the form shows it in the name field.
      const errs = Object.keys(r.errors).length ? Object.assign({}, r.errors, { name: r.errors.name || r.errors.contact }) : { form: r.error };
      this.setState({ applyErrors: errs });
      return;
    }
    if (code) this.track('otp_verified', { form });
    this.setState({ applySent: true, applyStep: 'form', applyCode: '' });
    this.track('buddy_application_submitted', { type: agency ? 'agency' : 'individual' });
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
    const { contactPhone, contactConsent, contactSending } = this.state;
    if (contactSending) return;
    const errs = {};
    if (!/^[6-9]\d{9}$/.test(contactPhone)) errs.contactError = 'Enter a 10-digit mobile number.';
    if (!contactConsent) errs.contactConsentError = 'Tick the box to join the waitlist.';
    if (Object.keys(errs).length) {
      if (errs.contactError) this.track('phone_invalid', { form: 'contact' });
      this.setState(Object.assign({ contactError: '', contactConsentError: '' }, errs));
      return;
    }
    this.sendContact('');
  };

  verifyContact = () => this.sendContact(this.state.contactCode);
  resendContact = () => this.sendContact('');

  // Saved by the Worker (POST /api/waitlist); with one-time codes on, after the code.
  sendContact = async (code) => {
    const s = this.state;
    if (s.contactSending) return;
    const atCode = s.contactStep === 'code';
    this.setState({ contactSending: true, contactError: '', contactConsentError: '', contactCodeError: '' });
    const r = await this.postForm('/api/waitlist', Object.assign({ phone: s.contactPhone, consent: true, source: 'contact', website: this.honeypot('rb-hp-contact') }, code ? { code } : {}));
    this.setState({ contactSending: false });
    if (r.otp === 'sent') { this.codeSent('contact', r, 'contact', 'rb-contact-code'); return; }
    if (!r.ok) {
      if (r.reason) this.track('otp_failed', { form: 'contact', kind: r.reason });
      else this.track(r.errors.phone ? 'phone_invalid' : 'save_failed', { form: 'contact' });
      if (atCode) { this.setState({ contactCodeError: r.errors.code || r.error }); return; }
      this.setState({ contactError: r.errors.phone || (r.errors.consent ? '' : r.error), contactConsentError: r.errors.consent || '' });
      return;
    }
    if (code) this.track('otp_verified', { form: 'contact' });
    this.setState({ contactDone: true, contactStep: 'form', contactCode: '' });
    this.track('waitlist_joined', { source: 'contact' });
  };`,
  },
  {
    why: 'Buddy form state for the template',
    from: "      applyLicenceError: s.applyErrors.licence || '',",
    to: String.raw`      applyLicenceError: s.applyErrors.licence || '',
      applyFormError: s.applyErrors.form || '',
      applySending: !!s.applySending, applyCta: s.applySending ? 'Sending…' : 'Send Application',
      // The new design's form: an individual Buddy or a driver agency.
      applyIsIndividual: s.applyType !== 'agency', applyIsAgency: s.applyType === 'agency',
      applyCardIndividual: s.applyType !== 'agency' ? { border: 'var(--color-green-500)', bg: 'var(--color-green-50)' } : { border: 'rgba(100,100,100,.22)', bg: 'var(--color-white)' },
      applyCardAgency: s.applyType === 'agency' ? { border: 'var(--color-green-500)', bg: 'var(--color-green-50)' } : { border: 'rgba(100,100,100,.22)', bg: 'var(--color-white)' },
      setApplyIndividual: () => this.setState({ applyType: 'individual', applyErrors: {} }),
      setApplyAgency: () => this.setState({ applyType: 'agency', applyErrors: {} }),
      applyTitle: s.applyType === 'agency' ? 'Apply as a driver agency.' : 'Apply to be a Buddy.',
      applySub: s.applyType === 'agency' ? 'A few details to start. RideBuddy will call to take it from there.' : 'Four details to start. RideBuddy will take it from there.',
      applySentText: 'Application received. We’ll contact you when onboarding opens.',
      applyCityLabel: s.applyType === 'agency' ? 'City or base' : 'Your city or base',
      applyCity: s.applyCity, applyAgency: s.applyAgency, applyEmail: s.applyEmail, applyGstin: s.applyGstin,
      applyCityError: s.applyErrors.city || '', applyAgencyError: s.applyErrors.agency || '',
      applyEmailError: s.applyErrors.email || '', applyGstinError: s.applyErrors.gstin || '',
      onApplyCity: (e) => this.setState({ applyCity: e.target.value, applyErrors: Object.assign({}, s.applyErrors, { city: '' }) }),
      onApplyAgency: (e) => this.setState({ applyAgency: e.target.value, applyErrors: Object.assign({}, s.applyErrors, { agency: '' }) }),
      onApplyEmail: (e) => this.setState({ applyEmail: e.target.value, applyErrors: Object.assign({}, s.applyErrors, { email: '' }) }),
      onApplyGstin: (e) => this.setState({ applyGstin: e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15), applyErrors: Object.assign({}, s.applyErrors, { gstin: '' }) }),
      applyFleetChips: ['1–5', '6–20', '21–50', '50+'].map((label) => ({ label, selected: s.applyFleet === label, pick: () => this.setState({ applyFleet: this.state.applyFleet === label ? '' : label }) })),
      applyPhoneBorder: s.applyErrors.phone ? '#C62828' : 'rgba(100,100,100,.18)',
      applyPhoneInvalid: s.applyErrors.phone ? 'true' : 'false',
      applyHasPhoneError: !!s.applyErrors.phone,`,
  },
  {
    why: 'Contact form state for the template',
    from: '      contactDone: s.contactDone, contactPending: !s.contactDone,',
    to: String.raw`      contactDone: s.contactDone, contactPending: !s.contactDone && s.contactStep !== 'code', contactAtCode: !s.contactDone && s.contactStep === 'code',
      contactSending: !!s.contactSending, contactCta: s.contactSending ? 'Joining…' : 'Join the Waitlist',
      contactConsent: !!s.contactConsent, contactConsentError: s.contactConsentError || '',
      onContactConsent: (e) => this.setState({ contactConsent: e.target.checked, contactConsentError: '' }),
      contactPhoneBorder: s.contactError ? '#C62828' : 'rgba(100,100,100,.18)', contactPhoneInvalid: s.contactError ? 'true' : 'false',`,
  },
  {
    why: 'Contact form: honeypot, and a button that shows it is working',
    from: '<x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ submitContact }}" hint-size="100%,48px">Join the Waitlist</x-import>',
    to: `${honeypot('rb-hp-contact')}
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ submitContact }}" disabled="{{ contactSending }}" hint-size="100%,48px">{{ contactCta }}</x-import>`,
  },
  {
    why: 'Buddy pop-up: the new design\'s form, individual Buddy or driver agency, without the consent tick; then the one-time code step',
    from: String.raw`  <sc-if value="{{ applyOpen }}">
    <div style="position:fixed;inset:0;z-index:70;background:rgba(30,30,26,.5);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto">
      <div style="width:100%;max-width:460px;background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);padding:32px;animation:rb-fade-up 300ms cubic-bezier(.25,.46,.45,.94)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <h2 style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:800;font-size:24px;letter-spacing:-0.015em;margin:0;color:var(--color-charcoal)">Apply to be a Buddy.</h2>
            <p style="font-family:var(--font-body),sans-serif;font-size:14px;line-height:1.55;color:var(--color-grey-500);margin:0">Three details to start. We'll take it from there.</p>
          </div>
          <button type="button" onClick="{{ closeApply }}" aria-label="Close" style="flex:0 0 auto;width:40px;height:40px;border:none;background:transparent;cursor:pointer;color:var(--color-grey-500)" style-hover="color:var(--color-charcoal)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        <sc-if value="{{ applySent }}">
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
            <div style="display:flex;gap:10px;align-items:flex-start;background:var(--badge-confirmed-bg);border-radius:var(--radius-lg);padding:16px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:2px"><path d="m20 6-11 11-5-5"></path></svg>
              <span style="font-family:var(--font-body),sans-serif;font-size:15px;line-height:1.5;font-weight:500;color:#1B5E20">Your email app is open with the application ready. Send it and we'll be in touch.</span>
            </div>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ closeApply }}" hint-size="100%,48px">Done</x-import>
          </div>
        </sc-if>
        <sc-if value="{{ applyForm }}" hint-placeholder-val="{{ true }}">
          <div style="display:flex;flex-direction:column;gap:18px;margin-top:24px">
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Full name" placeholder="As printed on your licence" value="{{ applyName }}" onChange="{{ onApplyName }}" error="{{ applyNameError }}" hint-size="100%,72px"></x-import>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Phone number" type="tel" placeholder="+91 ●●●●● ●●●●●" value="{{ applyPhone }}" onChange="{{ onApplyPhone }}" error="{{ applyPhoneError }}" hint-size="100%,72px"></x-import>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Driving licence number" placeholder="PB01 20110012345" value="{{ applyLicence }}" onChange="{{ onApplyLicence }}" error="{{ applyLicenceError }}" hint-size="100%,72px"></x-import>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" size="lg" onClick="{{ submitApply }}" hint-size="100%,52px">Send Application</x-import>
            <span style="font-family:var(--font-body),sans-serif;font-size:12px;line-height:1.5;color:var(--color-grey-500)">Opens your email app with the application addressed to support@ridebuddy.co.in.</span>
          </div>
        </sc-if>
      </div>
    </div>
  </sc-if>`,
    to: `  <sc-if value="{{ applyOpen }}">
    <div style="position:fixed;inset:0;z-index:70;background:rgba(30,30,26,.5);display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto">
      <div role="dialog" aria-modal="true" aria-label="{{ applyTitle }}" style="width:100%;max-width:460px;margin:auto 0;background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);padding:32px;animation:rb-fade-up 300ms cubic-bezier(.25,.46,.45,.94)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <h2 style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:800;font-size:24px;letter-spacing:-0.015em;margin:0;color:var(--color-charcoal)">{{ applyTitle }}</h2>
            <p style="font-family:var(--font-body),sans-serif;font-size:14px;line-height:1.55;color:var(--color-grey-500);margin:0">{{ applySub }}</p>
          </div>
          <button type="button" onClick="{{ closeApply }}" aria-label="Close" style="flex:0 0 auto;width:40px;height:40px;border:none;background:transparent;cursor:pointer;color:var(--color-grey-500)" style-hover="color:var(--color-charcoal)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        <sc-if value="{{ applySent }}">
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
            <div style="display:flex;gap:10px;align-items:flex-start;background:var(--badge-confirmed-bg);border-radius:var(--radius-lg);padding:16px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:2px"><path d="m20 6-11 11-5-5"></path></svg>
              <span style="font-family:var(--font-body),sans-serif;font-size:15px;line-height:1.5;font-weight:500;color:#1B5E20">{{ applySentText }}</span>
            </div>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ closeApply }}" hint-size="100%,48px">Done</x-import>
          </div>
        </sc-if>
        <sc-if value="{{ applyForm }}" hint-placeholder-val="{{ true }}">
          <div style="display:flex;flex-direction:column;gap:18px;margin-top:24px">
            <div role="radiogroup" aria-label="Applying as" style="display:flex;flex-direction:column;gap:8px">
              <span style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">Applying as</span>
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
              <button type="button" role="radio" aria-checked="{{ applyIsIndividual }}" onClick="{{ setApplyIndividual }}" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:72px;padding:14px 16px;cursor:pointer;text-align:left;border-radius:var(--radius-lg);border:1.5px solid {{ applyCardIndividual.border }};background:{{ applyCardIndividual.bg }};transition:background 150ms,border-color 150ms" style-hover="border-color:var(--color-green-500)" style-focus="box-shadow:0 0 0 3px rgba(74,92,47,.18);outline:none">
                <span style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:700;font-size:16px;color:var(--color-charcoal)">Individual Buddy</span>
                <span style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.4;color:var(--color-grey-700, #5F5E58)">I drive myself.</span>
              </button>
              <button type="button" role="radio" aria-checked="{{ applyIsAgency }}" onClick="{{ setApplyAgency }}" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-height:72px;padding:14px 16px;cursor:pointer;text-align:left;border-radius:var(--radius-lg);border:1.5px solid {{ applyCardAgency.border }};background:{{ applyCardAgency.bg }};transition:background 150ms,border-color 150ms" style-hover="border-color:var(--color-green-500)" style-focus="box-shadow:0 0 0 3px rgba(74,92,47,.18);outline:none">
                <span style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:700;font-size:16px;color:var(--color-charcoal)">Driver agency</span>
                <span style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.4;color:var(--color-grey-700, #5F5E58)">I supply verified drivers.</span>
              </button>
              </div>
            </div>
            <sc-if value="{{ applyIsIndividual }}" hint-placeholder-val="{{ true }}">
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Full name" placeholder="As printed on your licence" value="{{ applyName }}" onChange="{{ onApplyName }}" error="{{ applyNameError }}" hint-size="100%,72px"></x-import>
            </sc-if>
            <sc-if value="{{ applyIsAgency }}">
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Agency name" placeholder="As registered" value="{{ applyAgency }}" onChange="{{ onApplyAgency }}" error="{{ applyAgencyError }}" hint-size="100%,72px"></x-import>
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Contact person" placeholder="Full name" value="{{ applyName }}" onChange="{{ onApplyName }}" error="{{ applyNameError }}" hint-size="100%,72px"></x-import>
            </sc-if>
            <div style="display:flex;flex-direction:column;gap:6px">
              <label for="apply-phone" style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">Mobile number</label>
              <div style="display:flex;align-items:stretch;min-height:48px;border-radius:var(--radius-lg);border:1.5px solid {{ applyPhoneBorder }};background:var(--color-parchment);overflow:hidden">
                <span aria-hidden="true" style="display:flex;align-items:center;padding:0 12px 0 14px;border-right:1px solid rgba(100,100,100,.14);font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;font-weight:500;color:var(--color-charcoal)">+91</span>
                <input id="apply-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength="10" aria-invalid="{{ applyPhoneInvalid }}" value="{{ applyPhone }}" onChange="{{ onApplyPhone }}" placeholder="10-digit mobile" style="flex:1;min-width:0;border:none;outline:none;background:transparent;padding:0 14px;font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;letter-spacing:0.02em;color:var(--color-charcoal)">
              </div>
              <sc-if value="{{ applyHasPhoneError }}">
                <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828">{{ applyPhoneError }}</span>
              </sc-if>
            </div>
            <sc-if value="{{ applyIsIndividual }}" hint-placeholder-val="{{ true }}">
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Driving licence number" placeholder="PB01 20110012345" value="{{ applyLicence }}" onChange="{{ onApplyLicence }}" error="{{ applyLicenceError }}" hint-size="100%,72px"></x-import>
            </sc-if>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="{{ applyCityLabel }}" placeholder="Mohali" autoComplete="address-level2" value="{{ applyCity }}" onChange="{{ onApplyCity }}" error="{{ applyCityError }}" hint-size="100%,72px"></x-import>
            <sc-if value="{{ applyIsAgency }}">
              <div role="radiogroup" aria-label="Drivers you can supply" style="display:flex;flex-direction:column;gap:8px">
                <span style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">Drivers you can supply (optional)</span>
                <div style="display:flex;flex-wrap:wrap;gap:8px">
                  <sc-for list="{{ applyFleetChips }}" as="c" hint-placeholder-count="4">
                    <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Chip" selected="{{ c.selected }}" onClick="{{ c.pick }}" hint-size="64px,34px">{{ c.label }}</x-import>
                  </sc-for>
                </div>
              </div>
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Work email (optional)" type="email" placeholder="name@agency.in" autoComplete="email" value="{{ applyEmail }}" onChange="{{ onApplyEmail }}" error="{{ applyEmailError }}" hint-size="100%,72px"></x-import>
              <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="GSTIN (optional)" placeholder="03ABCDE1234F1Z5" maxLength="15" value="{{ applyGstin }}" onChange="{{ onApplyGstin }}" error="{{ applyGstinError }}" hint-size="100%,72px"></x-import>
            </sc-if>
            ${honeypot('rb-hp-apply')}
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" size="lg" onClick="{{ submitApply }}" disabled="{{ applySending }}" hint-size="100%,52px">{{ applyCta }}</x-import>
            <sc-if value="{{ applyFormError }}">
              <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.5;color:var(--color-error)">{{ applyFormError }}</span>
            </sc-if>
          </div>
        </sc-if>
        <sc-if value="{{ applyAtCode }}">
          <div style="margin-top:24px">
            ${codeStep('apply', 'apply-code')}
          </div>
        </sc-if>
      </div>
    </div>
  </sc-if>`,
  },
  {
    why: 'Contact page waitlist: mobile number with a fixed +91, and the consent tick',
    from: '<x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Input" label="Phone or WhatsApp number" icon="{{ chatIcon }}" type="tel" placeholder="+91 ●●●●● ●●●●●" value="{{ contactPhone }}" onChange="{{ onContactPhone }}" error="{{ contactError }}" hint-size="100%,72px"></x-import>',
    to: `<div style="display:flex;flex-direction:column;gap:6px">
                <label for="rb-contact-phone" style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">Mobile number</label>
                <div style="display:flex;align-items:stretch;min-height:48px;border-radius:var(--radius-lg);border:1.5px solid {{ contactPhoneBorder }};background:var(--color-parchment);overflow:hidden">
                  <span aria-hidden="true" style="display:flex;align-items:center;padding:0 12px 0 14px;border-right:1px solid rgba(100,100,100,.14);font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;font-weight:500;color:var(--color-charcoal)">+91</span>
                  <input id="rb-contact-phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-invalid="{{ contactPhoneInvalid }}" value="{{ contactPhone }}" onChange="{{ onContactPhone }}" placeholder="10-digit mobile" style="flex:1;min-width:0;border:none;outline:none;background:transparent;padding:0 14px;font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;letter-spacing:0.02em;color:var(--color-charcoal)">
                </div>
                <sc-if value="{{ contactError }}">
                  <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828">{{ contactError }}</span>
                </sc-if>
              </div>
              <div style="display:flex;flex-direction:column">
                <label style="display:flex;gap:12px;align-items:flex-start;min-height:44px;cursor:pointer">
                <input id="rb-contact-consent" type="checkbox" checked="{{ contactConsent }}" onChange="{{ onContactConsent }}" style="flex:0 0 auto;width:20px;height:20px;margin:1px 0 0;accent-color:#4A5C2F;cursor:pointer">
                <span style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.55;color:var(--color-charcoal)">Send me an SMS or WhatsApp when booking opens. I agree to the Privacy Policy and Terms of Use.</span>
                </label>
                <sc-if value="{{ contactConsentError }}">
                  <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828;margin-top:-12px">{{ contactConsentError }}</span>
                </sc-if>
              </div>`,
  },
  {
    why: 'phone fields keep digits only, at most ten (a pasted +91 number keeps its last ten)',
    from: "      onContactPhone: (e) => this.setState({ contactPhone: e.target.value, contactError: '' }),",
    to: "      onContactPhone: (e) => this.setState({ contactPhone: tenDigits(e.target.value), contactError: '' }),",
  },
  {
    why: 'Buddy form phone: digits only, at most ten',
    from: "      onApplyPhone: (e) => this.setState({ applyPhone: e.target.value, applyErrors: Object.assign({}, s.applyErrors, { phone: '' }) }),",
    to: "      onApplyPhone: (e) => this.setState({ applyPhone: tenDigits(e.target.value), applyErrors: Object.assign({}, s.applyErrors, { phone: '' }) }),",
  },
  {
    why: 'state for the new form fields, the Contact consent tick and the waitlist pop-up',
    from: '      applyErrors: {},\n    };',
    to: String.raw`      applyErrors: {},
      applyType: 'individual', applyCity: '', applyAgency: '', applyEmail: '', applyGstin: '', applyFleet: '',
      contactConsent: false, contactConsentError: '',
      wlOpen: false, wlPhone: '', wlConsent: false, wlErrors: {}, wlSending: false, wlDone: false,
      // One-time code steps: 'form' or 'code', the code typed, where it went, when a new one may be asked for.
      wlStep: 'form', wlCode: '', wlCodeError: '', wlSentTo: '', wlResendAt: 0,
      contactStep: 'form', contactCode: '', contactCodeError: '', contactSentTo: '', contactResendAt: 0,
      applyStep: 'form', applyCode: '', applyCodeError: '', applySentTo: '', applyResendAt: 0,
      otpNow: 0,
    };`,
  },
  {
    why: 'Buddy pop-up: the form, or its one-time code step',
    from: '      applyForm: !s.applySent,',
    to: "      applyForm: !s.applySent && s.applyStep !== 'code', applyAtCode: !s.applySent && s.applyStep === 'code',",
  },
  {
    why: 'Contact page waitlist: its one-time code step, after the number',
    from: '              <span style="font-family:var(--font-body),sans-serif;font-size:12px;color:var(--color-grey-500)">One message when the app is live. Nothing else.</span>\n            </div>\n          </sc-if>\n',
    to: `              <span style="font-family:var(--font-body),sans-serif;font-size:12px;color:var(--color-grey-500)">One message when the app is live. Nothing else.</span>
            </div>
          </sc-if>
          <sc-if value="{{ contactAtCode }}">
            <div style="display:flex;flex-direction:column;gap:16px">
              <h2 style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:800;font-size:24px;letter-spacing:-0.015em;margin:0;color:var(--color-charcoal)">Join the waitlist.</h2>
              ${codeStep('contact', 'rb-contact-code')}
            </div>
          </sc-if>
`,
  },
];

// ----- "Join the Waitlist": hero, closing band, and the pop-up they open -------------

/** Where a pop-up signup was made: the page the visitor was on (forms.js SOURCES). */
const WAITLIST_SOURCE = "{ home: 'home', about: 'about', contact: 'contact' }[this.state.page] || 'home'";

const WAITLIST = [
  {
    why: 'phone fields: digits only, at most ten; a pasted +91 or 0 number keeps its last ten',
    from: 'class Component extends DCLogic {',
    to: String.raw`const tenDigits = (v) => { const d = String(v).replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };

class Component extends DCLogic {`,
  },
  {
    why: 'waitlist pop-up: open, close, and save through POST /api/waitlist (after a one-time code, when they are on)',
    from: '  openApply = (e) => {',
    to: String.raw`  openWaitlist = (e) => {
    if (e) e.preventDefault();
    this.setState({ wlOpen: true, wlErrors: {}, menuOpen: false, applyOpen: false });
    this.track('waitlist_opened', { from: ${WAITLIST_SOURCE} });
  };

  closeWaitlist = () => this.setState({ wlOpen: false, wlErrors: {} });

  submitWaitlist = async () => {
    const { wlPhone, wlConsent, wlSending } = this.state;
    if (wlSending) return;
    const errors = {};
    if (!/^[6-9]\d{9}$/.test(wlPhone)) errors.phone = 'Enter a 10-digit mobile number.';
    if (!wlConsent) errors.consent = 'Tick the box to join the waitlist.';
    if (Object.keys(errors).length) {
      if (errors.phone) this.track('phone_invalid', { form: 'waitlist' });
      this.setState({ wlErrors: errors });
      return;
    }
    this.sendWaitlist('');
  };

  verifyWaitlist = () => this.sendWaitlist(this.state.wlCode);
  resendWaitlist = () => this.sendWaitlist('');

  sendWaitlist = async (code) => {
    const s = this.state;
    if (s.wlSending) return;
    const source = ${WAITLIST_SOURCE};
    const atCode = s.wlStep === 'code';
    this.setState({ wlSending: true, wlErrors: {}, wlCodeError: '' });
    const r = await this.postForm('/api/waitlist', Object.assign({ phone: s.wlPhone, consent: true, source, website: this.honeypot('rb-hp-waitlist') }, code ? { code } : {}));
    this.setState({ wlSending: false });
    if (r.otp === 'sent') { this.codeSent('wl', r, 'waitlist', 'rb-wl-code'); return; }
    if (!r.ok) {
      if (r.reason) this.track('otp_failed', { form: 'waitlist', kind: r.reason });
      else this.track(r.errors.phone ? 'phone_invalid' : 'save_failed', { form: 'waitlist' });
      if (atCode) { this.setState({ wlCodeError: r.errors.code || r.error }); return; }
      this.setState({ wlErrors: Object.keys(r.errors).length ? r.errors : { form: r.error } });
      return;
    }
    if (code) this.track('otp_verified', { form: 'waitlist' });
    this.setState({ wlDone: true, wlStep: 'form', wlCode: '' });
    this.track('waitlist_joined', { source });
  };

  openApply = (e) => {`,
  },
  {
    why: 'waitlist pop-up: template values',
    from: '      bookBuddy: this.bookBuddy,',
    to: String.raw`      bookBuddy: this.bookBuddy,
      openWaitlist: this.openWaitlist, closeWaitlist: this.closeWaitlist, submitWaitlist: this.submitWaitlist,
      wlOpen: s.wlOpen, wlDone: s.wlDone, wlPending: !s.wlDone && s.wlStep !== 'code', wlAtCode: !s.wlDone && s.wlStep === 'code',
      // The one-time code steps of the three phone forms (codeStep()).
      ...this.codeValues('wl', this.verifyWaitlist, this.resendWaitlist),
      ...this.codeValues('contact', this.verifyContact, this.resendContact),
      ...this.codeValues('apply', this.verifyApply, this.resendApply),
      wlPhone: s.wlPhone, onWlPhone: (e) => this.setState({ wlPhone: tenDigits(e.target.value), wlErrors: Object.assign({}, s.wlErrors, { phone: '' }) }),
      wlPhoneError: s.wlErrors.phone || '', wlPhoneBorder: s.wlErrors.phone ? '#C62828' : 'rgba(100,100,100,.18)', wlPhoneInvalid: s.wlErrors.phone ? 'true' : 'false',
      wlConsent: s.wlConsent, onWlConsent: (e) => this.setState({ wlConsent: e.target.checked, wlErrors: Object.assign({}, s.wlErrors, { consent: '' }) }),
      wlConsentError: s.wlErrors.consent || '', wlFormError: s.wlErrors.form || '',
      wlSending: !!s.wlSending, wlCta: s.wlSending ? 'Joining…' : 'Join the Waitlist',`,
  },
  {
    why: 'waitlist pop-up: the template, before the closing band',
    from: '  <!-- ══════════════════ FINAL CTA ══════════════════ -->',
    to: `  <!-- Join the Waitlist pop-up: hero and closing band (website/artboard-patches.mjs) -->
  <sc-if value="{{ wlOpen }}">
    <div style="position:fixed;inset:0;z-index:70;background:rgba(30,30,26,.5);display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto">
      <div role="dialog" aria-modal="true" aria-labelledby="rb-wl-title" style="width:100%;max-width:460px;margin:auto 0;background:var(--color-white);border-radius:var(--radius-lg);box-shadow:var(--shadow-xl);padding:32px;animation:rb-fade-up 300ms cubic-bezier(.25,.46,.45,.94)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div style="display:flex;flex-direction:column;gap:6px">
            <h2 id="rb-wl-title" style="font-family:var(--font-display),Urbanist,sans-serif;font-weight:800;font-size:24px;letter-spacing:-0.015em;margin:0;color:var(--color-charcoal)">Join the waitlist</h2>
            <p style="font-family:var(--font-body),sans-serif;font-size:14px;line-height:1.55;color:var(--color-grey-500);margin:0">Get one message when booking opens.</p>
          </div>
          <button type="button" onClick="{{ closeWaitlist }}" aria-label="Close" style="flex:0 0 auto;width:40px;height:40px;border:none;background:transparent;cursor:pointer;color:var(--color-grey-500)" style-hover="color:var(--color-charcoal)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
        </div>
        <sc-if value="{{ wlDone }}">
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
            <div style="display:flex;gap:10px;align-items:flex-start;background:var(--badge-confirmed-bg);border-radius:var(--radius-lg);padding:16px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex:0 0 auto;margin-top:2px"><path d="m20 6-11 11-5-5"></path></svg>
              <span style="font-family:var(--font-body),sans-serif;font-size:15px;line-height:1.5;font-weight:500;color:#1B5E20">You're on the waitlist. We'll message you once.</span>
            </div>
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ closeWaitlist }}" hint-size="100%,48px">Done</x-import>
          </div>
        </sc-if>
        <sc-if value="{{ wlPending }}" hint-placeholder-val="{{ true }}">
          <div style="display:flex;flex-direction:column;gap:16px;margin-top:24px">
              <div style="display:flex;flex-direction:column;gap:6px">
                <label for="rb-wl-phone" style="font-family:var(--font-body),sans-serif;font-size:13px;font-weight:500;color:#888">Mobile number</label>
                <div style="display:flex;align-items:stretch;min-height:48px;border-radius:var(--radius-lg);border:1.5px solid {{ wlPhoneBorder }};background:var(--color-parchment);overflow:hidden">
                  <span aria-hidden="true" style="display:flex;align-items:center;padding:0 12px 0 14px;border-right:1px solid rgba(100,100,100,.14);font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;font-weight:500;color:var(--color-charcoal)">+91</span>
                  <input id="rb-wl-phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-invalid="{{ wlPhoneInvalid }}" value="{{ wlPhone }}" onChange="{{ onWlPhone }}" placeholder="10-digit mobile" style="flex:1;min-width:0;border:none;outline:none;background:transparent;padding:0 14px;font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;letter-spacing:0.02em;color:var(--color-charcoal)">
                </div>
                <sc-if value="{{ wlPhoneError }}">
                  <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828">{{ wlPhoneError }}</span>
                </sc-if>
              </div>
              <div style="display:flex;flex-direction:column">
                <label style="display:flex;gap:12px;align-items:flex-start;min-height:44px;cursor:pointer">
                <input id="rb-wl-consent" type="checkbox" checked="{{ wlConsent }}" onChange="{{ onWlConsent }}" style="flex:0 0 auto;width:20px;height:20px;margin:1px 0 0;accent-color:#4A5C2F;cursor:pointer">
                <span style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.55;color:var(--color-charcoal)">Send me an SMS or WhatsApp when booking opens. I agree to the Privacy Policy and Terms of Use.</span>
                </label>
                <sc-if value="{{ wlConsentError }}">
                  <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;color:#C62828;margin-top:-12px">{{ wlConsentError }}</span>
                </sc-if>
              </div>
            ${honeypot('rb-hp-waitlist')}
            <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" onClick="{{ submitWaitlist }}" disabled="{{ wlSending }}" hint-size="100%,48px">{{ wlCta }}</x-import>
            <sc-if value="{{ wlFormError }}">
              <span role="alert" style="font-family:var(--font-body),sans-serif;font-size:13px;line-height:1.5;color:var(--color-error)">{{ wlFormError }}</span>
            </sc-if>
          </div>
        </sc-if>
        <sc-if value="{{ wlAtCode }}">
          <div style="margin-top:24px">
            ${codeStep('wl', 'rb-wl-code')}
          </div>
        </sc-if>
      </div>
    </div>
  </sc-if>

  <!-- ══════════════════ FINAL CTA ══════════════════ -->`,
  },
  {
    why: 'closing band on every page: "Get an Estimate" and "Join the Waitlist"',
    from: `      <sc-if value="{{ isPhase1 }}" hint-placeholder-val="{{ true }}">
        <div style="width:auto;margin-top:12px">
          <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" full-width="{{ false }}" size="lg" onClick="{{ goEstimatorFromPage }}" hint-size="190px,52px">Get an Estimate</x-import>
        </div>
      </sc-if>`,
    to: `      <sc-if value="{{ isPhase1 }}" hint-placeholder-val="{{ true }}">
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:12px">
          <x-import component-from-global-scope="RideBuddyDesignSystem_f63581.Button" full-width="{{ false }}" size="lg" onClick="{{ goEstimatorFromPage }}" hint-size="190px,52px">Get an Estimate</x-import>
          <button type="button" onClick="{{ openWaitlist }}" style="display:inline-flex;align-items:center;justify-content:center;gap:10px;white-space:nowrap;min-height:52px;padding:0 26px;cursor:pointer;background:transparent;border:1.5px solid rgba(245,240,232,.72);border-radius:var(--radius-lg);font-family:var(--font-body),DM Sans,sans-serif;font-size:16px;font-weight:500;color:var(--color-parchment)" style-hover="background:rgba(245,240,232,.14);border-color:var(--color-parchment)" style-active="transform:scale(0.98)" style-focus="box-shadow:0 0 0 3px rgba(245,240,232,.28);outline:none">Join the Waitlist</button>
        </div>
      </sc-if>`,
  },
  {
    why: 'closing band copy, from the new design',
    from: `      closeHeadline: phase2 ? 'The road is waiting.' : 'Your fare is one scroll away.',
      closeSub: phase2 ? 'Download RideBuddy. Book a Buddy for your next trip.' : "Estimate your next trip. We'll message you when booking opens.",`,
    to: `      closeHeadline: phase2 ? 'The road is waiting.' : 'Plan the trip now. Book it soon.',
      closeSub: phase2 ? 'Download RideBuddy. Book a Buddy for your next trip.' : 'Booking opens soon. Get one message when it does.',`,
  },
];

// ----- No How It Works page ----------------------------------------------------------
// The page goes, with the FAQ that lived on it, Home's "See the full journey"
// link to it, and its links in the header, phone menu and footer (URLS, BOOKING).
// Home keeps its short three-step section.

const HOW = [
  {
    why: 'the How It Works page, its FAQ included',
    cut: ['  <!-- ══════════════════ HOW IT WORKS ══════════════════ -->', '  <!-- ══════════════════ ABOUT ══════════════════ -->'],
  },
  {
    why: 'the FAQ\'s questions: nothing shows them any more, so none of them ships',
    from: String.raw`        ['Is this a cab service?', 'No. You travel in your own car; RideBuddy provides the driver.'],
        ['Is the estimate the final price?', "It's a specific estimate for your exact trip. Final fare is calculated when your trip ends, from the actual trip."],
        ['What about tolls?', "Tolls aren't part of the fare. You pay them directly on the road, in your own car — your FASTag, your call."],
        ["What does my Buddy's stay cost on multi-day trips?", '₹499 per night, included in your estimate — or arrange the stay yourself and it\u2019s excluded. Many hotels provide driver stay at no cost.'],
        ['Who are the Buddies?', 'Police-verified before their first trip, formally trained on hill roads, night driving and customer conduct, and rated by customers after every trip.'],
        ['Which cities do you serve?', 'Pickups across the Chandigarh Tricity — Chandigarh, Mohali and Panchkula. Outstation destinations across North India.'],
`,
    to: '',
  },
  {
    why: 'Home: no "See the full journey" link to the How It Works page',
    from: '\n        <a href="#" onClick="{{ goHow }}" style="display:inline-flex;align-items:center;gap:6px;margin-top:28px;font-family:var(--font-body),sans-serif;font-size:15px;font-weight:500">See the full journey\n          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>\n        </a>\n',
    to: '\n',
  },
];

// ----- Buddies are "verified", not "police-verified" ---------------------------------

const VERIFIED = [
  {
    why: 'Home, "Background-verified.": verified, not police-verified',
    from: "body: 'Every Buddy is police-verified before their first trip.' }",
    to: "body: 'Every Buddy is verified before their first trip.' }",
  },
  {
    why: 'About: verified, not police-verified',
    from: 'Every Buddy is police-verified, formally trained, and rated after every trip.',
    to: 'Every Buddy is verified, formally trained, and rated after every trip.',
  },
  {
    why: 'About, the standards list: verification, not police verification',
    from: "{ text: 'Police verification before the first trip.' },",
    to: "{ text: 'Verification before the first trip.' },",
  },
];

export const ARTBOARD_PATCHES = [...ESTIMATE, ...URLS, ...BOOKING, ...FORMS, ...WAITLIST, ...HOW, ...VERIFIED];
