/**
 * Become a Buddy, for drivers: in Hindi first, or English (DS04). The copy of
 * the Buddy bands (Contact and the city pages), the application pop-up
 * (apply.jsx) and the footer's link, word for word from the Phase 1 design
 * (BUDDY_COPY); the language each visitor picked, remembered in this browser;
 * and the WhatsApp way to apply, shown once there is a number to chat with.
 *
 * Plain JavaScript, no React: build.mjs renders the bands into the pages from
 * it (bandHtml), and the pages' scripts (shared/pages.jsx, estimate/app.jsx)
 * switch every [data-rb-t] text on the page to the chosen language
 * (initBuddyLang).
 *
 * The Hindi is a draft until a native speaker reviews it, and Legal approves
 * the Hindi consent (CL-03) and the band's offer (CL-05).
 */

/**
 * RideBuddy's WhatsApp number for Buddy applications: country code and
 * number, digits only ("91XXXXXXXXXX"). Empty hides every "Apply on WhatsApp".
 */
export const WHATSAPP_NUMBER = '';

/** The consent wording's version, saved with every application (the waitlist's too, until CL-03 delivers the final text). */
export const CONSENT_VERSION = 'draft-2026-10-10 (pending CL-03)';

export const LANGS = ['hi', 'en'];

export const BUDDY_COPY = {
  hi: {
    lang: 'hi',
    eyebrow: 'Buddy बनें', bandTitle: 'RideBuddy के साथ गाड़ी चलाएँ।',
    contactLine: 'पूरे उत्तर भारत में आउटस्टेशन ट्रिप, अपनी शर्तों पर।',
    cityLine: 'कोई जॉइनिंग फ़ीस नहीं। भत्ता पूरा आपको मिलेगा। पहली ट्रिप से बीमा।',
    applyBtn: 'Buddy बनने के लिए आवेदन करें', waBtn: 'WhatsApp पर आवेदन करें',
    waAria: 'WhatsApp पर Buddy बनने के लिए आवेदन करें (WhatsApp खुलेगा)',
    waFormLead: 'WhatsApp आसान लगता है?', waFormCta: 'चैट में आवेदन करें।',
    titleInd: 'Buddy बनने के लिए आवेदन करें।', titleAg: 'ड्राइवर एजेंसी के रूप में आवेदन करें।',
    subInd: 'शुरू करने के लिए बस चार जानकारी। आगे RideBuddy संभाल लेगा।',
    subAg: 'शुरू करने के लिए कुछ जानकारी। आगे की बात RideBuddy फ़ोन पर करेगा।',
    sentInd: 'आवेदन मिल गया। ऑनबोर्डिंग शुरू होने पर एक कॉल या मैसेज आएगा।',
    sentAg: 'आवेदन मिल गया। शर्तों और ड्राइवर ऑनबोर्डिंग पर बात करने के लिए RideBuddy कॉल करेगा।',
    done: 'ठीक है', close: 'बंद करें',
    applyingAs: 'आप किस रूप में आवेदन कर रहे हैं',
    indTitle: 'व्यक्तिगत Buddy', indSub: 'आप ख़ुद गाड़ी चलाते हैं।',
    agTitle: 'ड्राइवर एजेंसी', agSub: 'आप वेरिफ़ाइड ड्राइवर उपलब्ध कराते हैं।',
    fullName: 'पूरा नाम', fullNamePh: 'जैसा लाइसेंस पर लिखा है',
    agencyName: 'एजेंसी का नाम', agencyPh: 'जैसा रजिस्टर्ड है',
    contactPerson: 'संपर्क व्यक्ति', contactPh: 'पूरा नाम',
    mobile: 'मोबाइल नंबर', mobilePh: '10 अंकों का मोबाइल नंबर',
    licence: 'ड्राइविंग लाइसेंस नंबर', cityInd: 'आपका शहर या बेस', cityAg: 'शहर या बेस',
    fleet: 'आप कितने ड्राइवर दे सकते हैं (वैकल्पिक)', fleetAria: 'आप कितने ड्राइवर दे सकते हैं',
    email: 'ऑफ़िस ईमेल (वैकल्पिक)', gstin: 'GSTIN (वैकल्पिक)',
    consentInd: 'RideBuddy मेरे आवेदन के बारे में मुझसे फ़ोन, SMS या WhatsApp पर संपर्क कर सकता है।',
    consentAg: 'RideBuddy इस एजेंसी आवेदन के बारे में मुझसे फ़ोन, SMS, WhatsApp या ईमेल पर संपर्क कर सकता है।',
    agreeA: 'मैं', privacy: 'प्राइवेसी पॉलिसी', and: 'और', terms: 'उपयोग की शर्तों', agreeB: ' से सहमत हूँ।',
    getOtp: 'OTP पाएँ', verifyNote: 'आवेदन भेजने के लिए अपना नंबर वेरिफ़ाई करें।',
    codeSent: (last3) => 'कोड +91 XXXXX XX' + last3 + ' पर भेजा गया।',
    changeNumber: 'नंबर बदलें', otpGroup: '6 अंकों का कोड',
    verifyInd: 'वेरिफ़ाई करें और आवेदन भेजें', verifyAg: 'वेरिफ़ाई करें और एजेंसी आवेदन भेजें',
    resend: 'OTP दोबारा भेजें', resendIn: (ss) => '0:' + ss + ' में OTP दोबारा भेज सकते हैं',
    footerLink: 'Buddy बनें',
    wa: 'नमस्ते RideBuddy, मुझे Buddy (ड्राइवर) बनने के लिए आवेदन करना है।',
    err: {
      agency: 'एजेंसी का नाम लिखें।', nameAg: 'संपर्क व्यक्ति का पूरा नाम लिखें।', name: 'अपना पूरा नाम लिखें।',
      phoneInvalid: 'सही मोबाइल नंबर लिखें।', licence: 'अपना लाइसेंस नंबर लिखें।',
      cityAg: 'एजेंसी का शहर या बेस लिखें।', city: 'अपना शहर या बेस लिखें।',
      email: 'सही ईमेल लिखें, या इसे खाली छोड़ दें।', gstin: 'सही 15 अंकों का GSTIN लिखें, या इसे खाली छोड़ दें।',
      sendFailed: 'कोड नहीं भेज पाए। एक मिनट बाद फिर कोशिश करें।', expired: 'यह कोड एक्सपायर हो गया है। नया OTP लें।',
      tooMany: 'बहुत ज़्यादा कोशिशें हो गईं। नया OTP लें।', wrong: 'यह कोड मेल नहीं खाता। फिर कोशिश करें।',
      // Not in the design: the Worker's limits and failures (website/worker/otp.js, forms.js). Draft Hindi, for the same review.
      wait: (s) => `${s} सेकंड रुकें, फिर नया कोड माँगें।`,
      numberLimit: 'इस नंबर पर बहुत ज़्यादा कोड भेजे जा चुके हैं। एक घंटे बाद फिर कोशिश करें।',
      networkLimit: 'आपके नेटवर्क से बहुत ज़्यादा कोड माँगे गए हैं। एक घंटे बाद फिर कोशिश करें।',
      tooManyTries: 'आपके नेटवर्क से बहुत ज़्यादा कोशिशें हुई हैं। एक घंटे बाद फिर कोशिश करें।',
      saveFailed: 'आपका आवेदन सेव नहीं हो पाया। फिर कोशिश करें।',
      network: 'कनेक्ट नहीं हो पाया। अपना इंटरनेट देखें और फिर कोशिश करें।',
    },
  },
  en: {
    lang: 'en',
    eyebrow: 'Become a Buddy', bandTitle: 'Drive with RideBuddy.',
    contactLine: 'Outstation trips across North India, on your terms.',
    cityLine: 'No joining fee. Allowances paid in full to you. Insurance from your first trip.',
    applyBtn: 'Apply to be a Buddy', waBtn: 'Apply on WhatsApp',
    waAria: 'Apply to be a Buddy on WhatsApp (opens WhatsApp)',
    waFormLead: 'Prefer WhatsApp?', waFormCta: 'Apply in a chat instead.',
    titleInd: 'Apply to be a Buddy.', titleAg: 'Apply as a driver agency.',
    subInd: 'Four details to start. RideBuddy will take it from there.',
    subAg: 'A few details to start. RideBuddy will call to take it from there.',
    sentInd: 'Application received. One call or message when onboarding opens.',
    sentAg: 'Application received. RideBuddy will call to discuss terms and driver onboarding.',
    done: 'Done', close: 'Close',
    applyingAs: 'Applying as',
    indTitle: 'Individual Buddy', indSub: 'I drive myself.',
    agTitle: 'Driver agency', agSub: 'I supply verified drivers.',
    fullName: 'Full name', fullNamePh: 'As printed on your licence',
    agencyName: 'Agency name', agencyPh: 'As registered',
    contactPerson: 'Contact person', contactPh: 'Full name',
    mobile: 'Mobile number', mobilePh: '10-digit mobile',
    licence: 'Driving licence number', cityInd: 'Your city or base', cityAg: 'City or base',
    fleet: 'Drivers you can supply (optional)', fleetAria: 'Drivers you can supply',
    email: 'Work email (optional)', gstin: 'GSTIN (optional)',
    consentInd: 'RideBuddy can contact me by phone, SMS or WhatsApp about my application.',
    consentAg: 'RideBuddy can contact me by phone, SMS, WhatsApp or email about this agency application.',
    agreeA: 'I agree to the', privacy: 'Privacy Policy', and: 'and', terms: 'Terms of Use', agreeB: '.',
    getOtp: 'Get OTP', verifyNote: 'Verify your number to submit the application.',
    codeSent: (last3) => 'Code sent to +91 XXXXX XX' + last3 + '.',
    changeNumber: 'Change number', otpGroup: '6-digit code',
    verifyInd: 'Verify & Submit Application', verifyAg: 'Verify & Submit Agency Application',
    resend: 'Resend OTP', resendIn: (ss) => 'Resend OTP in 0:' + ss,
    footerLink: 'Become a Buddy',
    wa: 'Hi RideBuddy, I want to apply as a Buddy (driver).',
    err: {
      agency: 'Enter the agency name.', nameAg: 'Enter the contact person’s full name.', name: 'Enter your full name.',
      phoneInvalid: 'Enter a valid mobile number.', licence: 'Enter your licence number.',
      cityAg: 'Enter the agency’s city or base.', city: 'Enter your city or base.',
      email: 'Enter a valid email, or leave it blank.', gstin: 'Enter a valid 15-character GSTIN, or leave it blank.',
      sendFailed: 'Couldn’t send the code. Try again in a minute.', expired: 'This code has expired. Get a new OTP.',
      tooMany: 'Too many attempts. Get a new OTP.', wrong: 'That code doesn’t match. Try again.',
      wait: (s) => `Wait ${s} seconds, then ask for a new code.`,
      numberLimit: 'Too many codes for this number. Try again in an hour.',
      networkLimit: 'Too many codes from your network. Try again in an hour.',
      tooManyTries: 'Too many tries from your network. Try again in an hour.',
      saveFailed: 'Couldn’t save your application. Try again.',
      network: 'Couldn’t connect. Check your connection and try again.',
    },
  },
};

