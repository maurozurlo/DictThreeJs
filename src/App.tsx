
import ActionPanel from "./components/ActionPanel/ActionPanel";
import Navbar from "./components/Navbar/Navbar";
import TabManager from "./components/Tabs/TabManager";
import { Scene } from "./Scene";

export default function App() {
  return (
    <>
      <Navbar />
      <TabManager />
      <Scene />
      <ActionPanel />
    </>
  );
}
