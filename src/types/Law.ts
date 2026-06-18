import type { Power } from "./Power";
import type { ModifierSpec } from "./GameState";

/**
 * A law (or weird law). All effects — immediate relation/treasury deltas,
 * permanent recurring income/expense, budget-slider nudges, and charisma — are
 * expressed uniformly as `ModifierSpec[]` (ADR-0008 Amendment 2026-06-18). The
 * accept path's relation/charisma/slider specs use `time: 0` (permanent modifier,
 * removed on repeal); treasury uses `time: 1` (applied in the accepting round's
 * nextRound()); the reject path uses `time: 1` (one-round, equivalent to the old
 * one-time base mutation). `LawEffect`/`RecurringEffect` are gone.
 */
export type Law = {
    id: number;
    /** 'weird' marks absurd flavour laws proposed by ??? (no faction penalty on reject). */
    type?: 'normal' | 'weird';
    power: Power;
    acceptMods: ModifierSpec[];
    rejectMods: ModifierSpec[];
    /** i18n key for the Active-Legislation / repeal list — present only on laws that
     *  leave a lasting (recurring or relation) modifier worth surfacing. */
    label?: string;
};
