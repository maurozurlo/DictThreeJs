import { describe, it, expect, beforeEach } from 'vitest';
import {
    applyPlacementEdits, buildPlacementEditExport, isEffectiveEdit, placementEditFileName, yawDegOf,
    iplKey, propKey, buildingKey,
    type PlacementEdit, type PlacementSource, type Quat,
} from '../../../src/Utils/PlacementEdit';
import { placementSourceOf, placementSourceByKey } from '../../../src/Hooks/useStreetLayout';
import { useDebugEditStore } from '../../../src/Stores/DebugEditStore';
import { STREET_PLAN } from '../../../src/assets/data/road-plans';
import { STREET_IPL } from '../../../src/assets/data/street-placement.ipl';
import type { ResolvedPlacement } from '../../../src/types/WorldLayout';

const IDENTITY: Quat = [0, 0, 0, 1];
const yawQuat = (deg: number): Quat => {
    const r = deg * Math.PI / 180;
    return [0, Math.sin(r / 2), 0, Math.cos(r / 2)];
};

function placement(instanceId: number, modelName: string, pos: [number, number, number]): ResolvedPlacement {
    return { instanceId, modelName, asset: `models/${modelName}.glb`, textures: [], pos, rot: IDENTITY, scale: [1, 1, 1] };
}

/** Two tier variants at one prop spot plus an IPL bench. */
const SOURCES = new Map<number, PlacementSource>([
    [1, { kind: 'ipl', key: iplKey(19), id: 19, ids: [19, 83, 91], models: ['env_parkbench_medium', 'env_parkbench_poor', 'env_parkbench_rich'], pos: [35, 1, 17], rot: IDENTITY }],
    [2, { kind: 'plan.prop', key: propKey(4), index: 4, models: ['env_tree_poor', 'env_tree_rich'], pos: [-63, 9, 18], rot: IDENTITY }],
    [3, { kind: 'plan.prop', key: propKey(4), index: 4, models: ['env_tree_poor', 'env_tree_rich'], pos: [-63, 9, 18], rot: IDENTITY }],
]);
const sourceOf = (id: number) => SOURCES.get(id);
const byKey = (key: string) => [...SOURCES.values()].find((s) => s.key === key);

describe('applyPlacementEdits', () => {
    const placements = [
        placement(1, 'env_parkbench_medium', [35, 1, 17]),
        placement(2, 'env_tree_poor', [-63, 9, 18]),
        placement(3, 'env_tree_rich', [-63, 9, 18]),
        placement(99, 'env_skyline', [0, 50, 0]),
    ];

    it('test_no_edits_returns_same_array', () => {
        expect(applyPlacementEdits(placements, {}, sourceOf)).toBe(placements);
    });

    it('test_prop_spot_edit_moves_every_tier_variant', () => {
        const edit: PlacementEdit = { pos: [-60, 9, 20], rot: yawQuat(90) };
        const out = applyPlacementEdits(placements, { [propKey(4)]: edit }, sourceOf);
        expect(out[1].pos).toEqual(edit.pos);
        expect(out[2].pos).toEqual(edit.pos);
        expect(out[2].rot).toEqual(edit.rot);
        expect(out[0]).toBe(placements[0]);
        expect(out[3]).toBe(placements[3]); // no source -> untouched
    });
});

describe('yawDegOf', () => {
    it('test_yaw_round_trips_quaternion', () => {
        expect(yawDegOf(IDENTITY)).toBeCloseTo(0);
        expect(yawDegOf(yawQuat(90))).toBeCloseTo(90);
        expect(yawDegOf(yawQuat(-135))).toBeCloseTo(-135);
    });
});

describe('buildPlacementEditExport', () => {
    it('test_export_records_source_reference_and_delta', () => {
        const out = buildPlacementEditExport(
            { [iplKey(19)]: { pos: [36.5, 1, 15], rot: yawQuat(-170) } },
            byKey, 'avenida', '2026-11-13T12:00:00.000Z',
        );
        expect(out.kind).toBe('dict-three/street-placement-edits');
        expect(out.plan).toBe('avenida');
        expect(out.edits).toHaveLength(1);
        const r = out.edits[0];
        expect(r.source).toBe('ipl');
        expect(r.id).toBe(19);
        expect(r.ids).toEqual([19, 83, 91]);
        expect(r.index).toBeUndefined();
        expect(r.models).toEqual(['env_parkbench_medium', 'env_parkbench_poor', 'env_parkbench_rich']);
        expect(r.from.pos).toEqual([35, 1, 17]);
        expect(r.to.pos).toEqual([36.5, 1, 15]);
        expect(r.delta.pos).toEqual([1.5, 0, -2]);
        expect(r.delta.yawDeg).toBeCloseTo(-170);
    });

    it('test_yaw_delta_wraps_through_180', () => {
        const src: PlacementSource = { kind: 'ipl', key: iplKey(5), id: 5, ids: [5], models: ['x'], pos: [0, 0, 0], rot: yawQuat(170) };
        const out = buildPlacementEditExport({ [iplKey(5)]: { pos: [0, 0, 0], rot: yawQuat(-170) } }, () => src, 'p', 't');
        expect(out.edits[0].delta.yawDeg).toBeCloseTo(20);
    });

    it('test_edit_back_on_source_is_dropped', () => {
        const out = buildPlacementEditExport(
            { [propKey(4)]: { pos: [-63, 9, 18.0001], rot: IDENTITY }, [buildingKey(0)]: { pos: [1, 2, 3], rot: IDENTITY } },
            byKey, 'avenida', 't',
        );
        // prop:4 is within rounding noise of its source; building:0 has no source here
        expect(out.edits).toHaveLength(0);
    });
});

