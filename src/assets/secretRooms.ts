import { BUNKER } from '../Constants/SecretRooms';

const [bx, by, bz] = BUNKER.offset;
const [cx, cy, cz] = BUNKER.camera.pos;

/**
 * Camera configuration for each Secret tab room, indexed by
 * GAMESTATE.FACTION_ROOM_INDEX (military=0, business=1, people=2).
 * `hFov` (horizontal, aspect-derived) wins over `fov` when present.
 * room-1 / room-2 (vault, zen garden) are still placeholders from the old palace model.
 */
export const SECRET_ROOMS: {
    name: string;
    pos: [number, number, number];
    rotation: [number, number];
    fov: number;
    hFov?: number;
}[] = [
    { name: 'bunker', pos: [bx + cx, by + cy, bz + cz], rotation: [...BUNKER.camera.rotation], fov: 75, hFov: BUNKER.camera.hFov },
    { name: 'room-1', pos: [-2.925, 0.625, 0.091], rotation: [-0.006, 0.02],  fov: 75 },
    { name: 'room-2', pos: [-4.065, 0.625, 0.114], rotation: [-0.006, 0.02],  fov: 75 },
];
