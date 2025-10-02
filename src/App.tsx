
import clsx from "clsx";
import ActionPanel from "./components/ActionPanel/ActionPanel";
import Navbar from "./components/Navbar/Navbar";
import TabManager from "./components/Tabs/TabManager";
import { Scene } from "./Scene";
import { useGameStore } from "./Stores/GameState";

export default function App() {
  const setDebugMode = useGameStore((s) => s.debug.setDebugMode);
  const debugEnabled = useGameStore((s) => s.debug.enabled);

  return (
    <>
      <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>DEBUG MODE</div>
      <Navbar />
      <TabManager />
      <Scene />
      <ActionPanel />
      <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />
    </>
  );
}
