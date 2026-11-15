/* global React */
/**
 * Apply to be a Buddy — an individual Buddy or a driver agency — in Hindi
 * first, or English (DS04, W08/B01, B02/B03; copy in shared/buddy.mjs). Saved
 * by the Worker (POST /api/buddy -> D1) after the one-time code, with the
 * consent the applicant ticked, its wording's version and the language. The
 * Worker normalises the number and has the final word on every field.
 *
 * Get OTP stays greyed until every field is right and the consent is ticked;
 * a field left wrong says why as the applicant leaves it. The code goes in six
 * boxes, then Verify & Submit.
 */
import {
  BUDDY_COPY, CONSENT_VERSION, WHATSAPP_GLYPH, getBuddyLang, onBuddyLang, setBuddyLang, whatsappUrl,
} from './buddy.mjs';
import {
  Button, Chip, Dialog, DialogHead, Done, Honeypot, Input, MOBILE, OtpBoxes, PRIVACY, PhoneField, TERMS, track, useCodeForm,
} from './ui.jsx';

const { useState, useRef, useEffect } = React;

const FLEET = ['1–5', '6–20', '21–50', '50+'];
const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The visitor's Buddy language, following any change (a band's switch, another tab). */
function useBuddyLang() {
  const [lang, setLang] = useState(getBuddyLang);
  useEffect(() => onBuddyLang(setLang), []);
  return lang;
}

/** हिंदी | English, as a band's (buddy.mjs toggleHtml). */
function LangToggle({ lang }) {
  const btn = (l, label) => (
    <button type="button" lang={l} aria-pressed={lang === l} onClick={() => setBuddyLang(l)} data-rb-label={`Language: ${l === 'hi' ? 'Hindi' : 'English'}`}>{label}</button>
  );
  return <div className="rb-langtoggle" role="group" aria-label="भाषा / Language">{btn('hi', 'हिंदी')}{btn('en', 'English')}</div>;
}

/** One of the two "Applying as" cards. */
function TypeCard({ checked, onPick, name, sub }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="rb-applyas__card" onClick={onPick}>
      <span className="rb-applyas__name">{name}</span>
      <span className="rb-applyas__sub">{sub}</span>
    </button>
  );
}

/** Where the Worker's field names differ from the form's: the agency's contact person is the name field. */
const FIELD = { contact: 'name' };

/** A field's problem, as the design words it (BUDDY_COPY err keys), or '' when it is right. */
function problem(field, v, agency) {
  const t = v.trim();
  switch (field) {
    case 'agency': return agency && t.length < 2 ? 'agency' : '';
    case 'name': return t.length < 3 ? (agency ? 'nameAg' : 'name') : '';
    case 'phone': return MOBILE.test(v) ? '' : 'phoneInvalid';
    case 'licence': return !agency && t.length < 6 ? 'licence' : '';
    case 'city': return t.length < 2 ? (agency ? 'cityAg' : 'city') : '';
    case 'email': return agency && t && !EMAIL.test(t) ? 'email' : '';
    case 'gstin': return agency && v && !GSTIN.test(v) ? 'gstin' : '';
    default: return '';
  }
}

/**
 * Why a code didn't go out or wasn't taken, in the visitor's language: the
 * Worker's reason (otp.js), else what failed (forms.js), else its own words.
 */
function codeTrouble(T, r) {
  if (!r) return '';
  if (r.network) return T.err.network;
  const byReason = {
    wrong: T.err.wrong, too_many: T.err.tooMany, expired: T.err.expired,
    send_failed: T.err.sendFailed, not_configured: T.err.sendFailed, daily_cap: T.err.sendFailed,
    number_limit: T.err.numberLimit, network_limit: T.err.networkLimit,
    resend_wait: T.err.wait(r.resendIn || 30),
  };
  if (byReason[r.reason]) return byReason[r.reason];
  if (r.status === 429) return T.err.tooManyTries;
  return T.err.saveFailed;
}

