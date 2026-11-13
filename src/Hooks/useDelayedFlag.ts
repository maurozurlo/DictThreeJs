import { useEffect, useState } from "react";

/**
 * `on`, but only once it has stayed true for `delayMs` (immediately when
 * `delayMs` <= 0). Drops back to false as soon as `on` does.
 */
export function useDelayedFlag(on: boolean, delayMs: number): boolean {
    const [elapsed, setElapsed] = useState(false);

    useEffect(() => {
        if (!on || delayMs <= 0) return;
        const id = setTimeout(() => setElapsed(true), delayMs);
        return () => {
            clearTimeout(id);
            setElapsed(false);
        };
    }, [on, delayMs]);

    return on && (delayMs <= 0 || elapsed);
}
