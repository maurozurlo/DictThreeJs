interface Window {
    DEBUG_POSITIONS: { x: number; y: number; z: number; rx: number; ry: number; fov: number }[];
}

declare module 'three/examples/jsm/loaders/FBXLoader' {
    import { Group, LoadingManager, Loader } from 'three';

    export class FBXLoader extends Loader {
        constructor(manager?: LoadingManager);
        load(
            url: string,
            onLoad: (object: Group) => void,
            onProgress?: (event: ProgressEvent) => void,
            onError?: (event: ErrorEvent) => void
        ): void;
        parse(buffer: ArrayBuffer | string, path?: string): Group;
    }

    export { FBXLoader };
}