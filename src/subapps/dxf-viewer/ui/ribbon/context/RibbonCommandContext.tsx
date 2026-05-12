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
}

export interface RibbonCommandsApi {
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
}

interface RibbonCommandContextValue {
  onToolChange: (tool: ToolType) => void;
  onComingSoon: (label: string) => void;
  onAction: (action: string, data?: RibbonActionPayload) => void;
  onToggle: (commandKey: string, nextValue: boolean) => void;
  onComboboxChange: (commandKey: string, value: string) => void;
  getToggleState: (commandKey: string) => RibbonToggleState;
  getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  splitLastUsed: Record<string, string>;
  setSplitLastUsed: (commandId: string, variantId: string) => void;
}

const NOOP_TOGGLE = () => {};
const NOOP_COMBOBOX_CHANGE = () => {};
const NOOP_TOGGLE_STATE = (): RibbonToggleState => false;
const NOOP_COMBOBOX_STATE = (): RibbonComboboxState | null => null;

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
      onToolChange: commands.onToolChange,
      onComingSoon: commands.onComingSoon,
      onAction: commands.onAction,
      onToggle: commands.onToggle ?? NOOP_TOGGLE,
      onComboboxChange: commands.onComboboxChange ?? NOOP_COMBOBOX_CHANGE,
      getToggleState: commands.getToggleState ?? NOOP_TOGGLE_STATE,
      getComboboxState: commands.getComboboxState ?? NOOP_COMBOBOX_STATE,
      splitLastUsed,
      setSplitLastUsed,
    }),
    [
      commands.onToolChange,
      commands.onComingSoon,
      commands.onAction,
      commands.onToggle,
      commands.onComboboxChange,
      commands.getToggleState,
      commands.getComboboxState,
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