/** The Buddy application pop-up. Like the waitlist's, it keeps what was typed while closed. */
export function ApplyPopup({ open, onClose }) {
  const lang = useBuddyLang();
  const T = BUDDY_COPY[lang];
  const [type, setType] = useState('individual');
  const [values, setValues] = useState({ agency: '', name: '', phone: '', licence: '', city: '', email: '', gstin: '' });
  const [fleet, setFleet] = useState('');
  const [consent, setConsent] = useState(false);
  // Fields left by the applicant: their problems show. The Worker's refusals show as they come.
  const [left, setLeft] = useState({});
  const [refused, setRefused] = useState({});
  const [formTrouble, setFormTrouble] = useState(null);
  const [sent, setSent] = useState(null);
  const honeypot = useRef(null);
  const f = useCodeForm('/api/buddy', 'apply-code');

  // Each opening starts a new application, with what was typed still there.
  useEffect(() => { if (open) setSent(null); }, [open]);

  const agency = type === 'agency';
  const fields = agency ? ['agency', 'name', 'phone', 'city', 'email', 'gstin'] : ['name', 'phone', 'licence', 'city'];
  const problems = Object.fromEntries(fields.map((k) => [k, problem(k, values[k], agency)]).filter(([, p]) => p));
  const ready = consent && !Object.keys(problems).length;
  /**
   * What a field shows under it: the Worker's refusal, else its own problem
   * once the applicant has left it with something in it. An empty field says
   * nothing: Get OTP waits for it.
   */
  const errorOf = (k) => {
    const key = refused[k] || (left[k] && values[k].trim() && problems[k]);
    return key ? (T.err[key] || key) : undefined;
  };

  const set = (k, v) => {
    setValues((x) => ({ ...x, [k]: v }));
    setRefused((x) => ({ ...x, [k]: '' }));
    setFormTrouble(null);
  };
  const leave = (k) => setLeft((x) => ({ ...x, [k]: true }));
  // Ids of their own: the design system's Input would name each after its label, which changes with the language.
  const field = (k, extra = {}) => ({
    id: `apply-${k}`, value: values[k], error: errorOf(k), onChange: (e) => set(k, e.target.value), onBlur: () => leave(k), ...extra,
  });
  const pick = (next) => { setType(next); setLeft({}); setRefused({}); setFormTrouble(null); };

  const send = async (code) => {
    if (!ready) return;
    const body = agency
      ? { type: 'agency', agency: values.agency, contact: values.name, phone: values.phone, city: values.city, drivers: fleet || null, email: values.email, gstin: values.gstin }
      : { type: 'individual', name: values.name, phone: values.phone, licence: values.licence, city: values.city };
    const r = await f.submit({
      ...body, consent: true, consent_version: CONSENT_VERSION, language: lang, website: honeypot.current?.value || '',
    }, { source: 'buddy', code });
    if (!r) return;
    if (!r.ok) {
      // The Worker's refusals, by field, worded in the form's language where the design words them.
      const byField = {};
      for (const [k, msg] of Object.entries(r.errors || {})) {
        const name = FIELD[k] || k;
        byField[name] = problem(name, values[name] ?? '', agency) || msg;
      }
      if (Object.keys(byField).length) setRefused(byField); else setFormTrouble(r);
      return;
    }
    setSent(agency ? 'agency' : 'individual');
    // Sent: the next application starts empty (audit N9).
    setValues({ agency: '', name: '', phone: '', licence: '', city: '', email: '', gstin: '' });
    setFleet(''); setConsent(false); setLeft({}); setRefused({}); setFormTrouble(null);
    // PRD 10.2; the first touch rides with every beacon (src/site.js, worker/analytics.js).
    track('buddy_interest_submitted', { buddy_interest_id: r.buddy_interest_id || null, type: agency ? 'agency' : 'individual', language: lang });
  };

  // Done: the form is new again, as an individual Buddy's (N9).
  const done = () => { setType('individual'); onClose(); };

  if (!open) return null;
  const sentAgency = sent === 'agency';
  const title = (sent ? sentAgency : agency) ? T.titleAg : T.titleInd;
  const sub = (sent ? sentAgency : agency) ? T.subAg : T.subInd;
  const wa = whatsappUrl(lang);
  const last3 = (f.sentTo || '').replace(/\D/g, '').slice(-3);
  const codeError = f.codeError ? codeTrouble(T, f.codeFail) : '';
  return (
    <Dialog label={title} onClose={sent ? done : onClose} lang={lang}>
      <DialogHead title={title} sub={sub} onClose={sent ? done : onClose} closeLabel={T.close} above={<LangToggle lang={lang} />} />
      <div className="rb-dialog__body">
        {sent ? (
          <>
            <Done>{sentAgency ? T.sentAg : T.sentInd}</Done>
            <Button onClick={done}>{T.done}</Button>
          </>
        ) : f.step === 'code' ? (
          <>
            <div className="rb-sent">
              <span>{T.codeSent(last3)}</span>
              <button type="button" className="rb-linkbtn" onClick={f.changeNumber}>{T.changeNumber}</button>
            </div>
            <OtpBoxes id={f.codeId} value={f.code} onChange={f.setCode} error={codeError || undefined} label={T.otpGroup} />
            <Button size="lg" onClick={() => send(f.code)} disabled={f.sending || f.code.length !== 6}>{agency ? T.verifyAg : T.verifyInd}</Button>
            <div className="rb-resend" aria-live="polite">
              {f.resendIn > 0 && f.pending !== 'resend'
                ? <span>{T.resendIn(String(f.resendIn).padStart(2, '0'))}</span>
                : <button type="button" className="rb-linkbtn" onClick={() => send('')} disabled={f.sending}>{T.resend}</button>}
            </div>
          </>
        ) : (
          <>
            {wa && (
              <a className="rb-walead" href={wa} target="_blank" rel="noopener" data-rb-wa="apply_form" data-rb-label="Apply on WhatsApp">
                <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={WHATSAPP_GLYPH} /></svg>
                <span>{T.waFormLead} <strong>{T.waFormCta}</strong></span>
              </a>
            )}
            <div className="rb-applyas" role="radiogroup" aria-label={T.applyingAs}>
              <span className="rb-label">{T.applyingAs}</span>
              <div className="rb-applyas__cards">
                <TypeCard checked={!agency} onPick={() => pick('individual')} name={T.indTitle} sub={T.indSub} />
                <TypeCard checked={agency} onPick={() => pick('agency')} name={T.agTitle} sub={T.agSub} />
              </div>
            </div>
            {agency ? (
              <>
                <Input label={T.agencyName} placeholder={T.agencyPh} {...field('agency')} />
                <Input label={T.contactPerson} placeholder={T.contactPh} {...field('name')} />
              </>
            ) : (
              <Input label={T.fullName} placeholder={T.fullNamePh} {...field('name')} />
            )}
            <PhoneField id="apply-phone" value={values.phone} error={errorOf('phone')} label={T.mobile} placeholder={T.mobilePh} invalid="phoneInvalid"
              onChange={(v) => set('phone', v)}
              onError={() => { leave('phone'); track('phone_invalid', { form: 'buddy', type }); }} />
            {!agency && <Input label={T.licence} placeholder="PB01 20110012345" {...field('licence')} />}
            <Input label={agency ? T.cityAg : T.cityInd} placeholder="Mohali" autoComplete="address-level2" {...field('city')} />
            {agency && (
              <>
                <div className="rb-applyfleet" role="group" aria-label={T.fleetAria}>
                  <span className="rb-label">{T.fleet}</span>
                  <div className="rb-chips">
                    {FLEET.map((c) => <Chip key={c} selected={fleet === c} onClick={() => setFleet(fleet === c ? '' : c)}>{c}</Chip>)}
                  </div>
                </div>
                <Input label={T.email} type="email" placeholder="name@agency.in" autoComplete="email" {...field('email')} />
                <Input label={T.gstin} placeholder="03ABCDE1234F1Z5" maxLength={15} {...field('gstin', {
                  onChange: (e) => set('gstin', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)),
                })} />
              </>
            )}
            <div className="rb-consent">
              <label htmlFor="apply-consent">
                <input id="apply-consent" type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setFormTrouble(null); }} />
                <span>
                  {agency ? T.consentAg : T.consentInd} {T.agreeA}{' '}
                  <a href={PRIVACY} target="_blank" rel="noopener">{T.privacy}</a> {T.and}{' '}
                  <a href={TERMS} target="_blank" rel="noopener">{T.terms}</a>{T.agreeB}
                </span>
              </label>
            </div>
            <Honeypot ref={honeypot} />
            {formTrouble && <span className="rb-form-error" role="alert">{codeTrouble(T, formTrouble)}</span>}
            <Button size="lg" onClick={() => send('')} disabled={!ready || f.sending}>{T.getOtp}</Button>
            <p className="rb-help">{T.verifyNote}</p>
          </>
        )}
      </div>
    </Dialog>
  );
}
