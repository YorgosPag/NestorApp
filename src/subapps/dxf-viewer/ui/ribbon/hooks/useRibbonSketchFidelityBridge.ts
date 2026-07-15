'use client';

/**
 * ADR-658 M2 (D3) / M3 (D2) — Bridge between the «Μολύβι» contextual ribbon tab and the two
 * sketch setting stores: `sketch-fidelity-store` (RDP tolerance) + `sketch-output-store`
 * (polyline «Τεθλασμένη» / spline «Καμπύλη»).
 *
 * One bridge, two combobox keys (`sketch:fidelity`, `sketch:outputType`) → zero extra dispatch
 * wiring: the existing `isSketchRibbonKey` route already covers both. Reads each store via
 * `useSyncExternalStore` and provides pre-translated options (dxf-viewer namespace) so the
 * generic `RibbonCombobox` renders literal strings. No-ops for commandKeys outside
 * `SKETCH_RIBBON_KEYS` so it composes with every other bridge in `useRibbonCommands`.
 *
 * Store SSoTs: `systems/sketch/sketch-fidelity-store.ts`, `systems/sketch/sketch-output-store.ts`.
 */
import { useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getSketchFidelityState,
  setSketchFidelityLevel,
  subscribeSketchFidelity,
  SKETCH_FIDELITY_LEVELS,
  type SketchFidelityLevel,
} from '../../../systems/sketch/sketch-fidelity-store';
import {
  getSketchOutputState,
  setSketchOutputType,
  subscribeSketchOutput,
  SKETCH_OUTPUT_TYPES,
  type SketchOutputType,
} from '../../../systems/sketch/sketch-output-store';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import { SKETCH_RIBBON_KEYS, isSketchRibbonKey } from './bridge/sketch-fidelity-command-keys';

export interface RibbonSketchFidelityBridge {
  readonly getComboboxState: (commandKey: string) => RibbonComboboxState | null;
  readonly onComboboxChange: (commandKey: string, value: string) => void;
}

export function useRibbonSketchFidelityBridge(): RibbonSketchFidelityBridge {
  const { t } = useTranslation('dxf-viewer');
  const fidelity = useSyncExternalStore(subscribeSketchFidelity, getSketchFidelityState, getSketchFidelityState);
  const output = useSyncExternalStore(subscribeSketchOutput, getSketchOutputState, getSketchOutputState);

  const getComboboxState = (commandKey: string): RibbonComboboxState | null => {
    if (commandKey === SKETCH_RIBBON_KEYS.fidelity) {
      const options = SKETCH_FIDELITY_LEVELS.map((level) => ({
        value: level,
        labelKey: t(`tools.sketch.fidelity.${level}`),
        isLiteralLabel: true as const,
      }));
      return { value: fidelity.level, options };
    }
    if (commandKey === SKETCH_RIBBON_KEYS.outputType) {
      const options = SKETCH_OUTPUT_TYPES.map((type) => ({
        value: type,
        labelKey: t(`tools.sketch.outputType.${type}`),
        isLiteralLabel: true as const,
      }));
      return { value: output.outputType, options };
    }
    return null;
  };

  const onComboboxChange = (commandKey: string, value: string): void => {
    if (!isSketchRibbonKey(commandKey)) return;
    if (commandKey === SKETCH_RIBBON_KEYS.fidelity && SKETCH_FIDELITY_LEVELS.includes(value as SketchFidelityLevel)) {
      setSketchFidelityLevel(value as SketchFidelityLevel);
    } else if (commandKey === SKETCH_RIBBON_KEYS.outputType && SKETCH_OUTPUT_TYPES.includes(value as SketchOutputType)) {
      setSketchOutputType(value as SketchOutputType);
    }
  };

  return { getComboboxState, onComboboxChange };
}
