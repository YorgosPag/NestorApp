'use client';

/**
 * @fileoverview **Παραλαβή πρότασης έδρας** από τον ιδιοκτήτη της (ADR-948 §8 Βήμα 7 · ADR-332 §D30).
 * @module components/contacts/dynamic/use-hq-address-proposal-intake
 *
 * Η πρόταση (`hq-address-proposal-store`) εφαρμόζεται **μέσα από τον ίδιο γραφέα** που χρησιμοποιεί η
 * πληκτρολόγηση (`handleHqChange` → `commitHq`), με τον editor της έδρας **ανοιχτό**: ο editor ξαναδιαβάζει την
 * τιμή, γεωκωδικοποιεί και ζητά επιβεβαίωση πινέζας όπως για κάθε ανθρώπινη διόρθωση — η θέση χάρτη δεν μένει
 * ποτέ σιωπηλά μπαγιάτικη πίσω από νέο κείμενο.
 *
 * 🔑 **Αναίρεση ακριβής**: κρατιέται η εγγραφή της έδρας **πριν** την πρόταση (κείμενο, ιεραρχία, θέση) και η
 *    αναίρεση την ξαναβάζει αυτούσια — όχι «περίπου όπως ήταν».
 * 🔑 Κενή έδρα πριν ⇒ η αναίρεση **δεν** την κάνει δεδομένο (`pruneBlankContactAddresses`, ADR-332 D20).
 * 🔑 Η λωρίδα σβήνει όταν κλείσει ο editor ή τελειώσει η επεξεργασία — δεν μένει ξεχασμένη.
 */

import { useCallback, useEffect, useState } from 'react';

import type { ResolvedAddressFields } from '@/components/shared/addresses/editor';
import { registrySeatAsAddressFields } from '@/lib/company/registry-form-acceptance';
import type { CompanyAddress, ContactFormData } from '@/types/ContactFormTypes';
import { pruneBlankContactAddresses } from '@/utils/contacts/contact-address-blankness';

import { contactAddressList, withContactAddressAt } from './contact-hq-state';
import { takeHqAddressProposal, useHqAddressProposal, type HqAddressProposal } from './hq-address-proposal-store';

export interface AppliedHqAddressProposal {
  readonly proposal: HqAddressProposal;
  /** Η έδρα πριν την πρόταση — ό,τι ξαναγράφει η αναίρεση. */
  readonly before: CompanyAddress;
}

interface HqAddressProposalIntakeDeps {
  readonly formData: ContactFormData;
  readonly setFormData?: (data: ContactFormData) => void;
  readonly disabled: boolean;
  readonly openHqEditor: () => void;
  readonly closeHqEditor: () => void;
  readonly handleHqChange: (addr: ResolvedAddressFields) => void;
}

export interface HqAddressProposalIntake {
  /** Η πρόταση που εφαρμόστηκε και περιμένει επιβεβαίωση — `null` αλλιώς. */
  readonly applied: AppliedHqAddressProposal | null;
  /** Επαναφέρει την έδρα όπως ήταν και κλείνει τον editor. */
  readonly undo: () => void;
  /** Ξεχνά τη λωρίδα (ο άνθρωπος κράτησε την πρόταση). */
  readonly dismiss: () => void;
}

/** Η φόρμα με την έδρα **όπως ήταν** — χωρίς να γίνει δεδομένο η κενή έδρα της οθόνης. */
function restoredHq(formData: ContactFormData, before: CompanyAddress): ContactFormData {
  const restored = withContactAddressAt(formData, 0, before);
  return { ...restored, companyAddresses: pruneBlankContactAddresses(contactAddressList(restored)) };
}

export function useHqAddressProposalIntake({
  formData,
  setFormData,
  disabled,
  openHqEditor,
  closeHqEditor,
  handleHqChange,
}: HqAddressProposalIntakeDeps): HqAddressProposalIntake {
  const pending = useHqAddressProposal(formData.id);
  const [applied, setApplied] = useState<AppliedHqAddressProposal | null>(null);

  // Παραλαβή **μία** φορά ανά πρόταση: η ταυτότητα της πρότασης είναι το κλειδί, όχι η φόρμα.
  useEffect(() => {
    if (pending === null) return;
    takeHqAddressProposal(pending);
    if (disabled || !setFormData) return;
    setApplied({ proposal: pending, before: contactAddressList(formData)[0] });
    openHqEditor();
    handleHqChange(registrySeatAsAddressFields(pending.seat, pending.application));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (disabled) setApplied(null);
  }, [disabled]);

  const undo = useCallback(() => {
    if (applied === null || !setFormData) return;
    setFormData(restoredHq(formData, applied.before));
    setApplied(null);
    closeHqEditor();
  }, [applied, formData, setFormData, closeHqEditor]);

  const dismiss = useCallback(() => setApplied(null), []);

  return { applied, undo, dismiss };
}
