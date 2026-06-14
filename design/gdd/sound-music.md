# Sound & Music System GDD

## 1. Overview

The Sound & Music system adds audio to Dictator Simulator across two layers: ambient background music that reacts to game state, and per-action sound effects that punctuate player decisions. Music shifts between jazz ambiance during normal play and a tense variant when the player is in danger. Sound effects are tied to specific game events and are chosen to reinforce the game's darkly comedic tone. Total target: ~9 tracks, feasible for a solo developer to source or commission.

---

## 2. Player Fantasy

Every stamp of a rejected law, every gunshot followed by a Wilhelm scream — audio makes the bureaucratic absurdity land harder. The warm jazz playing while you sign away citizens' rights is the joke. The music getting tense when your military relations hit −7 is the anxiety that makes surviving to round 10 feel earned.

---

## 3. Detailed Rules

### 3.1 Music System

**Track pool:**

| ID | Track | Purpose | Count |
|----|-------|---------|-------|
| `ambient_jazz_1–5` | Jazz ambient | Background during gameplay rounds | 5 |
| `tense_1` | Tense variant | Replaces ambient when danger threshold is met | 1 |
| `menu_theme` | Menu theme | Plays on main menu and between games | 1 |
| `ending_good` | Good ending theme | Victory / positive special ending screen | 1 |
| `ending_bad` | Bad ending theme | Loss / bad ending / negative special ending screen | 1 |

**Total: 9 tracks.**

**Round ambient selection:**
At the start of each round, one of the 5 jazz tracks is selected. The same track may not play two rounds in a row (re-roll once on repeat). Track selection is random; no guaranteed cycle.

**Tense state:**
Each round, after budget effects resolve, check whether the tense threshold is met (see §4). If met, fade from the ambient track to `tense_1`. If the threshold is no longer met at the start of the next round, fade back to a jazz ambient track.

**Menu theme:**
Plays from game load until the player starts a new game. Resumes on the game-over / victory screen after the ending theme completes.

**Ending themes:**
- Good ending (`ending_good`): plays on victory screen and on positive special ending outcomes.
- Bad ending (`ending_bad`): plays on any loss screen (bankruptcy, overthrow) and on negative special ending outcomes.
- Ending themes play once; `menu_theme` resumes after.

### 3.2 Sound Effects

Per-action sound events. All sounds are one-shot (play once on trigger, no looping).

| Event | Sound | Notes |
|-------|-------|-------|
| Accept law | Stamp thud (approval) | Heavy rubber stamp impact |
| Reject law | Stamp thud (denial) | Slightly different stamp — could be same asset pitched down |
| Accept deal | Pen-on-paper scratch + brief click | Signing sound |
| Reject deal | Single dismissive knock | Table knock or stamp variant |
| Eliminate faction | Gunshot + Wilhelm scream | Classic comedy death. Play gunshot first, Wilhelm immediately after. |
| Bribe | Coins/cash rustle | Quick money-changing-hands sound |
| Expropriate | Safe door slam or heavy lock | Assets being seized |
| Dialogue success | Polite applause or single chime | Brief, not sarcastic |
| Dialogue fail | Sad trombone or descending note | Two-note descending, keep it short |
| Dialogue neutral | Single neutral click | Button press feel |
| Round end (timer expires) | Clock bell or gavel strike | Signals round close |
| Bankruptcy / game over | Cash register empty click | The drawer is open, there's nothing in it |
| Faction overthrow / game over | Distant crowd roar + door slam | The mob has arrived |
| Purchase (shop) | Cash register ding | Classic retail success |
| Round advance (player-triggered) | Single soft bell | Confirmation feel |

Additional SFX TBD — spawn `/sound-designer` agent to review the full event list and produce a complete asset spec before production begins.

### 3.3 Audio Implementation Notes

- All music tracks loop seamlessly.
- Transitions between ambient ↔ tense use a short fade (suggested: 1–2 seconds).
- Sound effects play over music; music volume ducks slightly on loud SFX (gunshot, crowd roar) then recovers.
- No spatial audio required — all sounds are 2D.
- Volume controls: separate sliders for music and SFX in settings (implementation deferred to Polish sprint).

---

## 4. Formulas

### 4.1 Tense Threshold

