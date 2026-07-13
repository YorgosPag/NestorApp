'use client';

/**
 * ADR-650 M3 — useContourDisplay: the exact↔smooth switch wiring.
 *
 * Reads the current style from `contour-display-store` (LOW-freq consumer — the
 * panel toggle) and, on change, does BOTH halves of the Civil 3D Surface-Style
 * flip: (1) restyle the existing contour lwpolylines via one undoable
 * `SetContourDisplayStyleCommand`, and (2) update the store so newly generated
 * contours inherit the choice. Non-destructive: the command only flips the
 * display flag; the surveyed geometry is untouched.
 *
 * Builds on the existing SSoTs — `useSceneManagerAdapter` (ADR-527 cached adapter)
 * + `useCommandHistory` — so the write path matches every other tool hook.
 */

import { useCallback } from 'react';
import * as React from 'react';
import { useLevels } from '../levels';
import { useCommandHistory } from '../../core/commands';
import { useSceneManagerAdapter } from '../entity-creation/useSceneManagerAdapter';
import { SetContourDisplayStyleCommand } from '../../core/commands/entity-commands/SetContourDisplayStyleCommand';
import { collectSmoothableContourIds } from './contour-entity-ids';
import {
  getContourDisplayState,
  setContourDisplayStyle,
  subscribeContourDisplay,
} from './contour-display-store';
import type { ContourDisplayStyle } from './contour-config';

export interface UseContourDisplay {
  readonly style: ContourDisplayStyle;
  readonly setStyle: (style: ContourDisplayStyle) => void;
}

export function useContourDisplay(): UseContourDisplay {
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const { execute } = useCommandHistory();
  const getSceneManager = useSceneManagerAdapter({ currentLevelId, getLevelScene, setLevelScene });
  const state = React.useSyncExternalStore(subscribeContourDisplay, getContourDisplayState, getContourDisplayState);

  const setStyle = useCallback(
    (style: ContourDisplayStyle): void => {
      const levelId = currentLevelId || '0';
      const scene = getLevelScene(levelId);
      if (scene) {
        const ids = collectSmoothableContourIds(scene);
        const sm = getSceneManager();
        if (ids.length > 0 && sm) {
          execute(new SetContourDisplayStyleCommand(ids, style === 'smooth', sm));
        }
      }
      setContourDisplayStyle(style);
    },
    [currentLevelId, getLevelScene, getSceneManager, execute],
  );

  return { style: state.style, setStyle };
}
