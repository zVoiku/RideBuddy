# Starting prompt for the website session

Paste the block below into a new chat. If that chat has access to the
`zVoiku/RideBuddy` repo, it can read `docs/WEBSITE_CONTEXT.md` directly and you
only need the short version. If it does not, paste the full contents of
`WEBSITE_CONTEXT.md` after the prompt.

---

## Short version — when the new session can read the repo

```
I'm building the public marketing website for RideBuddy.

Full context is in the repo at docs/WEBSITE_CONTEXT.md — read it first. It
covers the product, the locked pricing (Rate Table v1.7), brand tokens,
vocabulary, what's actually shipped, and what must not be claimed.

Two warnings from that file worth repeating: memory/PRD.md is stale and wrong
about branding and pricing — ignore it. And backend/server.py is the source of
truth for any number.

Before writing code, ask me:
- Stack (Next.js / Astro / something else)
- Where it lives (new repo, or a website/ folder in this monorepo)
- Which pages, and whether a live fare calculator is in scope
- Whether we're launching with a waitlist or app-store links (the apps are dev
  builds only right now, so there's nothing to link to yet)

Then propose a plan before building.
```

---

## Long version — when the new session cannot read the repo

Paste this, then the entire contents of `docs/WEBSITE_CONTEXT.md` underneath it.

```
I'm building the public marketing website for RideBuddy, a service where car
owners hire a vetted driver to drive their own car.

The apps and backend already exist and are shipped; the website does not — this
is greenfield. Below is a context document generated from the working codebase:
product model, locked pricing, brand tokens, vocabulary, what's real vs mocked,
and a list of claims we must not make. Every fare figure in it is asserted by
tests in the backend, so treat those numbers as exact.

Read it, then ask me about stack, hosting location, page list, and whether a
live fare calculator is in scope, before proposing a plan.

--- CONTEXT DOCUMENT FOLLOWS ---

[paste docs/WEBSITE_CONTEXT.md here]
```

---

## Things you'll likely be asked, worth deciding beforehand

**Stack.** Nothing constrains it. The apps are Expo but a marketing site has no
reason to be. Next.js if you want the fare calculator server-side and good SEO
control; Astro if it's mostly static content.

**Where it lives.** A new repo keeps deploy simple. A `website/` folder in the
monorepo keeps the brand tokens and the backend in one place — but the monorepo
is deliberately not an npm workspace, so it would be its own npm project.

**Fare calculator.** `POST /api/bookings/estimate` already implements the whole
rate table, but requires a customer JWT. Exposing it to a browser needs a
public, unauthenticated variant on the backend — a small job, but a backend
change, not a website one.

**Call to action.** There is nothing to download yet: both apps are 7-day
sideloaded dev builds, not on any store. So the CTA is realistically a waitlist,
a phone number, or a "become a Buddy" form until TestFlight or a store listing
exists.

**Buddy recruitment.** Probably the highest-value page you can build early. The
economics are genuinely attractive and you can state them honestly: at launch a
Buddy keeps ₹1,079 of a ₹1,199 trip day, plus 100% of food, stay and night
allowances.
