# RideBuddy Website — Claude Design Handoff
**Version:** 1.0 · **Last Updated:** August 2026
**Prepared by:** Claude (claude.ai) · **Approved by:** RideBuddy Founder (Avi)
**Handoff target:** Claude Design (or any design/build agent) — MVP marketing website
**Governing spec:** `RideBuddy_Website_Concept.md` **v2.2** (attached — read it in full before producing anything)

---

## 1. Your Mission

Design and build the RideBuddy MVP marketing website exactly as specified in `RideBuddy_Website_Concept.md` v2.2. The concept phase is **complete and locked** — every structural, content, and conversion decision has been made through a founder interview process. Your job is execution: visual design, layout, responsive build, and a working fare estimator. **You are not being asked to re-decide anything.**

**The one-line brief:** A warm, photo-forward, four-page site whose centrepiece is a live Trip Fare Estimator — the site's primary conversion event is a completed estimate; app downloads activate later via a phase flag.

---

## 2. Required Input Files

Do not begin without all of these in context:

| File | Role |
|---|---|
| `RideBuddy_Website_Concept.md` (v2.2) | **The governing spec.** Page-by-page structure, copy, estimator logic, phasing. |
| `RideBuddy_Design_Tokens.css` | All spacing, radius, shadow, motion, breakpoint, z-index values. Import as-is. |
| `RideBuddy_UI_Component_Library.css` | App component patterns — reuse for the estimator, cards, chips, buttons, badges. |
| `RideBuddy_BrandKit_VisualFoundations_AgentContext.md` | Colors, typography, logo system and usage rules. |
| `RideBuddy_BrandKit_Section4_Photography.md` | Hero imagery specs, AI image prompts, no-go list, photo checklist. |
| `RideBuddy_BrandKit_Section5_BrandVoice.md` | Voice rules, banned language, CTA conventions, channel density. |
| Rate Table & Fare Estimation Logic v1.7 *(Google Doc, founder's Drive)* | Fare engine source of truth. Formulas and display rules are reproduced in the concept spec §4.2 — if anything conflicts, the Rate Table wins. |

---

## 3. Non-Negotiable Directives

These are locked founder decisions. Do not override, soften, or "improve" them.

### Brand & Visual
1. **Palette:** Trail Green `#4A5C2F` as accent only · Parchment `#F5F0E8` base surface · Charcoal `#1E1E1A` for text and dark bands. Semantic colors per token file. **No teal, cyan, or cool blue anywhere** — including imagery grade.
2. **Typography:** Urbanist 700 (headings) + DM Sans 400/500 (body), Google Fonts. Web hero Display may extend to 56–64px desktop / 36–40px mobile; all other sizes per the brand type scale.
3. **Tokens are law:** 4px spacing base, radius-lg (12px) default on cards/buttons/inputs, cool-grey soft shadows, calm motion (150–350ms, no spring, no bounce, no parallax, no autoplay video).
4. **Logo:** use approved variants only, per Visual Foundations usage rules. Never on busy imagery, never recolored, never shadowed.
5. **Imagery:** golden-hour warm grade, Buddy as hero, customer's own car present, per Section 4. Generate placeholders with the Section 4.4 prompts. Every image must pass the Section 4.5 checklist. Hard bans: stock feel, staged poses, traffic/stress, competitor branding, subservient Buddy posture.
6. **Visual character:** photo-forward warm — large imagery on Parchment, generous whitespace, Airbnb-register, never utility-cold, never playful.

### Voice & Copy
7. All copy in the concept spec is **approved copy** — use it verbatim unless marked *(draft — founder to approve)*.
8. Voice hard bans (Section 5, zero exceptions): **no exclamation marks · no filler affirmations ("Great!", "Perfect!") · no hedging ("should", "we'll try") · no feature-led copy · no urgency/scarcity tactics.**
9. "**Buddy**" — capital B, always. Never "driver" in customer-facing copy except where the concept spec explicitly uses it for clarity.
10. CTAs verb-first and exact: `Get an Estimate` · `Get Estimate` · `Message me when booking opens` · `Apply to be a Buddy`. Never append "now."

### Structure & Conversion
11. **Four pages exactly:** Home · How It Works · About · Contact. Home stack: Promise → Estimate → Model → Trust → Services → Recruit → CTA.
12. **Hero:** mountain-road image, headline `Your car. Your comfort. A Buddy you can trust.`, single CTA `Get an Estimate` scrolling to the estimator. No store badges in the hero at Phase 1.
13. **Services = outstation only:** two cards — Round Trip (lead) + One Way ("Drop & Return" / "Reach & Drive" copy). One quiet grey footer line: `Monthly and scheduled Buddies — coming soon.` Nothing more.
14. **No forms anywhere** except the single optional WhatsApp field in the estimator's post-estimate panel. No contact form, no waitlist, no newsletter.
15. **Phase flag:** build both post-estimate states now — Phase 1 (WhatsApp capture + greyed `App coming soon` badges) and Phase 2 (active store badges, `Book this trip in the app.`) — switched by one config flag that also swaps the nav button, footer, and final CTA band.

### The Estimator (the build's heart — concept spec §4.2)
16. **Inputs, in order:** Trip type chips (Round Trip default / One Way) → Pickup (Tricity-biased Places autocomplete) → Destination (free text + quick chips: Shimla · Manali · Kasauli · Dharamshala · Delhi) → Dates (return date appears for Round Trip) → Pickup time → Stay question (Round Trip only, default **No** = stay included). **No car type input.**
17. **Math:** implement both formulas exactly as written in §4.2, from a shared rate-variable JSON (`per_day_rate: 1199`, `overage_per_km: 3.99`, `return_per_km: 0.99`, `food_per_day: 299`, `night_charge: 249`, `stay_per_night: 499`, `daily_km_inclusion: 300`, `daily_hour_inclusion: 12`, `night_start: 22:00`, `night_end: 06:00`). **Never hardcode a rate.** Distance and drive time from Google Distance Matrix.
18. **QA parity — the build fails if these don't match:** Chandigarh → Shimla one-way, 1 day, no night trigger = **₹1,612** · → Delhi = **₹1,746** · → Manali = **₹1,795** · Chandigarh → Manali round trip, 3 days, stay = No = **₹5,492**.
19. **Result display:** single amount `Estimated fare · ₹X,XXX` (Display size, Trail Green) + conditions list + verbatim variance notice `Final fare is calculated when your trip ends.` **Never show a component breakdown** — this is a locked Rate Table display rule, not a style choice.
20. **Specificity rule:** the fare always renders as a full, exact rupee figure. Never a range, never "approx," never rounded to "₹1,600+."

---

## 4. Suggested Build Order

1. **Foundation** — import both CSS files, set up fonts, page shells, nav + footer, phase flag.
2. **Estimator widget** — inputs → calculation → result state → both post-estimate panel states. Verify the four QA parity fares before styling further.
3. **Home page** — hero (generate imagery via Section 4.4 prompts), then remaining sections top to bottom.
4. **How It Works** — journey timeline (route-visualizer motif), app mockups built from the component library (never generic placeholder phones), FAQ accordion.
5. **About + Contact** — shortest pages last.
6. **Responsive pass** — 375px first-class, then 430 / 768 / 1280. Estimator single-column on mobile with native pickers.
7. **Checklist pass** — §7 below.

---

## 5. Open Items — How to Handle Them

Seven items remain open (concept spec §11). None block design. Handle as follows:

| # | Item | Your action |
|---|---|---|
| 1 | Stay-question default (spec'd: No = stay included) | Build as spec'd; flag for founder confirmation in your handback |
| 2 | Day-counting edge case (>12 hrs, <300 km) | Build per §4.2 rules as written; note the pending fare-engine decision in code comments |
| 3 | WhatsApp capture backend | Build the front-end field + success state; stub the endpoint; list tooling options in handback |
| 4 | Hero sub-line wording | Use the draft in §4.1; mark as draft in handback |
| 5 | Buddy application destination | Link to `#` placeholder; flag |
| 6 | Support email + phone | Use `support@ridebuddy.in` placeholder + phone placeholder; flag |
| 7 | Grievance line on About | Use draft wording; flag |

**Rule:** placeholders are fine; silent invention is not. Anything you placeholder must appear in your handback list.

---

## 6. What NOT to Do

- Do not add pages, sections, testimonials, stats, pricing tables, chat widgets, pop-ups, or cookie-banner theatrics beyond legal necessity.
- Do not redesign the estimator flow, reorder its inputs, or add a breakdown view.
- Do not invent copy for high-stakes surfaces (hero, estimator conditions, FAQ answers) — draft-marked copy is the only editable copy, and edits must stay inside the Section 5 voice rules.
- Do not use stock photography or generic device mockups.
- Do not introduce a second conversion path (no "Call us to book," no WhatsApp booking CTA).
- Do not ship active store badges in Phase 1.

---

## 7. Definition of Done

- [ ] All four pages built, responsive at 375 / 430 / 768 / 1280
- [ ] Estimator produces the four QA parity fares exactly
- [ ] Both phase states functional behind one flag
- [ ] All copy matches the concept spec; draft items flagged
- [ ] Imagery generated from Section 4.4 prompts and passing the Section 4.5 checklist
- [ ] Zero voice violations (search the build for `!`, "Great", "Awesome", "should", "hurry", "only X left")
- [ ] Tokens used throughout — no hardcoded colors, radii, shadows, or durations
- [ ] Analytics events wired: estimator opened · estimate completed · WhatsApp number submitted
- [ ] Handback list delivered: placeholders used, draft copy pending, tooling recommendations for WhatsApp capture

---

## 8. Working With the Founder

Avi works interview-first: if a genuine ambiguity arises that the concept spec doesn't resolve, **ask one question at a time, offer 2–4 concrete options, and always mark your recommended option with rationale.** He makes fast, decisive calls. Do not batch ten questions, and do not proceed silently on anything that contradicts a locked decision.

---

*End of handoff. The concept spec (v2.2) travels with this document — together they are the complete brief.*
