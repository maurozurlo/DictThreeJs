
import clsx from "clsx";
import ActionPanel from "./components/ActionPanel/ActionPanel";
import Navbar from "./components/Navbar/Navbar";
import TabManager from "./components/Tabs/TabManager";
import { Scene } from "./Scene";
import { useGameStore } from "./Stores/GameState";
import { Suspense } from "react";
import DictatorHands from "./Features/Laws/DictatorHands";
import { Tabs } from "./types/Tabs";
import styles from "./App.module.css";
import Typography from "./components/Typography/Typography";
import Button from "./components/Button/Button";

export default function App() {
  const setDebugMode = useGameStore((s) => s.debug.setDebugMode);
  const debugEnabled = useGameStore((s) => s.debug.enabled);
  const tab = useGameStore(s => s.tabs.activeTab)
  const phase = useGameStore(s => s.gameManagement.phase)
  const round = useGameStore(s => s.gameManagement.round)
  const endReason = useGameStore(s => s.gameManagement.endReason)
  const dayEnded = useGameStore(s => s.gameManagement.dayEnded)
  const lastRoundIncome = useGameStore(s => s.gameManagement.lastRoundIncome)
  const lastRoundExpenses = useGameStore(s => s.gameManagement.lastRoundExpenses)
  const nextRound = useGameStore(s => s.gameManagement.nextRound)
  const setPhase = useGameStore(s => s.gameManagement.setPhase)
  const treasury = useGameStore(s => s.budget.treasury)
  const relations = useGameStore(s => s.relations.current)

  return (
    <>
      <Suspense fallback="Loading...">
        <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>DEBUG MODE</div>
        <Navbar />
        <TabManager />
        <ActionPanel />
        {tab === Tabs.Laws ? <DictatorHands /> : null}
        <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />

        {/* Day-Ended Overlay */}
        {dayEnded && phase !== 'lose' && phase !== 'victory' && (
          <div className={styles.overlay}>
            <div className={styles.overlayCard}>
              <Typography variant="h2" className={styles.overlayTitle}>
                📅 Day {round} Has Ended
              </Typography>
              <div className={styles.statRow}>
                <span>Tax income:</span>
                <span className={styles.positive}>+${lastRoundIncome}M</span>
              </div>
              <div className={styles.statRow}>
                <span>Budget expenses:</span>
                <span className={styles.negative}>-${lastRoundExpenses}M</span>
              </div>
              <div className={styles.statRow}>
                <span>Net:</span>
                <span className={lastRoundIncome - lastRoundExpenses >= 0 ? styles.positive : styles.negative}>
                  {lastRoundIncome - lastRoundExpenses >= 0 ? '+' : ''}${lastRoundIncome - lastRoundExpenses}M
                </span>
              </div>
              <Typography variant="body" className={styles.overlayMessage}>
                You remain in power for another day.
              </Typography>
              <Button onClick={() => nextRound()}>
                Continue to Day {round + 1} →
              </Button>
            </div>
          </div>
        )}

        {/* Lose Overlay */}
        {phase === 'lose' && (
          <div className={clsx(styles.overlay, styles.loseOverlay)}>
            <div className={styles.overlayCard}>
              <Typography variant="h2" className={styles.overlayTitle}>
                ☠ Game Over
              </Typography>
              <Typography variant="body" className={styles.overlayMessage}>
                {endReason}
              </Typography>
              <Typography variant="body">
                You survived {round - 1} days. Final treasury: ${treasury}M
              </Typography>
              <div className={styles.finalRelations}>
                <span>Military: {relations.military}</span>
                <span>Business: {relations.business}</span>
                <span>People: {relations.people}</span>
              </div>
              <Button onClick={() => setPhase('start')}>New Game</Button>
            </div>
          </div>
        )}

        {/* Victory Overlay */}
        {phase === 'victory' && (
          <div className={clsx(styles.overlay, styles.victoryOverlay)}>
            <div className={styles.overlayCard}>
              <Typography variant="h2" className={styles.overlayTitle}>
                🏆 Victory!
              </Typography>
              <Typography variant="body" className={styles.overlayMessage}>
                You survived all {round - 1} days and maintained your grip on power!
              </Typography>
              <Typography variant="body">
                Final treasury: ${treasury}M
              </Typography>
              <div className={styles.finalRelations}>
                <span>Military: {relations.military}</span>
                <span>Business: {relations.business}</span>
                <span>People: {relations.people}</span>
              </div>
              <Button onClick={() => setPhase('start')}>Play Again</Button>
            </div>
          </div>
        )}
      </Suspense>
      <Scene />
    </>


  );
}
