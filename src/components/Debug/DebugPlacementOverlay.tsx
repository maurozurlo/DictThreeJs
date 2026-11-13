import { useEffect, useState } from 'react'
import { useGameStore } from '../../Stores/GameState'
import { useDebugEditStore } from '../../Stores/DebugEditStore'
import { placementSourceByKey } from '../../Hooks/useStreetLayout'
import { STREET_PLAN } from '../../assets/data/road-plans'
import { buildPlacementEditExport, isEffectiveEdit, placementEditFileName, yawDegOf } from '../../Utils/PlacementEdit'
import { downloadJson } from '../../Utils/DownloadJson'
import styles from './DebugPlacementOverlay.module.css'

/** How long the "saved" line stays up. */
const SAVED_FLASH_MS = 4000

/** Builds the edit JSON from the current store and downloads it. Returns the file name and edit count. */
function saveEdits(): { fileName: string; count: number } {
    const now = new Date()
    const payload = buildPlacementEditExport(
        useDebugEditStore.getState().edits, placementSourceByKey, STREET_PLAN.id, now.toISOString(),
    )
    const fileName = placementEditFileName(now)
    downloadJson(fileName, payload)
    return { fileName, count: payload.edits.length }
}

/**
 * Debug-only (debug mode, Street tab) HUD + hotkeys for the placement editor: click a placed
 * object to put the gizmo on it, then
 *   T move · R rotate (yaw) · X reset object · Z undo · Esc deselect · D download edits JSON
 * (Shift+D while the free cam is on — plain D strafes there).
 */
const DebugPlacementOverlay = () => {
    const freeCam = useGameStore(s => s.debug.freeCam)
    const selectedKey = useDebugEditStore(s => s.selectedKey)
    const mode = useDebugEditStore(s => s.mode)
    const edits = useDebugEditStore(s => s.edits)
    const [flash, setFlash] = useState<string | null>(null)

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
            const store = useDebugEditStore.getState()
            switch (e.code) {
                case 'KeyT': store.setMode('translate'); break
                case 'KeyR': if (!e.ctrlKey && !e.metaKey) store.setMode('rotate'); break
                case 'KeyX': if (store.selectedKey) store.resetEdit(store.selectedKey); break
                case 'KeyZ': store.undo(); break
                case 'Escape': store.selectForEdit(null); break
                case 'KeyD': {
                    if (e.ctrlKey || e.metaKey || e.altKey) return
                    if (useGameStore.getState().debug.freeCam && !e.shiftKey) return
                    e.preventDefault()
                    const { fileName, count } = saveEdits()
                    setFlash(`saved ${fileName} (${count} edit${count === 1 ? '' : 's'})`)
                    break
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    useEffect(() => {
        if (flash === null) return
        const id = setTimeout(() => setFlash(null), SAVED_FLASH_MS)
        return () => clearTimeout(id)
    }, [flash])

    const count = Object.entries(edits).filter(([key, e]) => {
        const src = placementSourceByKey(key)
        return src !== undefined && isEffectiveEdit(src, e)
    }).length

    const src = selectedKey ? placementSourceByKey(selectedKey) : undefined
    const current = selectedKey ? edits[selectedKey] ?? src : undefined
    const fmt = (n: number) => n.toFixed(2)

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                PLACEMENT EDIT · {mode === 'translate' ? 'MOVE' : 'ROTATE'} · {count} edited
            </div>
            {src && current ? (
                <div className={styles.selected}>
                    {src.models.join(' / ')} [{src.key}] pos {current.pos.map(fmt).join(', ')} · yaw {yawDegOf(current.rot).toFixed(1)}°
                </div>
            ) : (
                <div className={styles.keys}>click a street object to grab it</div>
            )}
            <div className={styles.keys}>
                T move · R rotate · X reset · Z undo · Esc drop · {freeCam ? 'Shift+D' : 'D'} save JSON
            </div>
            {flash && <div className={styles.flash}>{flash}</div>}
        </div>
    )
}

export default DebugPlacementOverlay
