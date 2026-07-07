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
        { id: 2001, modelName: 'env_bld_mixeduse_normal', asset: 'models/map/env_bld_mixeduse_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building4.png', transparent: false }] },
        { id: 2002, modelName: 'env_bld_apartment_normal', asset: 'models/map/env_bld_apartment_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building1.png', transparent: false }] },
        { id: 2003, modelName: 'env_bld_commercial_normal', asset: 'models/map/env_bld_commercial_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building5.png', transparent: false }] },
        { id: 2004, modelName: 'env_bld_civic_normal', asset: 'models/map/env_bld_civic_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building2.png', transparent: false }] },
        { id: 2005, modelName: 'env_bld_residential_normal', asset: 'models/map/env_bld_residential_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building3.png', transparent: false }] },
        { id: 2006, modelName: 'env_bld_mixeduse_poor', asset: 'models/map/env_bld_mixeduse_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building4_poor.png', transparent: false }] },
        { id: 2007, modelName: 'env_bld_apartment_poor', asset: 'models/map/env_bld_apartment_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building1_poor.png', transparent: false }] },
        { id: 2008, modelName: 'env_bld_commercial_poor', asset: 'models/map/env_bld_commercial_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building5_poor.png', transparent: false }] },
        { id: 2009, modelName: 'env_bld_civic_poor', asset: 'models/map/env_bld_civic_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building2_poor.png', transparent: false }] },
        { id: 2010, modelName: 'env_bld_residential_poor', asset: 'models/map/env_bld_residential_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/map/building3_poor.png', transparent: false }] },
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
        { id: 2016, modelName: 'env_streetlight_standard_medium', asset: 'models/map/env_streetlight_standard_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 10] }, textures: [{ texture: 'textures/map/streetlight.png', transparent: false }] },

        { id: 2017, modelName: 'env_tree_medium', asset: 'models/map/env_tree_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 10] }, textures: [{ texture: 'textures/map/leaves.png', transparent: true }, { texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/treeguard.png', transparent: true }] },
        { id: 2031, modelName: 'env_tree_poor', asset: 'models/map/env_tree_poor.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/leaves.png', transparent: true }, { texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/treeguard.png', transparent: true }] },
        { id: 2018, modelName: 'env_parkbench_medium', asset: 'models/map/env_parkbench_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 10] }, textures: [{ texture: 'textures/map/parkbench.png', transparent: false }] },
        { id: 2019, modelName: 'env_guard_post_small', asset: 'models/map/env_guard_post_small.glb', visibleIf: { tab: 'Street', security: [4, 7] }, textures: [{ texture: 'textures/map/guardpost.png', transparent: false }] },
        { id: 2020, modelName: 'env_tank_large', asset: 'models/map/env_tank_large.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/tank.png', transparent: false }] },
        { id: 2021, modelName: 'env_electricpole_medium', asset: 'models/map/env_electricpole_medium.glb', visibleIf: { tab: 'Street', infrastructure: [4, 10] }, textures: [{ texture: 'textures/map/electricpole.png', transparent: true }] },
        { id: 2022, modelName: 'env_billboard', asset: 'models/map/env_billboard.glb', visibleIf: { tab: 'Street' } },
        { id: 2023, modelName: 'env_scaffolding_large', asset: 'models/map/env_scaffolding_large.glb', visibleIf: { tab: 'Street', infrastructure: [4, 7] }, textures: [{ texture: 'textures/map/scaffolding.png', transparent: false }] },
        { id: 2024, modelName: 'env_gunnest_small', asset: 'models/map/env_gunnest_small.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/gunnest.png', transparent: false }] },
        { id: 2025, modelName: 'env_cannon_medium', asset: 'models/map/env_cannon_medium.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/trunk.png', transparent: false }, { texture: 'textures/map/cannon_wheel.png', transparent: true }] },
        { id: 2026, modelName: 'env_searchlight_large', asset: 'models/map/env_searchlight_large.glb', visibleIf: { tab: 'Street', security: [8, 10] }, textures: [{ texture: 'textures/map/spotlight.png', transparent: true }] },
        { id: 2027, modelName: 'env_graffiti_decal', asset: 'models/map/env_graffiti_decal.glb', visibleIf: { tab: 'Street', security: [1, 3] }, textures: [{ texture: 'textures/map/graffitti.png', transparent: true }] },
        { id: 2028, modelName: 'env_pothole_decal', asset: 'models/map/env_pothole_decal.glb', visibleIf: { tab: 'Street', infrastructure: [1, 3] }, textures: [{ texture: 'textures/map/pothole.png', transparent: true }] },
        { id: 2029, modelName: 'env_streetbarricade_medium', asset: 'models/map/env_streetbarricade_medium.glb', visibleIf: { tab: 'Street', security: [1, 3] }, textures: [{ texture: 'textures/map/streetbarricade.png', transparent: false }] },
        { id: 2030, modelName: 'env_camera_pole_medium', asset: 'models/map/env_camera_pole_medium.glb', visibleIf: { tab: 'Street', security: [4, 7] }, textures: [{ texture: 'textures/map/camerapole.png', transparent: false }] },
    ],
};
