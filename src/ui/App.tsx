import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { SettingsDrawer } from "./SettingsDrawer";
import { TopStrip } from "./TopStrip";
import { Viewport } from "./Viewport";

const MIN_WIDTH = 1024;

export function App() {
  const [tooNarrow, setTooNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < MIN_WIDTH,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onResize = () => setTooNarrow(window.innerWidth < MIN_WIDTH);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (tooNarrow) {
    return (
      <div className="too-narrow">
        <p>daedalus is built for a bigger screen</p>
      </div>
    );
  }

  return (
    <div className="app">
      <TopStrip ref={gearRef} onOpenSettings={() => setSettingsOpen(true)} />
      <Viewport />
      <ChatPanel />
      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        returnFocusRef={gearRef}
      />
    </div>
  );
}
