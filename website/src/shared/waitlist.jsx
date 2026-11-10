/* global React */
/**
 * Joining the waitlist away from an estimate: the "Join the Waitlist" pop-up
 * (the /beta artboard's, on every page) and the Contact page's card, which
 * takes the number in place. Both save through POST /api/waitlist, after the
 * one-time code, as PRD S1's `source` hero (no trip), with the page they were
 * on kept apart (`page`: about, contact; forms.js PAGES).
 */
import {
  Button, CodeStep, ConsentTick, CONSENT_ERROR, Dialog, DialogHead, Done, Honeypot, MOBILE, PHONE_ERROR, PhoneField,
  track, useCodeForm, WAITLIST_JOINED,
} from './ui.jsx';

const { useState, useRef } = React;

/**
 * PRD S8's confirmation without a trip: the line, and Get Estimate. A link,
 * so src/site.js carries any campaign parameters along with it.
 */
export function JoinedNoTrip() {
  return (
    <>
      <Done>{WAITLIST_JOINED}</Done>
      <a className="rb-btn rb-btn--primary" href="/estimate/">Get Estimate</a>
    </>
  );
}

/**
 * The number, the consent tick and the code, shared by both forms. `page` is
 * where the form is (about, contact); `toErrors` turns the Worker's refusal
 * into the form's errors.
 */
function useWaitlist({ page, codeId, toErrors }) {
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const honeypot = useRef(null);
  const f = useCodeForm('/api/waitlist', codeId);

  const send = async (code) => {
    const r = await f.submit({ phone, consent: true, source: 'hero', page, website: honeypot.current?.value || '' }, { source: 'hero', code });
    if (!r) return;
    if (!r.ok) { setErrors(toErrors(r)); return; }
    setDone(true);
    track('signup_completed', { lead_id: r.lead_id ?? null, source: 'hero', estimate_id: null, is_repeat: !!r.is_repeat, days_ahead: null });
  };

  const submit = () => {
    if (f.sending) return;
    const next = {};
    if (!MOBILE.test(phone)) next.phone = PHONE_ERROR;
    if (!consent) next.consent = CONSENT_ERROR;
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.phone) track('phone_invalid', { form: 'signup' });
      return;
    }
    send('');
  };

  return {
    f, done, errors, submit, honeypot,
    verify: () => send(f.code), resend: () => send(''),
    phoneProps: {
      value: phone, error: errors.phone, onChange: (v) => { setPhone(v); setErrors((e) => ({ ...e, phone: '' })); },
      onError: (msg) => setErrors((e) => ({ ...e, phone: msg })),
    },
    consentProps: { checked: consent, error: errors.consent, onChange: (v) => { setConsent(v); setErrors((e) => ({ ...e, consent: '' })); } },
  };
}

/**
 * The pop-up behind every "Join the Waitlist" button. It stays mounted while
 * closed, so a number typed, a code on its way, or the confirmation are still
 * there when it opens again.
 */
export function WaitlistPopup({ open, page, onClose }) {
  const w = useWaitlist({
    page, codeId: 'rb-wl-code',
    toErrors: (r) => (Object.keys(r.errors).length ? r.errors : { form: r.error }),
  });
  if (!open) return null;
  return (
    <Dialog labelledBy="rb-wl-title" onClose={onClose}>
      <DialogHead id="rb-wl-title" title="Join the waitlist" sub="Get one message when booking opens." onClose={onClose} />
      <div className="rb-dialog__body">
        {w.done ? (
          <JoinedNoTrip />
        ) : w.f.step === 'code' ? (
          <CodeStep f={w.f} onVerify={w.verify} onResend={w.resend} />
        ) : (
          <>
            <PhoneField id="rb-wl-phone" {...w.phoneProps} />
            <ConsentTick id="rb-wl-consent" {...w.consentProps} />
            <Honeypot ref={w.honeypot} />
            <Button onClick={w.submit} disabled={w.f.sending}>{w.f.sending ? 'Joining…' : 'Join the Waitlist'}</Button>
            {w.errors.form && <span className="rb-form-error" role="alert">{w.errors.form}</span>}
          </>
        )}
      </div>
    </Dialog>
  );
}

/** The Contact page's waitlist card: the number goes in right there (audit C03: the About card's line). */
export function ContactWaitlist() {
  const w = useWaitlist({
    page: 'contact', codeId: 'rb-contact-code',
    toErrors: (r) => ({ phone: r.errors.phone || (r.errors.consent ? '' : r.error), consent: r.errors.consent || '' }),
  });
  if (w.done) return <div className="rb-wlcard"><JoinedNoTrip /></div>;
  return (
    <div className="rb-wlcard">
      <div className="rb-wlcard__head">
        <h2>Join the waitlist.</h2>
        {w.f.step !== 'code' && <p>Verify your mobile number. One message when booking opens. Nothing else.</p>}
      </div>
      {w.f.step === 'code' ? (
        <CodeStep f={w.f} onVerify={w.verify} onResend={w.resend} />
      ) : (
        <>
          <PhoneField id="rb-contact-phone" {...w.phoneProps} />
          <ConsentTick id="rb-contact-consent" {...w.consentProps} />
          <Honeypot ref={w.honeypot} />
          <Button onClick={w.submit} disabled={w.f.sending}>{w.f.sending ? 'Joining…' : 'Join the Waitlist'}</Button>
        </>
      )}
    </div>
  );
}
