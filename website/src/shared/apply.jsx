/* global React */
/**
 * Apply to be a Buddy — an individual Buddy or a driver agency — saved by the
 * Worker (POST /api/buddy -> D1) after the one-time code. The Worker
 * normalises the number and has the final word on every field.
 */
import {
  Button, Chip, CodeStep, Dialog, DialogHead, Done, Honeypot, Input, MOBILE, PHONE_ERROR, PhoneField, track, useCodeForm,
} from './ui.jsx';

const { useState, useRef, useEffect } = React;

const FLEET = ['1–5', '6–20', '21–50', '50+'];

/** One of the two "Applying as" cards. */
function TypeCard({ checked, onPick, name, sub }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="rb-applyas__card" onClick={onPick}>
      <span className="rb-applyas__name">{name}</span>
      <span className="rb-applyas__sub">{sub}</span>
    </button>
  );
}

/** The Buddy application pop-up. Like the waitlist's, it keeps what was typed while closed. */
export function ApplyPopup({ open, onClose }) {
  const [type, setType] = useState('individual');
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [phone, setPhone] = useState('');
  const [licence, setLicence] = useState('');
  const [city, setCity] = useState('');
  const [fleet, setFleet] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);
  const honeypot = useRef(null);
  const f = useCodeForm('/api/buddy', 'apply-code');

  // Each opening starts a new application, with what was typed still there.
  useEffect(() => { if (open) setSent(false); }, [open]);

  const agency = type === 'agency';
  const form = agency ? 'agency' : 'buddy';
  const field = (set, key) => (e) => { set(e.target.value); setErrors((x) => ({ ...x, [key]: '' })); };

  const send = async (code) => {
    const fields = agency
      ? { type: 'agency', agency: agencyName, contact: name, phone, city, drivers: fleet || null, email, gstin }
      : { type: 'individual', name, phone, licence, city };
    const r = await f.submit({ ...fields, website: honeypot.current?.value || '' }, { form, code });
    if (!r) return;
    if (!r.ok) {
      // The Worker calls the agency's contact person "contact"; the form shows it in the name field.
      setErrors(Object.keys(r.errors).length ? { ...r.errors, name: r.errors.name || r.errors.contact } : { form: r.error });
      return;
    }
    setSent(true);
    track('buddy_application_submitted', { type: agency ? 'agency' : 'individual' });
  };

  const submit = () => {
    if (f.sending) return;
    const next = {};
    if (agency && !agencyName.trim()) next.agency = 'Enter the agency name.';
    if (!name.trim()) next.name = agency ? 'Enter the contact person’s name.' : 'Enter your full name.';
    if (!MOBILE.test(phone)) next.phone = PHONE_ERROR;
    if (!agency && !licence.trim()) next.licence = 'Enter your licence number.';
    if (!city.trim()) next.city = 'Enter your city or base.';
    setErrors(next);
    if (Object.keys(next).length) {
      // A number typed but short is a mistyped number; anything else, a form sent incomplete.
      track(next.phone && phone ? 'phone_invalid' : 'form_invalid', { form });
      return;
    }
    send('');
  };

  if (!open) return null;
  const title = agency ? 'Apply as a driver agency.' : 'Apply to be a Buddy.';
  return (
    <Dialog label={title} onClose={onClose}>
      <DialogHead title={title} onClose={onClose}
        sub={agency ? 'A few details to start. RideBuddy will call to take it from there.' : 'Four details to start. RideBuddy will take it from there.'} />
      <div className="rb-dialog__body">
        {sent ? (
          <>
            <Done>Application received. We’ll contact you when onboarding opens.</Done>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : f.step === 'code' ? (
          <CodeStep f={f} onVerify={() => send(f.code)} onResend={() => send('')} />
        ) : (
          <>
            <div className="rb-applyas" role="radiogroup" aria-label="Applying as">
              <span className="rb-label">Applying as</span>
              <div className="rb-applyas__cards">
                <TypeCard checked={!agency} onPick={() => { setType('individual'); setErrors({}); }} name="Individual Buddy" sub="I drive myself." />
                <TypeCard checked={agency} onPick={() => { setType('agency'); setErrors({}); }} name="Driver agency" sub="I supply verified drivers." />
              </div>
            </div>
            {agency ? (
              <>
                <Input label="Agency name" placeholder="As registered" value={agencyName} onChange={field(setAgencyName, 'agency')} error={errors.agency || undefined} />
                <Input label="Contact person" placeholder="Full name" value={name} onChange={field(setName, 'name')} error={errors.name || undefined} />
              </>
            ) : (
              <Input label="Full name" placeholder="As printed on your licence" value={name} onChange={field(setName, 'name')} error={errors.name || undefined} />
            )}
            <PhoneField id="apply-phone" value={phone} error={errors.phone} onChange={(v) => { setPhone(v); setErrors((x) => ({ ...x, phone: '' })); }}
              onError={(msg) => setErrors((x) => ({ ...x, phone: msg }))} />
            {!agency && (
              <Input label="Driving licence number" placeholder="PB01 20110012345" value={licence} onChange={field(setLicence, 'licence')} error={errors.licence || undefined} />
            )}
            <Input label={agency ? 'City or base' : 'Your city or base'} placeholder="Mohali" autoComplete="address-level2" value={city} onChange={field(setCity, 'city')} error={errors.city || undefined} />
            {agency && (
              <>
                <div className="rb-applyfleet" role="group" aria-label="Drivers you can supply">
                  <span className="rb-label">Drivers you can supply (optional)</span>
                  <div className="rb-chips">
                    {FLEET.map((c) => <Chip key={c} selected={fleet === c} onClick={() => setFleet(fleet === c ? '' : c)}>{c}</Chip>)}
                  </div>
                </div>
                <Input label="Work email (optional)" type="email" placeholder="name@agency.in" autoComplete="email" value={email} onChange={field(setEmail, 'email')} error={errors.email || undefined} />
                <Input label="GSTIN (optional)" placeholder="03ABCDE1234F1Z5" maxLength={15} value={gstin} error={errors.gstin || undefined}
                  onChange={(e) => { setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)); setErrors((x) => ({ ...x, gstin: '' })); }} />
              </>
            )}
            <Honeypot ref={honeypot} />
            <Button size="lg" onClick={submit} disabled={f.sending}>{f.sending ? 'Sending…' : 'Send Application'}</Button>
            {errors.form && <span className="rb-form-error" role="alert">{errors.form}</span>}
          </>
        )}
      </div>
    </Dialog>
  );
}
