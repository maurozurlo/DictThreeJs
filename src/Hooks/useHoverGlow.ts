import { useEffect, useRef, useState } from "react";
import { Color, Group, NearestFilter } from "three";

type UseHoverGlowOptions = {
    glowColor?: number;
    glowIntensity?: number;
    isSelected?: boolean;
    onClick?: () => void;
};

export function useHoverGlow(
    object: Group,
    options: UseHoverGlowOptions = {}
) {
    const { glowColor = 0x888888, glowIntensity = 0.2, onClick, isSelected } = options;
    const [hovered, setHovered] = useState(false);
    const originalEmissives = useRef<Map<any, Color>>(new Map());

    useEffect(() => {
        if (!object) return;

        object.traverse((child: any) => {
            if (child.isMesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];

                mats.forEach((mat: { map: { magFilter: number; minFilter: number; needsUpdate: boolean; }; emissive: { clone: () => any; }; }) => {
                    if (mat.map) {
                        mat.map.magFilter = NearestFilter;
                        mat.map.minFilter = NearestFilter;
                        mat.map.needsUpdate = true;
                    }
                    originalEmissives.current.set(mat, mat.emissive?.clone() || new Color(0x000000));
                });
            }
        });
    }, [object]);

    useEffect(() => {
        if (!object) return;

        object.traverse((child: any) => {
            if (child.isMesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];

                mats.forEach((mat: { emissive: Color; emissiveIntensity: number; }) => {
                    if (hovered) {
                        mat.emissive = new Color(glowColor);
                        mat.emissiveIntensity = glowIntensity;
                    } else {
                        const original = originalEmissives.current.get(mat);
                        if (original) mat.emissive = original.clone();
                        mat.emissiveIntensity = 1;
                    }
                });
            }
        });
    }, [hovered, object, glowColor, glowIntensity]);

    // Apply hover OR selected effect
    useEffect(() => {
        if (!object) return;

        object.traverse((child: any) => {
            if (child.isMesh) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];

                mats.forEach((mat: { emissive: Color; emissiveIntensity: number }) => {
                    if (hovered || isSelected) {
                        mat.emissive = new Color(glowColor);
                        mat.emissiveIntensity = glowIntensity;
                    } else {
                        const original = originalEmissives.current.get(mat);
                        if (original) mat.emissive = original.clone();
                        mat.emissiveIntensity = 1;
                    }
                });
            }
        });
    }, [hovered, isSelected, object, glowColor, glowIntensity]);


    const handlers = {
        onPointerOver: () => {
            document.body.style.cursor = 'pointer';
            setHovered(true)
        },
        onPointerOut: () => {
            document.body.style.cursor = 'default';
            setHovered(false)
        },
        onClick: onClick,
    };

    return handlers;
}