The tense music triggers when any faction is in danger of causing a game over within the next few rounds.

```
is_tense = any(relations[faction] <= TENSE_THRESHOLD for faction in [military, business, people])
        OR treasury <= TENSE_TREASURY_THRESHOLD
```

Where:
- `TENSE_THRESHOLD` = −6 (tuning knob — tense activates when any relation ≤ −6)
- `TENSE_TREASURY_THRESHOLD` = 30 (tuning knob — tense activates when treasury ≤ $30M)

### 4.2 Ending Theme Selection

```
if phase == 'lose':
    play ending_bad
elif phase == 'victory':
    play ending_good
elif phase == 'special_ending':
    play ending_good if outcome == 'good' else ending_bad
```

---

## 5. Edge Cases

- **Multiple danger conditions simultaneously** (two factions below threshold AND low treasury): tense music plays once — no stacking or intensity change in v1. Sound designer may revisit in a future audio sprint.
- **Tense threshold met on round 1**: tense music plays immediately. No grace period for music — the player's starting conditions can be tense.
- **Sound effect during music transition**: SFX play immediately regardless of whether a music fade is in progress. Do not delay SFX for fade completion.
- **Eliminate with backlash**: gunshot + Wilhelm scream play on the eliminate action itself. Backlash result (another faction penalised) has no additional SFX — the log text communicates it.
- **Dialogue rolled on the fail band vs. education-gated fail**: both cases play the `dialogue_fail` sound (sad trombone). The distinction is gameplay-internal.
- **Language switch**: sound effects are not language-dependent. Music tracks are instrumental — no localisation needed.
- **Tab switch or menu while music plays**: music continues uninterrupted across tab navigation. Music only stops on game end or returning to the menu.

---

## 6. Dependencies

- **All Meet actions** (`game-concept.md §6`): bribe, dialogue, expropriate, eliminate each have dedicated SFX.
- **Law system**: accept/reject law triggers stamp sounds.
- **Deal system**: accept/reject deal triggers signing/knock sounds.
- **Round system** (`game-concept.md §3`): round start triggers ambient track selection; round end triggers gavel SFX.
- **Relations system** (`game-concept.md §4`): tense threshold check reads all three faction values.
- **Budget system** (`game-concept.md §5`): tense threshold check reads treasury value.
- **Game phase system**: victory, lose, special_ending phases drive ending theme selection.
- **Shop system**: purchase triggers cash register SFX.

---

## 7. Tuning Knobs

| Knob | Current Value | Effect |
|------|--------------|--------|
| `TENSE_THRESHOLD` | −6 | Faction relation value below which tense music triggers |
| `TENSE_TREASURY_THRESHOLD` | 30 | Treasury value below which tense music triggers |
| `MUSIC_FADE_DURATION_MS` | 1500 | Duration of ambient ↔ tense crossfade in milliseconds |
| `SFX_DUCK_AMOUNT` | 0.4 | Music volume multiplier during loud SFX (gunshot, crowd roar) |
| `SFX_DUCK_RECOVERY_MS` | 800 | Time for music to recover to full volume after ducking |
| Ambient track pool size | 5 | Number of jazz tracks; must be ≥ 2 to support no-repeat rule |

---

## 8. Acceptance Criteria

- [ ] A jazz ambient track plays at the start of each gameplay round
- [ ] The same track does not play two rounds in a row
- [ ] When any faction relation drops to or below −6, music transitions to the tense track within 2 seconds
- [ ] When all faction relations recover above −6, music transitions back to an ambient jazz track
- [ ] Menu theme plays on the main menu and resumes after ending themes complete
- [ ] Good ending theme plays on victory and positive special ending screens
- [ ] Bad ending theme plays on loss and negative special ending screens
- [ ] Stamp sound plays on law accept and law reject
- [ ] Gunshot + Wilhelm scream plays on eliminate action
- [ ] Dialogue fail plays sad trombone; dialogue success plays chime
- [ ] Bribe plays cash sound; expropriate plays asset-seizure sound
- [ ] Round end plays gavel/bell
- [ ] Game over (bankruptcy) plays empty register click; game over (overthrow) plays crowd roar
- [ ] SFX play over music without delaying music transitions
- [ ] No audio plays if the browser tab is hidden (standard browser audio behaviour — no special implementation needed)
