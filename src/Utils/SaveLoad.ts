/**
 * Save / load utilities for Story 3-1 (meta integration) and prior sprints.
 *
 * exportSave(state)  — serialises GameState, attaches current MetaProgress as
 *                       a top-level `meta` field, encodes and triggers download.
 * importSave(file)   — decodes .dict file, merges embedded `meta` into
 *                       localStorage (side effect), resolves with the raw object
 *                       for the caller (store's loadGame) to apply.
 *
 * buildSavePayload(state) — pure helper; strips functions, attaches meta.
 *   Signature: buildSavePayload(state: GameState): Record<string, unknown>
 *   Exposed for unit testing.
 *
 * Design doc: production/stories/3-1-meta-progression.md
 */

import type { GameState } from "../types/GameState";
import { isValidMetaProgress, loadMeta, mergeMeta, saveMeta } from "./MetaProgress";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function stripFunctions(obj: unknown): unknown {
    if (typeof obj === 'function') return undefined;
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Set) return Array.from(obj as Set<unknown>).map(stripFunctions);
    if (Array.isArray(obj)) return obj.map(stripFunctions);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value !== 'function') {
            result[key] = stripFunctions(value);
        }
    }
    return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds the plain-object payload that will be JSON-encoded into a .dict file.
 * Strips all functions from state, then attaches the current MetaProgress as
 * a top-level `meta` field.
 *
 * Pure except for the `loadMeta()` localStorage read.
 * Note: call `recordGameEnd` before `exportSave` so the current run's result
 * is included — story 3-4 is responsible for this wiring.
 */
export function buildSavePayload(state: GameState): Record<string, unknown> {
    const serializable = stripFunctions(state) as Record<string, unknown>;
    serializable.meta = loadMeta();
    return serializable;
}

/**
 * Serialises the current GameState to a base-64-encoded .dict file and
 * triggers a browser download. Embeds current MetaProgress in the payload
 * so records survive a browser clear if the player loads this save on a
 * different machine.
 */
export function exportSave(state: GameState): void {
    const payload = buildSavePayload(state);
    const json = JSON.stringify(payload);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    const blob = new Blob([encoded], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dictator-save-round${state.gameManagement.round}.dict`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Reads a .dict save file, decodes it, and resolves with the raw parsed object.
 *
 * Side effect: if the file contains a valid `meta` field, merges it with the
 * existing localStorage MetaProgress using best-of logic (never downgrades).
 * The caller (store's `loadGame`) does not need to handle meta.
 */
export function importSave(file: File): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const encoded = (e.target?.result as string).trim();
                const json = decodeURIComponent(escape(atob(encoded)));
                const data = JSON.parse(json) as Record<string, unknown>;

                // Merge embedded meta into localStorage (side effect, silent on error)
                if (isValidMetaProgress(data.meta)) {
                    saveMeta(mergeMeta(loadMeta(), data.meta));
                }

                resolve(data);
            } catch {
                reject(new Error('Invalid save file'));
            }
        };
        reader.onerror = () => reject(new Error('Could not read file'));
        reader.readAsText(file);
    });
}
