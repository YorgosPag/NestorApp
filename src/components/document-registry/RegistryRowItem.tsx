'use client';

/**
 * @fileoverview **Μία γραμμή του μητρώου** — ένα έγγραφο, η κατάστασή του, η λήξη του και τι σταματά (ADR-915 Φ4γ).
 * @related lib/document-validity/document-registry.ts · RegistryDependents.tsx · document-registry-labels.ts
 * @module components/document-registry/RegistryRowItem
 *
 * 🔑 **`<article>` με `<dl>`, όχι γραμμή πίνακα.** Ένας πίνακας «στοιβαγμένος» σε κινητό χαλά τη σειρά ανάγνωσης και τη
 *    σύνδεση κελιού–κεφαλίδας (CMS Design System · W3C WAI-GL)· εδώ κάθε τιμή έχει **δική της** ετικέτα (`dt`), σε
 *    κάθε πλάτος. Και το «τι σταματά» έχει πολλές γραμμές — σε κελί θα στριμωχνόταν.
 *
 * 🔑 **Η κατάσταση διαβάζεται χωρίς χρώμα** (CHECK 3.41): εικονίδιο **και** λέξη στο σήμα, και εξήγηση δίπλα.
 * 🔑 **Το «σε N ημέρες» μετρά από το `asOf` της απόκρισης** — ποτέ από το ρολόι του υπολογιστή.
 * ⚠️ Η αντικατεστημένη γραμμή φαίνεται **υποβαθμισμένη**, όχι κρυμμένη: η αντικατάσταση είναι ανανέωση (Α5).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { formatDateKey } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { RegistryDocument, RegistryDocumentRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistryDependents } from '@/components/document-registry/RegistryDependents';
import { RegistryPropertyValue } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryRowHeader } from '@/components/document-registry/RegistryRowHeader';
import {
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_HINT_KEYS,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];
type Names = Pick<DocumentRegistryResponse, 'files' | 'properties'>;

/**
 * Πώς λέγεται το έγγραφο: όνομα αρχείου · «δηλωμένο χωρίς αρχείο» (Α3) · «εγκρίθηκε στον έλεγχο» (Φ4δ Ε8 — το αρχείο,
 * αν υπάρχει, δεν διαβάστηκε από το μητρώο, άρα δεν έχει όνομα εδώ).
 */
export function documentNameOf(t: Translate, document: RegistryDocument, names: Names): string {
  switch (document.origin.kind) {
    case 'declared': return t(REGISTRY_KEYS.declared);
    case 'attested': return t(REGISTRY_KEYS.attested);
    case 'file': return names.files[document.origin.fileId]?.name ?? t(REGISTRY_KEYS.fileUnnamed);
  }
}

/** «σε 12 ημέρες» / «πριν από 3 ημέρες» — από το `asOf` της απόκρισης. */
function relativeText(t: Translate, expiresOn: string, asOf: string): string | null {
  const days = daysBetweenDateKeys(asOf, expiresOn);
  if (days === null) return null;
  return days >= 0 ? t(REGISTRY_KEYS.daysLeft, { count: days }) : t(REGISTRY_KEYS.daysAgo, { count: -days });
}

function ExpiryValue({ row, asOf }: { readonly row: RegistryDocumentRow; readonly asOf: string }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { expiresOn, source, discrepancy } = row.expiry;
  if (expiresOn === null) return <dd className="m-0 text-sm text-foreground">{t(REGISTRY_KEYS.expiryUnknown)}</dd>;
  const relative = relativeText(t, expiresOn, asOf);
  return (
    <dd className="m-0 flex flex-col gap-0.5 text-sm text-foreground">
      <span>
        <time dateTime={expiresOn} className="font-medium">{formatDateKey(expiresOn)}</time>
        {relative !== null ? <span className="text-muted-foreground"> · {relative}</span> : null}
      </span>
      {source !== null ? (
        <span className="text-xs text-muted-foreground">
          {t(source === 'printed' ? REGISTRY_KEYS.sourcePrinted : REGISTRY_KEYS.sourceRule)}
        </span>
      ) : null}
      {discrepancy !== null ? (
        <span className="text-xs text-foreground">
          {t(REGISTRY_KEYS.discrepancy, {
            printed: formatDateKey(discrepancy.printed),
            rule: formatDateKey(discrepancy.rule),
          })}
        </span>
      ) : null}
    </dd>
  );
}

export interface RegistryRowItemProps {
  readonly row: RegistryDocumentRow;
  readonly registry: DocumentRegistryResponse;
  /** Το όνομα του εγγράφου που την αντικατέστησε — μόνο για `superseded`. */
  readonly supersededByName: string | null;
}

export function RegistryRowItem({ row, registry, supersededByName }: RegistryRowItemProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const superseded = row.state === 'superseded';
  return (
    <article className={cn('flex flex-col gap-3 rounded-md border border-border bg-card p-4', superseded && 'opacity-80')}>
      <RegistryRowHeader kind={row.document.kind} state={row.state} />
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
        <RegistryPropertyValue propertyId={row.document.propertyId} names={registry} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.document)}</dt>
        <dd className="m-0 text-sm text-foreground">{documentNameOf(t, row.document, registry)}</dd>
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.expiry)}</dt>
        <ExpiryValue row={row} asOf={registry.asOf} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.state)}</dt>
        <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_STATE_HINT_KEYS[row.state])}</dd>
      </dl>
      {superseded && supersededByName !== null ? (
        <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.supersededBy, { name: supersededByName })}</p>
      ) : null}
      {superseded ? null : <RegistryDependents dependents={row.dependents} state={row.state} />}
    </article>
  );
}
