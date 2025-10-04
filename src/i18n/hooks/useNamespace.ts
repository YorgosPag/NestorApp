import { useEffect, useState } from 'react';
import { loadNamespace, type Namespace } from '../lazy-config';

/**
 * Hook for lazy loading translation namespaces
 * Automatically loads the namespace when component mounts
 */
export function useNamespace(namespace: Namespace) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        await loadNamespace(namespace);
        
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load namespace'));
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [namespace]);

  return { isLoading, error };
}

/**
 * Hook for loading multiple namespaces
 */
export function useNamespaces(namespaces: Namespace[]) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        await Promise.all(
          namespaces.map(ns => loadNamespace(ns))
        );
        
        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load namespaces'));
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [namespaces.join(',')]);

  return { isLoading, error };
}