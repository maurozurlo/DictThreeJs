/*
    export_room_fbx.ms
    ------------------
    Exports a secret-ending room scene (e.g. `E:\Docs\dict\bunkerr01.max`) to an
    FBX the game loads for the Secret tab (src/Constants/SecretRooms.ts).

    Set the global `roomExportPath` before running (listener or Scripting >
    Run Script); it defaults to the bunker:
        roomExportPath = @"E:\GameDev\dict-three\public\assets\3d\bunker\bunker.FBX"

    Same exporter recipe as export_office_fbx.ms (see the WHY FBX / BAKE notes
    there): Standard-material diffuse maps survive, animation is resampled to one
    key per frame because three's FBXLoader interpolates linearly, mm -> m, Y up.

    TEXTURES: FBXLoader resolves texture names against the FBX's folder, but
    the exporter writes them relative to wherever the bitmaps live (e.g.
    "..\..\..\Docs\dict\bunker_wall.png"). So the script copies every bitmap
    next to the FBX (overwriting), points the scene's Bitmaptextures at those
    copies for the export (bare relative names), then restores the original
    paths. The .max file is not otherwise touched.

    Bunker timeline contract (BUNKER in src/Constants/SecretRooms.ts):
      0-10   Plane001    key inserts and turns
      15-30  Object002   red button pressed
*/
(
    local outPath = if roomExportPath != undefined then roomExportPath \
        else ((getFilenamePath (getThisScriptFilename())) + "..\\..\\public\\assets\\3d\\bunker\\bunker.FBX")

    local names = #("Animation", "BakeAnimation", "BakeFrameStart", "BakeFrameEnd", "BakeFrameStep",
        "BakeResampleAnimation", "Cameras", "Lights", "EmbedTextures", "ConvertUnit", "UpAxis", "ASCII",
        "Triangulate", "PreserveInstances", "GenerateLog", "ShowWarnings")
    local saved = for n in names collect (try (FBXExporterGetParam n) catch undefined)

    FBXExporterSetParam "Animation" true
    FBXExporterSetParam "BakeAnimation" true
    FBXExporterSetParam "BakeFrameStart" (animationRange.start.frame as integer)
    FBXExporterSetParam "BakeFrameEnd" (animationRange.end.frame as integer)
    FBXExporterSetParam "BakeFrameStep" 1
    FBXExporterSetParam "BakeResampleAnimation" true
    FBXExporterSetParam "Cameras" false
    FBXExporterSetParam "Lights" false
    FBXExporterSetParam "EmbedTextures" false
    FBXExporterSetParam "ConvertUnit" "m"
    FBXExporterSetParam "UpAxis" "Y"
    FBXExporterSetParam "ASCII" false
    FBXExporterSetParam "Triangulate" false
    FBXExporterSetParam "PreserveInstances" false
    FBXExporterSetParam "GenerateLog" false
    FBXExporterSetParam "ShowWarnings" false

    -- Copy textures next to the FBX and repath for the export.
    local outDir = getFilenamePath outPath
    local bitmaps = #()
    for o in objects where o.material != undefined do
        for b in (getClassInstances Bitmaptexture target:o.material) do appendIfUnique bitmaps b
    local oldPaths = for b in bitmaps collect b.filename
    for b in bitmaps where b.filename != undefined and b.filename != "" do (
        local src = mapPaths.getFullFilePath b.filename
        if src == "" then src = b.filename
        local dst = outDir + (filenameFromPath src)
        if (pathConfig.normalizePath src) != (pathConfig.normalizePath dst) do (
            deleteFile dst
            if not (copyFile src dst) do format "export_room_fbx: could not copy % -> %\n" src dst
        )
        b.filename = dst
    )

    local ok = exportFile outPath #noPrompt using:FBXEXP

    for i = 1 to bitmaps.count do bitmaps[i].filename = oldPaths[i]

    for i = 1 to names.count where saved[i] != undefined do
        try (FBXExporterSetParam names[i] (if isKindOf saved[i] Name then (saved[i] as string) else saved[i])) catch ()

    format "export_room_fbx: % -> %\n" (if ok then "OK" else "FAILED") outPath
    ok
)
