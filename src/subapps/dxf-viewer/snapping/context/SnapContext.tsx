/**
 * SnapContext
 * React Context για διαχείριση snap state και αποτελεσμάτων
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 3: Αποθήκευση στο Context
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */
import React, { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { ExtendedSnapType } from '../extended-types';

// ✅ ENTERPRISE FIX: Define SnapState locally since ../types doesn't exist
type SnapState = Record<ExtendedSnapType, boolean>;

// ALL_MODES array για αποφυγή enum-to-string issues
const ALL_MODES: ExtendedSnapType[] = [
  ExtendedSnapType.ENDPOINT,
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.CENTER,
  ExtendedSnapType.INTERSECTION,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.TANGENT,
  ExtendedSnapType.QUADRANT,
  ExtendedSnapType.NEAREST,
  ExtendedSnapType.EXTENSION,
  ExtendedSnapType.NODE,
  ExtendedSnapType.INSERTION,
  ExtendedSnapType.NEAR,
  ExtendedSnapType.PARALLEL,
  ExtendedSnapType.ORTHO,
  ExtendedSnapType.GRID,
  ExtendedSnapType.GUIDE,               // ADR-189: Construction guide snap
  ExtendedSnapType.CONSTRUCTION_POINT,   // ADR-189: Construction snap points
  ExtendedSnapType.AUTO
];

interface SnapContextType {
  snapState: SnapState;
  toggleSnap: (type: ExtendedSnapType) => void;
  setSnapState: (state: SnapState) => void;
  isSnapActive: (type: ExtendedSnapType) => boolean;
  snapEnabled: boolean;
  setSnapEnabled: (enabled: boolean) => void;
  enabledModes: Set<ExtendedSnapType>;
  toggleMode: (mode: ExtendedSnapType, enabled: boolean) => void;
  setExclusiveMode: (mode: ExtendedSnapType) => void;
  // 🚀 PERF (2026-02-21): currentSnapResult REMOVED from context.
  // Moved to ImmediateSnapStore (useSyncExternalStore) — only CanvasLayerStack subscribes.
  // This eliminates ~30fps re-renders for ALL other context consumers.
}

const SnapContext = createContext<SnapContextType | undefined>(undefined);

interface SnapProviderProps {
  children: ReactNode;
}

export const SnapProvider: React.FC<SnapProviderProps> = ({ children }) => {
  const [snapState, setSnapState] = useState<SnapState>(() => {
    const initialState = {} as SnapState;
    // Set default enabled snaps - ENDPOINT + infrastructure types (guide, grid, construction point)
    ALL_MODES.forEach(type => {
      initialState[type] = (
        type === ExtendedSnapType.ENDPOINT ||
        type === ExtendedSnapType.GUIDE ||
        type === ExtendedSnapType.CONSTRUCTION_POINT ||
        type === ExtendedSnapType.GRID
      );
    });
    return initialState;
  });

  // 🏢 ENTERPRISE (2026-01-27): Snap disabled by default on app start/refresh
  // User requested snap to be OFF initially for better performance during exploration
  const [snapEnabled, setSnapEnabled] = useState<boolean>(false);

  const enabledModes = React.useMemo(() => {
    const modes = new Set<ExtendedSnapType>();
    if (snapEnabled) {
      ALL_MODES.forEach(mode => {
        if (snapState[mode]) {
          modes.add(mode);
        }
      });
    }
    return modes;
  }, [snapState, snapEnabled]);

  // 🚀 PERF: Stable callback references — prevents cascading re-renders in consumers
  const toggleSnap = useCallback((type: ExtendedSnapType) => {
    setSnapState(prev => {
      const wasActive = !!prev[type];

      if (wasActive) {
        const newState = { ...prev, [type]: false };
        const hasAnyActive = ALL_MODES.some(mode => newState[mode]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        return newState;
      } else {
        return { ...prev, [type]: true };
      }
    });
  }, []);

  const isSnapActive = useCallback((type: ExtendedSnapType) => {
    if (!snapEnabled) return false;
    return snapState[type] || false;
  }, [snapEnabled, snapState]);

  const toggleMode = useCallback((mode: ExtendedSnapType, enabled: boolean) => {
    if (enabled) {
      setSnapState(prev => ({ ...prev, [mode]: true }));
    } else {
      setSnapState(prev => {
        const newState = { ...prev, [mode]: false };
        const hasAnyActive = ALL_MODES.some(m => newState[m]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        return newState;
      });
    }
  }, []);

  const setExclusiveMode = useCallback((mode: ExtendedSnapType) => {
    setSnapState(() => {
      const next = {} as SnapState;
      ALL_MODES.forEach(m => {
        next[m] = (m === mode);
      });
      return next;
    });
  }, []);

  // 🚀 PERF: Stabilized context value — only changes when snap state/enabled actually change.
  // BEFORE: New object every render → consumers cascade re-render on every SnapProvider render.
  // AFTER: useMemo with correct deps → consumers only re-render when snap data changes.
  const contextValue = useMemo<SnapContextType>(() => ({
    snapState,
    toggleSnap,
    setSnapState,
    isSnapActive,
    snapEnabled,
    setSnapEnabled,
    enabledModes,
    toggleMode,
    setExclusiveMode,
  }), [snapState, toggleSnap, isSnapActive, snapEnabled, enabledModes, toggleMode, setExclusiveMode]);

  return (
    <SnapContext.Provider value={contextValue}>
      {children}
    </SnapContext.Provider>
  );
};

export const useSnapContext = (): SnapContextType => {
  const context = useContext(SnapContext);
  if (!context) {
    throw new Error('useSnapContext must be used within a SnapProvider');
  }
  return context;
};