/** The whole consent line, as the visitor read it: who may contact them, and the policies they agree to. */
export const consentText = (T, agency) => `${agency ? T.consentAg : T.consentInd} ${T.agreeA} ${T.privacy} ${T.and} ${T.terms}${T.agreeB}`;

/** "Apply on WhatsApp", with the message ready to send in the visitor's language; '' while there is no number. */
export const whatsappUrl = (lang) => (WHATSAPP_NUMBER ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(BUDDY_COPY[lang].wa)}` : '');

// ----- The visitor's language ----------------------------------------------------

const KEY = 'rb_buddy_lang';
const CHANGED = 'rb-buddy-lang';

/** Hindi unless this browser chose English. */
export function getBuddyLang() {
  try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'hi'; } catch (e) { return 'hi'; }
}

const push = (event, payload) => (window.dataLayer = window.dataLayer || []).push({ event, ...payload });

/** Switches the page, the pop-up and every page after to `lang`, and remembers it. */
export function setBuddyLang(lang) {
  if (!LANGS.includes(lang) || lang === getBuddyLang()) return;
  try { localStorage.setItem(KEY, lang); } catch (e) { /* not remembered: this page still switches */ }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: lang }));
  push('buddy_language_changed', { language: lang });
}

/** Calls `fn(lang)` whenever the language changes, here or in another tab; returns the unsubscribe. */
export function onBuddyLang(fn) {
  const here = (e) => fn(e.detail);
  const there = (e) => { if (e.key === KEY) fn(getBuddyLang()); };
  window.addEventListener(CHANGED, here);
  window.addEventListener('storage', there);
  return () => { window.removeEventListener(CHANGED, here); window.removeEventListener('storage', there); };
}

/**
 * The page in `lang`: each [data-rb-t] element's text (and [data-rb-t-aria]'s
 * label) from BUDDY_COPY, each [data-rb-lang-scope]'s lang, the toggles'
 * pressed button, and the WhatsApp links' message.
 */
export function applyBuddyLang(lang) {
  const T = BUDDY_COPY[lang];
  document.querySelectorAll('[data-rb-t]').forEach((el) => { el.textContent = T[el.getAttribute('data-rb-t')]; });
  document.querySelectorAll('[data-rb-t-aria]').forEach((el) => el.setAttribute('aria-label', T[el.getAttribute('data-rb-t-aria')]));
  document.querySelectorAll('[data-rb-lang-scope]').forEach((el) => el.setAttribute('lang', lang));
  document.querySelectorAll('[data-rb-set-lang]').forEach((el) => el.setAttribute('aria-pressed', String(el.getAttribute('data-rb-set-lang') === lang)));
  document.querySelectorAll('a[data-rb-wa]').forEach((el) => el.setAttribute('href', whatsappUrl(lang)));
}

/** The page body's name for itself (body[data-page]): where a WhatsApp tap came from. */
const pageName = () => document.body.getAttribute('data-page') || '';

/**
 * Once per page: the page in the remembered language, its toggles working, and
 * the WhatsApp taps counted (buddy_whatsapp_clicked, with where: the band or
 * the form). The pop-up (apply.jsx) has toggles of its own and follows along.
 */
export function initBuddyLang() {
  applyBuddyLang(getBuddyLang());
  onBuddyLang(applyBuddyLang);
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element && e.target.closest('[data-rb-set-lang], a[data-rb-wa]');
    if (!el) return;
    if (el.hasAttribute('data-rb-set-lang')) setBuddyLang(el.getAttribute('data-rb-set-lang'));
    else push('buddy_whatsapp_clicked', { source: el.getAttribute('data-rb-wa'), page: pageName(), language: getBuddyLang() });
  });
}

// ----- The bands, as build.mjs writes them into the pages ---------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ARROW = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

/** WhatsApp's glyph, in the colour of the text around it. */
export const WHATSAPP_GLYPH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z';
const glyph = `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="${WHATSAPP_GLYPH}"/></svg>`;

/** The हिंदी | English switch: a band's, and (in React) the pop-up's. */
export function toggleHtml(lang = 'hi') {
  const btn = (l, label) => `<button type="button" lang="${l}" aria-pressed="${l === lang}" data-rb-set-lang="${l}" data-rb-label="Language: ${l === 'hi' ? 'Hindi' : 'English'}">${label}</button>`;
  return `<div class="rb-langtoggle" role="group" aria-label="भाषा / Language">${btn('hi', 'हिंदी')}${btn('en', 'English')}</div>`;
}

/**
 * The "Become a Buddy" band, in Hindi until the page's script switches it:
 * `contact` (the Contact page: an eyebrow, the line about trips, a filled
 * button) or `city` (a city page: the offer line, an outlined button). Its
 * buttons keep English names for the analytics (data-rb-label).
 */
export function bandHtml(variant, screenLabel) {
  const T = BUDDY_COPY.hi;
  const city = variant === 'city';
  const line = city ? 'cityLine' : 'contactLine';
  const wa = WHATSAPP_NUMBER
    ? `\n      <a class="rb-btn rb-btn--wa" href="${esc(whatsappUrl('hi'))}" target="_blank" rel="noopener" data-rb-wa="${city ? 'city_buddy_band' : 'contact_band'}" aria-label="${esc(T.waAria)}" data-rb-t-aria="waAria" data-rb-label="Apply on WhatsApp">${glyph}<span data-rb-t="waBtn">${esc(T.waBtn)}</span></a>`
    : '';
  return `<section class="rb-buddyband rb-buddyband--${variant}" data-screen-label="${esc(screenLabel)}" lang="hi" data-rb-lang-scope>
  <div class="rb-wrap rb-buddyband__in">
    <div class="rb-buddyband__text">
      ${toggleHtml('hi')}${city ? '' : `\n      <span class="rb-eyebrow" data-rb-t="eyebrow">${esc(T.eyebrow)}</span>`}
      <h2 data-rb-t="bandTitle">${esc(T.bandTitle)}</h2>
      <p data-rb-t="${line}">${esc(T[line])}</p>
    </div>
    <div class="rb-buddyband__ctas">
      <button type="button" class="rb-btn ${city ? 'rb-btn--outline' : 'rb-btn--primary'}" data-rb-apply data-rb-label="Apply to be a Buddy"><span data-rb-t="applyBtn">${esc(T.applyBtn)}</span>${ARROW}</button>${wa}
    </div>
  </div>
</section>`;
}
