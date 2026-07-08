import { useEffect, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { TopStrip } from "./TopStrip";
import { Viewport } from "./Viewport";

const MIN_WIDTH = 1024;

export function App() {
  const [tooNarrow, setTooNarrow] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.innerWidth < MIN_WIDTH,
  );

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
      <TopStrip />
      <Viewport />
      <ChatPanel />
    </div>
  );
}
