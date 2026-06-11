import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../Stores/GameState";

// Populated by pressing I in debug mode. Read from the browser console.
window.DEBUG_POSITIONS = window.DEBUG_POSITIONS ?? [];

export function useFreeCameraControls(speed: number = 1, lookSpeed: number = 0.002, verticalSpeed: number = speed) {
    const { camera, gl } = useThree();
    const setFov         = useGameStore((s) => s.debug.setFov);
    const storeCameraPos = useGameStore((s) => s.scene.camera.cameraPos);
    const storeRotation  = useGameStore((s) => s.scene.camera.cameraRotation);
    const storeFov       = useGameStore((s) => s.scene.camera.cameraFov);
    const move     = useRef({ forward: false, back: false, left: false, right: false, up: false, down: false });
    const rotation = useRef({ x: 0, y: 0 });

    // Snap to store position/rotation whenever setActiveTab fires (the only writer of cameraPos).
    useEffect(() => {
        camera.position.set(...storeCameraPos);
        rotation.current.x = storeRotation[0];
        rotation.current.y = storeRotation[1];
        const perspCam = camera as THREE.PerspectiveCamera;
        perspCam.fov = storeFov;
        perspCam.updateProjectionMatrix();
        setFov(storeFov);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storeCameraPos, storeRotation, storeFov]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case "KeyW": move.current.forward = true; break;
                case "KeyS": move.current.back    = true; break;
                case "KeyA": move.current.left    = true; break;
                case "KeyD": move.current.right   = true; break;
                case "KeyQ": move.current.up      = true; break;
                case "KeyE": move.current.down    = true; break;
                case "KeyI": {
                    const p = camera.position;
                    const perspCam = camera as THREE.PerspectiveCamera;
                    const entry = {
                        x:   Math.round(p.x * 1000) / 1000,
                        y:   Math.round(p.y * 1000) / 1000,
                        z:   Math.round(p.z * 1000) / 1000,
                        rx:  Math.round(rotation.current.x * 10000) / 10000,
                        ry:  Math.round(rotation.current.y * 10000) / 10000,
                        fov: Math.round(perspCam.fov * 10) / 10,
                    };
                    window.DEBUG_POSITIONS.push(entry);
                    console.log(
                        `[DEBUG] Position saved (${window.DEBUG_POSITIONS.length}):`,
                        entry,
                        '\nAll: window.DEBUG_POSITIONS'
                    );
                    break;
                }
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case "KeyW": move.current.forward = false; break;
                case "KeyS": move.current.back    = false; break;
                case "KeyA": move.current.left    = false; break;
                case "KeyD": move.current.right   = false; break;
                case "KeyQ": move.current.up      = false; break;
                case "KeyE": move.current.down    = false; break;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === gl.domElement) {
                rotation.current.x -= e.movementY * lookSpeed;
                rotation.current.y -= e.movementX * lookSpeed;
                rotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.current.x));
            }
        };

        const onClick = () => gl.domElement.requestPointerLock();

        const onWheel = (e: WheelEvent) => {
            const perspCam = camera as THREE.PerspectiveCamera;
            const next = Math.min(120, Math.max(10, perspCam.fov + e.deltaY * 0.05));
            perspCam.fov = next;
            perspCam.updateProjectionMatrix();
            setFov(Math.round(next * 10) / 10);
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("wheel", onWheel, { passive: true });
        gl.domElement.addEventListener("click", onClick);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("wheel", onWheel);
            gl.domElement.removeEventListener("click", onClick);
        };
    }, [camera, gl, lookSpeed, setFov]);

    useFrame((_, delta) => {
        const direction = new THREE.Vector3();
        const forward   = new THREE.Vector3();
        const right     = new THREE.Vector3();

        camera.rotation.x = rotation.current.x;
        camera.rotation.y = rotation.current.y;

        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        right.crossVectors(camera.up, forward).normalize();

        if (move.current.forward) direction.add(forward);
        if (move.current.back)    direction.sub(forward);
        if (move.current.left)    direction.add(right);
        if (move.current.right)   direction.sub(right);

        if (direction.lengthSq() > 0) {
            direction.normalize();
            camera.position.addScaledVector(direction, speed * delta);
        }

        if (move.current.up)   camera.position.addScaledVector(camera.up,  verticalSpeed * delta);
        if (move.current.down) camera.position.addScaledVector(camera.up, -verticalSpeed * delta);
    });
}
