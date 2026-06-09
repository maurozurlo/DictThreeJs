
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
  const setPhase = useGameStore(s => s.gameManagement.setPhase)
  const treasury = useGameStore(s => s.budget.treasury)
  const relations = useGameStore(s => s.relations.current)
  const specialEnding = useGameStore(s => s.specialEnding)
  const meetCounts = useGameStore(s => s.gameManagement.meetCounts)

  return (
    <>
      <Suspense fallback="Loading...">
        <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>DEBUG MODE</div>
        <Navbar />
        <TabManager />
        <ActionPanel />
        {tab === Tabs.Laws ? <DictatorHands /> : null}
        <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />


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

        {/* Special Ending Overlay */}
        {phase === 'special_ending' && (
          <div className={clsx(styles.overlay, specialEnding.outcome === 'good' ? styles.victoryOverlay : styles.loseOverlay)}>
            <div className={styles.overlayCard}>
              <Typography variant="h2" className={styles.overlayTitle}>
                {specialEnding.outcome === 'good' ? '★ A Different Path' : '✝ The End'}
              </Typography>
              <Typography variant="body" className={styles.overlayMessage}>
                {endReason}
              </Typography>
              <div className={styles.finalRelations}>
                <span>Military: {relations.military} ({meetCounts.military} meets)</span>
                <span>Business: {relations.business} ({meetCounts.business} meets)</span>
                <span>People: {relations.people} ({meetCounts.people} meets)</span>
              </div>
              <Typography variant="body">Final treasury: ${treasury}M</Typography>
              <Button onClick={() => setPhase('start')}>Play Again</Button>
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
