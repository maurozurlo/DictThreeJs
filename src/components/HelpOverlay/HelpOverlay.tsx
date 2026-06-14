import styles from './HelpOverlay.module.css'
import Button from '../Button/Button'
import { Icon } from '../Icon/Icon'
import { Modal, ModalCard } from '../Modal/Modal'
import { useTranslation } from 'react-i18next'

interface HelpOverlayProps {
    onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className={styles.section}>
            <div className={styles.sectionTitle}>{title}</div>
            {children}
        </div>
    )
}

function Entry({ label, desc }: { label: string; desc: string }) {
    return (
        <div className={styles.entry}>
            <span className={styles.entryLabel}>{label}</span>
            <span className={styles.entryDesc}>{desc}</span>
        </div>
    )
}

const HelpOverlay = ({ onClose }: HelpOverlayProps) => {
    const { t } = useTranslation('help')

    return (
        <Modal align="stretch" backgroundAlpha={0.95}>
            <ModalCard maxWidth="1400px" padding="1.5rem 2rem" className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.title}>{t('title')}</div>
                    <Button onClick={onClose}><Icon type="reject" /></Button>
                </div>

                <div className={styles.grid}>
                    {/* Column 1 */}
                    <div className={styles.col}>
                        <Section title={t('objective.title')}>
                            <p className={styles.body}>{t('objective.body1')}</p>
                            <p className={styles.body}>{t('objective.body2')}</p>
                        </Section>

                        <Section title={t('daily_loop.title')}>
                            <p className={styles.body}>{t('daily_loop.body1')}</p>
                            <p className={styles.body}>{t('daily_loop.body2')}</p>
                        </Section>

                        <Section title={t('stats.title')}>
                            <Entry label={t('stats.treasury_label')} desc={t('stats.treasury_desc')} />
                            <Entry label={t('stats.relations_label')} desc={t('stats.relations_desc')} />
                            <Entry label={t('stats.charisma_label')} desc={t('stats.charisma_desc')} />
                        </Section>
                    </div>

                    {/* Column 2 */}
                    <div className={styles.col}>
                        <Section title={t('meet.title')}>
                            <p className={styles.body}>{t('meet.intro')}</p>
                            <Entry label={t('meet.dialogue_label')} desc={t('meet.dialogue_desc')} />
                            <Entry label={t('meet.bribe_label')} desc={t('meet.bribe_desc')} />
                            <Entry label={t('meet.expropriate_label')} desc={t('meet.expropriate_desc')} />
                            <Entry label={t('meet.eliminate_label')} desc={t('meet.eliminate_desc')} />
                        </Section>

                        <Section title={t('budget.title')}>
                            <p className={styles.body}>{t('budget.intro')}</p>
                            <Entry label={t('budget.taxes_label')} desc={t('budget.taxes_desc')} />
                            <Entry label={t('budget.spending_label')} desc={t('budget.spending_desc')} />
                        </Section>
                    </div>

                    {/* Column 3 */}
                    <div className={styles.col}>
                        <Section title={t('laws.title')}>
                            <p className={styles.body}>{t('laws.body')}</p>
                        </Section>

                        <Section title={t('deals.title')}>
                            <p className={styles.body}>{t('deals.body')}</p>
                        </Section>

                        <Section title={t('tips.title')}>
                            <Entry label={t('tips.neglect_label')} desc={t('tips.neglect_desc')} />
                            <Entry label={t('tips.clock_label')} desc={t('tips.clock_desc')} />
                            <Entry label={t('tips.treasury_label')} desc={t('tips.treasury_desc')} />
                            <Entry label={t('tips.charisma_label')} desc={t('tips.charisma_desc')} />
                        </Section>
                    </div>
                </div>

                <div className={styles.footer}>
                    <Button onClick={onClose}>{t('close')}</Button>
                </div>
            </ModalCard>
        </Modal>
    )
}

export default HelpOverlay
