import { useEffect } from "react";
import { useGameStore } from "../Stores/GameState";

export function useCameraSwitcher(debug: boolean) {
    const cycleCamera = useGameStore((s) => s.scene.camera.cycleCamera);
    const freeCamEnabled = false; // Placeholder for potential future free cam toggle

    useEffect(() => {
        if (!debug || !freeCamEnabled) return;
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
