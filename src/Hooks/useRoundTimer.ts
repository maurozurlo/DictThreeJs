import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../Stores/GameState';
import { GAMESTATE } from '../Constants/GameState';

function progressToDisplayTime(progress: number): string {
    // Map 0→1 linearly to 9:00 AM → 5:00 PM (480 minutes)
    const totalMinutes = Math.floor(Math.min(progress, 1) * 480);
    const rawHour = Math.floor(totalMinutes / 60) + 9;
    const minutes = totalMinutes % 60;
    const isPM = rawHour >= 12;
    const displayHour = rawHour === 12 ? 12 : rawHour > 12 ? rawHour - 12 : rawHour;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

export function useRoundTimer(): { displayTime: string; progress: number } {
    const phase = useGameStore((s) => s.gameManagement.phase);
    const dayEnded = useGameStore((s) => s.gameManagement.dayEnded);
    const timerStartedAt = useGameStore((s) => s.gameManagement.timerStartedAt);
    const timerPausedAt = useGameStore((s) => s.gameManagement.timerPausedAt);
    const expireTimer = useGameStore((s) => s.gameManagement.expireTimer);

    const [displayTime, setDisplayTime] = useState('9:00 AM');
    const [progress, setProgress] = useState(0);
    const expiredRef = useRef(false);

    useEffect(() => {
        if (phase !== 'start' || dayEnded || !timerStartedAt || timerPausedAt !== null) {
            return;
        }
        expiredRef.current = false;

        const tick = () => {
            const elapsed = Date.now() - timerStartedAt;
            const p = elapsed / GAMESTATE.ROUNDS.TIME_LENGTH_MS;
            setDisplayTime(progressToDisplayTime(p));
            setProgress(Math.min(p, 1));

            if (p >= 1 && !expiredRef.current) {
                expiredRef.current = true;
                expireTimer();
            }
        };

        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [phase, dayEnded, timerStartedAt, timerPausedAt, expireTimer]);

    return { displayTime, progress };
}
