# RideBuddy Design System

> **"Your car. Your comfort. A Buddy you can trust."**

RideBuddy is an app-based **Driver-as-a-Service** platform for the Chandigarh Tricity (Chandigarh + Mohali + Panchkula), India. It connects car owners with verified, trained drivers — called **Buddies** — for scheduled rides, monthly retainers, and outstation trips to hill stations like Shimla, Manali, and Kasauli. The defining distinction: **the customer rides in their own car. RideBuddy provides only the driver.**

The brand competes on **trust and reliability, not price**. Core feeling: *safe, dependable, local, tech-savvy but human — a buddy, not a stranger.*

- **Products:** RideBuddy App (customer) + Buddies App (driver). This system currently ships a UI kit for the **customer app**.
- **Stage:** Pre-revenue, early-stage startup. First-mover in Chandigarh (primary competitor DriveU is not yet operational locally).
- **Primary segment (MVP):** Outstation travellers — families and professionals heading to the hills.

---

## Sources this system was built from

All inputs live in `/uploads` (kept for reference; assume the reader may not have them):

| Source | What it gave us |
|---|---|
| `RideBuddy Company Dossier.md` | Business model, ICP, competition, brand voice anchors |
| `RideBuddy_Design_Tokens.css` | **Canonical** tokens — color, spacing, radius, shadow, motion, z-index |
| `RideBuddy_UI_Component_Library.css` | 15 component specs (the basis for our React primitives) |
| `RideBuddy_BrandKit_Section3/4/5_*.md` | Component handoff, photography & imagery rules, brand voice |
| `RideBuddy_Visual_Foundations.pptx` | Color palette, logo system description, type scale |
| `RideBuddy_Design_Tokens.pptx` | Token reference deck |
| `ridebuddy-design-kit.md` | ⚠️ **DEPRECATED** — teal `#02929a` + Plus Jakarta Sans. This is the *old* brand and is **not used**. |

> ⚠️ **Palette correction.** An earlier kit (`ridebuddy-design-kit.md`) used a teal/cyan palette and Plus Jakarta Sans. The Brand Kit (Sections 1–5) explicitly **deprecates teal** ("previous brand palette") in favour of **Trail Green**. This system follows the Brand Kit. Ignore the teal kit.

---

## Content fundamentals (voice & copy)

The voice is **confidence**: *"You've made the smart choice."* The customer should feel smart and in control — never reassured (reassurance implies doubt existed).

- **Register:** Conversational but polished — a sharp, well-spoken friend. Contractions are fine. No stiffness, no slang, never talks down.
- **Point of view:** **"You"-first, always.** The brand stays invisible. ✅ "Your Buddy is confirmed." ❌ "We've confirmed your Buddy."
- **Driver naming:** **Buddy** — capital B, always. Never "driver", "captain", or "partner".
- **Headlines:** Short. Declarative. Full stops for rhythm. *"Your trip. Handled." · "Verified. Trained. Ready." · "Shimla, without the stress."*
- **CTAs:** Verb-first, specific. *"Book a Buddy", "Get Estimate", "Confirm & Pay ₹2,400".* Never append "now". Never "Submit". Always show the ₹ amount on payment CTAs.
- **Specificity over vagueness:** "Buddy arrives in 12 minutes," not "arriving soon." Real numbers, every time.
- **Understated at peaks:** "Trip confirmed." / "All set." — never "Amazing! You're booked!"

**Hard bans (no exceptions):** ❌ Exclamation marks (anywhere, ever) · ❌ filler affirmations ("Great!", "Awesome!", "Perfect!") · ❌ hedging ("We'll try…", "should be…") · ❌ feature-led copy (lead with outcome) · ❌ urgency/scarcity ("Only 2 left!").

**Emoji:** Not in product UI. One functional ✓ checkmark is permitted on WhatsApp booking confirmations only.

---

## Visual foundations

**Color.** Trail Green `#4A5C2F` is the primary brand color, on a warm **Parchment** `#F5F0E8` base with **Charcoal** `#1E1E1A` text. A 7-stop Trail Green tint scale (50→900) carries fills, hovers, and accents. Semantic colors: Success `#2E7D32`, Warning `#E65100`, Error `#C62828`, Info `#1565C0`. Status badges use soft tinted backgrounds with darker text. The whole palette is **warm and earthy** — never teal, never cool.

**Type.** **Urbanist** (700/800) for display, headings, the logo wordmark, and emphasis (trip cities, fares, names). **DM Sans** (400/500) for body, UI labels, captions, and meta. Scale: Display 40 · H1 28 · H2 22 · H3 18 · Title 16 · Body 15 · UI 14 · Label 13 · Caption 12 · Overline 10. *(The source PPTX substitutes Trebuchet MS / Calibri only because those are PowerPoint-safe — the real fonts are Urbanist + DM Sans, loaded from Google Fonts.)*

**Spacing.** 4px base unit, generous steps (4 → 64). The generosity is intentional: it makes the UI feel calm and spacious for an anxious-about-the-trip user.

**Radius.** Unified at **12px** (`--radius-lg`) for cards, buttons, and inputs — softly rounded, Airbnb-warm, never childish. 4px for chips/badges, 16px for bottom sheets, full for pills and avatars.

