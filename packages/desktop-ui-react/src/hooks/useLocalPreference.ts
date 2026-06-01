import { useCallback, useEffect, useState } from "react";

export function useLocalPreference<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored) as T);
    } catch {
      setValue(initialValue);
    }
  }, [initialValue, key]);

  const update = useCallback(
    (nextValue: T) => {
      setValue(nextValue);
      window.localStorage.setItem(key, JSON.stringify(nextValue));
    },
    [key]
  );

  const clear = useCallback(() => {
    setValue(initialValue);
    window.localStorage.removeItem(key);
  }, [initialValue, key]);

  return [value, update, clear] as const;
}
