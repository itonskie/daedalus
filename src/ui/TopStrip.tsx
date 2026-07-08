import { forwardRef } from "react";
import { useStore } from "../store/react";
import type { ProviderId } from "../store/types";

interface TopStripProps {
  onOpenSettings: () => void;
}

const providerLabel = (id: ProviderId): string =>
  id === "anthropic" ? "Anthropic" : id === "ollama" ? "Ollama" : "Cached";

export const TopStrip = forwardRef<HTMLButtonElement, TopStripProps>(function TopStrip(
  { onOpenSettings },
  gearRef,
) {
  const activeProvider = useStore((s) => s.activeProvider);
  const anthropicKey = useStore((s) => s.anthropicKey);
  const ollamaUrl = useStore((s) => s.ollamaUrl);
  const cycleProvider = useStore((s) => s.cycleProvider);

  const configuredCount = 1 + (anthropicKey.trim() ? 1 : 0) + (ollamaUrl.trim() ? 1 : 0);
  const canCycle = configuredCount > 1;

  return (
    <header className="top-strip">
      <span className="top-strip__brand">daedalus</span>
      <div className="top-strip__right">
        <button
          type="button"
          className="top-strip__provider"
          data-testid="provider-toggle"
          onClick={cycleProvider}
          disabled={!canCycle}
          aria-label={
            canCycle
              ? `Active provider: ${providerLabel(activeProvider)}. Click to cycle.`
              : `Active provider: ${providerLabel(activeProvider)}`
          }
        >
          {providerLabel(activeProvider)}
        </button>
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
