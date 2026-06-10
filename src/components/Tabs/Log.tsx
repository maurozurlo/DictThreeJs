import styles from './Tabs.module.css'
import eventStyles from './EventPanel.module.css'
import type { TabProps } from '../../types/Tabs'
import clsx from 'clsx'
import Newspaper from '../Newspaper/Newspaper'
import Typography from '../Typography/Typography'
import Card from '../Card/Card'
import Button from '../Button/Button'
import { useTranslation } from 'react-i18next'
import { useGameStore } from '../../Stores/GameState'
import { getGameDate } from '../../Utils/GameDate'


const Log = ({ isActive }: TabProps) => {
    const { t } = useTranslation()
    const { t: dailyEventT } = useTranslation('daily_events')
    const periodicEvent = useGameStore((s) => s.periodicEvent)
    const miniChallenge = useGameStore((s) => s.miniChallenge)
    const logEntries = useGameStore((s) => s.log)
    const round = useGameStore((s) => s.gameManagement.round)
    const dailyEventKey = useGameStore((s) => s.dailyEvent.current?.key)
    const dailyEventHeadline = dailyEventKey ? dailyEventT(dailyEventKey) : undefined

    return (
        <div className={clsx(styles.Tab, { [styles.isActive]: isActive })}>
            <div className={styles.pageContainer}>
                {/* --- Mini Challenge Section --- */}
                {miniChallenge.current && (
                    <div className={clsx(eventStyles.eventPanel, { [eventStyles.resolved]: miniChallenge.decided })}>
                        <Typography variant='h2' className={eventStyles.eventTitle}>
                            🎲 Opportunity
                        </Typography>
                        <Typography variant='body'>{miniChallenge.current.text}</Typography>

                        {!miniChallenge.decided ? (
                            <div className={eventStyles.challengeButtons}>
                                <Button onClick={() => miniChallenge.resolve(true)}>
                                    ✓ Accept
                                </Button>
                                <Button onClick={() => miniChallenge.resolve(false)}>
                                    ✗ Reject
                                </Button>
                            </div>
                        ) : (
                            <div className={eventStyles.resultCard}>
                                <Card>
                                    <Typography variant='body'>{miniChallenge.resultText}</Typography>
                                </Card>
                            </div>
                        )}
                    </div>
                )}
                <Typography variant='h2'>{t('log.today')}</Typography>
                <Newspaper headline={dailyEventHeadline} date={getGameDate(round)} />

                {/* --- Periodic Event Section --- */}
                {periodicEvent.current && (
                    <div className={clsx(eventStyles.eventPanel, { [eventStyles.resolved]: periodicEvent.decided })}>
                        <Typography variant='h2' className={eventStyles.eventTitle}>
                            ⚡ {periodicEvent.current.title}
                        </Typography>
                        <Typography variant='body'>{periodicEvent.current.text}</Typography>

                        {!periodicEvent.decided ? (
                            <div className={eventStyles.optionsGrid}>
                                {periodicEvent.current.options.map((opt, i) => (
                                    <Button key={i} onClick={() => periodicEvent.resolve(i)}>
                                        {opt.text}
                                    </Button>
                                ))}
                            </div>
                        ) : (
                            <div className={eventStyles.resultCard}>
                                <Card>
                                    <Typography variant='body'>{periodicEvent.resultText}</Typography>
                                </Card>
                            </div>
                        )}
                    </div>
                )}



                {/* --- Log History --- */}
                <Typography variant='h2'>{t('tabs.log')}</Typography>
                {logEntries.slice().reverse().map((entry, i) => (
                    <Card key={i}>
                        <Typography variant='h2'>{entry.date}</Typography>
                        {entry.lines.map((msg, j) => (
                            <Typography key={j} variant='body'>{msg}</Typography>
                        ))}
                    </Card>
                ))}
                {logEntries.length === 0 && (
                    <Card>{t('log.no_entries')}</Card>
                )}
            </div>
        </div>
    )
}

export default Log