/* global React */
/**
 * Joining the waitlist away from an estimate: the "Join the Waitlist" pop-up
 * (the /beta artboard's, on every page) and the Contact page's card, which
 * takes the number in place. Both save through POST /api/waitlist, after the
 * one-time code; `source` is the page, as the Worker names it (forms.js).
 */
import {
  Button, CodeStep, ConsentTick, CONSENT_ERROR, Dialog, DialogHead, Done, Honeypot, MOBILE, PHONE_ERROR, PhoneField,
  track, useCodeForm, WAITLIST_JOINED,
} from './ui.jsx';

const { useState, useRef } = React;

/**
 * The number, the consent tick and the code, shared by both forms. `form`
 * names the form for the analytics; `toErrors` turns the Worker's refusal
 * into the form's errors.
 */
function useWaitlist({ source, form, codeId, toErrors }) {
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const honeypot = useRef(null);
  const f = useCodeForm('/api/waitlist', codeId);

  const send = async (code) => {
    const r = await f.submit({ phone, consent: true, source, website: honeypot.current?.value || '' }, { form, code });
    if (!r) return;
    if (!r.ok) { setErrors(toErrors(r)); return; }
    setDone(true);
    track('waitlist_joined', { source });
  };

  const submit = () => {
    if (f.sending) return;
    const next = {};
    if (!MOBILE.test(phone)) next.phone = PHONE_ERROR;
    if (!consent) next.consent = CONSENT_ERROR;
    setErrors(next);
    if (Object.keys(next).length) {
      if (next.phone) track('phone_invalid', { form });
      return;
    }
    send('');
  };

  return {
    f, done, errors, submit, honeypot,
    verify: () => send(f.code), resend: () => send(''),
    phoneProps: { value: phone, error: errors.phone, onChange: (v) => { setPhone(v); setErrors((e) => ({ ...e, phone: '' })); } },
    consentProps: { checked: consent, error: errors.consent, onChange: (v) => { setConsent(v); setErrors((e) => ({ ...e, consent: '' })); } },
  };
}

/**
 * The pop-up behind every "Join the Waitlist" button. It stays mounted while
 * closed, so a number typed, a code on its way, or the confirmation are still
 * there when it opens again.
 */
export function WaitlistPopup({ open, source, onClose }) {
  const w = useWaitlist({
    source, form: 'waitlist', codeId: 'rb-wl-code',
    toErrors: (r) => (Object.keys(r.errors).length ? r.errors : { form: r.error }),
  });
  if (!open) return null;
  return (
    <Dialog labelledBy="rb-wl-title" onClose={onClose}>
      <DialogHead id="rb-wl-title" title="Join the waitlist" sub="Get one message when booking opens." onClose={onClose} />
      <div className="rb-dialog__body">
        {w.done ? (
          <>
            <Done>{WAITLIST_JOINED}</Done>
            <Button onClick={onClose}>Done</Button>
          </>
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

/** The Contact page's waitlist card: the number goes in right there. */
export function ContactWaitlist() {
  const w = useWaitlist({
    source: 'contact', form: 'contact', codeId: 'rb-contact-code',
    toErrors: (r) => ({ phone: r.errors.phone || (r.errors.consent ? '' : r.error), consent: r.errors.consent || '' }),
  });
  if (w.done) return <Done>{WAITLIST_JOINED}</Done>;
  return (
    <div className="rb-wlcard">
      <div className="rb-wlcard__head">
        <h2>Join the waitlist.</h2>
        {w.f.step !== 'code' && <p>Leave a number and we'll reach out when booking opens. Waitlist members go first.</p>}
      </div>
      {w.f.step === 'code' ? (
        <CodeStep f={w.f} onVerify={w.verify} onResend={w.resend} />
      ) : (
        <>
          <PhoneField id="rb-contact-phone" {...w.phoneProps} />
          <ConsentTick id="rb-contact-consent" {...w.consentProps} />
          <Honeypot ref={w.honeypot} />
          <Button onClick={w.submit} disabled={w.f.sending}>{w.f.sending ? 'Joining…' : 'Join the Waitlist'}</Button>
          <small>One message when the app is live. Nothing else.</small>
        </>
      )}
    </div>
  );
}
