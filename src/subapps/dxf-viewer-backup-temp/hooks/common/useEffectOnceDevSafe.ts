/**
 * useEffectOnceDevSafe - StrictMode-safe effect για resource creation/disposal
 * Λύνει το churn: init→dispose→init σε StrictMode development
 */

import { useEffect, useRef } from 'react';

export function useEffectOnceDevSafe(effect: () => void | (() => void)) {
  const destroyRef = useRef<null | (() => void)>(null);
  const calledRef = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {

    if (calledRef.current) {
      // 🔺 2η κλήση από StrictMode – αγνοούμε το setup
      // αλλά επιτρέπουμε κανονικό cleanup αργότερα

      mountedRef.current = true;
      return;
    }

    calledRef.current = true;
    mountedRef.current = true;

    const cleanup = effect();
    destroyRef.current = cleanup || null;

    return () => {

      // �� Κάνε πραγματικό cleanup μόνο όταν όντως απο-μονταριστεί το component
      if (mountedRef.current && destroyRef.current) {

        destroyRef.current();
        destroyRef.current = null;
      } else {

      }
    };
  }, []); // ← Άδεια dependencies - τρέχει μόνο στο mount/unmount

  // Debug function
  const getDebugInfo = () => ({
    called: calledRef.current,
    mounted: mountedRef.current,
    hasDestroy: !!destroyRef.current
  });

  return { getDebugInfo };
}

// ═══ ALTERNATIVE: useEffectStable για non-resource effects ═══
export function useEffectStable(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  debugName?: string
) {
  const lastDepsRef = useRef<React.DependencyList | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Shallow comparison των dependencies
    const depsChanged = !lastDepsRef.current || 
      lastDepsRef.current.length !== deps.length ||
      lastDepsRef.current.some((dep, i) => dep !== deps[i]);

    if (!depsChanged) {

      return;
    }

    // Cleanup previous
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    // Execute new effect
    lastDepsRef.current = [...deps];
    const cleanup = effect();
    cleanupRef.current = cleanup || null;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, deps);
}

// ═══ SPECIALIZED: useResourceOnce για engines/subscriptions ═══
export function useResourceOnce<T>(
  create: () => T,
  dispose: (resource: T) => void,
  debugName?: string
) {
  const resourceRef = useRef<T | null>(null);
  const { getDebugInfo } = useEffectOnceDevSafe(() => {

    resourceRef.current = create();
    
    return () => {

      if (resourceRef.current) {
        dispose(resourceRef.current);
        resourceRef.current = null;
      }
    };
  });

  return {
    resource: resourceRef.current,
    getDebugInfo
  };
}

// ═══ USAGE EXAMPLES ═══

/*
// Example 1: Snap Engine
const { resource: snapEngine } = useResourceOnce(
  () => new UnifiedSnapEngine(settings),
  (engine) => engine.dispose(),
  'SnapEngine'
);

// Example 2: Firestore Subscription
useEffectOnceDevSafe(() => {
  const unsubscribe = onSnapshot(firestoreRef, handleSnapshot);
  return () => unsubscribe();
});

// Example 3: Stable Effect with deps
useEffectStable(() => {
  engine?.configure(entities);
}, [entitiesHash], 'SnapEngineConfig');
*/
