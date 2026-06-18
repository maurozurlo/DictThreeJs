import type { Power } from "./Power";
import type { ModifierSpec } from "./GameState";

/**
 * A deal. All stat/economic effects are expressed as `ModifierSpec[]`
 * (`acceptMods`/`rejectMods`) per ADR-0008 Amendment 2026-06-18 — see Law for the
 * timing convention. `DealEffect`/`RecurringEffect` are gone.
 *
 * `risk` is a coup-risk probability, NOT a ModifierStat: it is rolled separately by
 * EffectHandler. It is kept per-path (`acceptRisk`/`rejectRisk`) because the
 * mechanical penalty fires only on the reject path while the flavour `riskText`
 * can fire on either — collapsing to one field would change which deals can punish.
 */
export interface Deal {
    id: number;
    text: string;
    acceptText: string;
    rejectText: string;
    acceptMods: ModifierSpec[];
    rejectMods: ModifierSpec[];
    riskText?: string;
    /** Probability the risk roll fires when this deal is accepted (flavour only — no penalty on accept). */
    acceptRisk?: number;
    /** Probability the risk roll fires when this deal is rejected (drives the random-faction penalty). */
    rejectRisk?: number;
    /** Proposing faction. REQUIRED on deals that leave a repealable recurring modifier (repeal penalty target). */
    power?: Power;
    /** i18n key for the Active-Legislation / repeal list — present only on lasting-effect deals. */
    label?: string;
}
