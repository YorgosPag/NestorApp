'use client';

/**
 * ADR-357 Phase 17 — Bridge between the Line Tool contextual ribbon tab and
 * `QuickStyleStore`.
 *
 * Unlike entity-editing bridges (wall, stair) this bridge does NOT dispatch
 * undo-able commands — quick-style overrides are ephemeral session preferences,
 * not model mutations. Changes write directly to `QuickStyleStore` (which
 * persists to localStorage).
 *
 * The bridge no-ops for commandKeys outside `LINE_TOOL_RIBBON_KEYS`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-357-dxf-line-tool-google-level.md §G15
 */

import { useSyncExternalStore } from 'react';
import {
  getQuickStyleSnapshot,
  subscribeQuickStyle,
  setQuickStyleLineweight,
  setQuickStyleLinetype,
  setQuickStyleColor,
} from '../../../stores/QuickStyleStore';
import type { LineweightMm } from '../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import {
  LINE_TOOL_RIBBON_KEYS,
  isLineToolRibbonKey,
} from './bridge/line-tool-command-keys';

export interface RibbonLineToolBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

export function useRibbonLineToolBridge(): RibbonLineToolBridge {
  const snapshot = useSyncExternalStore(subscribeQuickStyle, getQuickStyleSnapshot, getQuickStyleSnapshot);

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    if (!isLineToolRibbonKey(commandKey)) return null;

    if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
      const lw = snapshot.lineweightMm;
      const value = lw === LINEWEIGHT_SPECIAL.BYLAYER ? 'ByLayer' : String(lw);
      return { value, options: [] };
    }
    if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
      return { value: snapshot.linetypeName, options: [] };
    }
    if (commandKey === LINE_TOOL_RIBBON_KEYS.color) {
      const value = snapshot.colorMode === 'ByLayer'
        ? 'ByLayer'
        : snapshot.colorAci !== null ? String(snapshot.colorAci) : 'ByLayer';
      return { value, options: [] };
    }
    return null;
  };

  const onComboboxChange = (commandKey: string, value: string): void => {
    if (!isLineToolRibbonKey(commandKey)) return;

    if (commandKey === LINE_TOOL_RIBBON_KEYS.lineweight) {
      const lw: LineweightMm = value === 'ByLayer'
        ? LINEWEIGHT_SPECIAL.BYLAYER
        : (parseFloat(value) as LineweightMm);
      setQuickStyleLineweight(lw);
      return;
    }
    if (commandKey === LINE_TOOL_RIBBON_KEYS.linetype) {
      setQuickStyleLinetype(value);
      return;
    }
    if (commandKey === LINE_TOOL_RIBBON_KEYS.color) {
      if (value === 'ByLayer') {
        setQuickStyleColor('ByLayer', null, null);
      } else {
        const aci = parseInt(value, 10);
        setQuickStyleColor('Concrete', Number.isNaN(aci) ? null : aci, null);
      }
    }
  };

  return { getComboboxState, onComboboxChange };
}
