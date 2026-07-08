import { useStore as useZustandStore } from "zustand";
import type { StoreApi } from "zustand/vanilla";
import { createDaedalusStore } from "./index";
import type { StoreState } from "./types";

let singleton: StoreApi<StoreState> | null = null;

export function getStore(): StoreApi<StoreState> {
  if (!singleton) singleton = createDaedalusStore({ persist: true });
  return singleton;
}

export function __resetStoreForTesting(): void {
  singleton = null;
}

export function useStore<T>(selector: (s: StoreState) => T): T {
  return useZustandStore(getStore(), selector);
}
