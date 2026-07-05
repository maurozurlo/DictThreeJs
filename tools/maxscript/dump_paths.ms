/*
    dump_paths.ms
    -------------
    Dumps spline shapes (ped/car paths, crossings, zones) to the MAXScript
    Listener as JSON, and copies it to the clipboard.

    Naming convention (prefix decides the role; everything else is ignored):
      path_ped_*   closed loop  - pedestrian walk loop
      path_car_*   closed loop  - vehicle loop
      cross_*      open line    - street crossing (peds cross; cars get stop nodes)
      zone_*       closed rect  - area zone (e.g. zone_protest)

    IMPORTANT - coordinates are RAW 3ds Max world space (Z-up, scene units).
    The Z-up -> Y-up / unit conversion happens in tools/ipl/convert_paths.mjs,
    matching the dump_placements.ms / convert_maxdump.mjs pipeline (1 unit = 1 m).

    For each shape this dumps BOTH:
      knots   - the authored knot points
      samples - even arc-length samples every SAMPLE_STEP units (captures the
                rounded corners; the converter simplifies straights back down)

    Usage: Scripting > New Script, paste, Ctrl+E. JSON prints to the Listener
    and lands on the clipboard - save it to a .txt next to your other dumps.
*/
(
    -- ---- options -------------------------------------------------------------
    local SAMPLE_STEP = 1.0   -- arc-length sampling step in scene units (metres)
    local decimals    = ".4f"

    -- ---- helpers -------------------------------------------------------------
    fn jstr s = (
        local r = substituteString s "\\" "\\\\"
        r = substituteString r "\"" "\\\""
        "\"" + r + "\""
    )
    fn fnum v = formattedPrint v format:decimals
    fn hasPrefix s p = (s.count >= p.count and (substring s 1 p.count) == p)

    fn wantedShape name = (
        hasPrefix name "path_ped_" or hasPrefix name "path_car_" or \
        hasPrefix name "cross_" or hasPrefix name "zone_"
    )

    fn pt3Json p = ("[" + (fnum p.x) + ", " + (fnum p.y) + ", " + (fnum p.z) + "]")

    -- ---- gather --------------------------------------------------------------
    local shapesToDump = for s in shapes where (wantedShape s.name) collect s

    -- ---- build JSON ----------------------------------------------------------
    local sb = stringStream ""
    format "{\n\"units\": %, \"sampleStep\": %, \"shapes\": [\n" (jstr (units.SystemType as string)) (fnum SAMPLE_STEP) to:sb

    local n = shapesToDump.count
    for i = 1 to n do (
        local s = shapesToDump[i]
        if (numSplines s) > 1 do format "-- WARNING: % has % splines; only spline 1 is dumped\n" s.name (numSplines s)

        local closed = isClosed s 1
        local nk = numKnots s 1

        in coordsys world (
            -- knots
            local knotStrs = for k = 1 to nk collect (pt3Json (getKnotPoint s 1 k))

            -- even arc-length samples (closed loops skip the duplicate end point)
            local len = curveLength s 1
            local steps = amax 4 ((ceil (len / SAMPLE_STEP)) as integer)
            local lastT = if closed then (steps - 1) else steps
            local sampleStrs = for t = 0 to lastT collect (
                pt3Json (lengthInterp s 1 ((t as float) / (steps as float)))
            )

            format "  {\"name\": %, \"closed\": %, " (jstr s.name) (if closed then "true" else "false") to:sb
            format "\"knots\": [%], " (
                local ks = stringStream ""
                (for j = 1 to knotStrs.count do (format "%" knotStrs[j] to:ks; if j < knotStrs.count do format ", " to:ks))
                ks as string
            ) to:sb
            format "\"samples\": [%]}" (
                local ss = stringStream ""
                (for j = 1 to sampleStrs.count do (format "%" sampleStrs[j] to:ss; if j < sampleStrs.count do format ", " to:ss))
                ss as string
            ) to:sb
        )
        if i < n then format ",\n" to:sb else format "\n" to:sb
    )
    format "]}\n" to:sb

    local result = sb as string
    format "%\n" result
    try (setClipBoardText result) catch ()
    format "-- dump_paths: % shape(s) dumped (system units: %). JSON on clipboard.\n" n (units.SystemType)
)
