/* global React */
/**
 * What the site's standalone pages (/estimate/, /about/, /contact/) share: the
 * design-system primitives, the analytics hook, saving a form through the
 * Worker, and the phone-form parts — the mobile number with its fixed +91,
 * the consent tick, and the one-time code step every phone form goes through
 * (website/worker/otp.js). Bundled into each page by build.mjs.
 */
const { useState, useEffect, useRef } = React;

// Design-system primitives, with plain fallbacks so a bundle hiccup degrades
// to unstyled inputs rather than a blank page.
const DS = window.RideBuddyDesignSystem_f63581 || {};
export const Button = DS.Button || (({ children, fullWidth, size, variant, ...rest }) => <button className="rb-btn rb-btn--primary" {...rest}>{children}</button>);
export const Chip = DS.Chip || (({ selected, children, ...rest }) => <button type="button" aria-pressed={selected} className="rb-chip" {...rest}>{children}</button>);
export const Input = DS.Input || (({ label, icon, error, ...rest }) => (
  <label className="rb-field"><span className="rb-label">{label}</span><input className="rb-input" {...rest} />{error && <span className="rb-error-msg">{error}</span>}</label>
));

// Icons from the artboard.
export const Icon = ({ d, size = 18, stroke = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {[].concat(d).map((p, i) => <path key={i} d={p} />)}
  </svg>
);
export const CLOSE = 'M18 6 6 18M6 6l12 12';
export const TICK = 'm20 6-11 11-5-5';

export const PHONE_ERROR = 'Enter a valid mobile number.';
export const CONSENT_ERROR = 'Tick the box to join the waitlist.';
export const CONSENT = 'Send me an SMS or WhatsApp when booking opens. I agree to the Privacy Policy and Terms of Use.';
export const WAITLIST_JOINED = "You're on the waitlist. We'll message you once.";
/** An Indian mobile number, as the Worker accepts it (website/worker/lib.js). */
export const MOBILE = /^[6-9]\d{9}$/;

/** A named moment for the site's analytics (src/site.js forwards dataLayer pushes). */
export function track(event, payload) {
  (window.dataLayer = window.dataLayer || []).push(Object.assign({ event }, payload || {}));
}

/**
 * Saves a form through the site's Worker (website/worker/index.js). Resolves
 * to { ok: true }; to { ok: false, otp: 'sent', sentTo, resendIn } when the
 * Worker has sent a one-time code to the number and wants it back
 * (website/worker/otp.js); or to { ok: false, error, errors, reason }. Never
 * throws: a failure is shown to the visitor, who can try again. The /beta
 * artboard carries the same helper (artboard-patches.mjs).
 */
export async function postForm(path, body) {
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

/** Digits only, at most ten: a pasted "+91 98765 43210" keeps its last ten. */
export const tenDigits = (v) => { const d = String(v).replace(/\D/g, ''); return d.length > 10 ? d.slice(-10) : d; };

/** Into the field with this id as soon as it is on the page. */
export function focusWhenReady(id, tries = 20) {
  const el = document.getElementById(id);
  if (el) el.focus();
  else if (tries > 0) setTimeout(() => focusWhenReady(id, tries - 1), 50);
}

/**
 * Mobile number with a fixed +91, as on every form of the site. Leaving the
 * field with a number that can't be right says so at once (`onError`).
 */
export function PhoneField({ id, value, onChange, error, onError }) {
  return (
    <div className="rb-field">
      <label className="rb-label" htmlFor={id}>Mobile number</label>
      <div className={'rb-phone' + (error ? ' rb-phone--error' : '')}>
        <span className="rb-phone__cc" aria-hidden="true">+91</span>
        <input id={id} type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile"
          value={value} onChange={(e) => onChange(tenDigits(e.target.value))}
          onBlur={() => { if (onError && value && !MOBILE.test(value)) onError(PHONE_ERROR); }}
          aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} />
      </div>
      {error && <span className="rb-error-msg" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}

/**
 * The one-time code, as on every phone form of the site: one field rather than
 * six boxes, so a pasted or auto-filled code ("From Messages") lands whole.
 */
export function CodeField({ id, value, onChange, error }) {
  return (
    <div className="rb-field">
      <label className="rb-label" htmlFor={id}>6-digit code</label>
      <input id={id} className={'rb-code' + (error ? ' rb-code--error' : '')} type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]*" placeholder="••••••" value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        aria-invalid={error ? 'true' : undefined} aria-describedby={error ? `${id}-err` : undefined} />
      {error && <span className="rb-error-msg" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  );
}

export function ConsentTick({ id, checked, onChange, error }) {
  return (
    <div className="rb-consent">
      <label htmlFor={id}>
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{CONSENT}</span>
      </label>
      {error && <span className="rb-error-msg" role="alert">{error}</span>}
    </div>
  );
}

/** The field people never see and bots fill in; the Worker drops what arrives with it. */
export const Honeypot = React.forwardRef((props, ref) => (
  <input ref={ref} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="rb-hp" />
));

/**
 * A pop-up: the dimmed page behind, Escape to close, the page held still while
 * it is open, and the focus moved into it and back to where it was.
 */
export function Dialog({ label, labelledBy, onClose, children }) {
  const box = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    box.current?.focus();
    document.body.classList.add('rb-lock');
    const onKey = (e) => { if (e.key === 'Escape') close.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('rb-lock');
      if (opener && opener.focus) opener.focus();
    };
  }, []);
  return (
    <div className="rb-overlay">
      <div ref={box} className="rb-dialog" role="dialog" aria-modal="true" aria-label={label} aria-labelledby={labelledBy} tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

/** A pop-up's title, line under it, and close button. */
export function DialogHead({ id, title, sub, onClose }) {
  return (
    <div className="rb-dialog__head">
      <div>
        <h2 id={id}>{title}</h2>
        <p>{sub}</p>
      </div>
      <button type="button" className="rb-dialog__close" aria-label="Close" onClick={onClose}><Icon d={CLOSE} size={20} /></button>
    </div>
  );
}

/** The green confirmation a form ends on. */
export function Done({ children }) {
  return (
    <div className="rb-done">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B5E20" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TICK} /></svg>
      <span>{children}</span>
    </div>
  );
}

/**
 * A form that saves only after a one-time code (website/worker/otp.js): the
 * first POST sends a code to the number, the same POST with the code saves.
 * `submit(body, { form, code })` posts; a code sent or refused is handled
 * here, and it resolves to the Worker's answer when that is the form's to
 * show (saved, or the fields' errors) — null otherwise. `form` names the form
 * for the analytics (otp_sent, otp_failed, phone_invalid, ...).
 */
export function useCodeForm(path, codeId) {
  const [step, setStep] = useState('form');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const [sending, setSending] = useState(false);

  // The code step counts down to "Resend OTP".
  useEffect(() => {
    if (step !== 'code') return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [step]);

  const submit = async (body, { form, code: withCode = '' }) => {
    if (sending) return null;
    const atCode = step === 'code';
    setSending(true);
    setCodeError('');
    const r = await postForm(path, withCode ? { ...body, code: withCode } : body);
    setSending(false);
    if (r.otp === 'sent') {
      setStep('code');
      setCode('');
      setSentTo(r.sentTo);
      setResendAt(Date.now() + r.resendIn * 1000);
      setNow(Date.now());
      track('otp_sent', { form });
      setTimeout(() => focusWhenReady(codeId), 0);
      return null;
    }
    if (!r.ok) {
      // For the analytics: a code that didn't go through, a mistyped number, another field, or a save that failed.
      if (r.reason) track('otp_failed', { form, kind: r.reason });
      else track(r.errors.phone ? 'phone_invalid' : Object.keys(r.errors).length ? 'form_invalid' : 'save_failed', { form });
      if (atCode) { setCodeError(r.errors.code || r.error); return null; }
      return r;
    }
    if (withCode) track('otp_verified', { form });
    setStep('form');
    setCode('');
    return r;
  };

  return {
    step, code, codeError, sentTo, sending, submit, codeId,
    resendIn: Math.max(0, Math.ceil((resendAt - now) / 1000)),
    setCode: (v) => { setCode(v); setCodeError(''); },
    changeNumber: () => { setStep('form'); setCode(''); setCodeError(''); },
  };
}

/**
 * A form's code step: where the code went and "Change number", the 6-digit
 * code, Verify Number, and "Resend OTP" after a countdown. `f` is the form's
 * useCodeForm(); `onVerify` and `onResend` post its body again, with the code
 * and without.
 */
export function CodeStep({ f, onVerify, onResend }) {
  return (
    <>
      <div className="rb-sent">
        <span>Code sent to {f.sentTo}.</span>
        <button type="button" className="rb-linkbtn" onClick={f.changeNumber}>Change number</button>
      </div>
      <CodeField id={f.codeId} value={f.code} error={f.codeError} onChange={f.setCode} />
      <Button onClick={onVerify} disabled={f.sending || f.code.length !== 6}>{f.sending ? 'Checking…' : 'Verify Number'}</Button>
      <div className="rb-resend">
        {f.resendIn > 0
          ? <span>Resend OTP in 0:{String(f.resendIn).padStart(2, '0')}</span>
          : <button type="button" className="rb-linkbtn" onClick={onResend} disabled={f.sending}>Resend OTP</button>}
      </div>
    </>
  );
}
