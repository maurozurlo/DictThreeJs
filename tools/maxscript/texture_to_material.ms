(
    fn getBitmapNameFromMaterial mat =
    (
        if mat == undefined then return undefined
        if classof mat == Bitmaptexture then return getFilenameFile mat.filename

        if isProperty mat #diffuseMap and mat.diffuseMap != undefined and classof mat.diffuseMap == Bitmaptexture then
            return getFilenameFile mat.diffuseMap.filename

        if isProperty mat #baseColorMap and mat.baseColorMap != undefined and classof mat.baseColorMap == Bitmaptexture then
            return getFilenameFile mat.baseColorMap.filename

        if isProperty mat #diffuseColorMap and mat.diffuseColorMap != undefined and classof mat.diffuseColorMap == Bitmaptexture then
            return getFilenameFile mat.diffuseColorMap.filename

        if isProperty mat #albedoMap and mat.albedoMap != undefined and classof mat.albedoMap == Bitmaptexture then
            return getFilenameFile mat.albedoMap.filename

        if isProperty mat #map and mat.map != undefined and classof mat.map == Bitmaptexture then
            return getFilenameFile mat.map.filename

        undefined
    )

    fn renameMaterialByDiffuse mat =
    (
        if mat == undefined then return 0
        local renamedCount = 0

        local newName = getBitmapNameFromMaterial mat
        if newName != undefined and newName != mat.name then
        (
            format "Renaming material \"%\" -> \"%\"\n" mat.name newName
            mat.name = newName
            renamedCount += 1
        )

        if isProperty mat #materialList and mat.materialList != undefined then
        (
            for i = 1 to mat.numsubs do
            (
                renamedCount += renameMaterialByDiffuse mat.materialList[i]
            )
        )

        renamedCount
    )

    fn renameSelectedSubmaterials =
    (
        if selection.count == 0 then
        (
            messageBox "Select one or more objects first."
            return false
        )

        local totalRenamed = 0
        for obj in selection do
        (
            if obj.material != undefined then
                totalRenamed += renameMaterialByDiffuse obj.material
        )
        format "Total materials renamed: %\n" totalRenamed
        totalRenamed
    )

    renameSelectedSubmaterials()
)