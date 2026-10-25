'use client';

/**
 * @fileoverview **Κλειδί σειράς στο τέλος μιας ομάδας ιδιοτήτων** — για νέα ιδιότητα (σελίδα «Ιδιότητες» και «νέα
 *   ιδιότητα επί τόπου» της οικογένειας) και για αλλαγή ομάδας (ADR-923 §5.2 · Φάση 1γ).
 * @module components/catalog/attributes/use-attribute-order
 */

import { useCallback } from 'react';

import type { AttributeRecord } from '@/services/catalog/catalog-api.client';
import { orderKeyAtEnd } from '../shared/catalog-ordering';

export function useOrderKeyAtEnd(attributes: readonly AttributeRecord[]) {
  return useCallback(
    (groupId: string, excludeId: string | null) =>
      orderKeyAtEnd(attributes.filter((attribute) => attribute.groupId === groupId), excludeId),
    [attributes],
  );
}
