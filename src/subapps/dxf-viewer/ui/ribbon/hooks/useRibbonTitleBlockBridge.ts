'use client';

/**
 * ADR-651 Φάση Γ — Bridge ανάμεσα στο contextual «Πινακίδα Σχεδίου» tab και τις δύο πηγές
 * αλήθειας της επόμενης τοποθέτησης:
 *
 *  - **string params** (preset / χαρτί / προσανατολισμός / κορνίζα) → `title-block-options-store`
 *    (zustand SSoT, event-time read από το commit path — μοτίβο `useRibbonScaleBarBridge`),
 *  - **numeric params** (rotation / scale) → το handle του **εργαλείου** (placement overrides,
 *    ADR-600), μέσω των ΥΠΑΡΧΟΝΤΩΝ `readToolOverrideNumber` / `writeToolOverrideNumber`
 *    (N.18: κανένα δεύτερο αντίγραφο του numeric-override ιδιώματος).
 *
 * Drawing-mode ONLY: η τοποθετημένη πινακίδα είναι `BlockEntity` και έχει το δικό της tab
 * (`contextual-block-tab.ts`) — εδώ δεν υπάρχει selected-entity κλάδος.
 *
 * No-op για commandKeys εκτός του `TITLE_BLOCK_RIBBON_KEYS`, ώστε να συνθέτεται με τους
 * υπόλοιπους bridges στο `useRibbonCommands`.
 */

import { useCallback } from 'react';

import { useTitleBlockOptionsStore } from '../../../state/title-block-options-store';
import type { PaperOrientation, PaperSize } from '../../../print/config/paper-types';
import { isTitleBlockPresetId } from '../../../text-engine/title-block/title-block-presets';
import type { RibbonComboboxState } from '../context/RibbonCommandContext';
import {
  TITLE_BLOCK_RIBBON_KEYS,
  isTitleBlockRibbonKey,
  isTitleBlockRibbonStringKey,
} from './bridge/title-block-command-keys';
import { titleBlockToolBridgeStore } from './bridge/title-block-tool-bridge-store';
import type { RibbonEntityBridgeCore } from './ribbon-entity-bridge-shared';
import { useInertBridgeExtras, useStableBridge } from './ribbon-entity-bridge-shared';
import {
  readToolOverrideNumber,
  writeToolOverrideNumber,
} from './ribbon-tool-handle-bridge-shared';

export type RibbonTitleBlockBridge = RibbonEntityBridgeCore;

/** commandKey → numeric override field στο `TitleBlockParamOverrides`. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, 'rotation' | 'scale'>> = {
  [TITLE_BLOCK_RIBBON_KEYS.params.rotation]: 'rotation',
  [TITLE_BLOCK_RIBBON_KEYS.params.scale]: 'scale',
};

/** Τι δείχνει το combobox όσο το override δεν έχει οριστεί: 0° / 1:1. */
const NUMBER_KEY_DEFAULT: Readonly<Record<string, number>> = {
  [TITLE_BLOCK_RIBBON_KEYS.params.rotation]: 0,
  [TITLE_BLOCK_RIBBON_KEYS.params.scale]: 1,
};

export function useRibbonTitleBlockBridge(): RibbonTitleBlockBridge {
  // Συνδρομές στα options (low-freq: αλλάζουν μόνο με κλικ χρήστη στο ribbon).
  const presetId = useTitleBlockOptionsStore((s) => s.presetId);
  const paperSize = useTitleBlockOptionsStore((s) => s.paperSize);
  const orientation = useTitleBlockOptionsStore((s) => s.orientation);
  const withFrame = useTitleBlockOptionsStore((s) => s.withFrame);
  // Συνδρομή στο tool handle ώστε το ribbon να δείχνει τα τρέχοντα rotation/scale.
  const toolHandle = titleBlockToolBridgeStore.use();

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      switch (commandKey) {
        case TITLE_BLOCK_RIBBON_KEYS.stringParams.preset:
          return { value: presetId, options: [] };
        case TITLE_BLOCK_RIBBON_KEYS.stringParams.paperSize:
          return { value: paperSize, options: [] };
        case TITLE_BLOCK_RIBBON_KEYS.stringParams.orientation:
          return { value: orientation, options: [] };
        case TITLE_BLOCK_RIBBON_KEYS.stringParams.frameMode:
          return { value: withFrame ? 'sheet' : 'box', options: [] };
        default:
          break;
      }
      if (!toolHandle || !isTitleBlockRibbonKey(commandKey)) return null;
      return readToolOverrideNumber(
        toolHandle, commandKey, NUMBER_KEY_TO_OVERRIDE, NUMBER_KEY_DEFAULT,
      );
    },
    [presetId, paperSize, orientation, withFrame, toolHandle],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const store = useTitleBlockOptionsStore.getState();
    switch (commandKey) {
      case TITLE_BLOCK_RIBBON_KEYS.stringParams.preset:
        if (isTitleBlockPresetId(value)) store.setPreset(value);
        return;
      case TITLE_BLOCK_RIBBON_KEYS.stringParams.paperSize:
        store.setPaperSize(value as PaperSize);
        return;
      case TITLE_BLOCK_RIBBON_KEYS.stringParams.orientation:
        store.setOrientation(value as PaperOrientation);
        return;
      case TITLE_BLOCK_RIBBON_KEYS.stringParams.frameMode:
        store.setWithFrame(value === 'sheet');
        return;
      default:
        break;
    }
    const handle = titleBlockToolBridgeStore.get();
    if (!handle || !isTitleBlockRibbonKey(commandKey)) return;
    writeToolOverrideNumber(handle, commandKey, value, NUMBER_KEY_TO_OVERRIDE);
  }, []);

  const extras = useInertBridgeExtras();
  return useStableBridge({ onComboboxChange, getComboboxState, ...extras });
}

export { isTitleBlockRibbonKey, isTitleBlockRibbonStringKey };
