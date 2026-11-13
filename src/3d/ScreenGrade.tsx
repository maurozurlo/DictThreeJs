import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { HalfFloatType, Vector3, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SCREEN_GRADE_BY_TIER, SCREEN_GRADE_FADE_SECONDS, type ScreenGradeParams } from '../Constants/ScreenGrade';
import { useGameStore } from '../Stores/GameState';
import {
    retargetScreenGradeFade,
    sampleScreenGradeFade,
    screenGradeTierFor,
    settledFade,
    type ScreenGradeFade,
} from '../Utils/ScreenGrade';

/** MSAA samples for the composer target (the default framebuffer's antialias no longer applies). */
const COMPOSER_SAMPLES = 4;

/**
 * Colour grade in display space. The composer target holds premultiplied colour over a
 * transparent clear, so the grade runs on un-premultiplied colour and re-premultiplies —
 * empty pixels stay exactly empty.
 */
const GRADE_SHADER = {
    uniforms: {
        tDiffuse: { value: null },
        saturation: { value: 1 },
        contrast: { value: 1 },
        brightness: { value: 1 },
        tint: { value: new Vector3(1, 1, 1) },
        tintAmount: { value: 0 },
        highlightTint: { value: new Vector3(1, 1, 1) },
        highlightAmount: { value: 0 },
    },
    vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse;
        uniform float saturation;
        uniform float contrast;
        uniform float brightness;
        uniform vec3 tint;
        uniform float tintAmount;
        uniform vec3 highlightTint;
        uniform float highlightAmount;
        varying vec2 vUv;

        const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

        // Hue shift without darkening: scale the tint so its luminance is 1.
        vec3 normaliseTint(vec3 t) { return t / max(dot(t, LUMA), 1e-4); }

        void main() {
            vec4 src = texture2D(tDiffuse, vUv);
            if (src.a <= 0.0) { gl_FragColor = src; return; }
            vec3 c = src.rgb / src.a;
            c = mix(vec3(dot(c, LUMA)), c, saturation);
            c = (c - 0.5) * contrast + 0.5;
            c *= brightness;
            c = mix(c, c * normaliseTint(tint), tintAmount);
            float lit = smoothstep(0.35, 1.0, dot(c, LUMA));
            c = mix(c, c * normaliseTint(highlightTint), highlightAmount * lit);
            gl_FragColor = vec4(clamp(c, 0.0, 1.0) * src.a, src.a);
        }
    `,
};

interface GradePipeline {
    composer: EffectComposer;
    renderPass: RenderPass;
    gradePass: ShaderPass;
}

function applyGrade(pass: ShaderPass, g: ScreenGradeParams): void {
    const u = pass.uniforms;
    u.saturation.value = g.saturation;
    u.contrast.value = g.contrast;
    u.brightness.value = g.brightness;
    (u.tint.value as Vector3).set(g.tint[0], g.tint[1], g.tint[2]);
    u.tintAmount.value = g.tintAmount;
    (u.highlightTint.value as Vector3).set(g.highlightTint[0], g.highlightTint[1], g.highlightTint[2]);
    u.highlightAmount.value = g.highlightAmount;
}

/**
 * Tier screen filter for every 3D scene (art-bible §5.4.5): takes over the canvas render loop
 * (useFrame priority 1) and draws scene → tone map / sRGB → colour grade. The grade follows the
 * infrastructure tier and fades over SCREEN_GRADE_FADE_SECONDS when the tier changes.
 */
export function ScreenGrade() {
    const gl = useThree((s) => s.gl);
    const get = useThree((s) => s.get);
    const width = useThree((s) => s.size.width);
    const height = useThree((s) => s.size.height);
    const dpr = useThree((s) => s.viewport.dpr);
    const infrastructure = useGameStore((s) => s.budget.expenditures.infrastructure);
    const tier = screenGradeTierFor(infrastructure);

    const pipeline = useRef<GradePipeline | null>(null);
    // First mount shows the current tier as-is; only later tier changes fade.
    const fade = useRef<ScreenGradeFade>(settledFade(SCREEN_GRADE_BY_TIER[tier]));

    useEffect(() => {
        fade.current = retargetScreenGradeFade(fade.current, SCREEN_GRADE_BY_TIER[tier], SCREEN_GRADE_FADE_SECONDS);
    }, [tier]);

    // Built in an effect (not useMemo) so StrictMode's dispose → remount gets a fresh pipeline.
    useEffect(() => {
        const { scene, camera } = get();
        const composer = new EffectComposer(gl, new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: COMPOSER_SAMPLES }));
        const renderPass = new RenderPass(scene, camera);
        const outputPass = new OutputPass();
        const gradePass = new ShaderPass(GRADE_SHADER);
        composer.addPass(renderPass);
        composer.addPass(outputPass);
        composer.addPass(gradePass);
        pipeline.current = { composer, renderPass, gradePass };
        return () => {
            pipeline.current = null;
            outputPass.dispose();
            gradePass.dispose();
            composer.dispose();
        };
    }, [gl, get]);

    useEffect(() => {
        const p = pipeline.current;
        if (!p) return;
        p.composer.setPixelRatio(dpr);
        p.composer.setSize(width, height);
    }, [width, height, dpr, gl, get]);

    useFrame((state, delta) => {
        fade.current.elapsed += delta;
        const p = pipeline.current;
        if (!p) {
            state.gl.render(state.scene, state.camera);
            return;
        }
        applyGrade(p.gradePass, sampleScreenGradeFade(fade.current, SCREEN_GRADE_FADE_SECONDS));
        p.renderPass.scene = state.scene;
        p.renderPass.camera = state.camera;
        p.composer.render(delta);
    }, 1);

    return null;
}
