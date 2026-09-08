import { useCallback, useEffect, useRef, useState, useMemo } from 'react';

/**
 * Custom hook for debouncing values
 * Delays updating the value until after wait time has elapsed since last change
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook for throttling function calls
 * Ensures function is called at most once per specified interval
 */
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const lastExecRef = useRef<number>(0);

  const throttledFunc = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      
      if (now - lastExecRef.current >= delay) {
        lastExecRef.current = now;
        return func(...args);
      }
    },
    [func, delay]
  ) as T;

  return throttledFunc;
}

/**
 * Custom hook for memoizing expensive computations
 * Similar to useMemo but with better performance for complex dependencies
 */
export function useStableMemo<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  const ref = useRef<{ deps: React.DependencyList; value: T }>();
  
  if (!ref.current || !areEqual(ref.current.deps, deps)) {
    ref.current = { deps, value: factory() };
  }
  
  return ref.current.value;
}

/**
 * Custom hook for preventing unnecessary re-renders with stable references
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const ref = useRef<T>(callback);
  ref.current = callback;
  
  return useCallback((...args: Parameters<T>) => {
    return ref.current(...args);
  }, []) as T;
}

/**
 * Custom hook for managing component state with batched updates
 * Reduces the number of re-renders by batching state updates
 */
export function useBatchedState<T>(
  initialState: T
): [T, (updater: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(initialState);
  const batchedUpdatesRef = useRef<Set<T | ((prev: T) => T)>>(new Set());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchedSetState = useCallback((updater: T | ((prev: T) => T)) => {
    batchedUpdatesRef.current.add(updater);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setState(prevState => {
        let newState = prevState;
        batchedUpdatesRef.current.forEach(update => {
          newState = typeof update === 'function' ? update(newState) : update;
        });
        batchedUpdatesRef.current.clear();
        return newState;
      });
    }, 0);
  }, []);

  return [state, batchedSetState];
}

/**
 * Custom hook for managing multiple related state variables
 * Reduces re-renders by grouping related state updates
 */
export function useGroupedState<T extends Record<string, any>>(
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  
  const updateState = useCallback((updates: Partial<T>) => {
    setState(prevState => ({
      ...prevState,
      ...updates
    }));
  }, []);

  return [state, updateState];
}

/**
 * Custom hook for preventing unnecessary effect runs
 * Uses deep comparison for complex dependencies
 */
export function useDeepEffect(
  effect: React.EffectCallback,
  deps: React.DependencyList
): void {
  const prevDepsRef = useRef<React.DependencyList>();
  const hasChanged = !prevDepsRef.current || !areEqual(prevDepsRef.current, deps);
  
  useEffect(() => {
    if (hasChanged) {
      prevDepsRef.current = deps;
      return effect();
    }
  });
}

/**
 * Custom hook for managing component mounting state
 * Prevents state updates on unmounted components
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);
  
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  return useCallback(() => isMountedRef.current, []);
}

/**
 * Custom hook for managing async operations with cancellation
 */
export function useAsyncOperation<T>() {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({ data: null, loading: false, error: null });
  
  const isMounted = useIsMounted();
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (asyncFunc: () => Promise<T>) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    setState({ data: null, loading: true, error: null });
    
    try {
      const result = await asyncFunc();
      if (isMounted()) {
        setState({ data: result, loading: false, error: null });
      }
      return result;
    } catch (error) {
      if (isMounted() && !abortControllerRef.current.signal.aborted) {
        setState({ data: null, loading: false, error: error as Error });
      }
      throw error;
    }
  }, [isMounted]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { ...state, execute, cancel };
}

/**
 * Custom hook for optimizing list rendering with virtualization support
 */
export function useVirtualizedList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    
    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight
    };
  }, [items, itemHeight, containerHeight, scrollTop]);
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);
  
  return { visibleItems, handleScroll };
}

/**
 * Custom hook for preventing rapid successive calls
 * Useful for preventing double-clicks or rapid form submissions
 */
export function usePreventRapidCalls<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 300
): T {
  const lastCallRef = useRef<number>(0);
  
  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      return func(...args);
    }
  }, [func, delay]) as T;
}

// Utility functions
function areEqual(a: React.DependencyList, b: React.DependencyList): boolean {
  if (a.length !== b.length) return false;
  
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  
  return true;
}

/**
 * Custom hook for managing request deduplication
 * Prevents multiple identical requests from being made simultaneously
 */
export function useRequestDeduplication() {
  const pendingRequests = useRef<Map<string, Promise<any>>>(new Map());
  
  const dedupedRequest = useCallback(async <T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    if (pendingRequests.current.has(key)) {
      return pendingRequests.current.get(key)!;
    }
    
    const promise = requestFn().finally(() => {
      pendingRequests.current.delete(key);
    });
    
    pendingRequests.current.set(key, promise);
    return promise;
  }, []);
  
  return { dedupedRequest };
}