'use client';

/**
 * ADR-345 Fase 5.5 — Bridge between the ribbon contextual Text Editor
 * tab and the pre-existing `useTextToolbarStore` (ADR-344). Builds the
 * `onToggle` / `onComboboxChange` / `getToggleState` / `getComboboxState`
 * handlers the ribbon Command API consumes.
 *
 * Commit semantics: this bridge writes ONLY to `useTextToolbarStore`
 * — the store→`UpdateTextStyleCommand` commit chain is owned by
 * ADR-344 Phase 6+ (TipTap editor session). When that chain is wired,
 * every ribbon mutation automatically flows through CommandHistory; no
 * change needed here.
 *
 * Sources are leaf hooks (`useTextPanelFonts`, `useTextPanelLayers`,
 * `useScaleList`, `useActiveScale`) — ADR-040-friendly subscription.
 */

import { useCallback, useMemo } from 'react';
import { useTextToolbarStore } from '../../../state/text-toolbar';
import { useTextPanelFonts } from '../../text-toolbar/hooks/useTextPanelFonts';
import { useTextPanelLayers } from '../../text-toolbar/hooks/useTextPanelLayers';
import { useScaleList, useActiveScale } from '../../../systems/viewport';
import type {
  RibbonComboboxState,
  RibbonToggleState,
} from '../context/RibbonCommandContext';
import { applyToggle, readToggleState } from './bridge/toggle-handlers';
import {
  readComboboxState,
  type ComboboxSources,
} from './bridge/combobox-handlers';
import { applyCombobox } from './bridge/combobox-apply';

export interface RibbonTextEditorBridge {
  readonly onToggle: (commandKey: string, nextValue: boolean) => void;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
  readonly getToggleState: (commandKey: string) => RibbonToggleState;
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
}

export function useRibbonTextEditorBridge(): RibbonTextEditorBridge {
  const setValue = useTextToolbarStore((s) => s.setValue);
  const values = useTextToolbarStore();
  const fonts = useTextPanelFonts();
  const layers = useTextPanelLayers();
  const scales = useScaleList();
  const activeScale = useActiveScale();

  const sources = useMemo<ComboboxSources>(
    () => ({ fonts, layers, scales, activeScale }),
    [fonts, layers, scales, activeScale],
  );

  const onToggle = useCallback(
    (key: string, next: boolean) => applyToggle(key, next, setValue),
    [setValue],
  );

  const onComboboxChange = useCallback(
    (key: string, value: string) => applyCombobox(key, value, setValue),
    [setValue],
  );

  const getToggleState = useCallback(
    (key: string) => readToggleState(key, values),
    [values],
  );

  const getComboboxState = useCallback(
    (key: string) => readComboboxState(key, values, sources),
    [values, sources],
  );

  return { onToggle, onComboboxChange, getToggleState, getComboboxState };
}
