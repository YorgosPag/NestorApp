'use client';

/**
 * ADR-359 Phase 10.b — Bridge between the XLine mode contextual ribbon tab and
 * `XLineModeStore`.
 *
 * Reads the current mode via `useSyncExternalStore` and provides pre-translated
 * options (using `dxf-viewer` namespace) so the generic `RibbonCombobox` can
 * render them as literal strings without needing cross-namespace resolution.
 *
 * The bridge no-ops for commandKeys outside `XLINE_RIBBON_KEYS` so it
 * composes with all other bridges in `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-359-auxiliary-geometry-tools.md §5.12 Phase 10.b
 */

import { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getXLineModeState,
  subscribe,
  setMode,
  type XLineMode,
} from '../../../systems/tools/xline-mode-store';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import { isXlineRibbonKey } from './bridge/xline-command-keys';

const ALL_MODES: readonly XLineMode[] = [
  'through',
  'horizontal',
  'vertical',
  'angle',
  'bisect',
  'offset',
] as const;

export interface RibbonXlineModeBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

export function useRibbonXlineModeBridge(): RibbonXlineModeBridge {
  const { t } = useTranslation('dxf-viewer');
  const state = useSyncExternalStore(subscribe, getXLineModeState, getXLineModeState);

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    if (!isXlineRibbonKey(commandKey)) return null;
    const options = ALL_MODES.map((mode) => ({
      value: mode,
      labelKey: t(`tools.xline.modes.${mode}`),
      isLiteralLabel: true as const,
    }));
    return { value: state.mode, options };
  };

  const onComboboxChange = (commandKey: string, value: string): void => {
    if (!isXlineRibbonKey(commandKey)) return;
    const valid = ALL_MODES.includes(value as XLineMode);
    if (valid) setMode(value as XLineMode);
  };

  return { getComboboxState, onComboboxChange };
}
