'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { 
  type CursorSettings, 
  type CursorState,
  DEFAULT_CURSOR_SETTINGS,
  cursorConfig,
  getCursorSettings,
  updateCursorSettings,
  subscribeToCursorSettings
} from './config';
import { createDefaultCursorState, throttleMouseEvents } from './utils';

// Context type that combines state and actions
interface CursorContextType extends CursorState {
  settings: CursorSettings;
  // Settings actions
  updateSettings: (updates: Partial<CursorSettings>) => void;
  resetToDefaults: () => void;
  // State actions
  updatePosition: (position: { x: number; y: number } | null) => void;
  updateViewport: (viewport: { width: number; height: number }) => void;
  setActive: (active: boolean) => void;
  setTool: (tool: string) => void;
  setSnapPoint: (point: { x: number; y: number } | null) => void;
  setWorldPosition: (position: { x: number; y: number } | null) => void;
}

// Actions for reducer
type CursorAction =
  | { type: 'UPDATE_POSITION'; position: { x: number; y: number } | null }
  | { type: 'UPDATE_VIEWPORT'; viewport: { width: number; height: number } }
  | { type: 'SET_ACTIVE'; active: boolean }
  | { type: 'SET_TOOL'; tool: string }
  | { type: 'SET_SNAP_POINT'; point: { x: number; y: number } | null }
  | { type: 'SET_WORLD_POSITION'; position: { x: number; y: number } | null }
  | { type: 'UPDATE_SETTINGS'; settings: CursorSettings };

// Cursor reducer
function cursorReducer(state: CursorState & { settings: CursorSettings }, action: CursorAction) {
  switch (action.type) {
    case 'UPDATE_POSITION':
      return { ...state, position: action.position };
    case 'UPDATE_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_ACTIVE':
      return { ...state, isActive: action.active };
    case 'SET_TOOL':
      return { ...state, tool: action.tool };
    case 'SET_SNAP_POINT':
      return { ...state, snapPoint: action.point };
    case 'SET_WORLD_POSITION':
      return { ...state, worldPosition: action.position };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: action.settings };
    default:
      return state;
  }
}

// Create context
export const CursorContext = createContext<CursorContextType | null>(null);

// Initial state
const initialState = {
  ...createDefaultCursorState(),
  settings: DEFAULT_CURSOR_SETTINGS,
};

// Provider component
export function CursorSystem({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cursorReducer, {
    ...initialState,
    settings: getCursorSettings(),
  });

  // Subscribe to settings changes
  useEffect(() => {
    const unsubscribe = subscribeToCursorSettings((settings) => {
      dispatch({ type: 'UPDATE_SETTINGS', settings });
    });
    return unsubscribe;
  }, []);

  // Action creators
  const actions = useMemo(() => ({
    // Settings actions
    updateSettings: (updates: Partial<CursorSettings>) => {
      updateCursorSettings(updates);
    },
    resetToDefaults: () => {
      cursorConfig.resetToDefaults();
    },
    // State actions
    updatePosition: (position: { x: number; y: number } | null) => 
      dispatch({ type: 'UPDATE_POSITION', position }),
    updateViewport: (viewport: { width: number; height: number }) => 
      dispatch({ type: 'UPDATE_VIEWPORT', viewport }),
    setActive: (active: boolean) => 
      dispatch({ type: 'SET_ACTIVE', active }),
    setTool: (tool: string) => 
      dispatch({ type: 'SET_TOOL', tool }),
    setSnapPoint: (point: { x: number; y: number } | null) => 
      dispatch({ type: 'SET_SNAP_POINT', point }),
    setWorldPosition: (position: { x: number; y: number } | null) => 
      dispatch({ type: 'SET_WORLD_POSITION', position }),
  }), []);

  // Combine state and actions
  const contextValue = useMemo((): CursorContextType => ({
    ...state,
    ...actions,
  }), [state, actions]);

  return (
    <CursorContext.Provider value={contextValue}>
      {children}
    </CursorContext.Provider>
  );
}

// Hook to use cursor context
export function useCursor() {
  const context = useContext(CursorContext);
  if (!context) {
    throw new Error('useCursor must be used within a CursorSystem');
  }
  return context;
}

// Backward compatibility exports
export const CursorProvider = CursorSystem;
export const useCursorContext = useCursor;