'use client';

/**
 * Ο διάλογος συρσίματος **υποκαταστήματος** επαφής — ADR-332 D27 Βήμα Β-ΙΙ.
 *
 * Λεπτός καταναλωτής του κοινού `ViewDragConfirm`, όπως το `ProjectViewDragConfirm` των έργων:
 * εδώ ζει μόνο ό,τι είναι της επαφής — η τρέχουσα εγγραφή και το `toProposal`, που είναι
 * **η ίδια συνάρτηση που γράφει** (`applyDraggedToContactAddress`). Έτσι η σύνοψη διαφορών
 * δείχνει ακριβώς ό,τι θα αποθηκευτεί.
 *
 * @module components/contacts/dynamic/ContactViewDragConfirm
 */

import { useCallback, useMemo } from 'react';
import type { CompanyAddress } from '@/types/ContactFormTypes';
import type { DragApplyMode, PinDrop } from '@/components/shared/addresses/pin-drop';
import { ViewDragConfirm } from '@/components/shared/addresses/ViewDragConfirm';
import { storedAddressToResolved } from '@/utils/address/administrative-hierarchy';
import { contactDraggedToResolved, type DragResolvedAddress } from '@/components/contacts/details/contact-pin-drop';
import { applyDraggedToContactAddress } from './contact-address-drag';

export interface ContactViewDragConfirmProps {
  /** Η εγγραφή της συρμένης πινέζας· `undefined` αν χάθηκε στο μεταξύ. */
  readonly target: CompanyAddress | undefined;
  readonly drop: PinDrop<DragResolvedAddress>;
  readonly onConfirm: (mode: DragApplyMode) => void;
  readonly onCancel: () => void;
}

export function ContactViewDragConfirm({ target, drop, onConfirm, onCancel }: ContactViewDragConfirmProps) {
  const current = useMemo(() => storedAddressToResolved(target ?? {}, 'companyAddress'), [target]);
  const toProposal = useCallback(
    (dragged: DragResolvedAddress) => (target
      ? storedAddressToResolved(applyDraggedToContactAddress(target, dragged, drop.point), 'companyAddress')
      : contactDraggedToResolved(dragged)),
    [target, drop.point],
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
