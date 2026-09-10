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
 * Β-ΙΙ (2026-09-11): ο διάλογος εξήχθη στο κοινό `ViewDragConfirm` (τον χρειάζονται και οι
 * επαφές)· εδώ μένει **μόνο** ό,τι είναι του έργου — η τρέχουσα διεύθυνση και το `toProposal`.
 *
 * @module components/projects/tabs/locations/ProjectViewDragConfirm
 */

import { useCallback, useMemo } from 'react';
import type { PartialProjectAddress, ProjectAddress } from '@/types/project/addresses';
import type { DragApplyMode, PinDrop } from '@/components/shared/addresses/pin-drop';
import { ViewDragConfirm } from '@/components/shared/addresses/ViewDragConfirm';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
import { applyDraggedPin } from './location-converters';

export interface ProjectViewDragConfirmProps {
  /** Η διεύθυνση της συρμένης πινέζας· `undefined` αν χάθηκε στο μεταξύ. */
  readonly target: ProjectAddress | undefined;
  readonly drop: PinDrop;
  readonly onConfirm: (mode: DragApplyMode) => void;
  readonly onCancel: () => void;
}

export function ProjectViewDragConfirm({ target, drop, onConfirm, onCancel }: ProjectViewDragConfirmProps) {
  const current = useMemo(() => storedAddressToResolved(target ?? {}, 'projectAddress'), [target]);
  const toProposal = useCallback(
    (dragged: Partial<PartialProjectAddress>) => storedAddressToResolved(
      target ? applyDraggedPin(target, dragged, 'adopt-address') : dragged,
      'projectAddress',
    ),
    [target],
  );

  return (
    <ViewDragConfirm
      currentAddress={current}
      drop={drop}
      toProposal={toProposal}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
