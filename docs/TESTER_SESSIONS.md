# Autoflex tester sessions — a runnable kit

This is everything needed to run a real-user session on Autoflex and route what
you learn back into the product owner → designer → backend → frontend → QA →
real-user loop. It is written to be handed to whoever is free, not just to
whoever wrote the feature.

One session is ~45 minutes: 5 min setup, ~30 min tasks, 10 min closing.
Run at least 6 sessions before treating a pattern as real.

---

## 1. Who to recruit

Recruit for **ownership reality**, not for enthusiasm about apps.

| Segment | What they prove | Target per round |
| --- | --- | --- |
| Daily owners (car is transport, 3+ years owned) | Whether Garage, service history and running costs are worth the typing | 3 |
| Enthusiasts (follow models, read reviews, mod or track their car) | Whether community notes and playbooks are credible, and whether they'll post | 2 |
| Active buyers (shortlisting right now, budget decided or close) | Whether Shortlist, Compare, inspection checks and state pricing change a real decision | 3 |

Spread across:

- **Cities:** at least three, including one metro (Delhi NCR / Mumbai /
  Bengaluru) and one tier-2 (Indore, Kochi, Coimbatore, Jaipur, Guwahati…).
  City coverage is the whole point of city circles.
- **Devices:** majority **Android**, mid-range and 3+ years old included. At
  most one iPhone per round. At least one participant on a **slow or metered
  connection** (throttle to Slow 3G if their real connection is fast).
- **Fluency:** at least one participant who is not comfortable in English-first
  interfaces, and one who has never installed a PWA.

Do not recruit colleagues, their families, or anyone who has seen the build.

---

## 2. Pre-session setup

**Before they arrive**

- [ ] Confirm the production URL loads on a fresh browser profile.
- [ ] Prepare **dummy documents** (a plain PDF and a photo named
      `sample-rc.pdf`, `sample-insurance.jpg`) and have them ready to send.
- [ ] Prepare a demo vehicle and a demo shortlist entry you can describe out
      loud, so participants never need real details to get started.
- [ ] Have the finding log open (section 5) with the participant code
      (`P-07`, never their name) already filled in.
- [ ] Decide who observes: one facilitator who talks, one note-taker who does
      not. Never two people talking.

**With the participant, before task 1**

- [ ] **Use their own device**, their own browser, their own network. Do not
      hand them a test phone; the point is to see their real conditions.
- [ ] Explain: "We're testing the product, not you. If something is confusing,
      that's a defect we need to find. Please think out loud."
- [ ] **Screen recording only with explicit permission**, asked out loud and
      recorded in the log. If they hesitate, don't record — take notes instead.
      Never record their face or their notification shade.
- [ ] **Never ask for real RC, licence, insurance or service documents.** If
      they offer, decline and hand them the dummy files. If they upload a real
      document anyway, stop (see section 6).
- [ ] Tell them the data they enter is stored on their own device and how to
      clear it at the end (Settings → clear local data). Offer to do it with
      them.
- [ ] Confirm they can stop at any point, for any reason, with no explanation.

---

## 3. Observation tasks

Give the *goal*, never the *path*. If they stall for 90 seconds, note it as a
blocker, then unblock with the smallest possible hint and keep going.

| # | Task (say this) | Watching for |
| --- | --- | --- |
| 1 | "This is a new app for car owners. Look at this screen and tell me what you think it does and who it's for." | First-run comprehension. Do they say "owner notes / my car" or "another car review site"? |
| 2 | "Set yourself up so the app is useful to you." | Whether the starter route is discoverable without instruction. Does the lightweight profile flow feel sufficient, or do they hunt for Google sign-in? |
| 3 | "Add the car you drive, and record the last service you remember." | Garage + timeline entry. Do they know the fields? Do they abandon at odometer or purchase month? |
| 4 | "You want to know what this car will cost you to run over the next year." | Whether analytics/running costs are found and believed. Do they trust a number built from their own two entries? |
| 5 | "Find out what usually goes wrong with this model and what owners did about it." | KYV and Know-Your-Vehicle → community evidence. Is "Known issue" vs "Fix" understood? |
| 6 | "Keep your car papers somewhere you'd find them in a hurry." (hand over the dummy files) | Document vault. Do they understand the files stay on their device? Watch for any hesitation that means they don't trust it. |
| 7 | "Find what owners in your city are saying about a car you're curious about." | Community search, filters, city circles. Does search return something useful on the first query? |
| 8 | "Write down something you learned running your car that you'd tell another owner." | Composer. Do they post? Where do they stop? Does the quality prompt help or nag? |
| 9 | "You're choosing between two cars. Work out which one you'd actually buy." | Shortlist + Compare + inspection checks. Does the comparison change their stated pick? |
| 10 | "You'd like a friend to see one of these notes / this car. Send it to them." | The share ladder end to end: native sheet, clipboard fallback, and whether the link that arrives looks like a real page with a real preview. |
| 11 | "You saw a price for this car. Does it match what you'd pay where you live?" | State pricing. Do on-road numbers match their expectation for their RTO? |
| 12 | "Would you open this again next week? What would bring you back?" | Return-visit intent, stated *and* explained. "Yes it's nice" is not a yes. |

