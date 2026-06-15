'use client';

/**
 * ADR-345 Fase 3 — Bridge between ribbon button components and the
 * DXF viewer state (`handleToolChange` / split-last-used persistence).
 * Provider lives in RibbonRoot; leaves consume via useRibbonCommand().
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { ToolType } from '../../toolbar/types';
import type { RibbonComboboxOption } from '../types/ribbon-types';
import { useSplitLastUsed } from '../hooks/useSplitLastUsed';

export type RibbonActionPayload = number | string | Record<string, unknown>;

/**
 * ADR-345 §4.4-4.5 Fase 5.5 — Runtime state for a toggle/combobox.
 * Bridges (e.g. useRibbonTextEditorBridge) build these readers from
 * domain stores so button leaves stay declarative.
 */
export type RibbonToggleState = boolean | null;        // null = mixed/indeterminate
export interface RibbonComboboxState {
  value: string | null;                                // null = mixed
  options: readonly RibbonComboboxOption[];
  /**
   * ADR-421 SLICE C follow-up (a) — when `true`, the combobox renders
   * read-only (value still visible) because its value is governed elsewhere
   * (e.g. a typed BIM family Type, Revit-style). Owning bridge decides; bridges
   * that omit it keep the field fully editable (no breaking change).
   */
  disabled?: boolean;
}

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

interface RibbonCommandContextValue {
  /** ADR-345 Fase 5.6 — see RibbonCommandsApi.activeTool. */
  activeTool: ToolType | null;
  onToolChange: (tool: ToolType) => void;
  onComingSoon: (label: string) => void;
  onAction: (action: string, data?: RibbonActionPayload) => void;
  canUndo: boolean;
  canRedo: boolean;
  onToggle: (commandKey: string, nextValue: boolean) => void;
  onComboboxChange: (commandKey: string, value: string) => void;
  getToggleState: (commandKey: string) => RibbonToggleState;
  getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  getBadgeState: (badgeKey: string) => boolean;
  getPanelVisibility: (visibilityKey: string) => boolean;
  getCommandRecommendation: (commandKey: string) => boolean;
  splitLastUsed: Record<string, string>;
  setSplitLastUsed: (commandId: string, variantId: string) => void;
}

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

const RibbonCommandContext = createContext<RibbonCommandContextValue | null>(
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

  const value = useMemo<RibbonCommandContextValue>(
    () => ({
      activeTool: commands.activeTool ?? null,
      onToolChange: commands.onToolChange,
      onComingSoon: commands.onComingSoon,
      onAction: commands.onAction,
      canUndo: commands.canUndo ?? false,
      canRedo: commands.canRedo ?? false,
      onToggle: commands.onToggle ?? NOOP_TOGGLE,
      onComboboxChange: commands.onComboboxChange ?? NOOP_COMBOBOX_CHANGE,
      getToggleState: commands.getToggleState ?? NOOP_TOGGLE_STATE,
      getComboboxState: commands.getComboboxState ?? NOOP_COMBOBOX_STATE,
      getBadgeState: commands.getBadgeState ?? NOOP_BADGE_STATE,
      getPanelVisibility: commands.getPanelVisibility ?? DEFAULT_PANEL_VISIBILITY,
      getCommandRecommendation: commands.getCommandRecommendation ?? DEFAULT_COMMAND_RECOMMENDATION,
      splitLastUsed,
      setSplitLastUsed,
    }),
    [
      commands.activeTool,
      commands.onToolChange,
      commands.onComingSoon,
      commands.onAction,
      commands.canUndo,
      commands.canRedo,
      commands.onToggle,
      commands.onComboboxChange,
      commands.getToggleState,
      commands.getComboboxState,
      commands.getBadgeState,
      commands.getPanelVisibility,
      commands.getCommandRecommendation,
      splitLastUsed,
      setSplitLastUsed,
    ],
  );

  return (
    <RibbonCommandContext.Provider value={value}>
      {children}
    </RibbonCommandContext.Provider>
  );
};

export function useRibbonCommand(): RibbonCommandContextValue {
  const ctx = useContext(RibbonCommandContext);
  if (!ctx) {
    throw new Error(
      'useRibbonCommand must be used inside <RibbonCommandProvider>',
    );
  }
  return ctx;
}