describe('isEffectiveEdit', () => {
    it('test_rotation_only_edit_counts', () => {
        const src = SOURCES.get(1)!;
        expect(isEffectiveEdit(src, { pos: src.pos, rot: src.rot })).toBe(false);
        expect(isEffectiveEdit(src, { pos: src.pos, rot: yawQuat(5) })).toBe(true);
    });
});

describe('placementEditFileName', () => {
    it('test_file_name_is_timestamped', () => {
        expect(placementEditFileName(new Date(2026, 10, 13, 9, 5, 7))).toBe('street-edits-20261113-090507.json');
    });
});

describe('street placement sources', () => {
    it('test_every_kept_ipl_instance_maps_to_the_spot_at_its_pos', () => {
        const replaced = new Set(STREET_PLAN.replacesIpl ?? []);
        for (const inst of STREET_IPL.inst) {
            const src = placementSourceOf(inst.id);
            if (replaced.has(inst.id)) {
                expect(src).toBeUndefined();
                continue;
            }
            expect(src).toMatchObject({ kind: 'ipl', pos: inst.pos, rot: inst.rot });
            if (src?.kind !== 'ipl') throw new Error('expected an ipl spot');
            expect(src.ids).toContain(inst.id);
            expect(src.models).toContain(inst.modelName);
            expect(src.id).toBe(Math.min(...src.ids));
            expect(placementSourceByKey(src.key)).toBe(src);
        }
    });

    it('test_ipl_tier_variants_at_one_spot_share_a_key', () => {
        // medium / poor / rich park bench lines 19, 83, 91 stand on the same spot
        const keys = [19, 83, 91].map((id) => placementSourceOf(id)?.key);
        expect(new Set(keys)).toEqual(new Set([iplKey(19)]));
        expect(placementSourceOf(46)?.key).not.toBe(iplKey(19));
    });

    it('test_plan_buildings_and_prop_spots_are_addressable_by_index', () => {
        (STREET_PLAN.buildings ?? []).forEach((b, i) => {
            const src = placementSourceByKey(buildingKey(i));
            expect(src).toMatchObject({ kind: 'plan.building', index: i, models: [b.model], pos: [b.pos[0], b.y ?? 0, b.pos[1]] });
        });
        (STREET_PLAN.props ?? []).forEach((p, i) => {
            const src = placementSourceByKey(propKey(i));
            expect(src).toMatchObject({ kind: 'plan.prop', index: i, models: p.models, pos: [p.pos[0], p.y, p.pos[1]] });
        });
    });
});

describe('DebugEditStore', () => {
    beforeEach(() => {
        useDebugEditStore.setState({ selectedKey: null, mode: 'translate', edits: {}, history: [], dragging: false, lastDragEnd: 0 });
    });

    it('test_undo_restores_previous_edit_then_source', () => {
        const s = useDebugEditStore.getState();
        const a: PlacementEdit = { pos: [1, 0, 0], rot: IDENTITY };
        const b: PlacementEdit = { pos: [2, 0, 0], rot: IDENTITY };
        s.commitEdit('ipl:19', a);
        s.commitEdit('ipl:19', b);
        expect(useDebugEditStore.getState().edits['ipl:19']).toEqual(b);
        useDebugEditStore.getState().undo();
        expect(useDebugEditStore.getState().edits['ipl:19']).toEqual(a);
        useDebugEditStore.getState().undo();
        expect('ipl:19' in useDebugEditStore.getState().edits).toBe(false);
        useDebugEditStore.getState().undo(); // empty history is a no-op
        expect(useDebugEditStore.getState().history).toHaveLength(0);
    });

    it('test_reset_is_undoable', () => {
        const a: PlacementEdit = { pos: [1, 0, 0], rot: IDENTITY };
        useDebugEditStore.getState().commitEdit('prop:4', a);
        useDebugEditStore.getState().resetEdit('prop:4');
        expect('prop:4' in useDebugEditStore.getState().edits).toBe(false);
        useDebugEditStore.getState().undo();
        expect(useDebugEditStore.getState().edits['prop:4']).toEqual(a);
    });
});
