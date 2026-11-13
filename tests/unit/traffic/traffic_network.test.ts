import { describe, it, expect } from 'vitest';
import { buildRoadNetwork } from '../../../src/Traffic/RoadBuilder';
import { buildConflicts } from '../../../src/Traffic/Conflicts';
import { AVENIDA } from '../../../src/assets/data/road-plans/avenida';
import { PLAZA } from '../../../src/assets/data/road-plans/common';

describe('Avenida road network', () => {
    const net = buildRoadNetwork(AVENIDA);

    it('test_builds_without_warnings', () => {
        expect(net.warnings).toEqual([]);
    });

    it('test_finds_two_t_and_two_x_junctions', () => {
        expect(net.junctions).toHaveLength(4);
        const roadsAt = net.junctions.map((j) => j.roads.join('+')).sort();
        expect(roadsAt).toEqual(['boulevard+east', 'boulevard+west', 'east+front', 'front+west']);
    });

    it('test_every_lane_has_a_way_on_unless_it_is_a_sink', () => {
        for (const p of net.paths) {
            if (p.sink) continue;
            expect(p.next.length, p.key).toBeGreaterThan(0);
        }
    });

    it('test_every_non_spawn_lane_is_reachable', () => {
        for (const p of net.paths) {
            if (p.spawn) continue;
            expect(p.prev.length, p.key).toBeGreaterThan(0);
        }
    });

    it('test_connector_turns_obey_lane_rules', () => {
        // right turns never start from an inner boulevard lane (lane index 0 of a 2-lane side)
        const rightFromInner = net.paths.filter((p) => p.turn === 'right' && /boulevard\.\d[fb]0>/.test(p.key));
        expect(rightFromInner).toEqual([]);
    });

    it('test_plaza_interior_matches_env_plaza_footprint', () => {
        const plaza = net.blocks.find((b) => b.id === 'plaza')!;
        const xs = plaza.inner.map((p) => p[0]), zs = plaza.inner.map((p) => p[1]);
        expect(Math.min(...xs)).toBeCloseTo(PLAZA.x0, 1);
        expect(Math.max(...xs)).toBeCloseTo(PLAZA.x1, 1);
        expect(Math.min(...zs)).toBeCloseTo(PLAZA.z0, 1);
        expect(Math.max(...zs)).toBeCloseTo(PLAZA.z1, 1);
    });

    it('test_every_crossing_links_two_sidewalk_loops', () => {
        expect(net.crossings).toHaveLength(AVENIDA.crossings.length);
        for (const c of net.crossings) {
            expect(c.links[0], c.id).not.toBeNull();
            expect(c.links[1], c.id).not.toBeNull();
            expect(c.links[0]!.loop).not.toBe(c.links[1]!.loop);
        }
    });

    it('test_medians_are_generated_for_the_boulevard', () => {
        expect(net.blocks.filter((b) => b.kind === 'median').length).toBeGreaterThan(0);
    });

    it('test_conflicts_cover_every_junction_and_every_zebra', () => {
        const cf = buildConflicts(net);
        const connectorsWithZones = new Set(cf.carZones.flatMap((z) => z.sides.map((s) => s.path)).filter((p) => net.paths[p].kind === 'connector'));
        for (const j of net.junctions) {
            const anyConn = net.paths.some((p) => p.junction === j.id && connectorsWithZones.has(p.id));
            expect(anyConn, `junction ${j.id}`).toBe(true);
        }
        const zebrasHit = new Set(cf.crossZones.map((z) => z.crossing));
        expect(zebrasHit.size).toBe(net.crossings.length);
    });
});
