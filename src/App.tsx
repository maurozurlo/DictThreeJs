
import clsx from "clsx";
import ActionPanel from "./components/ActionPanel/ActionPanel";
import Navbar from "./components/Navbar/Navbar";
import TabManager from "./components/Tabs/TabManager";
import { Scene } from "./Scene";
import { useGameStore } from "./Stores/GameState";
import { Suspense } from "react";
import DictatorHands from "./Features/Laws/DictatorHands";
import { Tabs } from "./types/Tabs";
import EndScreen from "./components/EndScreen/EndScreen";
import FadeOverlay from "./components/FadeOverlay/FadeOverlay";
import { useFadeTransition } from "./Hooks/useFadeTransition";
import RoundAdvanceController from "./components/RoundAdvanceController/RoundAdvanceController";
import DayEnded from "./components/DayEnded/DayEnded";
import TutorialOverlay from "./components/Tutorial/TutorialOverlay";
import DebugRecurringOverlay from "./components/Debug/DebugRecurringOverlay";
import DebugSelectorOverlay from "./components/Debug/DebugSelectorOverlay";

export default function App() {
  const setDebugMode = useGameStore((s) => s.debug.setDebugMode);
  const debugEnabled = useGameStore((s) => s.debug.enabled);
  const debugFov = useGameStore((s) => s.debug.fov);
  const tab = useGameStore(s => s.tabs.activeTab)
  const phase = useGameStore(s => s.gameManagement.phase)

  const { fading, transitionTo } = useFadeTransition();

  return (
    <>
      <Suspense fallback="Loading...">
        <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>
          DEBUG MODE &nbsp;|&nbsp; FOV: {debugFov} &nbsp;|&nbsp; scroll to adjust · I to save pos
        </div>
        {debugEnabled && <DebugRecurringOverlay />}
        {debugEnabled && <DebugSelectorOverlay />}
        <Navbar transitionTo={transitionTo} />
        <FadeOverlay visible={fading} />
        <TabManager />
        <ActionPanel />
        <RoundAdvanceController />
        <DayEnded />
        <TutorialOverlay />
        {tab === Tabs.Laws ? <DictatorHands /> : null}
        <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />

        {(phase === 'lose' || phase === 'victory' || phase === 'special_ending') && (
          <EndScreen />
        )}
      </Suspense>
      <div data-tutorial="scene" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Scene />
      </div>
    </>
  );
}
