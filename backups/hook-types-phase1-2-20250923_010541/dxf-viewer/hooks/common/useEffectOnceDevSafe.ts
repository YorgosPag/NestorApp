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
    console.log('🔄 useEffectOnceDevSafe called, already called:', calledRef.current);

    if (calledRef.current) {
      // 🎯 2η κλήση από StrictMode – αγνοούμε το setup
      // αλλά επιτρέπουμε κανονικό cleanup αργότερα
      console.log('🔄 StrictMode 2nd call - skipping setup, allowing cleanup');
      mountedRef.current = true;
      return;
    }

    calledRef.current = true;
    mountedRef.current = true;

    console.log('🔄 First call - executing effect setup');
    const cleanup = effect();
    destroyRef.current = cleanup || null;

    return () => {
      console.log('🔄 Cleanup called - mounted:', mountedRef.current, 'has destroyer:', !!destroyRef.current);
      
      // �� Κάνε πραγματικό cleanup μόνο όταν όντως απο-μονταριστεί το component
      if (mountedRef.current && destroyRef.current) {
        console.log('🔄 Executing real cleanup');
        destroyRef.current();
        destroyRef.current = null;
      } else {
        console.log('🔄 Skipping cleanup (StrictMode intermediate)');
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
      console.log('🔄 useEffectStable skipping - deps unchanged:', debugName);
      return;
    }

    console.log('🔄 useEffectStable executing - deps changed:', debugName, deps);
    
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
    console.log('�� Creating resource:', debugName);
    resourceRef.current = create();
    
    return () => {
      console.log('🔄 Disposing resource:', debugName);
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
