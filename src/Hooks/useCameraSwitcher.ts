import { useEffect } from "react";
import { useGameStore } from "../Stores/GameState";

export function useCameraSwitcher(debug: boolean) {
    const cycleCamera = useGameStore((s) => s.scene.camera.cycleCamera);

    useEffect(() => {
        if (!debug) return;
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
