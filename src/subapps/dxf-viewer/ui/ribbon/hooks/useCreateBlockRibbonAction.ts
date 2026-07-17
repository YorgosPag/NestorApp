'use client';

/**
 * ADR-652 M6 — Action interceptor για «Δημιουργία Block» (AutoCAD BLOCK/BMAKE), το INSERT-flavour
 * αδελφάκι του «Ομαδοποίηση» ({@link useGroupRibbonAction}). GROUP φτιάχνει container στο ΙΔΙΟ frame
 * συγχρόνως· BLOCK απαιτεί ΟΝΟΜΑ + κατηγορία + άδεια + επιλογή «αντικατάσταση με instance», οπότε
 * ΔΕΝ τρέχει συγχρόνως: καταγράφει την επιλογή και ανοίγει τον διάλογο ({@link CreateBlockDialogHost}).
 *
 * Το πραγματικό build/register/save/replace ζει στον host (έχει command history + scene adapter +
 * auth) — εδώ μόνο το gate: χωρίς επιλογή, δείξε hint· αλλιώς σήμανε το αίτημα. Κάθε άλλη ενέργεια
 * πέφτει στο wrapped pipeline.
 *
 * @see ../../../systems/block/create-block-request-store.ts — το signal action → host
 * @see useGroupRibbonAction.ts — το αδελφάκι (σύγχρονο GROUP)
 */

import React from 'react';
import i18next from 'i18next';
import type { RibbonActionPayload } from '../context/RibbonCommandContext';
import { requestCreateBlockFromSelection } from '../../../systems/block/create-block-request-store';
import { toolHintOverrideStore } from '../../../hooks/toolHintOverrideStore';
import type { useUniversalSelection } from '../../../systems/selection';

type UniversalSelectionLike = Pick<
  ReturnType<typeof useUniversalSelection>,
  'getSelectedEntityIds'
>;

export interface UseCreateBlockRibbonActionProps {
  readonly universalSelection: UniversalSelectionLike;
  /** Fall-through for non-create-block actions. */
  readonly fallback: (action: string, data?: RibbonActionPayload) => void;
}

export function useCreateBlockRibbonAction(
  props: UseCreateBlockRibbonActionProps,
): (action: string, data?: RibbonActionPayload) => void {
  const { universalSelection, fallback } = props;

  return React.useCallback(
    (action: string, data?: RibbonActionPayload) => {
      if (action !== 'create-block') {
        fallback(action, data);
        return;
      }

      const selectedIds = universalSelection.getSelectedEntityIds();
      if (selectedIds.length < 1) {
        toolHintOverrideStore.setOverride(i18next.t('tool-hints:createBlock.selectEntities'));
        return;
      }
      requestCreateBlockFromSelection(selectedIds);
    },
    [universalSelection, fallback],
  );
}
