import { useCallback, useEffect, useRef, useState } from "react";

export interface RequestState<TData> {
  data: TData | null;
  error: Error | null;
  loading: boolean;
}

export interface UseRequestOptions<TData> {
  immediate?: boolean;
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
}

export function useRequest<TData, TArgs extends unknown[] = []>(
  request: (...args: TArgs) => Promise<TData>,
  options: UseRequestOptions<TData> = {}
) {
  const { immediate = false, onSuccess, onError } = options;
  const mountedRef = useRef(true);
  const [state, setState] = useState<RequestState<TData>>({
    data: null,
    error: null,
    loading: immediate
  });

  const run = useCallback(
    async (...args: TArgs) => {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await request(...args);
        if (mountedRef.current) {
          setState({ data, error: null, loading: false });
        }
        onSuccess?.(data);
        return data;
      } catch (caught) {
        const error = caught instanceof Error ? caught : new Error("Request failed");
        if (mountedRef.current) {
          setState((current) => ({ ...current, error, loading: false }));
        }
        onError?.(error);
        throw error;
      }
    },
    [onError, onSuccess, request]
  );

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      void run(...([] as unknown as TArgs));
    }
    return () => {
      mountedRef.current = false;
    };
  }, [immediate, run]);

  return {
    ...state,
    run,
    refresh: run
  };
}

export function useMutation<TData, TArgs extends unknown[] = []>(
  mutation: (...args: TArgs) => Promise<TData>,
  options: Omit<UseRequestOptions<TData>, "immediate"> = {}
) {
  return useRequest(mutation, { ...options, immediate: false });
}
