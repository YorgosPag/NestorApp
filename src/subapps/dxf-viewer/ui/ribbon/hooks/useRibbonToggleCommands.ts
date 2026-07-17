import React from 'react';
import { useEventCallback } from '@/hooks/useEventCallback';
import type { RibbonToggleState } from '../context/RibbonCommandContext';
import type { UseRibbonCommandsProps } from './useRibbonCommands-types';
import { isWallRibbonToggleKey } from './bridge/wall-command-keys';
import { isArrayRibbonToggleKey } from './bridge/array-command-keys';
import { isOpeningRibbonToggleKey } from './bridge/opening-command-keys';
import { isRoofRibbonToggleKey } from './bridge/roof-command-keys';
import { isMepBoilerToggleKey } from './bridge/mep-boiler-command-keys';
import { isHatchRibbonToggleKey } from './bridge/hatch-command-keys';
import { isDimVisibilityKey } from './bridge/dim-command-keys';
import { isScaleToolToggleKey } from './bridge/scale-tool-command-keys';
import { isBlockLibraryToggleKey } from './bridge/block-library-command-keys';

/**
 * ADR-547 / N.7.1 — the ribbon toggle dispatch (write + read), extracted from
 * `useRibbonCommands` for file-size compliance. Owns only the boolean-toggle
 * keys; every non-owner key falls through to the text-editor bridge (writer) or
 * returns its state (reader). Kept a hook so `getToggleState` stays a stable
 * `useCallback` feeding `RibbonFieldStore` unchanged.
 */
type RibbonToggleBridges = Pick<
  UseRibbonCommandsProps,
  'wallBridge' | 'arrayBridge' | 'openingBridge' | 'roofBridge' | 'mepBoilerBridge' | 'hatchBridge' | 'dimBridge' | 'scaleToolBridge' | 'blockLibraryBridge' | 'textEditorBridge'
>;

interface UseRibbonToggleCommandsParams extends RibbonToggleBridges {
  /** ADR-366 §C.1.b — animation snap-to-grid state (owns `animation.snap-toggle`). */
  snapEnabled: boolean;
}

interface RibbonToggleCommands {
  onToggle: (key: string, next: boolean) => void;
  getToggleState: (key: string) => RibbonToggleState;
}

export function useRibbonToggleCommands({
  snapEnabled,
  wallBridge,
  arrayBridge,
  openingBridge,
  roofBridge,
  mepBoilerBridge,
  hatchBridge,
  dimBridge,
  scaleToolBridge,
  blockLibraryBridge,
  textEditorBridge,
}: UseRibbonToggleCommandsParams): RibbonToggleCommands {
  const onToggle = useEventCallback(
    (key: string, next: boolean) => {
      if (isWallRibbonToggleKey(key)) {
        wallBridge.onToggle(key, next);
        return;
      }
      if (isArrayRibbonToggleKey(key)) {
        arrayBridge.onToggle(key, next);
        return;
      }
      if (isOpeningRibbonToggleKey(key)) {
        openingBridge.onToggle(key, next);
        return;
      }
      if (isRoofRibbonToggleKey(key)) {
        roofBridge.onToggle(key, next);
        return;
      }
      if (isMepBoilerToggleKey(key)) {
        mepBoilerBridge.onToggle(key, next);
        return;
      }
      if (isHatchRibbonToggleKey(key)) {
        hatchBridge.onToggle(key, next);
        return;
      }
      // ADR-362 Round 36 — per-part dimension visibility toggles (suppress* overrides).
      if (isDimVisibilityKey(key)) {
        dimBridge.onToggle(key, next);
        return;
      }
      // ADR-646 Φ4 #6 — scale tool Copy / Non-uniform toggles.
      if (isScaleToolToggleKey(key)) {
        scaleToolBridge.onToggle(key, next);
        return;
      }
      // ADR-652 M5 — Block Library «Ομοιόμορφη κλίμακα» (Uniform Scale) lock toggle.
      if (isBlockLibraryToggleKey(key)) {
        blockLibraryBridge.onToggle(key, next);
        return;
      }
      textEditorBridge.onToggle(key, next);
    },
  );

  const getToggleState = React.useCallback(
    (key: string): RibbonToggleState => {
      if (key === 'animation.snap-toggle') return snapEnabled;
      if (isWallRibbonToggleKey(key)) return wallBridge.getToggleState(key);
      if (isArrayRibbonToggleKey(key)) return arrayBridge.getToggleState(key);
      if (isOpeningRibbonToggleKey(key)) return openingBridge.getToggleState(key);
      if (isRoofRibbonToggleKey(key)) return roofBridge.getToggleState(key);
      if (isMepBoilerToggleKey(key)) return mepBoilerBridge.getToggleState(key);
      if (isHatchRibbonToggleKey(key)) return hatchBridge.getToggleState(key);
      // ADR-362 Round 36 — per-part dimension visibility toggle state (visible = !suppress).
      if (isDimVisibilityKey(key)) return dimBridge.getToggleState(key);
      // ADR-646 Φ4 #6 — scale tool Copy / Non-uniform toggle state.
      if (isScaleToolToggleKey(key)) return scaleToolBridge.getToggleState(key);
      // ADR-652 M5 — Block Library «Ομοιόμορφη κλίμακα» toggle state (default ON).
      if (isBlockLibraryToggleKey(key)) return blockLibraryBridge.getToggleState(key);
      return textEditorBridge.getToggleState(key);
    },
    [snapEnabled, wallBridge, arrayBridge, openingBridge, roofBridge, mepBoilerBridge, hatchBridge, dimBridge, scaleToolBridge, blockLibraryBridge, textEditorBridge],
  );

  return { onToggle, getToggleState };
}
