'use client';

/**
 * @fileoverview ADR-915 §41.5 — **η πλήρης κάρτα μιας γραμμής**, όπως ανοίγει στο πλαϊνό πάνελ. Φορτώνεται ως ΧΩΡΙΣΤΟ
 *   κομμάτι κώδικα (`registry-surfaces.tsx`) — ΠΟΤΕ στατική εισαγωγή από τη σελίδα.
 * @related RegistryRowItem.tsx (έγγραφο) · RegistryGapItem.tsx (κενό) · RegistryDocSheet.tsx (το πάνελ)
 * @module components/document-registry/RegistryDocCard
 *
 * 🏆 Linear · Gmail · Figma: η λίστα είναι το πρώτο καρέ· η λεπτομέρεια κατεβαίνει όταν τη ζητήσεις. Η κάρτα κουβαλά
 *    όλη την ανάλυση (τι σταματά · Εκδίδει · Το φέρνει · ανάθεση · δήλωση στοιχείων) — βάρος που το πρώτο καρέ δεν δείχνει.
 */

import React, { useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RegistryRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistryGapItem } from '@/components/document-registry/RegistryGapItem';
import { RegistryRowItem } from '@/components/document-registry/RegistryRowItem';
import { documentNameOf } from '@/components/document-registry/registry-row-text';
import { CONVEYANCE_NS, LEGALITY_NS, REGISTRY_NS } from '@/components/document-registry/document-registry-labels';

export interface RegistryDocCardProps {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
}

/** Το όνομα του εγγράφου που αντικατέστησε τη γραμμή — για το «αντικαταστάθηκε από …», χωρίς δεύτερη αναζήτηση. */
function useSupersededByName(row: RegistryRow, registry: DocumentRegistryResponse): string | null {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  return useMemo(() => {
    if (row.kind !== 'document' || row.supersededBy === null) return null;
    const successor = registry.rows.find((other) => other.kind === 'document' && other.document.id === row.supersededBy);
    return successor?.kind === 'document' ? documentNameOf(t, successor.document, registry) : null;
  }, [t, row, registry]);
}

/** Έγγραφο ή κενό — ο τύπος της γραμμής διαλέγει την κάρτα, ποτέ η οθόνη μόνη της. */
export function RegistryDocCard({ row, registry }: RegistryDocCardProps): React.ReactElement {
  const supersededByName = useSupersededByName(row, registry);
  if (row.kind === 'gap') return <RegistryGapItem row={row} registry={registry} />;
  return <RegistryRowItem row={row} registry={registry} supersededByName={supersededByName} />;
}
