'use client';

/**
 * ADR-415 — Bridge between the contextual floorplan-symbol ribbon tab and the
 * active placement tool (`floorplanSymbolToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror of the furniture bridge): the symbol is placed via the
 * tool, so the ribbon reads/writes the tool handle. Picking a catalog symbol →
 * `setAssetId`; rotation → `setParamOverrides`. The next click places the chosen
 * symbol with the chosen rotation.
 *
 * No-ops for commandKeys outside `FLOORPLAN_SYMBOL_RIBBON_KEYS` so it composes with
 * the other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { useCallback, useMemo } from 'react';
import { floorplanSymbolToolBridgeStore } from './bridge/floorplan-symbol-tool-bridge-store';
import {
  FLOORPLAN_SYMBOL_RIBBON_KEYS,
  isFloorplanSymbolRibbonKey,
} from './bridge/floorplan-symbol-command-keys';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import { FLOORPLAN_SYMBOL_CATALOG } from '../../../bim/floorplan-symbols/floorplan-symbol-catalog';

export interface RibbonFloorplanSymbolBridge {
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly onAction: (action: string) => void;
  readonly getPanelVisibility: (visibilityKey: string) => boolean;
}

const NULL_TOGGLE: RibbonToggleState = false;

/** Catalog options GENERATED from the SSoT (never hand-listed). */
const CATALOG_OPTIONS = FLOORPLAN_SYMBOL_CATALOG.map((p) => ({
  value: p.id,
  labelKey: p.labelKey,
  isLiteralLabel: false,
}));

export function useRibbonFloorplanSymbolBridge(): RibbonFloorplanSymbolBridge {
  // Subscribe to the tool handle so the ribbon re-renders on tool state changes.
  const toolHandle = floorplanSymbolToolBridgeStore.use();

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      if (commandKey === FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId) {
        return { value: toolHandle.assetId, options: CATALOG_OPTIONS };
      }
      if (commandKey === FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation) {
        const raw = toolHandle.overrides.rotationDeg;
        return { value: String(typeof raw === 'number' ? raw : 0), options: [] };
      }
      return null;
    },
    [toolHandle],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const handle = floorplanSymbolToolBridgeStore.get();
    if (!handle || !handle.isActive) return;
    if (commandKey === FLOORPLAN_SYMBOL_RIBBON_KEYS.stringParams.assetId) {
      handle.setAssetId(value);
      return;
    }
    if (commandKey === FLOORPLAN_SYMBOL_RIBBON_KEYS.params.rotation) {
      const numeric = Number.parseFloat(value);
      if (Number.isNaN(numeric)) return;
      handle.setParamOverrides({ rotationDeg: numeric });
    }
  }, []);

  const onToggle = useCallback((_key: string, _next: boolean): void => {
    /* no-op — included for interface parity */
  }, []);
  const getToggleState = useCallback((_key: string): RibbonToggleState => NULL_TOGGLE, []);
  const onAction = useCallback((_action: string): void => {
    /* no-op — the tool-active tab auto-hides when the tool changes */
  }, []);
  const getPanelVisibility = useCallback((_visibilityKey: string): boolean => true, []);

  return useMemo(
    () => ({ onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility }),
    [onComboboxChange, getComboboxState, onToggle, getToggleState, onAction, getPanelVisibility],
  );
}

/** Type guard used by `useRibbonCommands` composer (no visibility keys). */
export function isFloorplanSymbolPanelVisibilityKey(_visibilityKey: string): boolean {
  return false;
}

export { isFloorplanSymbolRibbonKey };
