import { useEffect, useState } from 'react'
import { useGameStore } from '../../Stores/GameState'
import Typography from '../Typography/Typography'
import Button from '../Button/Button'
import { useTranslation } from 'react-i18next'
import styles from './RoundAdvanceController.module.css'
import { Modal, ModalCard } from '../Modal/Modal'

const RoundAdvanceController = () => {
    const { t } = useTranslation()
    const requested      = useGameStore(s => s.gameManagement.advanceRoundRequested)
    const clearRequest   = useGameStore(s => s.gameManagement.clearAdvanceRoundRequest)
    const expireTimer    = useGameStore(s => s.gameManagement.expireTimer)
    const meetTaken      = useGameStore(s => s.meet.actionTaken.taken)
    const lawDecided     = useGameStore(s => s.law.lawDecided)
    const dealDecided    = useGameStore(s => s.deals.dealDecided)

    const [showConfirm, setShowConfirm] = useState(false)

    const allActionsDone = meetTaken && lawDecided && dealDecided

    useEffect(() => {
        if (!requested) return
        clearRequest()
        if (allActionsDone) {
            expireTimer()
        } else {
            setShowConfirm(true)
        }
    }, [requested])

    if (!showConfirm) return null

    return (
        <Modal>
            <ModalCard>
                <Typography variant="body">{t('actionPanel.advance_warning')}</Typography>
                <div className={styles.buttons}>
                    <Button onClick={() => { setShowConfirm(false); expireTimer() }}>{t('actionPanel.confirm')}</Button>
                    <Button onClick={() => setShowConfirm(false)}>{t('actionPanel.cancel')}</Button>
                </div>
            </ModalCard>
        </Modal>
    )
}

export default RoundAdvanceController
