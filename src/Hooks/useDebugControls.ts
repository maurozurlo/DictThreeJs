import { useEffect } from 'react';
import { useGameStore } from '../Stores/GameState';

/**
 * Hook to handle debug keyboard shortcuts when Debug Mode is enabled.
 * Keybindings:
 * - M: +$10m Treasury / L: -$10m Treasury
 * - 7/1: +/- People Relations
 * - 8/2: +/- Business (Elite) Relations
 * - 9/3: +/- Military Relations
 * - 4/6: +/- Charisma
 * - O: Swap current Law
 * - P: Swap current Deal
 * - H: Show help alert
 */
export const useDebugControls = () => {
    const debugEnabled = useGameStore((s) => s.debug.enabled);
    const adjustTreasury = useGameStore((s) => s.budget.adjustTreasury);
    const adjustRelations = useGameStore((s) => s.relations.adjustRelations);
    const adjustCharisma = useGameStore((s) => s.gameManagement.charisma.adjustCharisma);
    const swapLaw = useGameStore((s) => s.law.swapLaw);
    const swapDeal = useGameStore((s) => s.deals.swapDeal);
    const toggleSelector = useGameStore((s) => s.debug.toggleSelector);

    useEffect(() => {
        if (!debugEnabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input or textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case '`':
                case '~':
                    toggleSelector();
                    break;
                case 'm':
                case 'M':
                    adjustTreasury(10);
                    break;
                case 'l':
                case 'L':
                    adjustTreasury(-10);
                    break;
                case '7':
                    adjustRelations('people', 1);
                    break;
                case '1':
                    adjustRelations('people', -1);
                    break;
                case '8':
                    adjustRelations('business', 1);
                    break;
                case '2':
                    adjustRelations('business', -1);
                    break;
                case '9':
                    adjustRelations('military', 1);
                    break;
                case '3':
                    adjustRelations('military', -1);
                    break;
                case '4':
                    adjustCharisma(-1);
                    break;
                case '6':
                    adjustCharisma(1);
                    break;
                case 'o':
                case 'O':
                    swapLaw();
                    break;
                case 'p':
                case 'P':
                    swapDeal();
                    break;
                case 'h':
                case 'H':
                    const helpText = "Debug Keybindings:\n`: Toggle selector overlay\nM: +$10m | L: -$10m\n7/1: +/- People\n8/2: +/- Business\n9/3: +/- Military\n4/6: +/- Charisma\nO: Swap Law\nP: Swap Deal";
                    console.info(helpText);
                    alert(helpText);
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [debugEnabled, adjustTreasury, adjustRelations, adjustCharisma, swapLaw, swapDeal, toggleSelector]);
};