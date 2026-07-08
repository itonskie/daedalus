import { useStore } from "../store/react";

export function TopStrip() {
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
      <span className="top-strip__provider" data-testid="provider-indicator">
        {label}
      </span>
    </header>
  );
}
