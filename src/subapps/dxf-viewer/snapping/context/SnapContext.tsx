/**
 * SnapContext
 * React Context για διαχείριση snap state και αποτελεσμάτων
 *
 * @see docs/features/snapping/SNAP_INDICATOR_LINE.md - Βήμα 3: Αποθήκευση στο Context
 * @see docs/features/snapping/ARCHITECTURE.md - Αρχιτεκτονική snap system
 */
import React, { createContext, useContext, useState, type ReactNode, useCallback } from 'react';
import { ExtendedSnapType } from '../extended-types';
import type { ProSnapResult } from '../extended-types';

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
  // 🎯 ENTERPRISE: Current snap result for visual feedback (SnapIndicatorOverlay)
  currentSnapResult: ProSnapResult | null;
  setCurrentSnapResult: (result: ProSnapResult | null) => void;
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

  // 🎯 ENTERPRISE: Current snap result for visual feedback
  const [currentSnapResult, setCurrentSnapResultState] = useState<ProSnapResult | null>(null);

  // 🎯 ENTERPRISE: Memoized setter to avoid unnecessary re-renders
  const setCurrentSnapResult = useCallback((result: ProSnapResult | null) => {
    setCurrentSnapResultState(result);
  }, []);

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

  const toggleSnap = (type: ExtendedSnapType) => {
    setSnapState(prev => {
      const wasActive = !!prev[type];
      
      if (wasActive) {
        // If already active, turn it off but keep at least one mode active
        const newState = { ...prev, [type]: false };
        
        // Ensure at least one mode is active - default to ENDPOINT
        const hasAnyActive = ALL_MODES.some(mode => newState[mode]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        
        return newState;
      } else {
        // Multi-select mode: Just add this type to active ones
        return { ...prev, [type]: true };
      }
    });
  };

  const isSnapActive = (type: ExtendedSnapType) => {
    if (!snapEnabled) return false;
    return snapState[type] || false;
  };

  const toggleMode = (mode: ExtendedSnapType, enabled: boolean) => {
    if (enabled) {
      // Multi-select mode: Just add this mode to active ones
      setSnapState(prev => ({ ...prev, [mode]: true }));
    } else {
      // Turn off this mode, ensure at least one mode is active
      setSnapState(prev => {
        const newState = { ...prev, [mode]: false };
        
        // Ensure at least one mode is active - default to ENDPOINT
        const hasAnyActive = ALL_MODES.some(m => newState[m]);
        if (!hasAnyActive) {
          newState[ExtendedSnapType.ENDPOINT] = true;
        }
        
        return newState;
      });
    }
  };

  const setExclusiveMode = (mode: ExtendedSnapType) => {
    setSnapState(prev => {
      const next = {} as SnapState;
      ALL_MODES.forEach(m => {
        next[m] = (m === mode);
      });
      return next;
    });
  };

  const contextValue: SnapContextType = {
    snapState,
    toggleSnap,
    setSnapState,
    isSnapActive,
    snapEnabled,
    setSnapEnabled,
    enabledModes,
    toggleMode,
    setExclusiveMode,
    // 🎯 ENTERPRISE: Current snap result for visual feedback
    currentSnapResult,
    setCurrentSnapResult
  };

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
