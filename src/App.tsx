
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

export default function App() {
  const setDebugMode = useGameStore((s) => s.debug.setDebugMode);
  const debugEnabled = useGameStore((s) => s.debug.enabled);
  const tab = useGameStore(s => s.tabs.activeTab)
  const phase = useGameStore(s => s.gameManagement.phase)

  return (
    <>
      <Suspense fallback="Loading...">
        <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>DEBUG MODE</div>
        <Navbar />
        <TabManager />
        <ActionPanel />
        {tab === Tabs.Laws ? <DictatorHands /> : null}
        <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />


        {(phase === 'lose' || phase === 'victory' || phase === 'special_ending') && (
          <EndScreen />
        )}
      </Suspense>
      <Scene />
    </>


  );
}
