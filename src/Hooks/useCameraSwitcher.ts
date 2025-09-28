import { useEffect } from "react";
import { useGameStore } from "../Stores/GameState";

export function useCameraSwitcher() {
    const cycleCamera = useGameStore((s) => s.cycleCamera);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                e.preventDefault();
                cycleCamera();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cycleCamera]);
}
