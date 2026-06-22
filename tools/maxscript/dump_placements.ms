/*
    dump_placements.ms
    -------------------
    Dumps every object's NAME, world POSITION, world ROTATION (quaternion) and
    world SCALE to the MAXScript Listener as a JSON array, and copies it to the
    clipboard.

    Intended pipeline: paste the printed JSON back to the engine side, where it is
    converted into the custom IPL format (src/assets/data/*.ipl.ts).

    IMPORTANT — coordinates are RAW 3ds Max world space:
      * 3ds Max is Z-up, right-handed, in the scene's system units.
      * The engine IPL is Y-up, in metres, quaternion [x, y, z, w].
      * The Z-up -> Y-up / handedness / unit conversion is done DURING the IPL
        conversion step, NOT here. This script reports Max values verbatim.

    Usage:
      1. Scripting menu > New Script, paste this file, then Tools > Evaluate All
         (Ctrl+E). Output appears in the Listener and is copied to the clipboard.
      2. Toggle the options below if you only want the current selection or only
         geometry (meshes), excluding cameras/lights/helpers.
*/
(
    -- ---- options -------------------------------------------------------------
    local useSelectionOnly = false   -- true = only dump currently selected objects
    local geometryOnly      = false  -- true = only dump geometry (skip lights/cameras/helpers)
    local decimals          = ".6f"  -- printf-style float format

    -- ---- gather nodes --------------------------------------------------------
    local nodes = (if useSelectionOnly and selection.count > 0 then (selection as array) else (objects as array))
    if geometryOnly do nodes = (for o in nodes where (superClassOf o == GeometryClass) collect o)

    -- ---- helpers -------------------------------------------------------------
    -- JSON-escape a string and wrap it in double quotes.
    fn jstr s = (
        local r = substituteString s "\\" "\\\\"
        r = substituteString r "\"" "\\\""
        "\"" + r + "\""
    )
    -- Fixed-precision number as a string (avoids scientific notation).
    fn fnum v = formattedPrint v format:decimals

    -- ---- build JSON ----------------------------------------------------------
    local sb = stringStream ""
    format "[\n" to:sb
    local n = nodes.count
    for i = 1 to n do (
        local obj = nodes[i]
        local tm  = obj.transform          -- world-space matrix3
        local p   = tm.translation         -- world position (point3)
        local q   = tm.rotation            -- world rotation (quat: x, y, z, w)
        local s   = tm.scale               -- world scale (point3)

        format "  {\"name\": %, " (jstr obj.name) to:sb
        format "\"pos\": [%, %, %], " (fnum p.x) (fnum p.y) (fnum p.z) to:sb
        format "\"rot\": [%, %, %, %], " (fnum q.x) (fnum q.y) (fnum q.z) (fnum q.w) to:sb
        format "\"scale\": [%, %, %]}" (fnum s.x) (fnum s.y) (fnum s.z) to:sb
        if i < n then format ",\n" to:sb else format "\n" to:sb
    )
    format "]\n" to:sb

    local result = sb as string

    -- ---- output --------------------------------------------------------------
    format "%\n" result                                              -- print to Listener / command line
    try (setClipBoardText result) catch ()                           -- and copy to clipboard
    format "-- dump_placements: % object(s) dumped (system units: %). JSON on clipboard.\n" n (units.SystemType)
)