**Backgrounds.** Solid and calm. App background is green-50; surfaces are white; inputs sit on parchment. The Home header is a solid Trail Green band (content flows beneath on white). **No gradients in product UI**, no busy textures, no patterns. (The only gradient in this repo is the dark stage behind the phone mock, which is presentation chrome, not product.)

**Cards.** White surface · 12px radius · soft `--shadow-md` · a 0.5px hairline border (`rgba(100,100,100,.1)`). Accent cards use a flat green-50 fill with no shadow. Detail values sit in soft `#F7F7F5` pill chips.

**Shadows / elevation.** Cool-grey, soft, diffused — *gently elevated, never dramatic.* Five steps (0/sm/md/lg/xl); `md` is the default for cards. Shadows imply calm lift, not drama.

**Borders.** Hairlines are `0.5px` and very low-contrast. Controls (chips, unselected cards) use `1.5px` borders; selection swaps the border to Trail Green plus a green-50 fill.

**Motion.** Calm and flowing — *"like a deep breath, not a snap."* **No spring, no bounce.** Durations 150/250/350ms (+300 enter / 200 exit — exits are slightly faster). Easing: `--ease-calm` cubic-bezier(.25,.46,.45,.94) is the signature for tab fades; `--ease-enter` decelerates sheet entries. Tabs cross-fade; bottom sheets slide up and settle; buttons tap with a subtle `scale(0.98)`.

**Interaction states.** Hover: darker green fill (primary) or green-50 wash (secondary/cards) + a soft shadow. Press: darkest green (primary) and a 0.98 scale-down. Focus: a 3px Trail Green glow ring (`rgba(74,92,47,.18)`). Disabled: 45% opacity.

**Transparency & blur.** Used sparingly — scrims behind bottom sheets are `rgba(30,30,26,.5)`; header icon buttons use `rgba(255,255,255,.18)` over the green band. No frosted-glass blur in product UI.

**Imagery.** Warm golden-hour grade (greens + ambers). The Buddy is the hero (smart-casual navy polo + badge) beside the customer's own car; outstation/hill-station settings. Car photos: 3/4 exterior on neutral grey. Placeholders: car silhouette on green-100; Buddy avatar = initials on green-100. **Banned:** teal/cyan, stock photography, staged shots, traffic-stress imagery, competitor vehicles, subservient-driver depictions. See `guidelines/brand-photography.card.html`.

---

## Iconography

- **System:** **Lucide** (React) in product — outline, **2px stroke**, round caps and joins. Matches the warm, friendly-but-precise brand. Load from a Lucide CDN/package in production; this repo inlines a Lucide-style set in `ui_kits/customer_app/icons.jsx` and `guidelines/brand-iconography.card.html` (same geometry/stroke) so the kit is self-contained.
- **Common glyphs:** Car, MapPin, Navigation, Calendar, Clock, Phone, MessageCircle, Shield, User, CreditCard, Bell, Menu, ChevronRight, Loader.
- **Ratings** use a single **filled amber star** (`#F59E0B`) — the one intentional filled icon.
- **No emoji** as iconography in product UI. **No unicode glyphs** standing in for icons (the masked-digit "●" in license/phone fields is data masking, not an icon).
- **Logo / mark:** the "R" lettermark — the **leg becomes a road that curves into a destination pin**, with a dashed highway centre-line running along it ("the Journey mark"). It encodes the brand's core job (the outstation trip, navigated for you) in a single confident letterform. Built to stay legible down to 16px. Assets live in `assets/` as SVG (mark, parchment mark, app-icon tile). ⚠️ *A reconstruction from the written brand spec — flag for replacement with official vector artwork when available.*

---

## Index / manifest

**Root**
- `styles.css` — global entry point (import this one file). `@import`s the token + font files only.
- `readme.md` — this guide. · `SKILL.md` — Agent-Skill manifest for portable use.

**`tokens/`** — `fonts.css` (Urbanist + DM Sans via Google Fonts), `colors.css`, `typography.css`, `spacing.css` (+ radius, z-index, breakpoints), `elevation.css` (shadows + motion).

**`assets/`** — `ridebuddy-logomark.svg`, `ridebuddy-logomark-parchment.svg`, `ridebuddy-app-icon.svg`.

**`components/`** — React primitives (`.jsx` + `.d.ts` + `.prompt.md`), one `@dsCard` HTML per group:
- `core/` — **Button**, **Chip**, **Input**, **OtpInput**, **Badge**, **Card**
- `feedback/` — **Toast**, **BottomSheet**
- `navigation/` — **BottomNav**
- `booking/` — **TripTypeCard**, **CarCard**, **BuddyCard**, **TripCard**, **FareRow**

**`guidelines/`** — foundation specimen cards (Design System tab): colors (core / tints / semantic / neutrals), type (display / body), spacing (scale / radius / elevation), brand (logo / voice / iconography / photography).

**`ui_kits/customer_app/`** — interactive customer-app recreation (`index.html` + screens). See its `README.md`.

**Starting points:** Button, BuddyCard, TripCard, BottomNav (components). 

**Namespace:** components are exposed at `window.RideBuddyDesignSystem_f63581.<Name>` in card/kit HTML.
