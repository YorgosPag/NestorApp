'use client';

/**
 * Ζωντανός έλεγχος ισοπαλίας της φόρμας σύμβασης — ο ΙΔΙΟΣ `findAgreementTies` με τον server
 * (ADR-923 §5.11 «3γ», Βήμα 2). Η λίστα συμβάσεων είναι ζωντανή συνδρομή ⇒ αν κάποιος ενεργοποιήσει
 * αλλού μια σύμβαση που συγκρούεται, η προειδοποίηση εμφανίζεται πριν πατηθεί «Αποθήκευση».
 */

import { useMemo } from 'react';
import { findAgreementTies, type AgreementTie } from '@/subapps/procurement/utils/framework-agreement-ambiguity';
import type {
  FrameworkAgreementLike,
  FrameworkAgreementStatus,
} from '@/subapps/procurement/types/framework-agreement';
import type { AgreementScopeFields } from './agreement-scope-form';

/** Ταυτότητα για σύμβαση που δεν αποθηκεύτηκε ακόμη· δεν συμπίπτει με καμία `fwa_*`. */
const UNSAVED_AGREEMENT_ID = '';

export interface AgreementTieInput extends AgreementScopeFields {
  readonly id: string | null;
  readonly agreementNumber: string;
  readonly vendorContactId: string;
  readonly status: FrameworkAgreementStatus;
  /** `yyyy-mm-dd`, όπως το `<input type="date">` και το API. */
  readonly validFrom: string;
  readonly validUntil: string;
}

function asAgreement(input: AgreementTieInput): FrameworkAgreementLike {
  return {
    ...input,
    id: input.id ?? UNSAVED_AGREEMENT_ID,
    companyId: '',
    title: '',
    description: null,
    currency: 'EUR',
    totalCommitment: null,
    discountType: 'flat',
    flatDiscountPercent: null,
    volumeBreakpoints: [],
    isDeleted: false,
    createdAt: input.validFrom,
    updatedAt: input.validFrom,
    createdBy: '',
  };
}

export function useAgreementTies(
  input: AgreementTieInput,
  agreements: readonly FrameworkAgreementLike[],
): readonly AgreementTie[] {
  const { id, agreementNumber, vendorContactId, status, validFrom, validUntil } = input;
  const { applicableMaterialIds, applicableAtoeCategoryCodes, applicableProjectIds } = input;
  return useMemo(() => {
    if (!vendorContactId || !validFrom || !validUntil) return [];
    const draft = asAgreement({
      id, agreementNumber, vendorContactId, status, validFrom, validUntil,
      applicableMaterialIds, applicableAtoeCategoryCodes, applicableProjectIds,
    });
    return findAgreementTies(draft, agreements);
  }, [
    id, agreementNumber, vendorContactId, status, validFrom, validUntil,
    applicableMaterialIds, applicableAtoeCategoryCodes, applicableProjectIds, agreements,
  ]);
}
