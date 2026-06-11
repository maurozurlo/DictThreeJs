import { useEffect, useState } from 'react'
import { useGameStore } from '../../Stores/GameState'
import { calculateRoundFinancials } from '../../Stores/BudgetHandler'
import { MoneyNumberFormatter } from '../../Constants/Budget'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useTranslation } from 'react-i18next'
import styles from './RoundAdvanceController.module.css'
import { Modal, ModalCard } from '../Modal/Modal'

const RoundAdvanceController = () => {
    const { t } = useTranslation()
    const requested       = useGameStore(s => s.gameManagement.advanceRoundRequested)
    const clearRequest    = useGameStore(s => s.gameManagement.clearAdvanceRoundRequest)
    const expireTimer     = useGameStore(s => s.gameManagement.expireTimer)
    const round           = useGameStore(s => s.gameManagement.round)
    const budget          = useGameStore(s => s.budget)
    const meetTaken       = useGameStore(s => s.meet.actionTaken.taken)
    const lawDecided      = useGameStore(s => s.law.lawDecided)
    const dealDecided     = useGameStore(s => s.deals.dealDecided)

    const [showConfirm, setShowConfirm]     = useState(false)
    const [showSkipModal, setShowSkipModal] = useState(false)

    const allActionsDone = meetTaken && lawDecided && dealDecided
    const projected      = calculateRoundFinancials(budget)
    const projectedNet   = projected.totalIncome - projected.expenses

    useEffect(() => {
        if (!requested) return
        clearRequest()
        if (allActionsDone) {
            setShowSkipModal(true)
        } else {
            setShowConfirm(true)
        }
    }, [requested])

    function handleConfirm() {
        setShowConfirm(false)
        setShowSkipModal(true)
    }

    function handleSkipModalContinue() {
        setShowSkipModal(false)
        expireTimer()
    }

    if (showConfirm) return (
        <Modal>
            <ModalCard>
                <Typography variant="body">{t('actionPanel.advance_warning')}</Typography>
                <div className={styles.buttons}>
                    <Button onClick={handleConfirm}>{t('actionPanel.confirm')}</Button>
                    <Button onClick={() => setShowConfirm(false)}>{t('actionPanel.cancel')}</Button>
                </div>
            </ModalCard>
        </Modal>
    )

    if (showSkipModal) return (
        <Modal>
            <ModalCard>
                <Typography variant="h2">{t('actionPanel.day_ended', { round })}</Typography>
                <div className={styles.statRow}>
                    <span>{t('actionPanel.tax_income')}</span>
                    <span className={styles.positive}>+{MoneyNumberFormatter(projected.totalIncome)}</span>
                </div>
                <div className={styles.statRow}>
                    <span>{t('actionPanel.budget_expenses')}</span>
                    <span className={styles.negative}>-{MoneyNumberFormatter(projected.expenses)}</span>
                </div>
                <div className={styles.statRow}>
                    <span>{t('actionPanel.net')}</span>
                    <span className={projectedNet >= 0 ? styles.positive : styles.negative}>
                        {projectedNet >= 0 ? '+' : '-'}{MoneyNumberFormatter(Math.abs(projectedNet))}
                    </span>
                </div>
                <Button onClick={handleSkipModalContinue}>
                    {t('actionPanel.continue_day', { day: round + 1 })}
                </Button>
            </ModalCard>
        </Modal>
    )

    return null
}

export default RoundAdvanceController
