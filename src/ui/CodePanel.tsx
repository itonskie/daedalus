import { useEffect, useRef, useState } from "react";
import { useStore } from "../store/react";
import type { ProviderId } from "../store/types";

const SOURCE_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic",
  ollama: "Ollama",
  cached: "Cached",
};

const COPIED_MS = 800;

export function CodePanel() {
  const isOpen = useStore((s) => s.isCodePanelOpen);
  const script = useStore((s) => s.codePanelScript);
  const source = useStore((s) => s.codePanelSource);
  const modelSlug = useStore((s) => s.codePanelModelSlug);
  const close = useStore((s) => s.closeCodePanel);

  const panelRef = useRef<HTMLDialogElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    closeButtonRef.current?.focus();
    return () => {
      const el = openerRef.current;
      if (el && typeof el.focus === "function") el.focus();
      openerRef.current = null;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [isOpen, close]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  if (!isOpen || !script || !source || !modelSlug) return null;

  const sourceLabel = SOURCE_LABELS[source];
  const headerText = `Generated script  ·  ${sourceLabel} · ${modelSlug}`;

  const onCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
  };

  return (
    <dialog ref={panelRef} open aria-labelledby="code-panel__title" className="code-panel">
      <div className="code-panel__header">
        <h2 id="code-panel__title" className="code-panel__title">
          {headerText}
        </h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="code-panel__close"
          aria-label="Close code panel"
          onClick={close}
        >
          ×
        </button>
      </div>
      <pre data-testid="code-panel__body" className="code-panel__body" aria-label="script">
        {script}
      </pre>
      <div className="code-panel__footer">
        <button
          type="button"
          className={`code-panel__copy${copied ? " code-panel__copy--copied" : ""}`}
          onClick={() => {
            void onCopy();
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </dialog>
  );
}
