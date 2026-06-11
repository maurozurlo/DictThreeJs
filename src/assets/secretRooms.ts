/** Camera configuration for each Secret tab room. Add entries as positions are recorded in debug mode. */
export const SECRET_ROOMS: {
    name: string;
    pos: [number, number, number];
    rotation: [number, number];
    fov: number;
}[] = [
    { name: 'room-0', pos: [-2.03,  0.625, 0.073], rotation: [-0.008, 0.018], fov: 75 },
    { name: 'room-1', pos: [-2.925, 0.625, 0.091], rotation: [-0.006, 0.02],  fov: 75 },
    { name: 'room-2', pos: [-4.065, 0.625, 0.114], rotation: [-0.006, 0.02],  fov: 75 },
];
