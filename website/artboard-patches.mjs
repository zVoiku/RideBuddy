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
    why: 'nav links: the estimator, About and Contact are pages of their own (PAGE_URL); Home stays',
    from: String.raw`    return (e) => {
      if (e) e.preventDefault();
      this.setState({ page, menuOpen: false });`,
    to: String.raw`    return (e) => {
      if (e) e.preventDefault();
      if (PAGE_URL[page]) { window.location.href = (window.rbCarry || String)(PAGE_URL[page]); return; }
      this.setState({ page, menuOpen: false });`,
  },
  {
    why: 'hero / nav "Get an Estimate" CTAs',
    from: "    this.setState({ page: 'estimate', menuOpen: false });\n    window.scrollTo({ top: 0, behavior: 'auto' });\n    this.track('estimator_opened');",
    to: "    this.track('estimator_opened');\n    window.location.href = (window.rbCarry || String)('/estimate/');",
  },
  {
    why: 'Round trips / One-way trips cards',
    from: "    this.setState({ tripType: type, view: 'form' });\n    this.scrollToEstimator();",
    to: "    window.location.href = (window.rbCarry || String)('/estimate/?type=' + (type === 'round' ? 'round' : 'one'));",
  },
];

// ----- URLs: /beta/ is Home; the other pages have their own -------------------------

/** Old links to the artboard's About, Contact and Buddy form, and where they live now. */
const MOVED = "{ '#about': '/about/', '#contact': '/contact/', '#apply': '/contact/#apply' }";

const URLS = [
  {
    why: 'old /beta/#about, #contact and #apply links go to /about/, /contact/ and /contact/#apply, before anything loads',
    from: '<script src="./support.js"></script>',
    to: `<script>(function () { var to = ${MOVED}[location.hash]; if (to) location.replace(to); })();</script>
<script src="./support.js"></script>`,
  },
  {
    why: 'the pages with URLs of their own',
    from: 'class Component extends DCLogic {',
    to: String.raw`// The pages with URLs of their own (website/artboard-patches.mjs): the
// estimator, About and Contact. Home is /beta/ itself.
const PAGE_URL = { estimate: '/estimate/', about: '/about/', contact: '/contact/' };
// The How It Works page is gone: an old link to it opens Home, at a plain URL.
if (window.location.hash === '#how-it-works') history.replaceState(null, '', window.location.pathname + window.location.search);

class Component extends DCLogic {`,
  },
  {
    why: 'an old link typed into the address bar goes on too; Escape closes the pop-up; the code step counts down',
    from: String.raw`  componentDidMount() {
    import('./rate-config.js').then((m) => this.setState({ cfg: m }));
  }`,
    to: String.raw`  componentDidMount() {
    import('./rate-config.js').then((m) => this.setState({ cfg: m }));
    window.addEventListener('hashchange', () => {
      const to = ${MOVED}[window.location.hash];
      if (to) window.location.replace(to);
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state.wlOpen) this.closeWaitlist();
    });
    // The code step counts down to "Resend OTP".
    setInterval(() => {
      if (this.state.wlStep === 'code') this.setState({ otpNow: Date.now() });
    }, 1000);
  }`,
  },
  {
    why: 'nav links carry their URL',
    from: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),",
    to: "      underline: page === id ? 'var(--color-green-500)' : 'transparent', go: this.nav(id),\n      href: PAGE_URL[id] || window.location.pathname,",
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
    why: 'footer links carry their URLs (Terms and Privacy stay as they are); no How It Works; "Become a Buddy" is /contact/#apply',
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
          { label: 'About', go: this.nav('about'), href: '/about/' }, { label: 'Contact', go: this.nav('contact'), href: '/contact/' },
        ] },
        { title: 'Services', items: [
          { label: 'Round trips', go: this.presetTrip('round'), href: '/estimate/?type=round' },
          { label: 'One-way trips', go: this.presetTrip('one'), href: '/estimate/?type=one' },
          { label: phase2 ? 'Get the app' : 'Estimate your trip', go: this.scrollToEstimator, href: '/estimate/' },
        ] },
        { title: 'More', items: [
          { label: 'Become a Buddy', href: '/contact/#apply' },
          { label: 'Terms', go: (e) => { if (e) e.preventDefault(); }, href: '#' },
          { label: 'Privacy', go: (e) => { if (e) e.preventDefault(); }, href: '#' },
        ] },
      ],`,
  },
  { why: 'logo link', from: '<a href="#" onClick="{{ goHome }}"', to: '<a href="{{ homeHref }}" onClick="{{ goHome }}"' },
  { why: 'header and mobile-menu links', from: '<a href="#" onClick="{{ l.go }}"', to: '<a href="{{ l.href }}" onClick="{{ l.go }}"', count: 2 },
  { why: '"Estimate this trip" links', from: '<a href="#" onClick="{{ s.go }}"', to: '<a href="{{ s.href }}" onClick="{{ s.go }}"' },
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

// ----- The waitlist pop-up saves through the Worker (website/worker) ----------------

// A field people never see and bots fill in; the Worker drops what arrives with it.
const honeypot = (id) => `<input type="text" name="website" id="${id}" tabIndex="-1" autoComplete="off" aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;opacity:0">`;

