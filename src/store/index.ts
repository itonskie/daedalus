import { persist, subscribeWithSelector } from "zustand/middleware";
import { type StoreApi, createStore as createVanillaStore } from "zustand/vanilla";
import { CACHED_DEMOS, DEFAULT_DEMO, MANIFEST, getPromptText } from "../demos";
import { AnthropicProvider, type LLMProvider, LLMProviderError, OllamaProvider } from "../llm";
import { type ExecuteResult, type Executor, SandboxExecutor } from "../sandbox";
import { errorToCopy } from "./error-copy";
import {
  DEFAULT_ANTHROPIC_MODEL,
  type LiveProviderFactory,
  PERSIST_KEY,
  type ProviderId,
  type StoreState,
} from "./types";

export type { CameraState, ChatMessage, ProviderId, StoreState } from "./types";
export {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OLLAMA_MODEL,
  DEFAULT_OLLAMA_URL,
  PERSIST_KEY,
} from "./types";

export interface CreateStoreOptions {
  executor?: Executor;
  persist?: boolean;
  liveProviderFactory?: LiveProviderFactory;
}

const defaultLiveProviderFactory: LiveProviderFactory = (id, config) => {
  if (id === "anthropic") {
    if (!config.anthropicKey.trim()) return null;
    return new AnthropicProvider({
      apiKey: config.anthropicKey,
      model: config.anthropicModel,
    });
  }
  if (id === "ollama") {
    if (!config.ollamaUrl.trim()) return null;
    return new OllamaProvider({
      baseUrl: config.ollamaUrl,
      model: config.ollamaModel,
    });
  }
  return null;
};

let messageIdCounter = 0;
const nextMessageId = () => `m${++messageIdCounter}`;

const CACHED_LABEL = "Cached example";

const sourceLabel = (source: ProviderId): string =>
  source === "anthropic" ? "Anthropic" : source === "ollama" ? "Ollama" : "Cached";

const makeUserMessage = (text: string): StoreState["messages"][number] => ({
  id: nextMessageId(),
  role: "user",
  text,
});

const makeAssistantSuccessMessage = (
  source: ProviderId,
  modelSlug: string,
  script: string,
): StoreState["messages"][number] => ({
  id: nextMessageId(),
  role: "assistant",
  text: "",
  label: source === "cached" ? CACHED_LABEL : `${sourceLabel(source)} · ${modelSlug}`,
  source,
  modelSlug,
  script,
});

