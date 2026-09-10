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
 * @module components/projects/tabs/locations/ProjectViewDragConfirm
 */

import { useMemo } from 'react';
import type { PartialProjectAddress, ProjectAddress } from '@/types/project/addresses';
import { AddressDragConfirmDialog } from '@/components/shared/addresses/editor';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
import { applyDraggedPin, type DragApplyMode } from './location-converters';

export interface ProjectViewDragConfirmProps {
  /** Η διεύθυνση της συρμένης πινέζας· `undefined` αν χάθηκε στο μεταξύ. */
  readonly target: ProjectAddress | undefined;
  readonly dragged: Partial<PartialProjectAddress>;
  readonly onConfirm: (mode: DragApplyMode) => void;
  readonly onCancel: () => void;
}

export function ProjectViewDragConfirm({ target, dragged, onConfirm, onCancel }: ProjectViewDragConfirmProps) {
  const current = useMemo(() => storedAddressToResolved(target ?? {}, 'projectAddress'), [target]);
  const adopted = useMemo(
    () => storedAddressToResolved(
      target ? applyDraggedPin(target, dragged, 'adopt-address') : dragged,
      'projectAddress',
    ),
    [target, dragged],
  );

  return (
    <AddressDragConfirmDialog
      open
      currentAddress={current}
      newAddress={adopted}
      onConfirm={() => onConfirm('adopt-address')}
      onConfirmPositionOnly={() => onConfirm('position-only')}
      onCancel={onCancel}
    />
  );
}
