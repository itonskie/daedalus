import type { LLMProvider, LLMProviderError } from "../llm";
import type { ExecuteError } from "../sandbox";
import type { GridReadback } from "../voxel";

export type ProviderId = "cached" | "anthropic" | "ollama";
export type LiveProviderId = "anthropic" | "ollama";

export type LiveProviderFactory = (
  id: LiveProviderId,
  config: {
    anthropicKey: string;
    anthropicModel: string;
    ollamaUrl: string;
    ollamaModel: string;
  },
) => LLMProvider | null;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  label?: string;
  source?: ProviderId;
  modelSlug?: string;
  script?: string;
  errorKind?: ExecuteError["kind"] | "provider";
  errorCopy?: string;
}

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
}

export type ViewMode = "editor" | "compare";

export interface StoreState {
  activeProvider: ProviderId;
  anthropicKey: string;
  anthropicModel: string;
  ollamaUrl: string;
  ollamaModel: string;

  currentPrompt: string | null;
  currentScript: string | null;
  currentSource: ProviderId | null;
  currentModelSlug: string | null;

  lastGoodGrid: GridReadback | null;
  isGenerating: boolean;
  lastError: ExecuteError | LLMProviderError | null;
  providerNotConfiguredHint: boolean;
  showLastFailedHint: boolean;

  messages: ChatMessage[];

  cameraA: CameraState | null;
  cameraB: CameraState | null;
  cameraCompare: CameraState | null;

  view: ViewMode;

  isCodePanelOpen: boolean;
  codePanelSource: ProviderId | null;
  codePanelModelSlug: string | null;
  codePanelScript: string | null;
  codePanelErrorCopy: string | null;

  initPromise: Promise<void> | null;

  loadCachedDemo: (promptSlug: string, modelSlug: string) => Promise<void>;
  submitPrompt: (prompt: string) => Promise<void>;
  setProvider: (id: ProviderId) => void;
  cycleProvider: () => void;
  setAnthropicKey: (v: string) => void;
  setAnthropicModel: (v: string) => void;
  setOllamaUrl: (v: string) => void;
  setOllamaModel: (v: string) => void;
  clearProviderNotConfiguredHint: () => void;
  cancelGeneration: () => void;
  openCodePanel: (
    source: ProviderId,
    script: string,
    modelSlug: string,
    errorCopy?: string,
  ) => void;
  closeCodePanel: () => void;
  setView: (view: ViewMode) => void;
  setCameraCompare: (state: CameraState) => void;
  awaitInit: () => Promise<void>;
}

export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_OLLAMA_MODEL = "qwen3.6:27b-coding-nvfp4";
export const PERSIST_KEY = "daedalus-mvp-v1";
