
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
import { useDelayedFlag } from "./Hooks/useDelayedFlag";
import { specialEndingRevealDelayMs } from "./Constants/SecretRooms";
import { GAMESTATE } from "./Constants/GameState";
import RoundAdvanceController from "./components/RoundAdvanceController/RoundAdvanceController";
import DayEnded from "./components/DayEnded/DayEnded";
import TutorialOverlay from "./components/Tutorial/TutorialOverlay";
import DebugRecurringOverlay from "./components/Debug/DebugRecurringOverlay";
import DebugSelectorOverlay from "./components/Debug/DebugSelectorOverlay";
import DebugPlacementOverlay from "./components/Debug/DebugPlacementOverlay";

export default function App() {
  const setDebugMode = useGameStore((s) => s.debug.setDebugMode);
  const debugEnabled = useGameStore((s) => s.debug.enabled);
  const debugFov = useGameStore((s) => s.debug.fov);
  const cameraFov = useGameStore((s) => s.scene.camera.cameraFov);
  const cameraHFov = useGameStore((s) => s.scene.camera.cameraHFov);
  const setCameraFov = useGameStore((s) => s.scene.camera.setCameraFov);
  const freeCam = useGameStore((s) => s.debug.freeCam);
  const setFreeCam = useGameStore((s) => s.debug.setFreeCam);
  const tab = useGameStore(s => s.tabs.activeTab)
  const phase = useGameStore(s => s.gameManagement.phase)
  const specialFaction = useGameStore(s => s.specialEnding.faction)
  const dwelling = useGameStore(s => s.gameManagement.dwelling)

  const { fading, transitionTo } = useFadeTransition();

  // ADR-0012 hinge: mandatory reveal window, then the optional dwell. Local UI
  // timing (not store state). One flag shared by DayEnded (reveal modal) and the
  // Navbar advance slot (dwell advance), so the hand-off is the same frame.
  const revealAcked = useDelayedFlag(dwelling, GAMESTATE.ROUNDS.MANDATORY_REVEAL_MS);

  // A special ending's room take (the bunker's button press) plays before the end screen covers it.
  const showEndScreen = useDelayedFlag(
    phase === 'lose' || phase === 'victory' || phase === 'special_ending',
    phase === 'special_ending' ? specialEndingRevealDelayMs(specialFaction) : 0,
  );

  return (
    <>
      <Suspense fallback="Loading...">
        <div className={clsx("debug-banner", { 'hidden': !debugEnabled })}>
          DEBUG MODE
          &nbsp;|&nbsp;
          <label>
            <input type="checkbox" checked={freeCam} onChange={(e) => setFreeCam(e.target.checked)} />
            free cam{freeCam ? ` (FOV ${debugFov}, right-click to look, scroll to adjust · I to save pos)` : ''}
          </label>
          &nbsp;|&nbsp; cam FOV:&nbsp;
          {cameraHFov != null
            ? <span>{cameraHFov}° hFOV (aspect-derived)</span>
            : <>
                <input
                  type="range"
                  min={10}
                  max={120}
                  step={0.5}
                  value={cameraFov}
                  onChange={(e) => setCameraFov(Number(e.target.value))}
                  style={{ verticalAlign: 'middle' }}
                />
                &nbsp;{cameraFov.toFixed(1)}°
              </>
          }
        </div>
        {debugEnabled && <DebugRecurringOverlay />}
        {debugEnabled && <DebugSelectorOverlay />}
        {debugEnabled && tab === Tabs.Street && <DebugPlacementOverlay />}
        <Navbar transitionTo={transitionTo} revealAcked={revealAcked} />
        <FadeOverlay visible={fading} />
        <TabManager />
        <ActionPanel />
        <RoundAdvanceController />
        <DayEnded revealAcked={revealAcked} />
        <TutorialOverlay />
        {tab === Tabs.Laws ? <DictatorHands /> : null}
        <input type="checkbox" id="debug-toggle" className="debug-toggle" onChange={(e) => setDebugMode(e.target.checked)} value={debugEnabled ? 'checked' : 'unchecked'} />

        {showEndScreen && <EndScreen />}
      </Suspense>
      <div data-tutorial="scene" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Scene />
      </div>
    </>
  );
}
