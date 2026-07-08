import { DEFAULT_DEMO, MANIFEST } from "../demos";
import { useStore } from "../store/react";
import type { ChatMessage } from "../store/types";

export function ChatPanel() {
  const messages = useStore((s) => s.messages);
  const isGenerating = useStore((s) => s.isGenerating);
  const loadCachedDemo = useStore((s) => s.loadCachedDemo);

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
          <MessageRow key={m.id} message={m} />
        ))}
      </ol>
      <form
        className="chat-panel__input"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <label className="visually-hidden" htmlFor="prompt-input">
          Prompt
        </label>
        <input
          id="prompt-input"
          className="prompt-input"
          type="text"
          placeholder="Describe what to build..."
          disabled
          aria-disabled="true"
        />
        <button
          type="submit"
          className="send-button"
          disabled
          aria-disabled="true"
          aria-label="Send prompt"
        >
          →
        </button>
      </form>
    </aside>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <li className={`message message--${message.role}`}>
      <span className="message__label">{isUser ? "user:" : "assistant:"}</span>
      {isUser ? (
        <span className="message__text">{message.text}</span>
      ) : (
        <span className="message__status" data-error={message.errorKind ? "true" : undefined}>
          {message.label ?? ""}
        </span>
      )}
    </li>
  );
}
