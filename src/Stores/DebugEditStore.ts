import { create } from 'zustand';
import type { PlacementEdit } from '../Utils/PlacementEdit';

/** Gizmo mode of the debug placement editor. */
export type PlacementEditMode = 'translate' | 'rotate';

/** Ignore scene clicks this long after a gizmo drag ends (the drag's own click lands after mouseUp). */
const GIZMO_CLICK_GUARD_MS = 150;

/**
 * Debug-only placement editor state. Kept out of the game store on purpose: it is a dev tool,
 * never saved, never part of a round. Edits are keyed by source key (see Utils/PlacementEdit).
 */
interface DebugEditState {
    /** Source key of the placement under the gizmo, or null. */
    selectedKey: string | null;
    mode: PlacementEditMode;
    edits: Record<string, PlacementEdit>;
    /** Undo stack: the edit each commit replaced (undefined = there was none). */
    history: Array<{ key: string; prev: PlacementEdit | undefined }>;
    /** True while a gizmo handle is held. */
    dragging: boolean;
    /** performance.now() of the last gizmo release. */
    lastDragEnd: number;

    selectForEdit: (key: string | null) => void;
    setMode: (mode: PlacementEditMode) => void;
    /** Stores the transform a drag ended on. */
    commitEdit: (key: string, edit: PlacementEdit) => void;
    /** Drops the edit on `key` (back to the source transform). */
    resetEdit: (key: string) => void;
    undo: () => void;
    setDragging: (dragging: boolean) => void;
}

export const useDebugEditStore = create<DebugEditState>((set) => ({
    selectedKey: null,
    mode: 'translate',
    edits: {},
    history: [],
    dragging: false,
    lastDragEnd: 0,

    selectForEdit: (key) => set({ selectedKey: key }),
    setMode: (mode) => set({ mode }),
    commitEdit: (key, edit) => set((s) => ({
        edits: { ...s.edits, [key]: edit },
        history: [...s.history, { key, prev: s.edits[key] }],
    })),
    resetEdit: (key) => set((s) => {
        if (!(key in s.edits)) return s;
        const { [key]: prev, ...rest } = s.edits;
        return { edits: rest, history: [...s.history, { key, prev }] };
    }),
    undo: () => set((s) => {
        const last = s.history[s.history.length - 1];
        if (!last) return s;
        const edits = { ...s.edits };
        if (last.prev) edits[last.key] = last.prev;
        else delete edits[last.key];
        return { edits, history: s.history.slice(0, -1), selectedKey: last.key };
    }),
    setDragging: (dragging) => set(dragging
        ? { dragging: true }
        : { dragging: false, lastDragEnd: performance.now() }),
}));

/** True while a gizmo drag is in progress or just ended — scene clicks must not re-select then. */
export function gizmoBusy(): boolean {
    const s = useDebugEditStore.getState();
    return s.dragging || performance.now() - s.lastDragEnd < GIZMO_CLICK_GUARD_MS;
}