export function createDaedalusStore(options: CreateStoreOptions = {}): StoreApi<StoreState> {
  const executor = options.executor ?? new SandboxExecutor();
  const shouldPersist = options.persist ?? true;
  const liveProviderFactory = options.liveProviderFactory ?? defaultLiveProviderFactory;

  const initialState = {
    activeProvider: "cached" as ProviderId,
    anthropicKey: "",
    anthropicModel: DEFAULT_ANTHROPIC_MODEL,
    ollamaUrl: "",
    ollamaModel: "",

    currentPrompt: null,
    currentScript: null,
    currentSource: null,
    currentModelSlug: null,

    lastGoodGrid: null,
    isGenerating: false,
    lastError: null,
    providerNotConfiguredHint: false,
    showLastFailedHint: false,

    messages: [] as StoreState["messages"],

    cameraA: null,
    cameraB: null,
    cameraCompare: null,

    view: "editor" as const,

    isCodePanelOpen: false,
    codePanelSource: null,
    codePanelModelSlug: null,
    codePanelScript: null,
    codePanelErrorCopy: null,

    initPromise: null,
  };

  let inFlightAbort: AbortController | null = null;

  const buildActions = (
    set: StoreApi<StoreState>["setState"],
    get: StoreApi<StoreState>["getState"],
  ) => {
    const loadCachedDemo = async (promptSlug: string, modelSlug: string): Promise<void> => {
      const script = CACHED_DEMOS[promptSlug]?.[modelSlug];
      const text = getPromptText(promptSlug);
      if (!script || !text) return;

      set({
        isGenerating: true,
        currentPrompt: text,
        currentSource: "cached",
        currentModelSlug: modelSlug,
        currentScript: script,
        messages: [...get().messages, makeUserMessage(text)],
      });

      const result = await executor.execute(script);
      if (result.ok) {
        set({
          lastGoodGrid: result.grid,
          isGenerating: false,
          lastError: null,
          showLastFailedHint: false,
          messages: [...get().messages, makeAssistantSuccessMessage("cached", modelSlug, script)],
        });
      } else {
        const copy = errorToCopy(result.error, { ollamaUrl: get().ollamaUrl });
        set({
          isGenerating: false,
          lastError: result.error,
          showLastFailedHint: true,
          messages: [
            ...get().messages,
            {
              id: nextMessageId(),
              role: "assistant" as const,
              text: copy,
              label: "Error",
              source: "cached" as ProviderId,
              modelSlug,
              script,
              errorKind: result.error.kind,
              errorCopy: copy,
            },
          ],
        });
      }
    };

    const runLiveGeneration = async (
      prompt: string,
      provider: LLMProvider,
      modelSlug: string,
      sourceLabelName: "Anthropic" | "Ollama",
    ): Promise<void> => {
      const source = provider.id;
      const abort = new AbortController();
      inFlightAbort = abort;
      set({
        isGenerating: true,
        providerNotConfiguredHint: false,
        currentPrompt: prompt,
        currentSource: source,
        currentModelSlug: modelSlug,
        lastError: null,
        messages: [...get().messages, makeUserMessage(prompt)],
      });

      let script: string;
      try {
        script = await provider.generateVoxelScript(prompt, abort.signal);
      } catch (thrown) {
        if (inFlightAbort === abort) inFlightAbort = null;
        const err = thrown instanceof LLMProviderError ? thrown : null;
        const copy = err ? errorToCopy(err, { ollamaUrl: get().ollamaUrl }) : "Generation failed.";
        set({
          isGenerating: false,
          lastError: err,
          showLastFailedHint: true,
          messages: [
            ...get().messages,
            {
              id: nextMessageId(),
              role: "assistant" as const,
              text: copy,
              label: "Error",
              source,
              modelSlug,
              errorKind: "provider",
              errorCopy: copy,
            },
          ],
        });
        return;
      }

      if (inFlightAbort === abort) inFlightAbort = null;
      const result = await executor.execute(script);
      if (result.ok) {
        set({
          isGenerating: false,
          lastError: null,
          showLastFailedHint: false,
          lastGoodGrid: result.grid,
          currentScript: script,
          messages: [
            ...get().messages,
            {
              id: nextMessageId(),
              role: "assistant" as const,
              text: "",
              label: `${sourceLabelName} · ${modelSlug}`,
              source,
              modelSlug,
              script,
            },
          ],
        });
      } else {
        const copy = errorToCopy(result.error, { ollamaUrl: get().ollamaUrl });
        set({
          isGenerating: false,
          lastError: result.error,
          showLastFailedHint: true,
          messages: [
            ...get().messages,
            {
              id: nextMessageId(),
              role: "assistant" as const,
              text: copy,
              label: "Error",
              source,
              modelSlug,
              script,
              errorKind: result.error.kind,
              errorCopy: copy,
            },
          ],
        });
      }
    };

    const cancelGeneration = () => {
      const abort = inFlightAbort;
      if (!abort) return;
      inFlightAbort = null;
      abort.abort();
    };

    const submitPrompt = async (prompt: string): Promise<void> => {
      const trimmed = prompt.trim();
      if (!trimmed) return;
      const state = get();

      if (state.activeProvider === "cached") {
        const match = MANIFEST.prompts.find((p) => p.text === trimmed);
        if (match) {
          await loadCachedDemo(match.slug, DEFAULT_DEMO.modelSlug);
          return;
        }
        return;
      }

      if (state.activeProvider === "anthropic") {
        const provider = liveProviderFactory("anthropic", {
          anthropicKey: state.anthropicKey,
          anthropicModel: state.anthropicModel,
          ollamaUrl: state.ollamaUrl,
          ollamaModel: state.ollamaModel,
        });
        if (!provider) {
          set({ providerNotConfiguredHint: true });
          return;
        }
        await runLiveGeneration(prompt, provider, state.anthropicModel, "Anthropic");
        return;
      }

      if (state.activeProvider === "ollama") {
        const provider = liveProviderFactory("ollama", {
          anthropicKey: state.anthropicKey,
          anthropicModel: state.anthropicModel,
          ollamaUrl: state.ollamaUrl,
          ollamaModel: state.ollamaModel,
        });
        if (!provider) {
          set({ providerNotConfiguredHint: true });
          return;
        }
        await runLiveGeneration(prompt, provider, state.ollamaModel, "Ollama");
        return;
      }
    };

    const clearProviderNotConfiguredHint = () => {
      if (get().providerNotConfiguredHint) set({ providerNotConfiguredHint: false });
    };

    const setProvider = (id: ProviderId) => set({ activeProvider: id });

    const cycleProvider = () => {
      const s = get();
      const configured: ProviderId[] = ["cached"];
      if (s.anthropicKey.trim()) configured.push("anthropic");
      if (s.ollamaUrl.trim()) configured.push("ollama");
      if (configured.length <= 1) return;
      const idx = configured.indexOf(s.activeProvider);
      const next = configured[(idx + 1) % configured.length];
      set({ activeProvider: next });
    };

    const openCodePanel = (
      source: ProviderId,
      script: string,
      modelSlug: string,
      errorCopy?: string,
    ) => {
      set({
        isCodePanelOpen: true,
        codePanelSource: source,
        codePanelScript: script,
        codePanelModelSlug: modelSlug,
        codePanelErrorCopy: errorCopy ?? null,
      });
    };

    const closeCodePanel = () => {
      if (!get().isCodePanelOpen) return;
      set({ isCodePanelOpen: false });
    };

    const setAnthropicKey = (v: string) => set({ anthropicKey: v });
    const setAnthropicModel = (v: string) => set({ anthropicModel: v });
    const setOllamaUrl = (v: string) => set({ ollamaUrl: v });
    const setOllamaModel = (v: string) => set({ ollamaModel: v });

    const setView = (view: StoreState["view"]) => {
      if (get().view === view) return;
      set({ view });
    };

    const setCameraCompare = (state: NonNullable<StoreState["cameraCompare"]>) =>
      set({ cameraCompare: state });

    const awaitInit = async (): Promise<void> => {
      const p = get().initPromise;
      if (p) await p;
    };

    return {
      loadCachedDemo,
      submitPrompt,
      setProvider,
      cycleProvider,
      setAnthropicKey,
      setAnthropicModel,
      setOllamaUrl,
      setOllamaModel,
      clearProviderNotConfiguredHint,
      cancelGeneration,
      openCodePanel,
      closeCodePanel,
      setView,
      setCameraCompare,
      awaitInit,
    };
  };

  const initializer = (
    set: StoreApi<StoreState>["setState"],
    get: StoreApi<StoreState>["getState"],
  ): StoreState => ({
    ...initialState,
    ...buildActions(set, get),
  });

  const store = shouldPersist
    ? createVanillaStore<StoreState>()(
        subscribeWithSelector(
          persist(initializer, {
            name: PERSIST_KEY,
            partialize: (s) => ({
              activeProvider: s.activeProvider,
              anthropicKey: s.anthropicKey,
              anthropicModel: s.anthropicModel,
              ollamaUrl: s.ollamaUrl,
              ollamaModel: s.ollamaModel,
            }),
          }),
        ),
      )
    : createVanillaStore<StoreState>()(subscribeWithSelector(initializer));

  const initPromise = runFirstRunInit(store, executor);
  store.setState({ initPromise });

  return store;
}

async function runFirstRunInit(store: StoreApi<StoreState>, executor: Executor): Promise<void> {
  if (store.getState().lastGoodGrid) return;

  const { promptSlug, modelSlug } = DEFAULT_DEMO;
  const script = CACHED_DEMOS[promptSlug]?.[modelSlug];
  const text = getPromptText(promptSlug);
  if (!script || !text) return;

  const result: ExecuteResult = await executor.execute(script);
  if (!result.ok) return;

  store.setState({
    lastGoodGrid: result.grid,
    currentScript: script,
    currentPrompt: text,
    currentSource: "cached",
    currentModelSlug: modelSlug,
    messages: [
      {
        id: nextMessageId(),
        role: "assistant" as const,
        text: "",
        label: CACHED_LABEL,
        source: "cached" as ProviderId,
        modelSlug,
        script,
      },
    ],
  });
}
