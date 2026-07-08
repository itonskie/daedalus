import { type KeyboardEvent, useState } from "react";
import { DEFAULT_DEMO, MANIFEST } from "../demos";
import { useStore } from "../store/react";
import type { ChatMessage, ProviderId } from "../store/types";

export function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const isGenerating = useStore((s) => s.isGenerating);
  const providerHint = useStore((s) => s.providerNotConfiguredHint);
  const loadCachedDemo = useStore((s) => s.loadCachedDemo);
  const submitPrompt = useStore((s) => s.submitPrompt);
  const clearProviderHint = useStore((s) => s.clearProviderNotConfiguredHint);
  const openCodePanel = useStore((s) => s.openCodePanel);

  const [draft, setDraft] = useState("");

  const canSend = draft.trim().length > 0 && !isGenerating;

  const submit = () => {
    if (!canSend) return;
    const prompt = draft;
    setDraft("");
    void submitPrompt(prompt);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <aside className="chat-panel">
      <div className="chat-panel__chips">
        <h2 className="chat-panel__section">Try a prompt</h2>
        <ul className="chat-panel__chip-list">
          {MANIFEST.prompts.map((p) => (
            <li key={p.slug}>
              <button
                type="button"
                className="chip"
                aria-label={p.text}
                disabled={isGenerating}
                onClick={() => {
                  void loadCachedDemo(p.slug, DEFAULT_DEMO.modelSlug);
                }}
              >
                {p.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <ol className="chat-panel__messages" aria-live="polite">
        {messages.map((m) => (
          <MessageRow key={m.id} message={m} openCodePanel={openCodePanel} />
        ))}
      </ol>
      {providerHint ? (
        <output className="provider-hint">Add a provider in settings to run live prompts.</output>
      ) : null}
      <form
        className="chat-panel__input"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="visually-hidden" htmlFor="prompt-input">
          Prompt
        </label>
        <textarea
          id="prompt-input"
          className="prompt-input"
          placeholder="Describe what to build..."
          value={draft}
          rows={1}
          disabled={isGenerating}
          aria-disabled={isGenerating || undefined}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setDraft(e.target.value);
            if (providerHint) clearProviderHint();
          }}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!canSend}
          aria-disabled={!canSend || undefined}
          aria-label="Send prompt"
        >
          {isGenerating ? <span className="send-button__spinner" aria-hidden="true" /> : "→"}
        </button>
      </form>
    </aside>
  );
}

function MessageRow({
  message,
  openCodePanel,
}: {
  message: ChatMessage;
  openCodePanel: (source: ProviderId, script: string, modelSlug: string) => void;
}) {
  const isUser = message.role === "user";
  const canShowCode = !isUser && !!message.script && !!message.source && !!message.modelSlug;
  return (
    <li className={`message message--${message.role}`}>
      <span className="message__label">{isUser ? "user:" : "assistant:"}</span>
      {isUser ? (
        <span className="message__text">{message.text}</span>
      ) : (
        <>
          <span className="message__status" data-error={message.errorKind ? "true" : undefined}>
            {message.label ?? ""}
          </span>
          {message.errorKind && message.text ? (
            <span className="message__error-copy">{message.text}</span>
          ) : null}
          {canShowCode ? (
            <button
              type="button"
              className="message__show-code"
              onClick={(e) => {
                e.stopPropagation();
                if (message.script && message.source && message.modelSlug) {
                  openCodePanel(message.source, message.script, message.modelSlug);
                }
              }}
            >
              show code
            </button>
          ) : null}
        </>
      )}
    </li>
  );
}
