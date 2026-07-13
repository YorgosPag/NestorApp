'use client';

/**
 * ADR-652 (M1.5) — Bridge ανάμεσα στο contextual «Τοποθέτηση Block» ribbon tab και το ενεργό
 * Block Library placement tool (`blockLibraryToolBridgeStore`).
 *
 * Drawing-mode ONLY (mirror του furniture bridge): το block τοποθετείται από το εργαλείο, άρα
 * το ribbon γράφει στο tool handle — δεν υπάρχει selected-entity editor branch (η επιλεγμένη
 * `BlockEntity` έχει το δικό της tab, `contextual-block-tab.ts`).
 *
 * ⚠️ NUMERIC-ONLY — καμία επιλογή asset: το «ποιο block» ζει στο `block-library-selection-store`
 * (palette → tool, ADR-652 SSoT), ΟΧΙ στο ribbon. Γι' αυτό ο `useToolHandleBridge` καλείται
 * ΧΩΡΙΣ `assetIdKey`/`buildOptions` (ο picker είναι προαιρετικός) — ίδιο factory, μηδέν clone
 * (N.18). Rotation/scale → `setParamOverrides` → το ΕΠΟΜΕΝΟ κλικ τοποθετεί με το νέο transform.
 *
 * No-op για commandKeys εκτός του `BLOCK_LIBRARY_RIBBON_KEYS`, ώστε να συνθέτεται με τους
 * υπόλοιπους bridges στο `useRibbonCommands`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-652-block-library.md
 */

import { blockLibraryToolBridgeStore } from './bridge/block-library-tool-bridge-store';
import { BLOCK_LIBRARY_RIBBON_KEYS } from './bridge/block-library-command-keys';
import type { RibbonEntityBridgeCore } from './ribbon-entity-bridge-shared';
import { useToolHandleBridge } from './ribbon-tool-handle-bridge-shared';

export type RibbonBlockLibraryBridge = RibbonEntityBridgeCore;

/** commandKey → numeric override field στο `BlockLibraryParamOverrides`. */
const NUMBER_KEY_TO_OVERRIDE: Readonly<Record<string, 'rotation' | 'scale'>> = {
  [BLOCK_LIBRARY_RIBBON_KEYS.params.rotation]: 'rotation',
  [BLOCK_LIBRARY_RIBBON_KEYS.params.scale]: 'scale',
};

/** Τι δείχνει το combobox όσο το override δεν έχει οριστεί: 0° / 1:1 (ίδια με τα M1 defaults). */
const NUMBER_KEY_DEFAULT: Readonly<Record<string, number>> = {
  [BLOCK_LIBRARY_RIBBON_KEYS.params.rotation]: 0,
  [BLOCK_LIBRARY_RIBBON_KEYS.params.scale]: 1,
};

export function useRibbonBlockLibraryBridge(): RibbonBlockLibraryBridge {
  // Subscribe στο tool handle ώστε το ribbon να re-render-άρει όταν αλλάζει το tool state.
  const toolHandle = blockLibraryToolBridgeStore.use();

  return useToolHandleBridge({
    toolHandle,
    readImperative: () => blockLibraryToolBridgeStore.get(),
    numberKeyToField: NUMBER_KEY_TO_OVERRIDE,
    numberKeyDefault: NUMBER_KEY_DEFAULT,
  });
}
