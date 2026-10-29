'use client';

/**
 * **Επίλυση κωδικού σε όλο τον κατάλογο, από την οθόνη** — ο ΕΝΑΣ αναγνώστης Firestore του `resolveCatalogCode`
 * (ADR-923 §5.10.4 Β2 · §5.11 «3δ»). Ήταν αντιγραμμένος στο πεδίο άλματος και στο περιβάλλον των επεξεργαστών τιμών·
 * το πλέγμα γραμμών τιμοκαταλόγου θα ήταν το τρίτο αντίγραφο.
 *
 * ⚠️ Διαβάζει **κατάλογο** (μοντέλα · SKU · κρατήσεις μοναδικότητας), ποτέ τιμές — οι τιμές μόνο από τον διακομιστή (απόφαση Ζ).
 * @module components/catalog/products/use-catalog-code-resolver
 */

import { useCallback, useMemo } from 'react';

import { useCompanyId } from '@/hooks/useCompanyId';
import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import { resolveCatalogCode, uniqueAttributeRefsOf, type CodeJumpReader, type CodeJumpTarget } from './catalog-code-jump';

/** Ο αναγνώστης εγγράφων του άλματος — μία ανάγνωση εγγράφου ανά ερώτηση, κανένα ερώτημα λίστας. */
export const catalogCodeReader: CodeJumpReader = (collection, id) => firestoreQueryService.getById<Record<string, unknown>>(collection, id);

export type CatalogCodeResolver = (code: string) => Promise<CodeJumpTarget | null>;

/** `κωδικός → μοντέλο | SKU | null` για τον χώρο του συνδεδεμένου· `null` χωρίς χώρο (καμία ερώτηση πριν την ταυτότητα). */
export function useCatalogCodeResolver(attributes: readonly AttributeRecord[]): CatalogCodeResolver {
  const companyId = useCompanyId()?.companyId ?? null;
  const unique = useMemo(() => uniqueAttributeRefsOf(attributes), [attributes]);
  return useCallback(
    async (code: string) => (companyId ? resolveCatalogCode(companyId, code, unique, catalogCodeReader) : null),
    [companyId, unique],
  );
}
