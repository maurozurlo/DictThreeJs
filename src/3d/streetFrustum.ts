import * as THREE from 'three';

/**
 * Street camera frustum, refreshed every frame by StreetSimDriver before any street agent draws.
 * Walkers use it to skip skinned-animation updates and draws while off screen (skinned bounds
 * don't track bones, so three.js can't cull them itself).
 */
export const streetFrustum = new THREE.Frustum();
