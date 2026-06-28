'use client';

/**
 * ADR-345 Fase 3 — Bridge between ribbon button components and the
 * DXF viewer state (`handleToolChange` / split-last-used persistence).
 * Provider lives in RibbonRoot; dispatch/handlers via useRibbonDispatch(), volatile
 * field state per-key via useRibbonFieldSelectors (RibbonFieldStore).
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ToolType } from '../../toolbar/types';
import { useSplitLastUsed } from '../hooks/useSplitLastUsed';
// ADR-547 Stage 4 Option B — value types extracted to a React-free module so the
// zero-React field store can share them; re-exported here for backward compat.
import type {
  RibbonActionPayload,
  RibbonToggleState,
  RibbonComboboxState,
} from './ribbon-command-types';

export type { RibbonActionPayload, RibbonToggleState, RibbonComboboxState };

export interface RibbonCommandsApi {
  /**
   * ADR-345 Fase 5.6 — currently active tool, used by tool buttons (Large /
   * Small / Split) to render their pressed/highlighted state. `null` means
   * no tool button should appear active (e.g. transient action mode).
   * The bridge wires this from `useDxfViewerState.activeTool`.
   */
  activeTool?: ToolType | null;
  onToolChange: (tool: ToolType) => void;
  /** ADR-345 §3.2 Fase 4 — fires when a button marked `comingSoon` is clicked. */
  onComingSoon: (label: string) => void;
  /**
   * ADR-345 Fase 5 — generic action dispatcher for non-ToolType commands
   * (zoom-extents, undo, redo, fit-to-view, toggle-snap…). Forwarded to
   * `handleAction(action, data)` in `useDxfViewerState`.
   */
  onAction: (action: string, data?: RibbonActionPayload) => void;
  /**
   * ADR-345 Fase 5.7 — Command-history availability, used by the tab-bar
   * undo/redo buttons to render their disabled (greyed) state. Bridged from
   * `useDxfViewerState.canUndo` / `canRedo` (CommandHistory, ADR-032).
   * Default `false` when no bridge supplies them.
   */
  canUndo?: boolean;
  canRedo?: boolean;
  /**
   * ADR-345 §4.4 Fase 5.5 — toggle button click.
   * `commandKey` identifies the field (e.g. 'text.style.bold');
   * the bridge decides which store to mutate and which command to fire.
   */
  onToggle?: (commandKey: string, nextValue: boolean) => void;
  /**
   * ADR-345 §4.5 Fase 5.5 — combobox value change.
   */
  onComboboxChange?: (commandKey: string, value: string) => void;
  // ADR-547 Stage 4 (completion) — the VOLATILE field READERS (getToggleState /
  // getComboboxState / getBadgeState / getPanelVisibility) no longer ride on this
  // object. `useRibbonCommands` pushes them straight into the zero-React
  // `RibbonFieldStore` (see `RibbonFieldReaders`); value widgets subscribe per-key
  // via `useRibbonFieldSelectors`. Keeping them OUT of `commands` is what lets the
  // `commands` prop stay stable across BIM edits so `RibbonRoot.memo` holds.
  /**
   * ADR-461 Phase C4 — Revit-style ADVISORY recommendation: returns `false` when a
   * creation tool's discipline does not belong on the active storey kind (foundation
   * level → only foundation/beam/slab tools recommended, etc.), so tool buttons can
   * de-emphasise it WITHOUT disabling it («warn, don't block»). Default `true` for
   * every command when no bridge supplies it → μηδέν regression on counted storeys.
   */
  getCommandRecommendation?: (commandKey: string) => boolean;
}

/**
 * ADR-547 Stage 4 (completion) — the only React context here is the STABLE
 * `RibbonDispatchContextValue`. It holds the dispatch handlers + tool-mode flags
 * that the tool buttons (Large / Small / Split) consume. All its methods are
 * reference-stable (`onAction` / `onToggle` / `onComboboxChange` are
 * `useEventCallback` in `useRibbonCommands`), so its provider `useMemo` holds
 * across BIM edits/selection → memoized tool buttons BAIL. It churns only on the
 * rare events that genuinely change a tool button (tool change → `activeTool`,
 * undo-state → `canUndo/Redo`, storey → `getCommandRecommendation`, split pick →
 * `splitLastUsed`).
 *
 * The VOLATILE per-entity field state (combobox/toggle/badge/panel-visibility) no
 * longer lives in a context: `useRibbonCommands` pushes the readers into the
 * zero-React `RibbonFieldStore`, and value widgets subscribe per-`commandKey` via
 * `useRibbonFieldSelectors`. That keeps the `commands` prop stable so
 * `RibbonRoot.memo` holds and a single field edit re-renders only the one widget
 * whose slice moved (Revit-grade retained binding / ADR-040 micro-leaf doctrine).
 */
