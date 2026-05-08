'use client';

import React, { createContext, useContext, useReducer, useEffect, useMemo } from 'react';
import {
  type CursorSettings,
  type CursorState,
  DEFAULT_CURSOR_SETTINGS,
  cursorConfig,
  getCursorSettings,
  updateCursorSettings,
  subscribeToCursorSettings
} from './config';
import { createDefaultCursorState } from './utils';
import type { Point2D, Viewport } from '../../rendering/types/Types';
import { useAuth } from '@/auth/contexts/AuthContext';
import { ImmediatePositionStore } from './ImmediatePositionStore';

// Context type that combines state and actions
interface CursorContextType extends CursorState {
  settings: CursorSettings;
  // Settings actions
  updateSettings: (updates: Partial<CursorSettings>) => void;
  resetToDefaults: () => void;

  // ✅ CORE MOUSE ACTIONS (Professional CAD Interface)
  updatePosition: (position: Point2D | null) => void;
  updateWorldPosition: (position: Point2D | null) => void;
  setWorldPosition: (position: Point2D | null) => void;
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
// 🚀 PERF (2026-05-08): UPDATE_POSITION / UPDATE_WORLD_POSITION removed from
// the reducer. Position now lives in `ImmediatePositionStore` (singleton with
// useSyncExternalStore-compatible API). The reducer no longer fires on every
// mousemove → CursorSystem context value is stable across mousemoves → the
// 8+ provider/component subtree below CursorSystem stops cascading on each
// frame. Position-reading consumers must use `useCursorPosition()` /
// `useCursorWorldPosition()` hooks instead of `cursor.position`.
type CursorAction =
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

  // 🏢 ADR-XXX UserSettings SSoT — bind cursor singleton to the Firestore-backed
  // repository once auth is ready. From this point on, cursor settings persist
  // server-side, sync across devices, and survive hard refresh. Until auth
  // resolves, the singleton uses its localStorage boot value.
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const companyId = user?.companyId ?? null;
  useEffect(() => {
    if (!userId || !companyId) return;
    cursorConfig.bindToRepository(userId, companyId);
    return () => {
      cursorConfig.unbindFromRepository();
    };
  }, [userId, companyId]);

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
    // 🚀 PERF (2026-05-08): no React dispatch — write to ImmediatePositionStore
    // singleton. Subscribers use useCursorPosition / useCursorWorldPosition
    // (useSyncExternalStore) for selective re-render. The CursorContext value
    // no longer changes on mousemove, eliminating the subtree cascade.
    updatePosition: (position: Point2D | null) =>
      ImmediatePositionStore.setPosition(position),
    updateWorldPosition: (position: Point2D | null) =>
      ImmediatePositionStore.setWorldPosition(position),
    setWorldPosition: (position: Point2D | null) =>
      ImmediatePositionStore.setWorldPosition(position),
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

  // Combine state and actions.
  // 🚀 PERF (2026-05-08): position / worldPosition expose getters that read
  // live from ImmediatePositionStore. The context value identity is stable
  // across mousemoves (state no longer carries position), so React doesn't
  // re-render the subtree. Event handlers / non-React renderers calling
  // `cursor.position` still see the latest value. React components that
  // need to *re-render* on position change use `useCursorPosition()` /
  // `useCursorWorldPosition()` (useSyncExternalStore) explicitly.
  const contextValue = useMemo((): CursorContextType => ({
    ...state,
    ...actions,
    get position() { return ImmediatePositionStore.getPosition(); },
    get worldPosition() { return ImmediatePositionStore.getWorldPosition(); },
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
