/*
    export_unique_meshes.ms
    -----------------------
    A small dockable-style dialog to batch-export meshes to GLB for the IPL/IDE
    pipeline. Pick (or accept the baked-in) output folder, then Export.

    Per object it makes a temp copy, zeroes position + rotation, bakes scale to
    100% (ResetXForm + collapse), and exports its own .glb -- once per unique
    object NAME (repeated props share a name, so they export once). The scene is
    never modified; temp copies are deleted.

    Pairs with the IPL: meshes are baked to in-scene size (so IPL scale = [1,1,1])
    and pivots end at origin. Export runs with the glTF exporter's last dialog
    settings (#noPrompt) -- set them once via File > Export if needed.

    AXIS NOTE: the Max ATF glTF exporter DOES convert geometry to Y-up (adds a root
    -90deg X node), matching convert_maxdump.mjs's pos/rot conversion. So no engine-
    side rotation is needed -- the GLBs render Y-up as-is.

    UNITS NOTE: this Max scene is in MILLIMETRES, so the exporter bakes a 0.001 mm->m
    scale onto each mesh node and the GLBs render 1000x too small. The engine currently
    compensates (StreetView.tsx GLB_UNIT_FIX = 1000). PROPER FIX: set System Units to
    metres (Customize > Units Setup > System Unit Scale = 1.0 Meters) and re-export,
    then set GLB_UNIT_FIX = 1.

    TEXTURES (external files, not embedded):
      The engine applies the PNGs in public/textures/ over each mesh's UVs at
      render time -- it does NOT read textures out of the GLB. For that to work:
        1. Each GLB must carry UVs (TEXCOORD_0). The ATF glTF exporter only keeps
           UVs when the mesh has a glTF-translatable material, so this script
           assigns a temporary PhysicalMaterial to the export copy. The SOURCE
           mesh must still have a UVW map channel (add a UVW Map modifier in Max
           if a re-exported GLB shows no UVs).
        2. This script writes texture-manifest.json next to the GLBs: a map of
           { modelName: "diffuse_texture_basename.png" } read from each object's
           material. tools/ipl/convert_maxdump.mjs reads it and emits the IDE
           `texture: 'textures/<file>'` field. Copy the manifest next to the dump
           before running the converter (or export both to the same folder).
*/
(
    global gExportMeshesRollout
    try (destroyDialog gExportMeshesRollout) catch ()

    rollout gExportMeshesRollout "Export Unique Meshes -> GLB" width:440
    (
        -- baked-in default: the game's public/models folder
        local defaultDir = @"e:\GameDev\dict-three\public\models\"

        group "Output folder"
        (
            edittext etPath "" text:defaultDir width:330 across:2 align:#left
            button btnBrowse "Browse..." width:80 align:#right
        )
        checkbox chkAll "Process ALL scene objects (ignore selection)" checked:false
        label lblFilter "Only exports objects named env_* / ped_* / veh_*" align:#left width:420
        button btnExport "Export -> GLB" width:420 height:34
        progressBar pbProgress value:0 width:420
        label lblStatus "Ready." align:#left width:420

        -- only game props (these prefixes) are exportable; skips cameras/dummies/etc.
        fn hasExportPrefix name =
        (
            (matchPattern name pattern:"env_*") or (matchPattern name pattern:"ped_*") or (matchPattern name pattern:"veh_*")
        )

        -- diffuse / base-colour bitmap of a SINGLE (sub)material, or undefined.
        fn diffuseBitmapFor m =
        (
            if m == undefined do return undefined
            local mp = undefined
            if (hasProperty m #diffuseMap and m.diffuseMap != undefined) do mp = m.diffuseMap                  -- Standard & co.
            if (mp == undefined and hasProperty m #base_color_map and m.base_color_map != undefined) do mp = m.base_color_map  -- Physical
            mp
        )

        -- texture basename (with extension) of a SINGLE (sub)material, or "".
        fn texBasenameOf m =
        (
            local mp = diffuseBitmapFor m
            if mp != undefined and (hasProperty mp #filename) and mp.filename != undefined and mp.filename != "" then
                (filenameFromPath mp.filename)
            else ""
        )

        -- Convert a SINGLE material to a glTF-friendly PhysicalMaterial NAMED after its
        -- texture basename (the engine matches textures to parts by material name), with a
        -- base-colour map so the ATF exporter keeps UVs (TEXCOORD_0); a map-less material
        -- drops them. The engine uses our EXTERNAL textures, so embed-vs-reference is moot.
        fn toGltfSubMat m =
        (
            local tb = texBasenameOf m
            local nm = if tb != "" then tb else (if m != undefined and m.name != undefined then m.name else "untextured")
            local pm = PhysicalMaterial name:nm
            local mp = diffuseBitmapFor m
            if mp != undefined do pm.base_color_map = mp
            pm
        )

        -- Convert a material (single or Multi) PRESERVING the multi-sub structure (matching
        -- material IDs), and collect each slot's texture basename into texAcc (unique).
        fn convertMaterialTree m texAcc =
        (
            if m != undefined and (classOf m == Multimaterial) then
            (
                local out = Multimaterial numsubs:m.numsubs
                out.name = m.name
                for i = 1 to m.numsubs do
                (
                    out.materialIDList[i] = m.materialIDList[i]
                    out.names[i] = m.names[i]
                    out.materialList[i] = toGltfSubMat m.materialList[i]
                    local tb = texBasenameOf m.materialList[i]
                    if tb != "" do appendIfUnique texAcc tb
                )
                out
            )
            else
            (
                local tb = texBasenameOf m
                if tb != "" do appendIfUnique texAcc tb
                toGltfSubMat m
            )
        )

        -- write { "modelName": ["tex0.png", ...], ... } as JSON for the IPL converter
        fn writeTextureManifest dir pairs =
        (
            local mb = stringStream ""
            format "{\n" to:mb
            local n = pairs.count
            for i = 1 to n do
            (
                local nm = substituteString pairs[i][1] "\\" "\\\\"
                local arr = pairs[i][2]
                format "  \"%\": [" nm to:mb
                for j = 1 to arr.count do
                (
                    local tx = substituteString arr[j] "\\" "\\\\"
                    format "\"%\"" tx to:mb
                    if j < arr.count do format ", " to:mb
                )
                format "]" to:mb
                if i < n then format ",\n" to:mb else format "\n" to:mb
            )
            format "}\n" to:mb
            local f = createFile (dir + "texture-manifest.json")
            format "%" (mb as string) to:f
            close f
        )

        -- normalize + export the given nodes to dir
        fn exportMeshes nodes dir =
        (
            if dir == undefined or dir == "" do ( messageBox "Pick an output folder first." title:"Export"; return false )
            if nodes.count == 0 do ( messageBox "Nothing to export (selection is empty)." title:"Export"; return false )
            if (dir[dir.count] != "\\") do dir += "\\"
            makeDir dir all:true

            local exportedNames = #()
            local manifestPairs = #()
            local failures = #()
            disableSceneRedraw()
            try
            (
                local total = nodes.count
                for i = 1 to total do
                (
                    pbProgress.value = (100.0 * i / total)
                    windows.processPostedMessages()
                    local obj = nodes[i]
                    if (findItem exportedNames obj.name == 0) do
                    (
                        appendIfUnique exportedNames obj.name
                        local modelTex = #()
                        local newMat = convertMaterialTree obj.material modelTex   -- from the SOURCE material(s)
                        if modelTex.count > 0 do append manifestPairs #(obj.name, modelTex)
                        lblStatus.text = ("Exporting: " + obj.name)
                        local tempObj = undefined
                        try
                        (
                            tempObj = copy obj
                            tempObj.parent = undefined
                            tempObj.name = obj.name
                            tempObj.transform = scaleMatrix tempObj.scale   -- zero pos+rot, keep scale
                            ResetXForm tempObj                              -- bake scale into geometry
                            collapseStack tempObj
                            -- Replace materials with glTF-friendly PhysicalMaterials named after
                            -- their textures, PRESERVING the multi-sub structure so each part keeps
                            -- its own texture + UVs. The engine applies our EXTERNAL textures by
                            -- matching each part's material name.
                            tempObj.material = newMat
                            select tempObj
                            exportFile (dir + tempObj.name + ".glb") #noPrompt selectedOnly:true
                        )
                        catch ( append failures obj.name; format "  ! failed on %: %\n" obj.name (getCurrentException()) )
                        if isValidNode tempObj do delete tempObj
                    )
                )
            )
            catch ( enableSceneRedraw(); throw() )
            enableSceneRedraw()

            try ( writeTextureManifest dir manifestPairs )
            catch ( format "  ! failed to write texture-manifest.json: %\n" (getCurrentException()) )

            pbProgress.value = 100
            local msg = "Done. " + (exportedNames.count as string) + " mesh(es), " + (manifestPairs.count as string) + " textured"
            if failures.count > 0 do msg += (", " + (failures.count as string) + " FAILED (see Listener)")
            lblStatus.text = msg
            format "%  ->  %\n" msg dir
            true
        )

        on btnBrowse pressed do
        (
            local p = getSavePath caption:"Choose output folder" initialDir:etPath.text
            if p != undefined do etPath.text = p
        )

        on btnExport pressed do
        (
            local keepSel = selection as array
            local pool = if chkAll.checked then (objects as array) else keepSel
            local src = for o in pool where (hasExportPrefix o.name) collect o
            if src.count == 0 then
                messageBox "No env_ / ped_ / veh_ objects found to export." title:"Export"
            else
                exportMeshes src etPath.text
            select keepSel
        )

    )

    createDialog gExportMeshesRollout
)
