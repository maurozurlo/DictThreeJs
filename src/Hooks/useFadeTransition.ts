import { useCallback, useRef, useState } from 'react';
import { useGameStore } from '../Stores/GameState';
import type { Tabs } from '../types/Tabs';

const FADE_DURATION_MS = 100;

/**
 * Manages a black-overlay tab transition.
 *
 * Returns:
 *   - `fading` — true while the overlay is fully opaque (use as `visible` on FadeOverlay)
 *   - `transitionTo(tab)` — fades out, switches tab, fades back in
 */
export function useFadeTransition(): {
    fading: boolean;
    transitionTo: (tab: Tabs) => void;
} {
    const [fading, setFading] = useState(false);
    const setActiveTab = useGameStore((s) => s.tabs.setActiveTab);
    const inProgress = useRef(false);

    const transitionTo = useCallback(
        (tab: Tabs) => {
            if (inProgress.current) return;
            inProgress.current = true;

            setFading(true);

            setTimeout(() => {
                setActiveTab(tab);

                setTimeout(() => {
                    setFading(false);
                    inProgress.current = false;
                }, FADE_DURATION_MS);
            }, FADE_DURATION_MS);
        },
        [setActiveTab],
    );

    return { fading, transitionTo };
}
