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
import type { Point2D, Viewport } from '../../rendering/types/Types';

// Context type that combines state and actions
interface CursorContextType extends CursorState {
  settings: CursorSettings;
  // Settings actions
  updateSettings: (updates: Partial<CursorSettings>) => void;
  resetToDefaults: () => void;

  // ✅ CORE MOUSE ACTIONS (Professional CAD Interface)
  updatePosition: (position: Point2D | null) => void;
  updateWorldPosition: (position: Point2D | null) => void;
  updateViewport: (viewport: Viewport) => void;

  // ✅ MOUSE BUTTON ACTIONS
  setMouseDown: (down: boolean, button?: number) => void;

  // ✅ CAD STATE ACTIONS
  setActive: (active: boolean) => void;
  setTool: (tool: string) => void;
  setSnapPoint: (point: Point2D | null) => void;

  // ✅ SELECTION ACTIONS (CAD Selection System)
  startSelection: (startPoint: Point2D) => void;
  updateSelection: (currentPoint: Point2D) => void;
  endSelection: () => void;
  cancelSelection: () => void;
}

// ✅ PROFESSIONAL CAD ACTIONS
type CursorAction =
  | { type: 'UPDATE_POSITION'; position: Point2D | null }
  | { type: 'UPDATE_WORLD_POSITION'; position: Point2D | null }
  | { type: 'UPDATE_VIEWPORT'; viewport: Viewport }
  | { type: 'SET_MOUSE_DOWN'; down: boolean; button?: number }
  | { type: 'SET_ACTIVE'; active: boolean }
  | { type: 'SET_TOOL'; tool: string }
  | { type: 'SET_SNAP_POINT'; point: Point2D | null }
  | { type: 'START_SELECTION'; startPoint: Point2D }
  | { type: 'UPDATE_SELECTION'; currentPoint: Point2D }
  | { type: 'END_SELECTION' }
  | { type: 'CANCEL_SELECTION' }
  | { type: 'UPDATE_SETTINGS'; settings: CursorSettings };

// Cursor reducer
function cursorReducer(state: CursorState & { settings: CursorSettings }, action: CursorAction) {
  switch (action.type) {
    case 'UPDATE_POSITION':
      // ✅ OPTIMIZATION: Skip update if position unchanged to prevent infinite cycles
      if (state.position?.x === action.position?.x && state.position?.y === action.position?.y) {
        return state;
      }
      return { ...state, position: action.position };
    case 'UPDATE_WORLD_POSITION':
      // ✅ OPTIMIZATION: Skip update if world position unchanged
      if (state.worldPosition?.x === action.position?.x && state.worldPosition?.y === action.position?.y) {
        return state;
      }
      return { ...state, worldPosition: action.position };
    case 'UPDATE_VIEWPORT':
      return { ...state, viewport: action.viewport };
    case 'SET_MOUSE_DOWN':
      return { ...state, isDown: action.down, button: action.button || 0 };
    case 'SET_ACTIVE':
      return { ...state, isActive: action.active };
    case 'SET_TOOL':
      return { ...state, tool: action.tool };
    case 'SET_SNAP_POINT':
      return { ...state, snapPoint: action.point };
    case 'START_SELECTION':
      return {
        ...state,
        isSelecting: true,
        selectionStart: action.startPoint,
        selectionCurrent: action.startPoint
      };
    case 'UPDATE_SELECTION':
      return {
        ...state,
        selectionCurrent: action.currentPoint
      };
    case 'END_SELECTION':
    case 'CANCEL_SELECTION':
      return {
        ...state,
        isSelecting: false,
        selectionStart: null,
        selectionCurrent: null
      };
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
    // ✅ CORE MOUSE ACTIONS (Professional CAD Interface)
    updatePosition: (position: Point2D | null) =>
      dispatch({ type: 'UPDATE_POSITION', position }),
    updateWorldPosition: (position: Point2D | null) =>
      dispatch({ type: 'UPDATE_WORLD_POSITION', position }),
    // ✅ ENTERPRISE: Alias for updateWorldPosition (used in CanvasOverlays)
    setWorldPosition: (position: Point2D | null) =>
      dispatch({ type: 'UPDATE_WORLD_POSITION', position }),
    updateViewport: (viewport: Viewport) =>
      dispatch({ type: 'UPDATE_VIEWPORT', viewport }),

    // ✅ MOUSE BUTTON ACTIONS
    setMouseDown: (down: boolean, button?: number) =>
      dispatch({ type: 'SET_MOUSE_DOWN', down, button }),

    // ✅ CAD STATE ACTIONS
    setActive: (active: boolean) =>
      dispatch({ type: 'SET_ACTIVE', active }),
    setTool: (tool: string) =>
      dispatch({ type: 'SET_TOOL', tool }),
    setSnapPoint: (point: Point2D | null) =>
      dispatch({ type: 'SET_SNAP_POINT', point }),

    // ✅ SELECTION ACTIONS (CAD Selection System)
    startSelection: (startPoint: Point2D) =>
      dispatch({ type: 'START_SELECTION', startPoint }),
    updateSelection: (currentPoint: Point2D) =>
      dispatch({ type: 'UPDATE_SELECTION', currentPoint }),
    endSelection: () =>
      dispatch({ type: 'END_SELECTION' }),
    cancelSelection: () =>
      dispatch({ type: 'CANCEL_SELECTION' }),
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