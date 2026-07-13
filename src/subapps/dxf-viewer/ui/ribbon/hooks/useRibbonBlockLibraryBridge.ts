'use client';

/**
 * ADR-652 (M1.5 → M5) — Bridge ανάμεσα στο contextual «Τοποθέτηση Block» ribbon tab και το ενεργό
 * Block Library placement tool (`blockLibraryToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror του furniture bridge): το block τοποθετείται από το εργαλείο, άρα
 * το ribbon γράφει στο tool handle — δεν υπάρχει selected-entity editor branch (η επιλεγμένη
 * `BlockEntity` έχει το δικό της palette, ADR-641).
 *
 * ⚠️ NUMERIC-ONLY picker: το «ποιο block» ζει στο `block-library-selection-store` (palette → tool,
 * ADR-652 SSoT), ΟΧΙ στο ribbon.
 *
 * **M5 (AutoCAD INSERT-faithful)** — τρία numeric πεδία (rotation / scaleX / scaleY, αρνητικό =
 * καθρέφτισμα) + ένα `uniform` toggle («Uniform Scale», default ON):
 *   - Ο read κάθε αριθμού γίνεται με τον κοινό `readToolOverrideNumber` primitive (defaults 0°/1/1).
 *   - Ο write του scaleX/scaleY **ζευγαρώνει** όσο το `uniform` είναι ON (γράφει και τους δύο άξονες)
 *     ώστε να διατηρείται η προ-M5 εμπειρία «ένα νούμερο οδηγεί και τα δύο»· OFF → ανεξάρτητα.
 *   - Το toggle δρομολογείται μέσω του κοινού ribbon-toggle SSoT (`useRibbonToggleCommands`).
 *
 * Ο block-specific χαρακτήρας (uniform coupling) ζει εδώ αντί στο γενικό `useToolHandleBridge`
 * factory — ο factory σκόπιμα ΔΕΝ μοντελοποιεί coupled fields (YAGNI μέχρι 2ο καταναλωτή, N.18)·
 * όμως τα read/inert primitives ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ (κανένα clone).
 *
 * No-op για commandKeys εκτός του `BLOCK_LIBRARY_RIBBON_KEYS`, ώστε να συνθέτεται με τους
 * υπόλοιπους bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 * @see ../../../utils/mirror-math.ts — mirror ενός block = αρνητικό scale σε έναν άξονα
 */

import { useCallback } from 'react';

import { blockLibraryToolBridgeStore } from './bridge/block-library-tool-bridge-store';
import { BLOCK_LIBRARY_RIBBON_KEYS } from './bridge/block-library-command-keys';
import {
  useInertBridgeExtras,
  useStableBridge,
  type RibbonComboboxState,
  type RibbonEntityBridgeCore,
} from './ribbon-entity-bridge-shared';
import type { RibbonToggleState } from '../context/RibbonCommandContext';

export type RibbonBlockLibraryBridge = RibbonEntityBridgeCore;

const { rotation: ROT_KEY, scaleX: SX_KEY, scaleY: SY_KEY } = BLOCK_LIBRARY_RIBBON_KEYS.params;
const { uniform: UNIFORM_KEY } = BLOCK_LIBRARY_RIBBON_KEYS.toggles;

/** commandKey → numeric override field (+ default όσο το override δεν έχει οριστεί: 0° / 1:1). */
const NUMBER_FIELDS: Readonly<
  Record<string, { readonly field: 'rotation' | 'scaleX' | 'scaleY'; readonly fallback: number }>
> = {
  [ROT_KEY]: { field: 'rotation', fallback: 0 },
  [SX_KEY]: { field: 'scaleX', fallback: 1 },
  [SY_KEY]: { field: 'scaleY', fallback: 1 },
};

export function useRibbonBlockLibraryBridge(): RibbonBlockLibraryBridge {
  // Subscribe στο tool handle ώστε το ribbon να re-render-άρει όταν αλλάζει το tool state.
  const toolHandle = blockLibraryToolBridgeStore.use();
  const extras = useInertBridgeExtras();

  const getComboboxState = useCallback(
    (commandKey: string): RibbonComboboxState | null => {
      if (!toolHandle || !toolHandle.isActive) return null;
      const spec = NUMBER_FIELDS[commandKey];
      if (!spec) return null;
      const raw = toolHandle.overrides[spec.field];
      return { value: String(typeof raw === 'number' ? raw : spec.fallback), options: [] };
    },
    [toolHandle],
  );

  const onComboboxChange = useCallback((commandKey: string, value: string): void => {
    const handle = blockLibraryToolBridgeStore.get();
    if (!handle || !handle.isActive) return;
    const numeric = Number.parseFloat(value);
    if (Number.isNaN(numeric)) return;
    if (commandKey === ROT_KEY) {
      handle.setParamOverrides({ rotation: numeric });
      return;
    }
    if (commandKey === SX_KEY || commandKey === SY_KEY) {
      if (numeric === 0) return; // degenerate INSERT — 0 scale δεν επιτρέπεται
      // «Ομοιόμορφη» ON (default) → γράψε ΚΑΙ τους δύο άξονες (lock)· OFF → μόνο τον έναν.
      const locked = handle.overrides.uniform !== false;
      handle.setParamOverrides(
        locked
          ? { scaleX: numeric, scaleY: numeric }
          : commandKey === SX_KEY
            ? { scaleX: numeric }
            : { scaleY: numeric },
      );
    }
  }, []);

  const getToggleState = useCallback(
    (commandKey: string): RibbonToggleState => {
      if (commandKey !== UNIFORM_KEY) return false;
      // Default ON: undefined ⇒ locked (AutoCAD «Uniform Scale» τσεκαρισμένο by default).
      return (toolHandle?.overrides.uniform ?? true) !== false;
    },
    [toolHandle],
  );

  const onToggle = useCallback((commandKey: string, next: boolean): void => {
    if (commandKey !== UNIFORM_KEY) return;
    const handle = blockLibraryToolBridgeStore.get();
    if (!handle || !handle.isActive) return;
    if (next) {
      // Κλείδωμα → οι δύο άξονες συγκλίνουν στο X (AutoCAD: uniform ON ⇒ Y ακολουθεί X).
      const sx = handle.overrides.scaleX ?? handle.overrides.scaleY ?? 1;
      handle.setParamOverrides({ uniform: true, scaleX: sx, scaleY: sx });
    } else {
      handle.setParamOverrides({ uniform: false });
    }
  }, []);

  return useStableBridge({
    onComboboxChange,
    getComboboxState,
    onToggle,
    getToggleState,
    onAction: extras.onAction,
    getPanelVisibility: extras.getPanelVisibility,
  });
}
