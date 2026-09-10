'use client';

/**
 * Ο διάλογος συρσίματος της **προβολής** διευθύνσεων έργου — δείχνει ό,τι **ΘΑ ΓΙΝΕΙ**.
 *
 * 🔴 2026-09-10 (ADR-332 D27): το «νέο» του διαλόγου ήταν το **ωμό** αποτέλεσμα της
 * αντίστροφης γεωκωδικοποίησης, ενώ η εφαρμογή (`applyDraggedPin`) **κρατά** οδό / πόλη /
 * Τ.Κ. όταν λείπουν και **σβήνει** αριθμό / περιφέρεια / συνοικία. Η σύνοψη διαφορών
 * περιέγραφε άλλο πράγμα από αυτό που γραφόταν. Εδώ το «νέο» **είναι** το αποτέλεσμα —
 * η ίδια συνάρτηση που γράφει, όχι πρόβλεψή της.
 *
 * 🔑 Βήμα Β: δέχεται ολόκληρο το `PinDrop` — και σύρσιμο **χωρίς** κείμενο (404 / timeout),
 * που ως τότε χανόταν πριν φτάσει εδώ. Τότε ο διάλογος προσφέρει μόνο «Μόνο η θέση».
 *
 * @module components/projects/tabs/locations/ProjectViewDragConfirm
 */

import { useMemo } from 'react';
import type { ProjectAddress } from '@/types/project/addresses';
import { AddressDragConfirmDialog } from '@/components/shared/addresses/editor';
import { mapPinDropText, type PinDrop } from '@/components/shared/addresses/pin-drop';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
import { applyDraggedPin, type DragApplyMode } from './location-converters';

export interface ProjectViewDragConfirmProps {
  /** Η διεύθυνση της συρμένης πινέζας· `undefined` αν χάθηκε στο μεταξύ. */
  readonly target: ProjectAddress | undefined;
  readonly drop: PinDrop;
  readonly onConfirm: (mode: DragApplyMode) => void;
  readonly onCancel: () => void;
}

export function ProjectViewDragConfirm({ target, drop, onConfirm, onCancel }: ProjectViewDragConfirmProps) {
  const current = useMemo(() => storedAddressToResolved(target ?? {}, 'projectAddress'), [target]);
  const proposal = useMemo(
    () => mapPinDropText(drop, (dragged) => storedAddressToResolved(
      target ? applyDraggedPin(target, dragged, 'adopt-address') : dragged,
      'projectAddress',
    )).text,
    [target, drop],
  );

  return (
    <AddressDragConfirmDialog
      open
      currentAddress={current}
      proposal={proposal}
      onConfirm={() => onConfirm('adopt-address')}
      onConfirmPositionOnly={() => onConfirm('position-only')}
      onCancel={onCancel}
    />
  );
}
