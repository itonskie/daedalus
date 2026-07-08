import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { useStore } from "../store/react";
import type { ProviderId } from "../store/types";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  returnFocusRef?: React.RefObject<HTMLElement>;
}

const ANTHROPIC_MODELS = ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"] as const;

export function SettingsDrawer({ isOpen, onClose, returnFocusRef }: SettingsDrawerProps) {
  const activeProvider = useStore((s) => s.activeProvider);
  const anthropicKey = useStore((s) => s.anthropicKey);
  const anthropicModel = useStore((s) => s.anthropicModel);
  const ollamaUrl = useStore((s) => s.ollamaUrl);
  const ollamaModel = useStore((s) => s.ollamaModel);
  const setProvider = useStore((s) => s.setProvider);
  const setAnthropicKey = useStore((s) => s.setAnthropicKey);
  const setAnthropicModel = useStore((s) => s.setAnthropicModel);
  const setOllamaUrl = useStore((s) => s.setOllamaUrl);
  const setOllamaModel = useStore((s) => s.setOllamaModel);

  const [keyRevealed, setKeyRevealed] = useState(false);
  const [keyDraft, setKeyDraft] = useState(anthropicKey);
  const [urlDraft, setUrlDraft] = useState(ollamaUrl);
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [modelDraft, setModelDraft] = useState(ollamaModel);

  const drawerRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setKeyDraft(anthropicKey);
      setUrlDraft(ollamaUrl);
      setModelDraft(ollamaModel);
      setUrlInvalid(false);
    }
  }, [isOpen, anthropicKey, ollamaUrl, ollamaModel]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && drawerRef.current) {
        trapFocus(e, drawerRef.current);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && drawerRef.current) {
      const first = drawerRef.current.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
      wasOpenRef.current = true;
    } else if (!isOpen && wasOpenRef.current && returnFocusRef?.current) {
      returnFocusRef.current.focus();
      wasOpenRef.current = false;
    }
  }, [isOpen, returnFocusRef]);

  if (!isOpen) return null;

  const commitKey = () => {
    if (keyDraft !== anthropicKey) setAnthropicKey(keyDraft);
  };

  const commitUrl = () => {
    const trimmed = urlDraft.trim();
    if (!trimmed) {
      setUrlInvalid(false);
      if (ollamaUrl !== "") setOllamaUrl("");
      return;
    }
    try {
      new URL(trimmed);
      setUrlInvalid(false);
      if (trimmed !== ollamaUrl) setOllamaUrl(trimmed);
    } catch {
      setUrlInvalid(true);
    }
  };

  const commitModel = () => {
    const trimmed = modelDraft.trim();
    if (trimmed !== ollamaModel) setOllamaModel(trimmed);
  };

  const onModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setAnthropicModel(e.target.value);
  };

  return (
    <div className="drawer-root">
      <button
        type="button"
        className="drawer-backdrop"
        aria-label="Close settings"
        onClick={onClose}
      />
      <dialog ref={drawerRef} className="drawer" aria-labelledby="settings-title" open>
        <header className="drawer__header">
          <h2 id="settings-title" className="drawer__title">
            Settings
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="drawer__close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <section className="drawer__section" aria-labelledby="active-provider-title">
          <h3 id="active-provider-title" className="drawer__section-title">
            Active provider
          </h3>
          <fieldset className="radio-group">
            <legend className="visually-hidden">Choose active provider</legend>
            <ProviderRadio
              value="cached"
              label="Cached demos"
              activeProvider={activeProvider}
              setProvider={setProvider}
            />
            <ProviderRadio
              value="anthropic"
              label="Anthropic"
              activeProvider={activeProvider}
              setProvider={setProvider}
            />
            <ProviderRadio
              value="ollama"
              label="Ollama"
              activeProvider={activeProvider}
              setProvider={setProvider}
            />
          </fieldset>
        </section>

        <section className="drawer__section" aria-labelledby="anthropic-title">
          <h3 id="anthropic-title" className="drawer__section-title">
            Anthropic
          </h3>
          <div className="drawer__field">
            <label className="drawer__label" htmlFor="anthropic-key">
              API key
            </label>
            <div className="drawer__key-row">
              <input
                id="anthropic-key"
                className="mono-input"
                type={keyRevealed ? "text" : "password"}
                value={keyDraft}
                placeholder="sk-ant-..."
                onChange={(e) => setKeyDraft(e.target.value)}
                onBlur={commitKey}
              />
              <button
                type="button"
                className="ghost-button"
                onClick={() => setKeyRevealed((v) => !v)}
                aria-label={keyRevealed ? "Hide API key" : "Show API key"}
              >
                {keyRevealed ? "hide" : "show"}
              </button>
            </div>
            <p className="drawer__hint">Stored in localStorage on this device only.</p>
          </div>
          <div className="drawer__field">
            <label className="drawer__label" htmlFor="anthropic-model">
              Model
            </label>
            <select
              id="anthropic-model"
              className="mono-select"
              value={anthropicModel}
              onChange={onModelChange}
            >
              {ANTHROPIC_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="drawer__section" aria-labelledby="ollama-title">
          <h3 id="ollama-title" className="drawer__section-title">
            Ollama
          </h3>
          <div className="drawer__field">
            <label className="drawer__label" htmlFor="ollama-url">
              URL
            </label>
            <input
              id="ollama-url"
              className="mono-input"
              type="text"
              value={urlDraft}
              placeholder="http://localhost:11434"
              onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={commitUrl}
              aria-invalid={urlInvalid || undefined}
            />
            {urlInvalid ? <p className="drawer__hint">Not a valid URL</p> : null}
          </div>
          <div className="drawer__field">
            <label className="drawer__label" htmlFor="ollama-model">
              Model
            </label>
            <input
              id="ollama-model"
              className="mono-input"
              type="text"
              value={modelDraft}
              placeholder="qwen3-coder:30b"
              onChange={(e) => setModelDraft(e.target.value)}
              onBlur={commitModel}
            />
          </div>
        </section>

        <footer className="drawer__footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </footer>
      </dialog>
    </div>
  );
}

interface ProviderRadioProps {
  value: ProviderId;
  label: string;
  activeProvider: ProviderId;
  setProvider: (id: ProviderId) => void;
}

function ProviderRadio({ value, label, activeProvider, setProvider }: ProviderRadioProps) {
  const id = `provider-${value}`;
  return (
    <label className="radio-row" htmlFor={id}>
      <input
        id={id}
        type="radio"
        name="active-provider"
        value={value}
        checked={activeProvider === value}
        onChange={() => setProvider(value)}
      />
      <span>{label}</span>
    </label>
  );
}

function trapFocus(e: KeyboardEvent, container: HTMLElement): void {
  const focusables = Array.from(
    container.querySelectorAll<HTMLElement>(
      'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.hasAttribute("disabled"));
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;
  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}
