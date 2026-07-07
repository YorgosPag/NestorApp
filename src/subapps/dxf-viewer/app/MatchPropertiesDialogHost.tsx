'use client';

/**
 * ADR-581 — Mount host για το «Αντιγραφή Ιδιοτήτων» modal.
 *
 * Thin host: visibility owned by `MatchPropertiesDialogStore` (zero React state).
 * Mount-on-open — όταν κλειστό επιστρέφει `null`, ώστε το `useMatchProperties`
 * (που παγώνει την επιλογή στο mount) να τρέχει με φρέσκια source/targets κάθε
 * φορά που ανοίγει. Mirror του FloorManagementDialogHost.
 */

import React, { useSyncExternalStore } from 'react';
import type { useLevels } from '../systems/levels';
import { MatchPropertiesDialogStore } from '../stores/MatchPropertiesDialogStore';
import { MatchSettingsDialog } from '../ui/match-properties/MatchSettingsDialog';

type LevelManager = ReturnType<typeof useLevels>;

interface MatchPropertiesDialogHostProps {
  readonly levelManager: LevelManager;
}

export const MatchPropertiesDialogHost: React.FC<MatchPropertiesDialogHostProps> = ({
  levelManager,
}) => {
  const { isOpen } = useSyncExternalStore(
    MatchPropertiesDialogStore.subscribe,
    MatchPropertiesDialogStore.getSnapshot,
    MatchPropertiesDialogStore.getSnapshot,
  );

  if (!isOpen) return null;

  return (
    <MatchSettingsDialog
      levelManager={levelManager}
      onClose={() => MatchPropertiesDialogStore.close()}
    />
  );
};
