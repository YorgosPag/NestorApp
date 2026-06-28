'use client';

/**
 * ADR-345 Fase 3 — Bridge between ribbon button components and the
 * DXF viewer state (`handleToolChange` / split-last-used persistence).
 * Provider lives in RibbonRoot; leaves consume via useRibbonCommand().
 */

import React, { createContext, useContext, useLayoutEffect, useMemo } from 'react';
import type { ToolType } from '../../toolbar/types';
import { useSplitLastUsed } from '../hooks/useSplitLastUsed';
// ADR-547 Stage 4 Option B — value types extracted to a React-free module so the
// zero-React field store can share them; re-exported here for backward compat.
import type {
  RibbonActionPayload,
  RibbonToggleState,
  RibbonComboboxState,
} from './ribbon-command-types';
import { setRibbonFieldReaders } from './RibbonFieldStore';

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
  /**
   * ADR-345 §4.4 Fase 5.5 — read current toggle state for a commandKey.
   * Returns `null` for mixed/indeterminate selections.
   */
  getToggleState?: (commandKey: string) => RibbonToggleState;
  /**
   * ADR-345 §4.5 Fase 5.5 — read current combobox state for a commandKey
   * (value + dynamic options if any). When the bridge returns `null` (or
   * the handler itself is undefined), the button falls back to
   * `command.options` static list and renders an empty value.
   */
  getComboboxState?: (commandKey: string) => RibbonComboboxState | null;
  /**
   * ADR-358 Phase 7b1 — read current validation badge state for a `badgeKey`
   * declared on a `RibbonTab`. Returns `true` to render a red "!" badge on
   * the tab button. Owning bridge (e.g. `useRibbonStairBridge`) maps badge
   * keys to domain validators (e.g. `StairEntity.validation.hasCodeViolations`).
   */
  getBadgeState?: (badgeKey: string) => boolean;
  /**
   * ADR-358 Phase 7b2b-β Stream F — read panel visibility for a
   * `visibilityKey` declared on `RibbonPanelDef`. Returns `false` to skip
   * rendering the panel. Owning bridge (e.g. `useRibbonStairBridge`) maps
   * visibility keys to domain predicates (e.g. variant.kind != 'straight').
   * Default behavior when no bridge owns the key: panel always visible.
   */
  getPanelVisibility?: (visibilityKey: string) => boolean;
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
 * ADR-547 Stage 4 (Option A) — the context is SPLIT into two halves so the
 * expensive ribbon tree (tool buttons + their Radix Tooltips ×75) stops
 * re-rendering on every scene edit / selection:
 *
 *  • `RibbonDispatchContextValue` — STABLE across edits/selection. Holds the
 *    dispatch handlers + tool-mode flags that the tool buttons (Large / Small /
 *    Split) consume. All its methods are reference-stable (`onAction` is now an
 *    `useEventCallback` in `useRibbonCommands`), so its provider `useMemo` holds
 *    across edits/selection → memoized tool buttons BAIL → their Tooltips don't
 *    re-render. It churns only on the rare events that genuinely change a tool
 *    button (tool change → `activeTool`, undo-state → `canUndo/Redo`, storey →
 *    `getCommandRecommendation`, split pick → `splitLastUsed`).
 *
 *  • `RibbonFieldContextValue` — VOLATILE. Holds the per-entity field readers /
 *    writers consumed ONLY by value widgets (Combobox / Toggle) that live in the
 *    active contextual panel. It SHOULD churn on selection/edit so those few
 *    widgets re-read the current entity value (correctness preserved).
 *
 * `useRibbonCommand()` stays as a backward-compatible combiner for the remaining
 * widgets (split-dropdown, pickers) that need both halves.
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

