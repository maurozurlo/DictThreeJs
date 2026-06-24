# Round Loop & Street View Reveal — Design Decisions (v0.1)

**Status:** working design notes — decisions + rationale from a design review pass.
**Scope:** how the round/phase structure reshapes around the Street View. **Assumes the Street View, ped simulation, and happiness system are already implemented** — this doc does *not* re-cover those. It's the loop, the reveal, and one pending RNG call.

---

## 1. The problem (from the WIP build)

The Street View turned out **fun to look at** — which is the goal, it means the systems underneath are alive. But under a live round timer it creates friction: it's tempting enough to watch that players neglect their actual decisions.

The real risk is the *inverse* of the obvious one. It isn't that players waste time gawking — it's that, under pressure, players get **disciplined**. They learn that looking outside costs them rounds, so they stop looking. Result: we'd ship a beautiful, fun-to-watch consequence engine that players **train themselves to ignore in order to survive.** Our best feature dies unwatched.

So the design question is not "how do we stop the street distracting players." It's "what is the street *for*, and how do we guarantee they see it."

---

## 2. Decision — split the two jobs, give each its own rules

The Street View does two different things that want **opposite** rules:

- **Information** (who's unhappy, where the unrest is): needed to govern. Stays cheap and always-readable. We never make a player choose between being well-informed and being fast.
- **Spectacle** (dwelling in the 3D, following a specific ped, admiring what you built): this is the "toy." It deserves a phase where lingering is the *point* — and that phase must be **timer-free**.

### Adopted framing: "the dictator works one day a month"

This is lore doing mechanical work, not flavor pasted on top:

- It's the in-fiction reason you only act once per round — solves the unspoken "why one action per turn?" problem every turn-based game has.
- It creates a deliberate **tension → release** rhythm: clenched, timed work; then the unhurried street; then clenched again. The exhale is what makes the next held breath land.

**Resulting phases:**

| Phase | Clock | Street View |
|-------|-------|-------------|
| **Work day** (1st of the month) | timed, pressured | **off** — decisions only, no distractions |
| **After work** | none | **on**, unlimited |

---

## 3. The street "hinge" — exactly one viewing per cycle

A naive loop shows the street *twice* between work sessions (one labeled "this month," one "next month"). **That's a duplicated beat:** it's the same city shown then re-shown, and it muddies attribution — the player can't tell which view is the *result* of their last turn vs. the *setup* for their next.

**Decision:** there is **one** street viewing between each pair of work days, and it intentionally faces both directions at once — the aftermath of the turn you just finished **is** the briefing for the turn you're about to start. Do not split it into two views; its power is that it's singular.

```
Work month 1 → [ STREET HINGE ] → Work month 2 → [ STREET HINGE ] → Work month 3 …
```

This converts rubbernecking into **reconnaissance.** Because the street is off during work, the after-work street is the player's only briefing for next month. Lingering = governing better. Looking stops being indulgence the game tolerates and becomes the smart play — which enforces the act → see-consequence → read-it → act-better loop instead of hoping for it.

- **Recommended frame: aftermath** (the street is what you *caused*) — the game is about living with decisions, not optimizing them. Final in-fiction framing is narrative-director's call; structurally it's one beat either way.
- **Engineering note:** a single hinge means month 1 needs an **opening / inherited city state** before the player's first decision — the regime you take over already looks like something. Strong, free first impression.

---

## 4. The reveal — mandatory, brief; the dwell — optional, unlimited

The transition into each hinge is the **"The next month…" beat:** the city updates and the player walks into it.

- **Fast-forward skips the *dwell*, never the *reveal*.** Every player passes through a brief mandatory reveal of the updated city; they choose how long to *then* stand there. If fast-forward skipped the city entirely, impatient players would mash it and never see the feature — the "dies unwatched" failure sneaking back in through the skip button. They walk *through* the city to reach next month.
- **Don't delete the newspaper — fuse it onto the reveal.** The city shows the *effect* but can't state the *cause*; strip the log out and the street becomes pretty noise (players can't trace why anything changed). Run a **state newsreel** over the city update: triumphant regime headlines (PROSPERITY SOARS, THE PEOPLE REJOICE) playing over streets that may flatly contradict them.
  - **Lies in the text, truth in the visuals.** The gap between propaganda and what the player is actually looking at is the satire landing *and* the attribution layer that keeps the sim readable — at no extra cost.

---

## 5. Consistency flag — scripted crises must obey "once a month"

The fixed events (Summit, Economic Crisis, Natural Disaster) now have to respect the work-day fiction. A mid-month disaster either waits for the desk or it interrupts and breaks our own rule.

**Decision:** present crises **at the work session, as part of the month's docket** ("this month's agenda: a natural disaster"). Decide this now so the fiction doesn't crack later.

---

## 6. Pending call — RNG: deterministic + seedable (recommended, likely not yet implemented)

Flagged here because it interacts with save/load and the "live with your choice" premise. Recommendation: **switch off `Math.random` to a seeded PRNG, paired with commit-on-roll.**

- **Why (design):** with save/load present, `Math.random` lets a player save before a risky roll (e.g. the 30% Eliminate backlash) and reload until it whiffs — an undo button on the exact moments meant to hurt. A seeded RNG whose state is saved makes the reload land on the *same* outcome. Save-scumming dies.
- **Commit-on-roll:** resolve risky outcomes into game state the instant the player commits, before they can save. Seed makes it reproducible; commit-on-roll makes it unexploitable. Use both.
- **Bonus:** a printed seed in dev makes "why did this play out this way?" reproducible for tuning.
- **Cost:** minimal (~5-line seedable PRNG, no library). Real work is discipline — one RNG instance, every call routed through it, state stored + saved. *Algorithm + serialization is engineering's; the verdict is the design call.*

---

## 7. Ownership

- **Systems-designer:** fast-forward timing; whether the dwell ever costs anything; PRNG choice + state serialization.
- **Narrative-director:** newsreel / headline copy; the "next month" wording; whether the hinge reads as *aftermath* or *briefing* in-fiction.
- **Deferred to Street View 0.2+:** the persistence / "scar" layer — boarded-up shops after expropriation that reopen *slowly*, an empty plinth or memorial after an Elimination. Turns the live mirror into a record of the reign. (Buyable statues are the one persistence hook already in place; build the rest on that bone.)

---

## 8. How to validate

Build the dumb version, wire it live, play — don't formalize further on paper first.

Bolt a crude **mandatory-reveal-then-optional-dwell** onto round-end, placeholder newsreel text, change nothing else. Play 3–4 months. The only question to feel:

> **Do you linger because you *want* to, or do you mash fast-forward?**

- **Linger** → the intel-carrot is pulling; the structure works, move to polish.
- **Skip** → the street isn't legible/built-out enough yet to reward looking. That's not a structure problem — it means the ped tells need to get louder before the dwell earns its keep.

Ten minutes of play answers it.