/**
 * A phone form's code step (website/worker/otp.js), as in the Phase 1 design:
 * where the code went and "Change number", the 6-digit code, Verify Number,
 * and "Resend OTP" after a countdown. `p` is the form's state prefix (wl, the
 * pop-up), whose values codeValues() provides; `id` the code field's. One
 * field rather than six boxes, so a pasted or auto-filled code lands whole.
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

  /** A one-time code went out: the form (state prefix p: wl) moves to its code step. */
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
    why: 'state for the waitlist pop-up',
    from: '      applyErrors: {},\n    };',
    to: String.raw`      applyErrors: {},
      wlOpen: false, wlPhone: '', wlConsent: false, wlErrors: {}, wlSending: false, wlDone: false,
      // Its one-time code step: 'form' or 'code', the code typed, where it went, when a new one may be asked for.
      wlStep: 'form', wlCode: '', wlCodeError: '', wlSentTo: '', wlResendAt: 0,
      otpNow: 0,
    };`,
  },
];

// ----- "Join the Waitlist": hero, closing band, and the pop-up they open -------------

/** Where a pop-up signup was made (forms.js SOURCES): Home, the artboard's one page now. */
const WAITLIST_SOURCE = "'home'";

const WAITLIST = [
  {
    why: 'phone fields: digits only, at most ten; a pasted +91 or 0 number keeps its last ten',
    from: 'class Component extends DCLogic {',
    to: String.raw`const tenDigits = (v) => { const d = String(v).replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };
const PHONE_ERROR = 'Enter a valid mobile number.';

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
    if (!/^[6-9]\d{9}$/.test(wlPhone)) errors.phone = PHONE_ERROR;
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
    to: String.raw`      openWaitlist: this.openWaitlist, closeWaitlist: this.closeWaitlist, submitWaitlist: this.submitWaitlist,
      wlOpen: s.wlOpen, wlDone: s.wlDone, wlPending: !s.wlDone && s.wlStep !== 'code', wlAtCode: !s.wlDone && s.wlStep === 'code',
      // The pop-up's one-time code step (codeStep()).
      ...this.codeValues('wl', this.verifyWaitlist, this.resendWaitlist),
      wlPhone: s.wlPhone, onWlPhone: (e) => this.setState({ wlPhone: tenDigits(e.target.value), wlErrors: Object.assign({}, s.wlErrors, { phone: '' }) }),
      // Leaving the field with a number that can't be right says so at once.
      onWlPhoneBlur: () => { const v = this.state.wlPhone; if (v && !/^[6-9]\d{9}$/.test(v)) this.setState({ wlErrors: Object.assign({}, this.state.wlErrors, { phone: PHONE_ERROR }) }); },
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
                  <input id="rb-wl-phone" type="tel" inputMode="numeric" autoComplete="tel-national" aria-invalid="{{ wlPhoneInvalid }}" value="{{ wlPhone }}" onChange="{{ onWlPhone }}" onBlur="{{ onWlPhoneBlur }}" placeholder="10-digit mobile" style="flex:1;min-width:0;border:none;outline:none;background:transparent;padding:0 14px;font-family:var(--font-body),DM Sans,sans-serif;font-size:15px;letter-spacing:0.02em;color:var(--color-charcoal)">
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

// ----- Go-live clean-up (QA audit v2.3: L01, P01, P02, P05, P07) ----------------------

const AUDIT = [
  {
    why: 'L01: the hero line',
    from: 'Verified, trained Buddies for outstation trips from Chandigarh. Shimla, Manali, Kasauli — in your own car.',
    to: 'Verified, trained Buddies for outstation trips from the Chandigarh Tricity, in your own car.',
  },
  { why: 'P01: the page is in Indian English', from: '<html>\n<head>\n', to: '<html lang="en-IN">\n<head>\n' },
  {
    // build.mjs fills <!-- partial:head --> (icons, sharing image) as on every page.
    why: 'P01, P02: a title, a description, the sharing card and the icons',
    from: '<meta name="viewport" content="width=device-width, initial-scale=1">',
    to: `<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RideBuddy — Your car. Your comfort. A Buddy you can trust.</title>
<meta name="description" content="Verified, trained Buddies for outstation trips from the Chandigarh Tricity, in your own car. See your fare and join the waitlist.">
<meta name="theme-color" content="#F5F0E8">
<!-- partial:head -->
<meta property="og:title" content="RideBuddy — Your car. Your comfort. A Buddy you can trust.">
<meta property="og:description" content="Verified, trained Buddies for outstation trips from the Chandigarh Tricity, in your own car.">
<meta property="og:url" content="https://ridebuddy.co.in/beta/">`,
  },
  {
    why: 'P05: the hero photo as a plain image rather than an authoring slot',
    from: String.raw`<image-slot id="home-hero" shape="rect" fit="cover" src="assets/hero-mountain-road.webp" placeholder="Buddy at Mountain Road — navy polo, white SUV, Himachal road curving away, golden hour. 16:9, keep lower-left calm. See imagery-brief.md"></image-slot>`,
    to: '<img id="home-hero" src="assets/hero-mountain-road.webp" alt="A Buddy beside a white SUV on a mountain road in Himachal" fetchpriority="high" style="width:100%;height:100%;object-fit:cover;display:block">',
  },
  {
    why: 'P05: the trust photo too',
    from: String.raw`<image-slot id="home-trust" shape="rounded" radius="12" fit="cover" src="assets/buddy-solo.webp" placeholder="Buddy Solo — portrait beside the customer's car, driveway, early golden light. 4:5. See imagery-brief.md"></image-slot>`,
    to: '<img id="home-trust" src="assets/buddy-solo.webp" alt="A Buddy beside a customer\'s car in the driveway" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">',
  },
  { why: 'P05: no image slots left, so no image-slot.js', from: '<script src="./image-slot.js"></script>\n', to: '' },
  {
    why: 'P07: the artboard\'s own estimator page — every Estimate CTA goes to /estimate/ — with its WhatsApp field and Book a Buddy button',
    cut: ['  <!-- ══════════════════ ESTIMATE ══════════════════ -->', '  <!-- ══════════════════ HOW IT WORKS ══════════════════ -->'],
  },
  { why: 'P07: the Book a Buddy handler', from: String.raw`  /**
   * Booking isn't live in Phase 1, so "Book a Buddy" routes to the only real action:
   * the waitlist under a completed estimate. Never a dead button.
   */
  bookBuddy = (e) => {
    if (e) e.preventDefault();
    this.setState({ page: 'estimate', menuOpen: false });
    this.track('book_a_buddy_clicked', { phase: String(this.props.phase ?? '1') });
    setTimeout(() => {
      const el = document.getElementById('waitlist') || document.getElementById('estimate');
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 88, behavior: 'smooth' });
      else window.scrollTo({ top: 0, behavior: 'auto' });
    }, 80);
  };

`, to: '' },
  { why: 'P07: the WhatsApp handler (a TODO that saved nothing)', from: String.raw`  submitWhatsapp = () => {
    if (!/\d{6}/.test(this.state.whatsapp)) return;
    // TODO(open item #3): POST to launch-alert endpoint once founder confirms tooling.
    this.setState({ waDone: true });
    this.track('whatsapp_number_submitted');
  };

`, to: '' },
  { why: 'P07: the WhatsApp field\'s and the FAQ\'s state', from: "      whatsapp: '',\n      waDone: false,\n      openFaq: 0,\n", to: '' },
  {
    why: 'P07: the WhatsApp field\'s template values',
    from: "      whatsapp: s.whatsapp, waDone: s.waDone, waPending: !s.waDone,\n      onWhatsapp: (e) => this.setState({ whatsapp: e.target.value }),\n      submitWhatsapp: this.submitWhatsapp,\n",
    to: '',
  },
  { why: 'P07: How It Works journey data (with its deposit copy) and the mock trip card (RB-40218)', from: String.raw`      journey: [
        { title: 'Estimate your fare.', body: 'A specific number for your exact trip, from the Estimate Fare page.' },
        { title: phase2 ? 'Book in minutes.' : 'Book in minutes — when booking opens.', body: 'Trip type, route, dates, your car — in the app. A 20% deposit confirms the trip; the balance settles when the trip ends.' },
        { title: 'Your Buddy is assigned.', body: "Profile, rating, trip count — you see who's driving before the trip." },
        { title: 'Trip day.', body: 'Your Buddy arrives on time. You hold the trip-start OTP — the trip begins only when you share it.' },
        { title: 'Ride your way.', body: 'Your car, your rules. Stop for parathas at Dharampur if you want. Tolls you pay directly, as you always do.' },
        { title: 'Trip ends, fare settles.', body: 'You mark the trip complete. Final fare is calculated from the actual trip. Rate your Buddy.' },
      ],
      tripCardProps: {
        from: 'Chandigarh',
        to: 'Shimla',
        bookingId: 'RB-40218',
        badge: React.createElement(window.RideBuddyDesignSystem_f63581.Badge, { status: 'assigned' }, 'Assigned'),
        details: [
          { label: 'Depart', value: pretty(s.departDate) },
          { label: 'Pickup', value: s.pickupTime },
          { label: 'Type', value: 'Round Trip' },
        ],
      },
`, to: '' },
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
    why: 'the FAQ\'s data: nothing shows it any more (P07: no empty FAQ map either)',
    from: String.raw`      faqs: [
        ['Is this a cab service?', 'No. You travel in your own car; RideBuddy provides the driver.'],
        ['Is the estimate the final price?', "It's a specific estimate for your exact trip. Final fare is calculated when your trip ends, from the actual trip."],
        ['What about tolls?', "Tolls aren't part of the fare. You pay them directly on the road, in your own car — your FASTag, your call."],
        ["What does my Buddy's stay cost on multi-day trips?", '₹499 per night, included in your estimate — or arrange the stay yourself and it\u2019s excluded. Many hotels provide driver stay at no cost.'],
        ['Who are the Buddies?', 'Police-verified before their first trip, formally trained on hill roads, night driving and customer conduct, and rated by customers after every trip.'],
        ['Which cities do you serve?', 'Pickups across the Chandigarh Tricity — Chandigarh, Mohali and Panchkula. Outstation destinations across North India.'],
      ].map(([q2, a], i) => ({
        q: q2, a, open: s.openFaq === i, rot: s.openFaq === i ? '180deg' : '0deg',
        toggle: () => this.setState((p) => ({ openFaq: p.openFaq === i ? -1 : i })),
      })),
`,
    to: '',
  },
  {
    why: 'Home: no "See the full journey" link to the How It Works page',
    from: '\n        <a href="#" onClick="{{ goHow }}" style="display:inline-flex;align-items:center;gap:6px;margin-top:28px;font-family:var(--font-body),sans-serif;font-size:15px;font-weight:500">See the full journey\n          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>\n        </a>\n',
    to: '\n',
  },
];

// ----- About, Contact and the Buddy application are pages of their own ----------------
// /about/, /contact/ and /contact/#apply (src/about, src/contact). Links lead there
// (URLS), and the artboard's own copies go, so there is one of each.

const MOVED_OUT = [
  {
    why: 'the About and Contact pages, and the Buddy application pop-up',
    cut: ['  <!-- ══════════════════ ABOUT ══════════════════ -->', '  <!-- Join the Waitlist pop-up: hero and closing band (website/artboard-patches.mjs) -->'],
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
    // The list only showed on the artboard's About page, which is cut (MOVED_OUT), but it ships in the script.
    why: 'About, the standards list: verification, not police verification',
    from: "{ text: 'Police verification before the first trip.' },",
    to: "{ text: 'Verification before the first trip.' },",
  },
];

export const ARTBOARD_PATCHES = [...ESTIMATE, ...URLS, ...BOOKING, ...FORMS, ...WAITLIST, ...AUDIT, ...HOW, ...MOVED_OUT, ...VERIFIED];
