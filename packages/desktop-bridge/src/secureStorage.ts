import type { AsyncKeyValueStore } from "./types";

export function createWebSecureStorage(prefix: string): AsyncKeyValueStore {
  const storage = window.sessionStorage;
  const keyFor = (key: string) => `${prefix}:${key}`;

  return {
    async get<T>(key: string) {
      const raw = storage.getItem(keyFor(key));
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    },
    async set<T>(key: string, value: T) {
      storage.setItem(keyFor(key), JSON.stringify(value));
    },
    async remove(key: string) {
      storage.removeItem(keyFor(key));
    }
  };
}
