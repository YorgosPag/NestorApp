/**
 * @fileoverview ADR-915 §45.15 (1β-γ-2) — **η «Εφαρμογή στην επαφή»** και ό,τι λέει στον άνθρωπο μετά (εφαρμόστηκε · ήταν
 *   ήδη · άρνηση με όνομα). Φορτώνεται **δυναμικά**, τη στιγμή του πατήματος (ίδιο ιδίωμα με την «Υπενθύμιση», CHECK 3.34).
 * @related RegistryIssuanceOwnerAttestation.tsx (το κουμπί) · services/document-registry/document-registry.client.ts (η μεταφορά)
 * @module components/document-registry/registry-owner-vat-apply
 *
 * 🔑 Μετά από κάθε έκβαση: επαναφόρτωση του μητρώου — η εκκρεμότητα **παράγεται**, άρα σβήνει μόνη της όταν η επαφή
 *    έχει πια το ΑΦΜ (και στην άρνηση `NO_CORRECTION`, η οθόνη δείχνει ό,τι ισχύει τώρα).
 */

import { OWNER_VAT_KEYS, OWNER_VAT_REFUSAL_KEYS } from '@/components/document-registry/issuance-owner-vat-labels';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { useTranslation } from '@/i18n/hooks/useTranslation';
import { applyIssuanceOwnerVat } from '@/services/document-registry/document-registry.client';

export interface OwnerVatFeedback {
  readonly t: ReturnType<typeof useTranslation>['t'];
  readonly success: (message: string) => void;
  readonly error: (message: string) => void;
  readonly revalidate: () => Promise<void>;
}

export async function applyOwnerVat(
  target: { readonly propertyId: string; readonly kind: DocumentKind; readonly contactId: string; readonly vatNumber: string },
  feedback: OwnerVatFeedback,
): Promise<void> {
  const { t } = feedback;
  const result = await applyIssuanceOwnerVat({
    propertyId: target.propertyId, documentKind: target.kind, contactId: target.contactId, vatNumber: target.vatNumber,
  });
  if (result.kind === 'failed') {
    feedback.error(t(OWNER_VAT_REFUSAL_KEYS[result.code ?? 'generic'] ?? OWNER_VAT_REFUSAL_KEYS.generic));
  } else {
    feedback.success(result.data.result === 'applied' ? t(OWNER_VAT_KEYS.applied) : t(OWNER_VAT_KEYS.unchanged));
  }
  await feedback.revalidate();
}
