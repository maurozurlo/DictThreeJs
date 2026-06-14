import { useEffect, useState } from 'react'
import { useGameStore } from '../../Stores/GameState'
import { Tabs } from '../../types/Tabs'
import { useTranslation } from 'react-i18next'
import styles from './TutorialOverlay.module.css'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'

// ─── Step config ─────────────────────────────────────────────────────────────

interface StepConfig {
    selector: string | null
    bodyKey: string
    subnoteKey?: string
    /** undefined = show Got-it button; null = no button (auto-advance only) */
    ctaKey?: string | null
    tooltipSide: 'center' | 'top' | 'bottom' | 'bottom-right' | 'left' | 'right'
    oval?: boolean
}

const STEPS: StepConfig[] = [
    { selector: null,                               bodyKey: 'step1.body',  subnoteKey: 'step1.subnote',  tooltipSide: 'center' },
    { selector: '[data-tutorial="action-panel"]',   bodyKey: 'step2.body',  subnoteKey: 'step2.subnote',  tooltipSide: 'top'    },
    { selector: '[data-tutorial="tab-buttons"]',    bodyKey: 'step3.body',  subnoteKey: 'step3.subnote',  tooltipSide: 'bottom' },
    { selector: '[data-tutorial="tab-Meet"]',       bodyKey: 'step4a.body', ctaKey: null,                 tooltipSide: 'bottom' },
    { selector: '[data-tutorial="scene"]',          bodyKey: 'step4b.body', subnoteKey: 'step4b.subnote', ctaKey: null, tooltipSide: 'bottom', oval: true },
    { selector: '[data-tutorial="action-buttons"]', bodyKey: 'step5.body',  subnoteKey: 'step5.subnote',  tooltipSide: 'top'    },
    { selector: '[data-tutorial="tab-Budget"]',     bodyKey: 'step6.body',  subnoteKey: 'step6.subnote',  tooltipSide: 'bottom' },
    { selector: '[data-tutorial="tab-Shop"]',       bodyKey: 'step7.body',  subnoteKey: 'step7.subnote',  tooltipSide: 'bottom' },
    { selector: '[data-tutorial="tab-Street"]',     bodyKey: 'step8.body',  subnoteKey: 'step8.subnote',  tooltipSide: 'bottom' },
    { selector: '[data-tutorial="tab-Log"]',        bodyKey: 'step9.body',                                tooltipSide: 'bottom' },
    { selector: '[data-tutorial="advance-btn"]',    bodyKey: 'step10.body', subnoteKey: 'step10.subnote', tooltipSide: 'bottom-right' },
]
const TOTAL_STEPS = STEPS.length

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRect(selector: string | null): DOMRect | null {
    if (!selector) return null
    const el = document.querySelector(selector)
    return el ? el.getBoundingClientRect() : null
}

