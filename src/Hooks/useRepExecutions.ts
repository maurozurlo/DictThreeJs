import { useCallback, useEffect, useState } from 'react';
import type { Power } from '../types/Power';
import { updateExecutionRuns, type ExecutionRuns, type RepStatuses } from '../Utils/RepExecution';

const NO_RUNS: ExecutionRuns = {};

/**
 * Tracks which representatives are mid-execution in the Meet room. A run starts
 * when a rep goes 'active' → 'eliminated' while the room is on screen and ends
 * when the scene calls `finishExecution` (last frame reached) or the room is left.
 * Scene-local and cosmetic: the store has already marked the rep eliminated.
 */
export function useRepExecutions(statuses: RepStatuses, roomVisible: boolean) {
    const [prevStatuses, setPrevStatuses] = useState(statuses);
    const [runs, setRuns] = useState<ExecutionRuns>(NO_RUNS);

    // Derived during render ("storing information from previous renders"), not in an
    // effect: the eliminated rep must stay mounted in the very render its status
    // flips, or it would vanish for a frame before its execution starts.
    if (statuses !== prevStatuses) {
        const now = performance.now();
        setPrevStatuses(statuses);
        setRuns((current) => updateExecutionRuns(current, prevStatuses, statuses, roomVisible, now));
    }

    // Leaving the room abandons any run in progress.
    useEffect(() => {
        if (!roomVisible) setRuns((current) => (Object.keys(current).length > 0 ? NO_RUNS : current));
    }, [roomVisible]);

    const finishExecution = useCallback((power: Power) => {
        setRuns((current) => {
            if (current[power] === undefined) return current;
            const next = { ...current };
            delete next[power];
            return next;
        });
    }, []);

    return { runs: roomVisible ? runs : NO_RUNS, finishExecution };
}
