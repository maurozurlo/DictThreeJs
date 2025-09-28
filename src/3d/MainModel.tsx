import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useEffect } from "react";
import { useGameStore } from "../Stores/GameState";
import type { Vector3 } from "three";
import { NearestFilter } from "three";

export function MainModel() {
    const fbx = useLoader(FBXLoader, "/assets/3d/main.FBX");
    const moveCameraTo = useGameStore((s) => s.moveCameraTo);
    const setCameraPositions = useGameStore((s) => s.setCameraPositions);

    useEffect(() => {
        // find all camera dummies by name
        const dummyNames = ["CameraStart", "CameraStart001", "CameraStart002"];
        const positions: Vector3[] = [];

        dummyNames.forEach((name) => {
            const dummy = fbx.getObjectByName(name);
            //            console.log(dummy.position, dummy.name)
            if (dummy) {
                positions.push(dummy.position.clone());
                //console.log(`Found ${name} at`, dummy.position);
            }
        });

        if (positions.length > 0) {
            setCameraPositions(positions);
            // initialize camera at first dummy
            moveCameraTo([positions[0].x, positions[0].y, positions[0].z], positions[0].clone());
        }

        // Iterate through all materials/textures and set pixelated
        fbx.traverse((child: any) => {
            if (child.isMesh) {
                const material = child.material;
                if (Array.isArray(material)) {
                    material.forEach((mat) => {
                        if (mat.map) {
                            mat.map.magFilter = NearestFilter;
                            mat.map.minFilter = NearestFilter;
                            mat.map.needsUpdate = true;
                        }
                    });
                } else if (material.map) {
                    material.map.magFilter = NearestFilter;
                    material.map.minFilter = NearestFilter;
                    material.map.needsUpdate = true;
                }
            }
        });
    }, [fbx, moveCameraTo]);

    return <primitive receiveShadow object={fbx} scale={1} />;
}