function tooltipStyle(rect: DOMRect | null, side: StepConfig['tooltipSide']): React.CSSProperties {
    const GAP = 20
    if (!rect || side === 'center') {
        return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }
    switch (side) {
        case 'bottom':
            return { position: 'fixed', top: rect.bottom + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
        case 'bottom-right':
            return { position: 'fixed', top: rect.bottom + GAP, right: window.innerWidth - rect.right }
        case 'top':
            return { position: 'fixed', bottom: window.innerHeight - rect.top + GAP, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
        case 'left':
            return { position: 'fixed', top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + GAP, transform: 'translateY(-50%)' }
        case 'right':
            return { position: 'fixed', top: rect.top + rect.height / 2, left: rect.right + GAP, transform: 'translateY(-50%)' }
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

const TutorialOverlay = () => {
    const { t } = useTranslation('tutorial')

    const active        = useGameStore(s => s.tutorial.active)
    const activate      = useGameStore(s => s.tutorial.activate)
    const deactivate    = useGameStore(s => s.tutorial.deactivate)
    const phase         = useGameStore(s => s.gameManagement.phase)
    const activeTab     = useGameStore(s => s.tabs.activeTab)
    const selectedPower = useGameStore(s => s.meet.selectedPower)
    const pauseTimer    = useGameStore(s => s.gameManagement.pauseTimer)
    const resumeTimer   = useGameStore(s => s.gameManagement.resumeTimer)
    const setActiveTab  = useGameStore(s => s.tabs.setActiveTab)

    const [step, setStep]           = useState(0)
    const [showFinale, setShowFinale] = useState(false)
    const [rect, setRect]           = useState<DOMRect | null>(null)

    // ── Auto-trigger on first run ─────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'start' && !localStorage.getItem('dict_tutorial_seen')) {
            activate()
        }
    }, [phase])

    // ── Pause timer on tutorial start ─────────────────────────────────────────
    useEffect(() => {
        if (active) {
            setStep(0)
            setShowFinale(false)
            pauseTimer()
        }
    }, [active])

    // ── Update spotlight rect when step changes ───────────────────────────────
    useEffect(() => {
        if (!active) return
        const config = STEPS[step]
        if (!config) return

        const update = () => setRect(getRect(config.selector))
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [active, step])

    // ── Auto-advance step 4a → 4b when Meet tab opens ─────────────────────────
    useEffect(() => {
        if (active && step === 3 && activeTab === Tabs.Meet) {
            const timer = setTimeout(() => setStep(4), 350)
            return () => clearTimeout(timer)
        }
    }, [active, step, activeTab])

    // ── Auto-advance step 4b → 5 when faction selected ───────────────────────
    useEffect(() => {
        if (active && step === 4 && selectedPower !== 'none') {
            setStep(5)
        }
    }, [active, step, selectedPower])

    // ── Show finale card when past last step ──────────────────────────────────
    useEffect(() => {
        if (active && step >= TOTAL_STEPS) {
            setShowFinale(true)
        }
    }, [active, step])

    function advance() { setStep(s => s + 1) }

    function complete(nav: 'game' | 'menu') {
        localStorage.setItem('dict_tutorial_seen', 'true')
        resumeTimer()
        deactivate()
        setShowFinale(false)
        setStep(0)
        setActiveTab(nav === 'menu' ? Tabs.Menu : Tabs.Log)
    }

    function skip() {
        localStorage.setItem('dict_tutorial_seen', 'true')
        resumeTimer()
        deactivate()
        setShowFinale(false)
        setStep(0)
    }

    if (!active) return null

    // ── Finale card ───────────────────────────────────────────────────────────
    if (showFinale) {
        return (
            <div className={styles.finaleWrapper}>
                <div className={styles.finaleCard}>
                    <p className={styles.body}>{t('toast')}</p>
                    <div className={styles.finaleButtons}>
                        <Button variant="primary" onClick={() => complete('game')}>{t('start_playing')}</Button>
                        <Button variant="secondary" onClick={() => complete('menu')}>{t('back_to_menu')}</Button>
                    </div>
                </div>
            </div>
        )
    }

    const config = STEPS[step]
    if (!config) return null

    const spotRect = rect
    const spotlight = spotRect ? {
        position: 'fixed' as const,
        top: spotRect.top,
        left: spotRect.left,
        width: spotRect.width,
        height: spotRect.height,
        borderRadius: config.oval ? '50%' : 4,
    } : null

    const ttStyle = tooltipStyle(spotRect, config.tooltipSide)
    const showCta = config.ctaKey !== null

    return (
        <div className={styles.root}>
            {spotlight ? (
                <div className={styles.spotlight} style={spotlight} />
            ) : (
                <div className={styles.scrim} />
            )}

            <div
                className={styles.tooltip}
                style={ttStyle}
                role="dialog"
                aria-label={`Tutorial step ${step + 1} of ${TOTAL_STEPS}`}
            >
                <p className={styles.body}>{t(config.bodyKey)}</p>
                {config.subnoteKey && (
                    <p className={styles.subnote}>{t(config.subnoteKey)}</p>
                )}
                {showCta && (
                    <Button onClick={advance}>{t('cta')}</Button>
                )}
                {!showCta && step === 3 && (
                    <span className={styles.waiting}><Icon type="caret" /></span>
                )}
                <button className={styles.skipLink} onClick={skip}>
                    {t('skip')}
                </button>
            </div>
        </div>
    )
}

export default TutorialOverlay
