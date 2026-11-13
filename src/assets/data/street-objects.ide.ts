import type { IDEFile } from '../../types/WorldLayout';

/**
 * Street scene object definitions (IDE format, GTA-inspired).
 * One entry per distinct model type. Asset paths are relative to public/.
 * Generated stub — fix asset paths/extensions and visibleIf as needed.
 */
export const STREET_IDE: IDEFile = {
    version: 1,
    objs: [
        // Buildings — variant selected by conditionStage in useStreetLayout — visibleIf.infrastructure not used for buildings
        { id: 2001, modelName: 'env_bld_mixeduse_normal', asset: 'models/map/env_bld_mixeduse_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building4.png', transparent: false }, { texture: 'textures/map/concrete_buildings_top.png', transparent: false }, { texture: 'textures/map/concrete_buildings_base.png', transparent: false }] },
        { id: 2002, modelName: 'env_bld_apartment_normal', asset: 'models/map/env_bld_apartment_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building1.png', transparent: false }] },
        { id: 2003, modelName: 'env_bld_commercial_normal', asset: 'models/map/env_bld_commercial_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building5.png', transparent: false }] },
        { id: 2004, modelName: 'env_bld_civic_normal', asset: 'models/map/env_bld_civic_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building2.png', transparent: false }] },
        { id: 2005, modelName: 'env_bld_residential_normal', asset: 'models/map/env_bld_residential_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building3.png', transparent: false }] },
        { id: 2006, modelName: 'env_bld_mixeduse_poor', asset: 'models/map/env_bld_mixeduse_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building4_poor.png', transparent: false }] },
        { id: 2007, modelName: 'env_bld_apartment_poor', asset: 'models/map/env_bld_apartment_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building1_poor.png', transparent: false }] },
        { id: 2008, modelName: 'env_bld_commercial_poor', asset: 'models/map/env_bld_commercial_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building5_poor.png', transparent: false }] },
        { id: 2009, modelName: 'env_bld_civic_poor', asset: 'models/map/env_bld_civic_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building2_poor.png', transparent: false }] },
        { id: 2010, modelName: 'env_bld_residential_poor', asset: 'models/map/env_bld_residential_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building3_poor.png', transparent: false }] },
        // Long terrace row (road planning 2026-11-12, tools/blender/bld_terrace.py) — material names = texture basenames.
        // The GLBs also embed copies, but only listed textures override them: list every material here.
        { id: 2040, modelName: 'env_bld_terrace_normal', asset: 'models/map/env_bld_terrace_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/bld_terrace_facade.png', transparent: false }, { texture: 'textures/map/bld_terrace_trim.png', transparent: false }, { texture: 'textures/map/bld_terrace_brick.png', transparent: false }, { texture: 'textures/map/bld_terrace_roof.png', transparent: false }] },
        { id: 2041, modelName: 'env_bld_terrace_poor', asset: 'models/map/env_bld_terrace_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/bld_terrace_facade_poor.png', transparent: false }, { texture: 'textures/map/bld_terrace_trim_poor.png', transparent: false }, { texture: 'textures/map/bld_terrace_brick_poor.png', transparent: false }, { texture: 'textures/map/bld_terrace_roof_poor.png', transparent: false }] },
        // Rich terrace (tools/{texgen,blender}/bld_terrace_rich.py) — same pivot as normal; bld_terrace_rich_cutout is the alpha-clip (MASK) railing material
        { id: 2056, modelName: 'env_bld_terrace_rich', asset: 'models/map/env_bld_terrace_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/bld_terrace_rich_facade.png', transparent: false }, { texture: 'textures/map/bld_terrace_rich_trim.png', transparent: false }, { texture: 'textures/map/bld_terrace_rich_cutout.png', transparent: true }, { texture: 'textures/map/bld_terrace_rich_wall.png', transparent: false }, { texture: 'textures/map/bld_terrace_rich_roof.png', transparent: false }] },
        // Street Objects
        { id: 2011, modelName: 'env_flagpole_large', asset: 'models/map/env_flagpole_large.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/flagpole.png', transparent: false }] },
        { id: 2012, modelName: 'env_flag_small', asset: 'models/map/env_flag_small.glb', visibleIf: { tab: 'Street' } },

        { id: 2013, modelName: 'env_skyline', asset: 'models/map/env_skyline.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/skyline.png', transparent: true }] },
        // env_roads carries 7 material slots (per texture-manifest.json); poor variants swap
        // the painted texture in place — see groundVariantSuffix / textureVariantSuffix.
        { id: 2014, modelName: 'env_roads', asset: 'models/map/env_roads.glb', visibleIf: { tab: 'Street' }, textures: [
            { texture: 'textures/map/stone.png', transparent: false },
            { texture: 'textures/map/sidewalk_str.png', transparent: false },
            { texture: 'textures/map/sidewalk_crn.png', transparent: false },
            { texture: 'textures/map/concrete_buildings_base.png', transparent: false },
            { texture: 'textures/map/road_centr.png', transparent: false },
            { texture: 'textures/map/road_corner.png', transparent: false },
            { texture: 'textures/map/park.png', transparent: false },
            { texture: 'textures/map/stone_poor.png', transparent: false },
            { texture: 'textures/map/sidewalk_str_poor.png', transparent: false },
            { texture: 'textures/map/sidewalk_crn_poor.png', transparent: false },
            { texture: 'textures/map/concrete_buildings_base_poor.png', transparent: false },
            { texture: 'textures/map/road_centr_poor.png', transparent: false },
            { texture: 'textures/map/road_corner_poor.png', transparent: false },
            { texture: 'textures/map/park_poor.png', transparent: false },
        ] },
        { id: 2015, modelName: 'env_plaza', asset: 'models/map/env_plaza.glb', visibleIf: { tab: 'Street' }, textures: [
            { texture: 'textures/map/park.png', transparent: false },
            { texture: 'textures/map/park_poor.png', transparent: false },
        ] },
        { id: 2016, modelName: 'env_streetlight_standard_medium', asset: 'models/map/env_streetlight_standard_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/streetlight.png', transparent: false }] },

        { id: 2017, modelName: 'env_tree_medium', asset: 'models/map/env_tree_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/leaves.png', transparent: true }, { texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/treeguard.png', transparent: true }] },
        { id: 2031, modelName: 'env_tree_poor', asset: 'models/map/env_tree_poor.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/leaves.png', transparent: true }, { texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/treeguard.png', transparent: true }] },
        { id: 2018, modelName: 'env_parkbench_medium', asset: 'models/map/env_parkbench_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/parkbench.png', transparent: false }] },
        { id: 2019, modelName: 'env_guard_post_small', asset: 'models/map/env_guard_post_small.glb', visibleIf: { tab: 'Street', security: [4, 7] }, textures: [{ texture: 'textures/map/guardpost.png', transparent: false }] },
        { id: 2020, modelName: 'env_tank_large', asset: 'models/map/env_tank_large.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/tank.png', transparent: false }] },
        { id: 2022, modelName: 'env_billboard', asset: 'models/map/env_billboard.glb', visibleIf: { tab: 'Street' } },
        { id: 2023, modelName: 'env_scaffolding_large', asset: 'models/map/env_scaffolding_large.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/scaffolding.png', transparent: false }] },
        { id: 2024, modelName: 'env_gunnest_small', asset: 'models/map/env_gunnest_small.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/gunnest.png', transparent: false }] },
        { id: 2025, modelName: 'env_cannon_medium', asset: 'models/map/env_cannon_medium.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/cannon_wheel.png', transparent: true }] },
        { id: 2026, modelName: 'env_searchlight_large', asset: 'models/map/env_searchlight_large.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/spotlight.png', transparent: true }] },
        { id: 2027, modelName: 'env_graffiti_decal', asset: 'models/map/env_graffiti_decal.glb', visibleIf: { tab: 'Street', security: [1, 3] }, textures: [{ texture: 'textures/map/graffitti.png', transparent: true }] },
        { id: 2028, modelName: 'env_pothole_decal', asset: 'models/map/env_pothole_decal.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/pothole.png', transparent: true }] },
        { id: 2029, modelName: 'env_streetbarricade_medium', asset: 'models/map/env_streetbarricade_medium.glb', visibleIf: { tab: 'Street', security: [1, 3] }, textures: [{ texture: 'textures/map/streetbarricade.png', transparent: false }] },
        { id: 2030, modelName: 'env_camera_pole_medium', asset: 'models/map/env_camera_pole_medium.glb', visibleIf: { tab: 'Street', security: [4, 7] }, textures: [{ texture: 'textures/map/camerapole.png', transparent: false }] },
        // Rich-tier buildings (visual-gaps POC 2026-11-12) — picked by BUILDING_SLOTS when conditionStage > 0
        { id: 2032, modelName: 'env_bld_mixeduse_rich', asset: 'models/map/env_bld_mixeduse_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/env_bld_mixeduse_rich_facade.png', transparent: false }, { texture: 'textures/map/bld_b_rich_trim.png', transparent: false }, { texture: 'textures/map/bld_b_rich_cutout.png', transparent: true }] },
        { id: 2033, modelName: 'env_bld_apartment_rich', asset: 'models/map/env_bld_apartment_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/env_bld_apartment_rich_facade.png', transparent: false }, { texture: 'textures/map/bld_a_rich_trim.png', transparent: true }] },
        { id: 2034, modelName: 'env_bld_commercial_rich', asset: 'models/map/env_bld_commercial_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/env_bld_commercial_rich_facade.png', transparent: false }, { texture: 'textures/map/bld_b_rich_trim.png', transparent: false }, { texture: 'textures/map/bld_b_rich_cutout.png', transparent: true }] },
        { id: 2035, modelName: 'env_bld_civic_rich', asset: 'models/map/env_bld_civic_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/env_bld_civic_rich_facade.png', transparent: false }, { texture: 'textures/map/env_bld_civic_rich_parts.png', transparent: false }, { texture: 'textures/map/bld_a_rich_trim.png', transparent: true }] },
        { id: 2036, modelName: 'env_bld_residential_rich', asset: 'models/map/env_bld_residential_rich.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/env_bld_residential_rich_facade.png', transparent: false }, { texture: 'textures/map/env_bld_residential_rich_roof.png', transparent: false }, { texture: 'textures/map/bld_b_rich_trim.png', transparent: false }, { texture: 'textures/map/bld_b_rich_cutout.png', transparent: true }] },
        // Tier swaps of existing props — placed at the normal prop's IPL positions (same pivot convention)
        { id: 2037, modelName: 'env_streetlight_poor', asset: 'models/map/env_streetlight_poor.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/env_streetlight_poor.png', transparent: false }] },
        { id: 2038, modelName: 'env_streetlight_rich', asset: 'models/map/env_streetlight_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/env_streetlight_rich.png', transparent: true }] },
        { id: 2039, modelName: 'env_parkbench_poor', asset: 'models/map/env_parkbench_poor.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/env_parkbench_poor.png', transparent: true }] },
        { id: 2040, modelName: 'env_parkbench_rich', asset: 'models/map/env_parkbench_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/env_parkbench_rich.png', transparent: true }] },
        { id: 2041, modelName: 'env_tree_rich', asset: 'models/map/env_tree_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/env_tree_rich_fronds.png', transparent: true }, { texture: 'textures/map/env_tree_rich_trunk.png', transparent: false }, { texture: 'textures/map/greenery_gold.png', transparent: true }] },
        // Plaza props per infrastructure tier — origin on the ground at the footprint centre
        { id: 2042, modelName: 'env_planter_poor', asset: 'models/map/env_planter_poor.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/greenery_stone.png', transparent: false }, { texture: 'textures/map/greenery_cards.png', transparent: true }] },
        { id: 2043, modelName: 'env_planter_normal', asset: 'models/map/env_planter_normal.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/greenery_stone.png', transparent: false }, { texture: 'textures/map/greenery_hedge.png', transparent: false }, { texture: 'textures/map/greenery_cards.png', transparent: true }] },
        { id: 2044, modelName: 'env_planter_rich', asset: 'models/map/env_planter_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/greenery_stone.png', transparent: false }, { texture: 'textures/map/greenery_hedge.png', transparent: false }, { texture: 'textures/map/greenery_gold.png', transparent: true }] },
        { id: 2045, modelName: 'env_bush_rich', asset: 'models/map/env_bush_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/greenery_hedge.png', transparent: false }, { texture: 'textures/map/greenery_gold.png', transparent: true }] },
        { id: 2046, modelName: 'env_trashcan_burning', asset: 'models/map/env_trashcan_burning.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/env_trashcan_burning.png', transparent: false }, { texture: 'textures/map/env_trashcan_burning_fire.png', transparent: true }] },
        { id: 2047, modelName: 'env_burned_decal', asset: 'models/map/env_burned_decal.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/env_burned_decal.png', transparent: true }] },
        { id: 2048, modelName: 'env_fountain_normal', asset: 'models/map/env_fountain_normal.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/env_fountain_normal.png', transparent: false }, { texture: 'textures/map/plaza_features_water.png', transparent: true }] },
        { id: 2049, modelName: 'env_fountain_rich', asset: 'models/map/env_fountain_rich.glb', visibleIf: { tab: 'Street', infrastructure: [8, 10] }, textures: [{ texture: 'textures/map/env_fountain_rich.png', transparent: false }, { texture: 'textures/map/plaza_features_water.png', transparent: true }] },
        // Statue row (GDD street-view §3.2): slot N shows its empty pedestal until the Nth statue is bought.
        // One IDE object per slot pedestal because visibleIf is per model, not per instance.
        { id: 2050, modelName: 'env_statue_pedestal_slot1', asset: 'models/map/env_statue_pedestal.glb', visibleIf: { tab: 'Street', statues: [0, 0] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }] },
        { id: 2051, modelName: 'env_statue_pedestal_slot2', asset: 'models/map/env_statue_pedestal.glb', visibleIf: { tab: 'Street', statues: [0, 1] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }] },
        { id: 2052, modelName: 'env_statue_pedestal_slot3', asset: 'models/map/env_statue_pedestal.glb', visibleIf: { tab: 'Street', statues: [0, 2] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }] },
        { id: 2053, modelName: 'env_statue_bronze', asset: 'models/map/env_statue_bronze.glb', visibleIf: { tab: 'Street', statues: [1, 3] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }, { texture: 'textures/map/env_statue_bronze.png', transparent: false }] },
        { id: 2054, modelName: 'env_statue_silver', asset: 'models/map/env_statue_silver.glb', visibleIf: { tab: 'Street', statues: [2, 3] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }, { texture: 'textures/map/env_statue_silver.png', transparent: false }] },
        { id: 2055, modelName: 'env_statue_gold', asset: 'models/map/env_statue_gold.glb', visibleIf: { tab: 'Street', statues: [3, 3] }, textures: [{ texture: 'textures/map/env_statue_pedestal.png', transparent: false }, { texture: 'textures/map/env_statue_gold.png', transparent: false }] },
    ],
};
