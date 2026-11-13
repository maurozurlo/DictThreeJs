/*
    export_office_fbx.ms
    --------------------
    Exports the palace interior (Meet + Laws rooms and the representative
    "execution" props) from `main interiors06.max` to public/assets/3d/main.FBX.

    Run in Max via Scripting > Run Script, or through the claude listener
    (3ps tools/max/claude_listener.ms) after setting `officeExportPath`.

    WHY FBX (not the glTF exporter): the Max 2023 glTF exporter only understands
    Physical materials -- with this scene's Standard materials it writes black
    "fallback Material"s, drops UVs, and writes no animation. FBX keeps the
    Standard material diffuse maps (resolved by basename from /assets/3d/ by
    three's FBXLoader) and the transform animation.

    BAKE NOTE: three's FBXLoader interpolates LINEARLY between FBX keys and
    ignores tangents, so the Bezier keys must be resampled to one key per frame
    ("BakeResampleAnimation"); otherwise in-betweens drift (the claw was 10 mm
    off at frame 50). Units convert mm -> m, Y up; the game places the result
    with OFFICE_MODEL_OFFSET (src/Constants/Office.ts).

    Exporter settings are saved before and restored after, so a manual
    File > Export afterwards behaves as before.

    Timeline contract (see REP_EXECUTIONS in src/Constants/Office.ts):
      0-20   Object002 + Helix001   couch spring yeets the business rep
      20-35  Object001              trapdoor drops the military rep
      40-80  Dummy001 + Box072-074  toy claw takes the people's rep
*/
(
    local outPath = if officeExportPath != undefined then officeExportPath \
        else ((getFilenamePath (getThisScriptFilename())) + "..\\..\\public\\assets\\3d\\main.FBX")

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

    local ok = exportFile outPath #noPrompt using:FBXEXP

    for i = 1 to names.count where saved[i] != undefined do
        try (FBXExporterSetParam names[i] (if isKindOf saved[i] Name then (saved[i] as string) else saved[i])) catch ()

    format "export_office_fbx: % -> %\n" (if ok then "OK" else "FAILED") outPath
    ok
)