interface RibbonDispatchContextValue {
  /** ADR-345 Fase 5.6 — see RibbonCommandsApi.activeTool. */
  activeTool: ToolType | null;
  onToolChange: (tool: ToolType) => void;
  onComingSoon: (label: string) => void;
  onAction: (action: string, data?: RibbonActionPayload) => void;
  canUndo: boolean;
  canRedo: boolean;
  getCommandRecommendation: (commandKey: string) => boolean;
  splitLastUsed: Record<string, string>;
  setSplitLastUsed: (commandId: string, variantId: string) => void;
  // ADR-547 Stage 4 Option B — the field WRITERS are stable (`useEventCallback`
  // in useRibbonCommands), so they live in the STABLE dispatch half. Value widgets
  // get their writer from here and their reactive VALUE from `RibbonFieldStore`.
  onToggle: (commandKey: string, nextValue: boolean) => void;
  onComboboxChange: (commandKey: string, value: string) => void;
}

const NOOP_TOGGLE = () => {};
const NOOP_COMBOBOX_CHANGE = () => {};
// ADR-461 Phase C4 — default = every command recommended (no breaking change for
// counted storeys / when no bridge owns the active-storey kind).
const DEFAULT_COMMAND_RECOMMENDATION = (): boolean => true;

const RibbonDispatchContext = createContext<RibbonDispatchContextValue | null>(
  null,
);

interface RibbonCommandProviderProps {
  commands: RibbonCommandsApi;
  children: React.ReactNode;
}

export const RibbonCommandProvider: React.FC<RibbonCommandProviderProps> = ({
  commands,
  children,
}) => {
  const { splitLastUsed, setSplitLastUsed } = useSplitLastUsed();

  // STABLE half — holds across edits/selection because each method reference is
  // stable (`onAction`/`onToggle`/`onComboboxChange` = useEventCallback). Tool
  // buttons + the WRITER side of value widgets subscribe to this only.
  const dispatchValue = useMemo<RibbonDispatchContextValue>(
    () => ({
      activeTool: commands.activeTool ?? null,
      onToolChange: commands.onToolChange,
      onComingSoon: commands.onComingSoon,
      onAction: commands.onAction,
      canUndo: commands.canUndo ?? false,
      canRedo: commands.canRedo ?? false,
      getCommandRecommendation: commands.getCommandRecommendation ?? DEFAULT_COMMAND_RECOMMENDATION,
      splitLastUsed,
      setSplitLastUsed,
      onToggle: commands.onToggle ?? NOOP_TOGGLE,
      onComboboxChange: commands.onComboboxChange ?? NOOP_COMBOBOX_CHANGE,
    }),
    [
      commands.activeTool,
      commands.onToolChange,
      commands.onComingSoon,
      commands.onAction,
      commands.canUndo,
      commands.canRedo,
      commands.getCommandRecommendation,
      splitLastUsed,
      setSplitLastUsed,
      commands.onToggle,
      commands.onComboboxChange,
    ],
  );

  // ADR-547 Stage 4 (completion) — the volatile field READERS are pushed into the
  // zero-React `RibbonFieldStore` from `useRibbonCommands` (not here), so this
  // provider only carries the STABLE dispatch half. `commands` no longer churns on
  // BIM edits → `RibbonRoot.memo` holds → this provider does not re-render on edits.
  return (
    <RibbonDispatchContext.Provider value={dispatchValue}>
      {children}
    </RibbonDispatchContext.Provider>
  );
};

/**
 * ADR-547 Stage 4 — subscribe to the STABLE dispatch half only. Tool buttons
 * (Large/Small/Split) use this + `React.memo` so they bail on edits/selection.
 */
export function useRibbonDispatch(): RibbonDispatchContextValue {
  const ctx = useContext(RibbonDispatchContext);
  if (!ctx) {
    throw new Error(
      'useRibbonDispatch must be used inside <RibbonCommandProvider>',
    );
  }
  return ctx;
}

// ADR-547 Stage 4 (completion) — `useRibbonField()` / `useRibbonCommand()` were
// removed. The VOLATILE field state now lives ONLY in `RibbonFieldStore`; read it
// per-key via `useRibbonComboboxState` / `useRibbonToggleState` /
// `useRibbonBadgeState` / `useRibbonPanelVisibility` (`useRibbonFieldSelectors`).
// Dispatch/handlers come from `useRibbonDispatch()`.