// ADR-547 Stage 4 Option B — the field READERS no longer live in a React context.
// They are pushed into the zero-React `RibbonFieldStore`; value widgets subscribe
// per-`commandKey` via `useRibbonFieldSelectors`. This interface is retained only
// so the `useRibbonCommand()` combiner can keep its historical shape for the few
// non-migrated consumers (pickers / split-dropdown).
interface RibbonFieldContextValue {
  getToggleState: (commandKey: string) => RibbonToggleState;
  getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  getBadgeState: (badgeKey: string) => boolean;
  getPanelVisibility: (visibilityKey: string) => boolean;
}

type RibbonCommandContextValue = RibbonDispatchContextValue & RibbonFieldContextValue;

const NOOP_TOGGLE = () => {};
const NOOP_COMBOBOX_CHANGE = () => {};
const NOOP_TOGGLE_STATE = (): RibbonToggleState => false;
const NOOP_COMBOBOX_STATE = (): RibbonComboboxState | null => null;
const NOOP_BADGE_STATE = (): boolean => false;
// ADR-358 Phase 7b2b-β Stream F — default = always visible (no breaking
// change for existing panels without `visibilityKey`).
const DEFAULT_PANEL_VISIBILITY = (): boolean => true;
// ADR-461 Phase C4 — default = every command recommended (no breaking change for
// counted storeys / when no bridge owns the active-storey kind).
const DEFAULT_COMMAND_RECOMMENDATION = (): boolean => true;

const RibbonDispatchContext = createContext<RibbonDispatchContextValue | null>(
  null,
);
const RibbonFieldContext = createContext<RibbonFieldContextValue | null>(
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

  // VOLATILE half — retained only for the `useRibbonCommand()` combiner (pickers /
  // split-dropdown). Migrated value widgets read these via `RibbonFieldStore`.
  const fieldValue = useMemo<RibbonFieldContextValue>(
    () => ({
      getToggleState: commands.getToggleState ?? NOOP_TOGGLE_STATE,
      getComboboxState: commands.getComboboxState ?? NOOP_COMBOBOX_STATE,
      getBadgeState: commands.getBadgeState ?? NOOP_BADGE_STATE,
      getPanelVisibility: commands.getPanelVisibility ?? DEFAULT_PANEL_VISIBILITY,
    }),
    [
      commands.getToggleState,
      commands.getComboboxState,
      commands.getBadgeState,
      commands.getPanelVisibility,
    ],
  );

  // ADR-547 Stage 4 Option B — push the field READERS into the zero-React store on
  // every commit so per-key subscribers (`useRibbonFieldSelectors`) re-pull. The
  // store's per-key signature cache gates which widgets actually re-render, so an
  // over-notify costs only a cheap getSnapshot compare. Layout effect (not render)
  // keeps the push StrictMode/concurrent-safe.
  useLayoutEffect(() => {
    setRibbonFieldReaders({
      getComboboxState: commands.getComboboxState ?? NOOP_COMBOBOX_STATE,
      getToggleState: commands.getToggleState ?? NOOP_TOGGLE_STATE,
      getBadgeState: commands.getBadgeState ?? NOOP_BADGE_STATE,
      getPanelVisibility: commands.getPanelVisibility ?? DEFAULT_PANEL_VISIBILITY,
    });
  });

  return (
    <RibbonDispatchContext.Provider value={dispatchValue}>
      <RibbonFieldContext.Provider value={fieldValue}>
        {children}
      </RibbonFieldContext.Provider>
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

/** ADR-547 Stage 4 — subscribe to the VOLATILE field half (value widgets). */
export function useRibbonField(): RibbonFieldContextValue {
  const ctx = useContext(RibbonFieldContext);
  if (!ctx) {
    throw new Error(
      'useRibbonField must be used inside <RibbonCommandProvider>',
    );
  }
  return ctx;
}

/**
 * Backward-compatible combiner — returns both halves. Consumers that read fields
 * (split-dropdown, pickers) keep working unchanged; they re-render when EITHER
 * half changes (acceptable — they are few and live in the active panel).
 */
export function useRibbonCommand(): RibbonCommandContextValue {
  return { ...useRibbonDispatch(), ...useRibbonField() };
}