---

## 4. What to record per task

For every task, capture five things — nothing more, so it stays fast:

1. **Outcome:** completed unaided / completed with a hint / abandoned.
2. **Time to first correct action** (roughly; a stopwatch is not needed).
3. **The exact words they used** for the thing they were looking for. Their
   vocabulary is the label copy we should be shipping.
4. **Every hesitation over 5 seconds**, and where their finger hovered.
5. **One quote**, verbatim, that captures how they felt about the task.

Also log, once per session: device and OS, connection quality, whether the app
was installed to the home screen, and anything that broke visually at their
screen width.

Mark each finding with a severity as you write it:

- **S1 — data loss or trust breach.** Stop-rule territory (section 6).
- **S2 — task blocked.** They could not finish without a hint.
- **S3 — friction.** They finished but were slowed or annoyed.
- **S4 — preference.** They'd like it different; nothing is broken.

---

## 5. Closing questions

Ask all six; do not lead.

1. "In your own words, what is this app for?"
2. "What would you use it for first, if we gave it to you today?"
3. "What here would you not trust with your own information, and why?"
4. "What was the most annoying moment in the last half hour?"
5. "If this disappeared tomorrow, what would you miss — if anything?"
6. "Who else you know would use this? What would you tell them it does?"

Then: clear their local data together if they want, confirm the recording is
stopped and stored where you said it would be, and thank them.

---

## 6. Stop rules

Stop the session immediately, in these four cases. There is no judgement call
to make and no "let's just finish the task first".

| Trigger | What to do |
| --- | --- |
| **The participant believes demo or seeded data is their own record** (e.g. "so it already knows my service history?") | Stop. Correct it out loud right then. Log as **S1**; this is a trust defect, not a comprehension one. |
| **They upload a real document** (actual RC, licence, insurance, Aadhaar, anything) | Stop. Delete it with them, on their device, before continuing. Do not screenshot it. Do not resume until it is gone. Log as **S1**. |
| **They see another person's data** — any name, garage entry, document or draft that is not theirs | Stop the session entirely. Do not continue testing. Report to the backend owner the same day as a possible RLS or caching defect. Log as **S1**, blocking. |
| **They lose data they entered** — a vehicle, a note, a document disappears after a reload, a back gesture or a network drop | Stop the task. Capture the exact steps and the device state before touching anything else. Log as **S1**. |

Additional soft stop: if the participant becomes uncomfortable, distressed, or
starts apologising for "being bad at this", end the session early and thank
them. A finished script is worth less than a person's afternoon.

---

## 7. Routing findings back to the loop

Every finding gets exactly one owning role. If two roles could own it, it goes
to the earlier one in the loop.

| Finding type | Owner | Definition of done |
| --- | --- | --- |
| "I don't know what this app is for" / wrong audience / feature nobody wants | **Product owner** | The scope decision is written down (build, cut, or defer with a gate) and `docs/LAUNCH_PANEL.md` or `docs/PRODUCT_ROADMAP.md` reflects it. |
| Wrong label, unclear hierarchy, unreadable at their screen width, an action they could not find | **Designer** | Revised copy or layout specified at 390 px and desktop, using the participant's own vocabulary, and handed to frontend. |
| Missing or wrong data, a permission that exposed something, a slow or failing hosted call, anything from the "saw another person's data" stop rule | **Backend engineer** | Schema/RLS/query fixed, a regression test added, and the RLS posture table in `docs/LAUNCH_PANEL.md` updated if the access rule changed. |
| Broken interaction, lost local state, a fallback that didn't fire, a share that produced a dead link | **Frontend engineer** | Fixed in the owning module, covered by a unit test (e.g. `src/app/sharing/share.test.ts` for share and deep links), and verified on a real Android device. |
| Reproducible only under specific conditions — slow network, offline, old device, blocked storage, back/forward navigation | **Tested / QA** | Reproduction steps written into `docs/RELEASE_CHECKLIST.md`, and the case added to the responsive/offline QA matrix. |
| "I'd come back for X" / "I'd never post" / stated intent that contradicts observed behaviour | **Real user** (feeds the next round) | Turned into a specific hypothesis and re-tested with the next three participants, not shipped on one person's say-so. |

A finding is **not done** when a fix is merged. It is done when the next
participant hits the same moment and passes it unaided.

---

## 8. Round summary template

Copy this into the round's notes when the sessions are finished.

```
Round:            R-__   Dates: ____  Facilitator: ____  Note-taker: ____
Participants:     __ daily owners, __ enthusiasts, __ active buyers
Cities:           ____________________   Devices: __ Android / __ iOS
Slow-connection sessions: __            Recordings consented: __ of __

S1 findings (trust / data):     ____  → owner: ____  (blocking release? Y/N)
S2 findings (blocked tasks):    ____  → owners: ____
S3 findings (friction):         ____
S4 findings (preference):       ____

Tasks completed unaided:        __ / 12 average
Most common stall point:        ____________________
Words participants used for the core idea: ____________________
Return-visit intent (explained, not polite): __ of __

Decisions taken:                ____________________
Re-test in next round:          ____________________
```
