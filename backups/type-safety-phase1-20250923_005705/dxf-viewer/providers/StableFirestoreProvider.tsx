/**
 * Stable Firestore Provider - Stop resubscribe loops
 * Stable query keys + memoized props + smart dependency management
 */

import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { dlog, dwarn, derr } from '../utils/OptimizedLogger';

interface FirestoreContextType {
  projectId: string | null;
  levelId: string | null;
  subscribe: (key: string, callback: (data: any) => void) => () => void;
  getSubscriptionStats: () => any;
}

const FirestoreContext = createContext<FirestoreContextType | undefined>(undefined);

// ═══ STABLE SUBSCRIPTION MANAGER ═══

class StableSubscriptionManager {
  private subscriptions = new Map<string, {
    unsubscribe: () => void;
    callbacks: Set<(data: any) => void>;
    lastData: any;
    subscribeCount: number;
  }>();

  private subscriptionStats = {
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    resubscribeCount: 0,
    lastActivity: Date.now()
  };

  subscribe(key: string, callback: (data: any) => void): () => void {
    dlog('🔥 Firestore subscribe requested:', key);

    // Check αν υπάρχει ήδη subscription
    if (this.subscriptions.has(key)) {
      const existing = this.subscriptions.get(key)!;
      existing.callbacks.add(callback);
      existing.subscribeCount++;

      // Αν έχουμε cached data, στείλε τα αμέσως
      if (existing.lastData) {
        callback(existing.lastData);
      }

      dlog('🔥 Reusing existing Firestore subscription:', key, `(${existing.callbacks.size} callbacks)`);

      // Return unsubscribe function
      return () => {
        existing.callbacks.delete(callback);
        if (existing.callbacks.size === 0) {
          this.unsubscribe(key);
        }
      };
    }

    // Δημιουργία νέου subscription
    this.subscriptionStats.totalSubscriptions++;
    this.subscriptionStats.activeSubscriptions++;
    this.subscriptionStats.lastActivity = Date.now();

    const callbacks = new Set([callback]);
    let lastData: any = null;

    // TODO: Replace με actual Firestore call
    const unsubscribe = this.createFirestoreSubscription(key, (data) => {
      lastData = data;
      // Broadcast σε όλα τα callbacks
      callbacks.forEach(cb => {
        try {
          cb(data);
        } catch (error) {
          dwarn('Error in Firestore callback:', error);
        }
      });
    });

    this.subscriptions.set(key, {
      unsubscribe,
      callbacks,
      lastData,
      subscribeCount: 1
    });

    dlog('🔥 New Firestore subscription created:', key);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.unsubscribe(key);
      }
    };
  }

  private unsubscribe(key: string): void {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(key);
      this.subscriptionStats.activeSubscriptions--;
      dlog('🔥 Firestore subscription removed:', key);
    }
  }

  private createFirestoreSubscription(key: string, callback: (data: any) => void): () => void {
    // TODO: Implement actual Firestore onSnapshot
    // For now, simulate with timeout
    dlog('🔥 Creating Firestore onSnapshot for:', key);
    
    const timer = setTimeout(() => {
      callback({ key, data: 'simulated', timestamp: Date.now() });
    }, 100);

    return () => {
      clearTimeout(timer);
      dlog('�� Firestore onSnapshot unsubscribed:', key);
    };
  }

  getStats() {
    return {
      ...this.subscriptionStats,
      activeKeys: Array.from(this.subscriptions.keys()),
      subscriptionDetails: Array.from(this.subscriptions.entries()).map(([key, sub]) => ({
        key,
        callbackCount: sub.callbacks.size,
        subscribeCount: sub.subscribeCount,
        hasData: !!sub.lastData
      }))
    };
  }

  dispose(): void {
    this.subscriptions.forEach((sub, key) => {
      sub.unsubscribe();
    });
    this.subscriptions.clear();
    this.subscriptionStats.activeSubscriptions = 0;
    dlog('🔥 StableSubscriptionManager disposed');
  }
}

// ═══ SINGLETON SUBSCRIPTION MANAGER ═══
const subscriptionManager = new StableSubscriptionManager();

// ═══ STABLE FIRESTORE PROVIDER ═══

interface StableFirestoreProviderProps {
  projectId: string | null;
  levelId: string | null;
  children: React.ReactNode;
}

export const StableFirestoreProvider: React.FC<StableFirestoreProviderProps> = ({
  projectId,
  levelId,
  children
}) => {
  
  // ═══ STABLE KEYS (NO OBJECT RECREATION) ═══
  const stableProjectId = useRef(projectId);
  const stableLevelId = useRef(levelId);

  // Update refs μόνο όταν αλλάζουν τα values
  if (stableProjectId.current !== projectId) {
    stableProjectId.current = projectId;
    dlog('🔥 Project ID changed:', projectId);
  }
  
  if (stableLevelId.current !== levelId) {
    stableLevelId.current = levelId;
    dlog('🔥 Level ID changed:', levelId);
  }

  // ═══ MEMOIZED CONTEXT VALUE (PREVENT PROVIDER CHURN) ═══
  const contextValue = useMemo<FirestoreContextType>(() => ({
    projectId: stableProjectId.current,
    levelId: stableLevelId.current,
    subscribe: (key: string, callback: (data: any) => void) => {
      return subscriptionManager.subscribe(key, callback);
    },
    getSubscriptionStats: () => subscriptionManager.getStats()
  }), [stableProjectId.current, stableLevelId.current]); // ← Stable deps!

  // ═══ CLEANUP ON UNMOUNT ═══
  useEffect(() => {
    return () => {
      subscriptionManager.dispose();
    };
  }, []);

  return (
    <FirestoreContext.Provider value={contextValue}>
      {children}
    </FirestoreContext.Provider>
  );
};

// ═══ STABLE HOOK ═══

export const useStableFirestore = () => {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useStableFirestore must be used within StableFirestoreProvider');
  }
  return context;
};

// ═══ STABLE SUBSCRIPTION HOOK ═══

export const useStableFirestoreSubscription = (
  queryKey: string | null, 
  enabled = true
) => {
  const { subscribe } = useStableFirestore();
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);

  // ═══ STABLE QUERY KEY ═══
  const stableQueryKey = useMemo(() => queryKey, [queryKey]);

  // ═══ STABLE CALLBACK ═══
  const handleData = useCallback((newData: any) => {
    setData(newData);
    setLoading(false);
    setError(null);
  }, []);

  const handleError = useCallback((err: Error) => {
    setError(err);
    setLoading(false);
  }, []);

  // ═══ SUBSCRIPTION EFFECT (STABLE DEPS) ═══
  useEffect(() => {
    if (!stableQueryKey || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribe(stableQueryKey, handleData);
      dlog('🔥 Subscribed to:', stableQueryKey);

      return () => {
        unsubscribe();
        dlog('🔥 Unsubscribed from:', stableQueryKey);
      };
    } catch (err) {
      derr('🔥 Subscription error:', err);
      handleError(err as Error);
    }
  }, [stableQueryKey, enabled, subscribe, handleData]); // ← Stable deps μόνο!

  return { data, loading, error };
};

// ═══ DIAGNOSTIC FUNCTIONS ═══

export const getFirestoreSubscriptionStats = () => {
  return subscriptionManager.getStats();
};

export const debugFirestoreSubscriptions = () => {
  const stats = subscriptionManager.getStats();
  console.log('🔥 Firestore Subscription Stats:', stats);
  return stats;
};

// Make available in window για debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).debugFirestore = {
    stats: getFirestoreSubscriptionStats,
    debug: debugFirestoreSubscriptions,
    manager: subscriptionManager
  };
}
