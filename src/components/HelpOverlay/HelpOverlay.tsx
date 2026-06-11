import styles from './HelpOverlay.module.css'
import Button from '../Button/Button'

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
    return (
        <div className={styles.overlay}>
            <div className={styles.card}>
                <div className={styles.header}>
                    <div className={styles.title}>HOW TO PLAY</div>
                    <Button onClick={onClose}>✕</Button>
                </div>

                <div className={styles.grid}>
                    {/* Column 1 */}
                    <div className={styles.col}>
                        <Section title="OBJECTIVE">
                            <p className={styles.body}>
                                You are a dictator. Survive all 10 days in power without losing
                                the loyalty of the Military, the Business class, or the People —
                                and without going bankrupt.
                            </p>
                            <p className={styles.body}>
                                Let any faction's respect hit the floor, or let your treasury reach
                                zero, and your reign ends early. Last all 10 days to win.
                            </p>
                        </Section>

                        <Section title="THE DAILY LOOP">
                            <p className={styles.body}>
                                Each day runs for 2 real minutes (9:00 AM → 5:00 PM in-game).
                                Before the clock runs out, take one action in each tab: Meet,
                                Laws, and Deals. You can skip ahead early once you're done.
                            </p>
                            <p className={styles.body}>
                                When the day ends, taxes are collected and expenses are paid.
                                The net result changes your treasury.
                            </p>
                        </Section>

                        <Section title="STATS">
                            <Entry
                                label="Treasury"
                                desc="Your money. Income comes from taxes; expenses come from public spending. Reaches $0 = game over."
                            />
                            <Entry
                                label="Military / Business / People"
                                desc="Each faction's loyalty, -10 to +10. Any one hitting the minimum ends the game."
                            />
                            <Entry
                                label="Charisma"
                                desc="Your personal influence, -10 to +10. Higher charisma improves your Dialogue success rate."
                            />
                        </Section>
                    </div>

                    {/* Column 2 */}
                    <div className={styles.col}>
                        <Section title="MEET">
                            <p className={styles.body}>
                                Once per day, choose a faction and take one action:
                            </p>
                            <Entry
                                label="Dialogue"
                                desc="Free. A chance-based appeal. Higher charisma means better odds of gaining their respect."
                            />
                            <Entry
                                label="Bribe"
                                desc="Spend money to guarantee a relations boost. Costs vary by faction."
                            />
                            <Entry
                                label="Expropriate"
                                desc="Seize their assets for a cash injection. Relations will take a hit."
                            />
                            <Entry
                                label="Eliminate"
                                desc="Remove their representative permanently. High risk. Use sparingly."
                            />
                        </Section>

                        <Section title="BUDGET">
                            <p className={styles.body}>
                                Adjust your tax rates and public spending from the Budget tab.
                                Changes take effect at the end of each day.
                            </p>
                            <Entry
                                label="People Taxes / Business Taxes"
                                desc="0–50%. Higher rates bring more income but erode faction loyalty over time."
                            />
                            <Entry
                                label="Health / Infrastructure / Security / Education"
                                desc="Spending levels 1–10. Higher spending costs more per day but earns goodwill."
                            />
                        </Section>
                    </div>

                    {/* Column 3 */}
                    <div className={styles.col}>
                        <Section title="LAWS">
                            <p className={styles.body}>
                                Each day a faction proposes a law. Approve it and they gain
                                respect; reject it and they lose respect. Every faction can see
                                what you decide — balance their needs carefully.
                            </p>
                        </Section>

                        <Section title="DEALS">
                            <p className={styles.body}>
                                A deal arrives each day from an interested party. Read the offer
                                carefully — accepting or rejecting will have consequences.
                                The outcome is revealed immediately after you decide.
                            </p>
                        </Section>

                        <Section title="TIPS">
                            <Entry
                                label="Don't neglect anyone"
                                desc="It's easy to let one faction drift while managing the others. Check all three relations bars each day."
                            />
                            <Entry
                                label="Watch the clock"
                                desc="The day ends automatically when time runs out. Make sure you've taken all three actions before then."
                            />
                            <Entry
                                label="Treasury is a buffer"
                                desc="Keep some money in reserve. A deal or event can cost you unexpectedly — being broke leaves no options."
                            />
                            <Entry
                                label="Charisma compounds"
                                desc="A positive charisma makes Dialogue reliable, saving you bribe money every round it works."
                            />
                        </Section>
                    </div>
                </div>

                <div className={styles.footer}>
                    <Button onClick={onClose}>Got it</Button>
                </div>
            </div>
        </div>
    )
}

export default HelpOverlay
