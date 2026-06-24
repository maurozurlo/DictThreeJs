import type { IDEFile } from '../../types/WorldLayout';

/**
 * Street scene object definitions (IDE format, GTA-inspired).
 * One entry per distinct model type. Asset paths are relative to public/.
 * Generated stub — fix asset paths/extensions and visibleIf as needed.
 */
export const STREET_IDE: IDEFile = {
    version: 1,
    objs: [
        // Buildings Normal
        { id: 2001, modelName: 'env_bld_mixeduse_normal', asset: 'models/env_bld_mixeduse_poor.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/building4.png', transparent: false }] },
        { id: 2002, modelName: 'env_bld_apartment_normal', asset: 'models/env_bld_apartment_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/building1.png', transparent: false }] },
        { id: 2003, modelName: 'env_bld_commercial_normal', asset: 'models/env_bld_commercial_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/building5.png', transparent: false }] },
        { id: 2004, modelName: 'env_bld_civic_normal', asset: 'models/env_bld_civic_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/building2.png', transparent: false }] },
        { id: 2005, modelName: 'env_bld_residential_normal', asset: 'models/env_bld_residential_normal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/building3.png', transparent: false }] },
        // Buildings Poor
        { id: 2006, modelName: 'env_bld_mixeduse_poor', asset: 'models/env_bld_mixeduse_poor.glb', visibleIf: { tab: 'Street', infrastructure: [0, 2] }, textures: [{ texture: 'textures/building4_poor.png', transparent: false }] },
        { id: 2007, modelName: 'env_bld_apartment_poor', asset: 'models/env_bld_apartment_poor.glb', visibleIf: { tab: 'Street', infrastructure: [0, 2] }, textures: [{ texture: 'textures/building1_poor.png', transparent: false }] },
        { id: 2008, modelName: 'env_bld_commercial_poor', asset: 'models/env_bld_commercial_poor.glb', visibleIf: { tab: 'Street', infrastructure: [0, 2] }, textures: [{ texture: 'textures/building5_poor.png', transparent: false }] },
        { id: 2009, modelName: 'env_bld_civic_poor', asset: 'models/env_bld_civic_poor.glb', visibleIf: { tab: 'Street', infrastructure: [0, 2] }, textures: [{ texture: 'textures/building2_poor.png', transparent: false }] },
        { id: 2010, modelName: 'env_bld_residential_poor', asset: 'models/env_bld_residential_poor.glb', visibleIf: { tab: 'Street', infrastructure: [0, 2] }, textures: [{ texture: 'textures/building3_poor.png', transparent: false }] },
        // Street Objects
        { id: 2011, modelName: 'env_flagpole_large', asset: 'models/env_flagpole_large.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/flagpole.png', transparent: false }] },
        { id: 2012, modelName: 'env_flag_small', asset: 'models/env_flag_small.glb', visibleIf: { tab: 'Street' } },

        { id: 2013, modelName: 'env_skyline', asset: 'models/env_skyline.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/skyline.png', transparent: true }] },
        { id: 2014, modelName: 'env_roads', asset: 'models/env_roads.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/stone.png', transparent: false }] },
        { id: 2015, modelName: 'env_plaza', asset: 'models/env_plaza.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/park.png', transparent: false }] },
        { id: 2016, modelName: 'env_streetlight_standard_medium', asset: 'models/env_streetlight_standard_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/streetlight.png', transparent: false }] },

        { id: 2017, modelName: 'env_tree_medium', asset: 'models/env_tree_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/leaves.png', transparent: true }, { texture: 'textures/trunk.png', transparent: false }, { texture: 'textures/treeguard.png', transparent: true }] },
        { id: 2018, modelName: 'env_parkbench_medium', asset: 'models/env_parkbench_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/parkbench.png', transparent: false }] },
        { id: 2019, modelName: 'env_guard_post_small', asset: 'models/env_guard_post_small.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/guardpost.png', transparent: false }] },
        { id: 2020, modelName: 'env_tank_large', asset: 'models/env_tank_large.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/tank.png', transparent: false }] },
        { id: 2021, modelName: 'env_electricpole_medium', asset: 'models/env_electricpole_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/electricpole.png', transparent: true }] },
        { id: 2022, modelName: 'env_billboard', asset: 'models/env_billboard.glb', visibleIf: { tab: 'Street' } },
        { id: 2023, modelName: 'env_scaffolding_large', asset: 'models/env_scaffolding_large.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/scaffolding.png', transparent: false }] },
        { id: 2024, modelName: 'env_gunnest_small', asset: 'models/env_gunnest_small.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/gunnest.png', transparent: false }] },
        { id: 2025, modelName: 'env_cannon_medium', asset: 'models/env_cannon_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/trunk.png', transparent: false }, { texture: 'textures/cannon_wheel.png', transparent: true }] },
        { id: 2026, modelName: 'env_searchlight_large', asset: 'models/env_searchlight_large.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/spotlight.png', transparent: true }] },
        { id: 2027, modelName: 'env_graffiti_decal', asset: 'models/env_graffiti_decal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/graffitti.png', transparent: true }] },
        { id: 2028, modelName: 'env_pothole_decal', asset: 'models/env_pothole_decal.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/pothole.png', transparent: true }] },
        { id: 2029, modelName: 'env_streetbarricade_medium', asset: 'models/env_streetbarricade_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/streetbarricade.png', transparent: false }] },
        { id: 2030, modelName: 'env_camera_pole_medium', asset: 'models/env_camera_pole_medium.glb', visibleIf: { tab: 'Street' }, textures: [{ texture: 'textures/camerapole.png', transparent: false }] },
    ],
};
