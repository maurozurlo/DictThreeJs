import { useFrame, useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader";
import { useEffect, useMemo, useRef } from "react";
import { AnimationClip, BackSide, type Group, type Mesh, type MeshPhongMaterial } from "three";
import { useGameStore } from "../Stores/GameState";
import { BUNKER, bunkerPressFrame } from "../Constants/SecretRooms";
import { ClipPoser } from "./ClipPoser";
import { pixelateTextures } from "./pixelate";

/**
 * The Bunker, the military special-ending room shown on the Secret tab. Holds
 * the press take's rest frame until the Nuke button is used, then plays the key
 * turn + button press once and holds the last frame (App delays the end screen
 * by the same amount, see specialEndingRevealDelayMs).
 */
export function Bunker() {
    const fbx = useLoader(FBXLoader, BUNKER.url) as Group;
    const pressed = useGameStore((s) => s.specialEnding.used && s.specialEnding.faction === 'military');
    const pressedAt = useRef<number | null>(null);

    const poser = useMemo(() => {
        const clip = fbx.animations[0] ?? new AnimationClip('empty', 0, []);
        const p = new ClipPoser(fbx, clip, BUNKER.fps);
        for (const node of BUNKER.pressNodes) {
            if (!p.animates(node)) console.warn(`Bunker: take does not animate "${node}"`);
        }
        return p;
    }, [fbx]);

    useEffect(() => {
        pixelateTextures(fbx);
        // Max ignores a Standard material's diffuse colour when a 100% diffuse map
        // is set; FBXLoader multiplies by it (grey 150 -> 0.3 linear). Match Max.
        fbx.traverse((child) => {
            if (!(child as Mesh).isMesh) return;
            const material = (child as Mesh).material as MeshPhongMaterial | MeshPhongMaterial[];
            for (const mat of Array.isArray(material) ? material : [material]) {
                if (mat.map) mat.color.set(0xffffff);
            }
        });
    }, [fbx]);

    useEffect(() => {
        pressedAt.current = pressed ? performance.now() : null;
    }, [pressed]);

    useFrame(() => {
        const start = pressedAt.current;
        poser.apply(BUNKER.pressNodes, bunkerPressFrame(start === null ? null : performance.now() - start));
    });

    return (
        <group position={BUNKER.offset}>
            <primitive object={fbx} />
            <pointLight position={BUNKER.lamp.pos} color={BUNKER.lamp.color} intensity={BUNKER.lamp.intensity} />
            <mesh>
                <boxGeometry args={[BUNKER.voidSize, BUNKER.voidSize, BUNKER.voidSize]} />
                <meshBasicMaterial color="black" side={BackSide} />
            </mesh>
        </group>
    );
}
