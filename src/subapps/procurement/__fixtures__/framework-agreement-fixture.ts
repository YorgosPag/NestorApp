/**
 * Το ΕΝΑ fixture Σύμβασης-Πλαίσιο για τα tests επιλογής και τιμολόγησης (ADR-923 §5.11 «3γ»).
 * Ισχύς 2026-01-01 … 2026-12-31 (συμπεριληπτικά), προμηθευτής `sup_1`, flat 10%, χωρίς περιορισμούς.
 */

import type { FrameworkAgreementLike } from '../types/framework-agreement';

export const FA_VALID_FROM = '2026-01-01T00:00:00.000Z';
export const FA_VALID_UNTIL = '2026-12-31T00:00:00.000Z';
/** Μια στιγμή μέσα στην ισχύ. */
export const FA_INSIDE_MS = Date.parse('2026-06-15T12:00:00.000Z');

export function makeAgreement(id: string, overrides: Partial<FrameworkAgreementLike> = {}): FrameworkAgreementLike {
  return {
    id,
    companyId: 'co_1',
    agreementNumber: id.toUpperCase(),
    title: `Agreement ${id}`,
    description: null,
    vendorContactId: 'sup_1',
    status: 'active',
    validFrom: FA_VALID_FROM,
    validUntil: FA_VALID_UNTIL,
    applicableProjectIds: null,
    applicableMaterialIds: null,
    applicableAtoeCategoryCodes: null,
    currency: 'EUR',
    totalCommitment: null,
    discountType: 'flat',
    flatDiscountPercent: 10,
    volumeBreakpoints: [],
    isDeleted: false,
    createdAt: FA_VALID_FROM,
    updatedAt: FA_VALID_FROM,
    createdBy: 'user_1',
    ...overrides,
  };
}
