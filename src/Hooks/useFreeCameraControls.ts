// useFreeCameraControls.tsx
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function useFreeCameraControls(speed: number = 2, lookSpeed: number = 0.002) {
    const { camera, gl } = useThree();
    const move = useRef({
        forward: false,
        back: false,
        left: false,
        right: false,
        up: false,
        down: false,
    });
    const rotation = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case "KeyW":
                    move.current.forward = true;
                    break;
                case "KeyS":
                    move.current.back = true;
                    break;
                case "KeyA":
                    move.current.left = true;
                    break;
                case "KeyD":
                    move.current.right = true;
                    break;
                case "ShiftLeft":
                case "ShiftRight":
                    move.current.up = true;
                    break;
                case "ControlLeft":
                case "ControlRight":
                    move.current.down = true;
                    break;
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case "KeyW":
                    move.current.forward = false;
                    break;
                case "KeyS":
                    move.current.back = false;
                    break;
                case "KeyA":
                    move.current.left = false;
                    break;
                case "KeyD":
                    move.current.right = false;
                    break;
                case "ShiftLeft":
                case "ShiftRight":
                    move.current.up = false;
                    break;
                case "ControlLeft":
                case "ControlRight":
                    move.current.down = false;
                    break;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            if (document.pointerLockElement === gl.domElement) {
                rotation.current.x -= e.movementY * lookSpeed;
                rotation.current.y -= e.movementX * lookSpeed;
                rotation.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotation.current.x)); // clamp vertical
            }
        };

        const onClick = () => {
            gl.domElement.requestPointerLock();
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
        document.addEventListener("mousemove", onMouseMove);
        gl.domElement.addEventListener("click", onClick);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
            document.removeEventListener("mousemove", onMouseMove);
            gl.domElement.removeEventListener("click", onClick);
        };
    }, [gl, lookSpeed]);

    useFrame((_, delta) => {
        const direction = new THREE.Vector3();
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();

        // apply rotation
        camera.rotation.x = rotation.current.x;
        camera.rotation.y = rotation.current.y;

        // forward/back movement
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        // right/left movement
        right.crossVectors(camera.up, forward).normalize();

        if (move.current.forward) direction.add(forward);
        if (move.current.back) direction.sub(forward);
        if (move.current.left) direction.add(right);
        if (move.current.right) direction.sub(right);
        if (move.current.up) direction.add(camera.up);
        if (move.current.down) direction.sub(camera.up);

        if (direction.lengthSq() > 0) {
            direction.normalize();
            camera.position.addScaledVector(direction, speed * delta);
        }
    });
}
