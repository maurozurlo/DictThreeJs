// useKeyboardControls.ts
import { useEffect } from "react";
import { useGameStore } from "../Stores/GameState";

export function useKeyboardControls() {
    const move = useGameStore((s) => s.move);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key.toLowerCase()) {
                case "w":
                    move(0, 0, -0.2); // forward
                    break;
                case "s":
                    move(0, 0, 0.2); // backward
                    break;
                case "a":
                    move(-0.2, 0, 0); // left
                    break;
                case "d":
                    move(0.2, 0, 0); // right
                    break;
                case " ":
                    move(0, 0.2, 0); // up (spacebar)
                    break;
                case "shift":
                    move(0, -0.2, 0); // down
                    break;
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [move]);
}
