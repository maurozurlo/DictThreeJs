import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { streetSim } from '../Traffic/streetWorld';
import { streetFrustum } from './streetFrustum';

const viewProj = new THREE.Matrix4();

/**
 * Steps the street traffic simulation (ADR-0014) once per frame, BEFORE any car or walker reads
 * its pose (negative priority runs first and keeps R3F's automatic rendering). Lives inside
 * StreetView, so the simulation simply pauses while the Street tab is hidden.
 */
function StreetSimDriver() {
    useFrame((state, delta) => {
        streetSim().advance(delta);
        viewProj.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
        streetFrustum.setFromProjectionMatrix(viewProj);
    }, -1);
    return null;
}

export default StreetSimDriver;
