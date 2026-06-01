import type { KeyValueStore, SessionStore } from "./types";

function readJSON<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key);
  if (raw === null) return null;
  return JSON.parse(raw) as T;
}

export function createWebStorage(storage: Storage): KeyValueStore {
  return {
    get: <T,>(key: string) => readJSON<T>(storage, key),
    set: <T,>(key: string, value: T) => storage.setItem(key, JSON.stringify(value)),
    remove: (key: string) => storage.removeItem(key)
  };
}

export function createWebSessionStore(tokenKey: string): SessionStore {
  return {
    getToken: () => window.localStorage.getItem(tokenKey) || window.sessionStorage.getItem(tokenKey),
    setToken: (token: string, remember?: boolean) => {
      window.localStorage.removeItem(tokenKey);
      window.sessionStorage.removeItem(tokenKey);
      (remember ? window.localStorage : window.sessionStorage).setItem(tokenKey, token);
    },
    clearToken: () => {
      window.localStorage.removeItem(tokenKey);
      window.sessionStorage.removeItem(tokenKey);
    }
  };
}
