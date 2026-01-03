'use client';

/**
 * TRANSFORM CONTEXT
 * ✅ Single Source of Truth για viewport transform
 * ✅ Industry Standard: Ακολουθεί CAD software best practices
 * ✅ Centralized State Management για coordinate transformations
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ViewTransform } from '../rendering/types/Types';

// ✅ ENTERPRISE: Window interface extension for legacy support
declare global {
  interface Window {
    dxfTransform?: ViewTransform;
  }
}

// ─────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────────────

interface TransformContextValue {
  /** Current viewport transform (SINGLE SOURCE OF TRUTH) */
  transform: ViewTransform;

  /** Update transform (centralized update point) */
  setTransform: (newTransform: ViewTransform) => void;

  /** Update transform with callback (for functional updates) */
  updateTransform: (updater: (prev: ViewTransform) => ViewTransform) => void;
}

// ─────────────────────────────────────────────────────────────────
// CONTEXT CREATION
// ─────────────────────────────────────────────────────────────────

const TransformContext = createContext<TransformContextValue | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────
// PROVIDER COMPONENT
// ─────────────────────────────────────────────────────────────────

interface TransformProviderProps {
  children: ReactNode;
  initialTransform?: ViewTransform;
  /** Optional callback to expose setTransform to parent */
  onTransformReady?: (setTransform: (t: ViewTransform) => void) => void;
}

export function TransformProvider({
  children,
  initialTransform = { scale: 1, offsetX: 0, offsetY: 0 },
  onTransformReady
}: TransformProviderProps) {
  const [transform, setTransformState] = useState<ViewTransform>(initialTransform);

  // ❌ REMOVED: The sync was causing conflicts
  // The transform should be updated via setTransform(), not via prop changes

  // ✅ CENTRALIZED UPDATE: Κεντρικό σημείο για όλες τις transform αλλαγές
  const setTransform = useCallback((newTransform: ViewTransform) => {
    setTransformState(newTransform);

    // ✅ LEGACY SUPPORT: Ενημέρωση window.dxfTransform για backward compatibility
    // (Θα αφαιρεθεί σταδιακά καθώς όλα μεταβούν σε Context)
    if (typeof window !== 'undefined') {
      window.dxfTransform = newTransform;
    }

    // ✅ EVENT DISPATCH: Για components που ακούν events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dxf-zoom-changed', {
        detail: { transform: newTransform }
      }));
    }
  }, []);

  // ✅ EXPOSE setTransform: Κάλεσε το callback για να δώσεις access στον parent
  React.useEffect(() => {
    if (onTransformReady) {
      onTransformReady(setTransform);
    }
  }, [onTransformReady, setTransform]);

  // ✅ FUNCTIONAL UPDATE: Για updates που βασίζονται στο previous state
  const updateTransform = useCallback((updater: (prev: ViewTransform) => ViewTransform) => {
    setTransformState(prev => {
      const newTransform = updater(prev);

      // Same side effects as setTransform
      if (typeof window !== 'undefined') {
        window.dxfTransform = newTransform;
        window.dispatchEvent(new CustomEvent('dxf-zoom-changed', {
          detail: { transform: newTransform }
        }));
      }

      return newTransform;
    });
  }, []);

  // ✅ MEMOIZE: Αποφυγή περιττών re-renders
  const value: TransformContextValue = React.useMemo(() => ({
    transform,
    setTransform,
    updateTransform
  }), [transform, setTransform, updateTransform]);

  return (
    <TransformContext.Provider value={value}>
      {children}
    </TransformContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────
// HOOK FOR CONSUMING CONTEXT
// ─────────────────────────────────────────────────────────────────

/**
 * Hook για χρήση του Transform Context
 * @throws Error αν χρησιμοποιηθεί εκτός TransformProvider
 */
export function useTransform(): TransformContextValue {
  const context = useContext(TransformContext);

  if (context === undefined) {
    throw new Error('useTransform must be used within a TransformProvider');
  }

  return context;
}

// ─────────────────────────────────────────────────────────────────
// OPTIONAL: READ-ONLY HOOK
// ─────────────────────────────────────────────────────────────────

/**
 * Hook για read-only access στο transform
 * Χρήσιμο για components που μόνο διαβάζουν το transform
 */
export function useTransformValue(): ViewTransform {
  const { transform } = useTransform();
  return transform;
}

// ─────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────

export { TransformContext };
export type { TransformContextValue };
