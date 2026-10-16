'use client';

/**
 * @fileoverview **Ό,τι ΛΕΙΠΕΙ** — μία γραμμή κενού του μητρώου (ADR-915 Φ4δ Ε7).
 * @related lib/document-validity/document-registry.ts (`RegistryGapRow`) · RegistryRowItem.tsx (η αδελφή του) ·
 *   RegistryDependents.tsx
 * @module components/document-registry/RegistryGapItem
 *
 * 🏆 **Πέρα από τους μεγάλους**: το Street λέει «Listings with no EPC»· εδώ η γραμμή λέει **ποια** διαδικασία το ζητά,
 *    αν **μπλοκάρει ήδη** (κρίση του πυρήνα), και πού το προσθέτεις (ο σύνδεσμος του «Ακίνητο»).
 * 🔑 **Καμία λήξη, καμία πηγή**: ο τύπος (`RegistryGapRow`) δεν τις έχει — ένα κενό δεν «λήγει».
 * 🔑 Ίδιο σχήμα με τη γραμμή εγγράφου (`<article>` + `<dl>`, λέξη + εικονίδιο στο σήμα — CHECK 3.41).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { RegistryGapRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistryDependents } from '@/components/document-registry/RegistryDependents';
import { RegistryIssuerValue } from '@/components/document-registry/RegistryIssuerValue';
import { RegistryPropertyValue } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryRowHeader } from '@/components/document-registry/RegistryRowHeader';
import {
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_KEYS,
  REGISTRY_NS,
  REGISTRY_STATE_HINT_KEYS,
} from '@/components/document-registry/document-registry-labels';

export interface RegistryGapItemProps {
  readonly row: RegistryGapRow;
  readonly registry: DocumentRegistryResponse;
}

export function RegistryGapItem({ row, registry }: RegistryGapItemProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { gap } = row;
  return (
    <article className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <RegistryRowHeader kind={gap.kind} state={row.state} />
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
        <RegistryPropertyValue propertyId={gap.propertyId} names={registry} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.document)}</dt>
        {/* Ο δρόμος για να προστεθεί ζει ΜΙΑ φορά, στο «Ακίνητο» (έγγραφα ακινήτου · σελίδα εντολής). */}
        <dd className="m-0 text-sm text-foreground">{t(REGISTRY_KEYS.missingDocument)}</dd>
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.state)}</dt>
        <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_STATE_HINT_KEYS[row.state])}</dd>
        <RegistryIssuerValue kind={gap.kind} />
      </dl>
      <RegistryDependents dependents={row.dependents} state={row.state} />
    </article>
  );
}
