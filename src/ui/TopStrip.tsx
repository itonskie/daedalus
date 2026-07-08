import { forwardRef } from "react";
import { useStore } from "../store/react";

interface TopStripProps {
  onOpenSettings: () => void;
}

export const TopStrip = forwardRef<HTMLButtonElement, TopStripProps>(function TopStrip(
  { onOpenSettings },
  gearRef,
) {
  const activeProvider = useStore((s) => s.activeProvider);
  const label =
    activeProvider === "anthropic"
      ? "Anthropic"
      : activeProvider === "ollama"
        ? "Ollama"
        : "Cached";
  return (
    <header className="top-strip">
      <span className="top-strip__brand">daedalus</span>
      <div className="top-strip__right">
        <span className="top-strip__provider" data-testid="provider-indicator">
          {label}
        </span>
        <button
          ref={gearRef}
          type="button"
          className="top-strip__gear"
          aria-label="Open settings"
          onClick={onOpenSettings}
        >
          ⚙
        </button>
      </div>
    </header>
  );
});
