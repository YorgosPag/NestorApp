'use client';

/**
 * Ο διάλογος συρσίματος της **προβολής** — δείχνει ό,τι **ΘΑ ΓΙΝΕΙ** (ADR-332 D27).
 *
 * Εξήχθη από το `ProjectViewDragConfirm` στο Β-ΙΙ: οι επαφές χρειάζονταν τον ίδιο διάλογο για
 * τα υποκαταστήματα, και ένα δεύτερο αντίγραφο θα απέκλινε στο πιο λεπτό του σημείο — ότι το
 * «νέο» της σύνοψης **είναι** το αποτέλεσμα της εφαρμογής, όχι το ωμό κείμενο της μηχανής
 * (2026-09-10: η σύνοψη περιέγραφε άλλο πράγμα από αυτό που γραφόταν).
 *
 * 🔑 Κάθε τομέας δίνει το δικό του `toProposal` = **η ίδια συνάρτηση που γράφει**. Δέχεται
 * ολόκληρο το `PinDrop` — και σύρσιμο χωρίς κείμενο ή σε αναμονή, οπότε ο διάλογος προσφέρει
 * μόνο «Μόνο η θέση».
 *
 * @module components/shared/addresses/ViewDragConfirm
 */

import { useMemo } from 'react';
import { AddressDragConfirmDialog, type ResolvedAddressFields } from '@/components/shared/addresses/editor';
import { mapPinDropText, type DragApplyMode, type PinDrop } from './pin-drop';

export interface ViewDragConfirmProps<T> {
  readonly currentAddress: ResolvedAddressFields;
  readonly drop: PinDrop<T>;
  /** Κείμενο της μηχανής → ό,τι θα γραφτεί. **Σταθερή αναφορά** (ο διάλογος το απομνημονεύει). */
  readonly toProposal: (dragged: T) => ResolvedAddressFields;
  readonly onConfirm: (mode: DragApplyMode) => void;
  readonly onCancel: () => void;
}

export function ViewDragConfirm<T>({ currentAddress, drop, toProposal, onConfirm, onCancel }: ViewDragConfirmProps<T>) {
  const proposal = useMemo(() => mapPinDropText(drop, toProposal).text, [drop, toProposal]);

  return (
    <AddressDragConfirmDialog
      open
      currentAddress={currentAddress}
      proposal={proposal}
      onConfirm={() => onConfirm('adopt-address')}
      onConfirmPositionOnly={() => onConfirm('position-only')}
      onCancel={onCancel}
    />
  );
}
