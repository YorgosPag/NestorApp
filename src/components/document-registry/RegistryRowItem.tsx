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

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { daysBetweenDateKeys } from '@/lib/calendar/date-key';
import { formatDateKey } from '@/lib/intl-formatting';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import type { RegistryDocument, RegistryRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { RegistryDependents } from '@/components/document-registry/RegistryDependents';
import {
  DOCUMENT_KIND_LABEL_KEYS,
  REGISTRY_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_HINT_KEYS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
} from '@/components/document-registry/document-registry-labels';

type Translate = ReturnType<typeof useTranslation>['t'];
type Names = Pick<DocumentRegistryResponse, 'files' | 'properties'>;

/** Πώς λέγεται το έγγραφο: όνομα αρχείου, ή «δηλωμένο χωρίς αρχείο» (Α3). */
export function documentNameOf(t: Translate, document: RegistryDocument, names: Names): string {
  if (document.origin.kind === 'declared') return t(REGISTRY_KEYS.declared);
  return names.files[document.origin.fileId]?.name ?? t(REGISTRY_KEYS.fileUnnamed);
}

function propertyNameOf(t: Translate, propertyId: string, names: Names): string {
  return names.properties[propertyId]?.name ?? t(REGISTRY_KEYS.propertyUnnamed);
}

/** «σε 12 ημέρες» / «πριν από 3 ημέρες» — από το `asOf` της απόκρισης. */
function relativeText(t: Translate, expiresOn: string, asOf: string): string | null {
  const days = daysBetweenDateKeys(asOf, expiresOn);
  if (days === null) return null;
  return days >= 0 ? t(REGISTRY_KEYS.daysLeft, { count: days }) : t(REGISTRY_KEYS.daysAgo, { count: -days });
}

function ExpiryValue({ row, asOf }: { readonly row: RegistryRow; readonly asOf: string }): React.ReactElement {
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

function PropertyValue({ document, names }: { readonly document: RegistryDocument; readonly names: Names }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  if (document.propertyId === null) return <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.propertyNone)}</dd>;
  return (
    <dd className="m-0 flex flex-wrap gap-x-3 text-sm">
      <Link href={ENTITY_ROUTES.properties.withId(document.propertyId)} className="text-foreground underline underline-offset-4">
        {propertyNameOf(t, document.propertyId, names)}
      </Link>
      <Link
        href={ENTITY_ROUTES.properties.withTab(document.propertyId, 'documents')}
        className="text-muted-foreground underline underline-offset-4"
      >
        {t(REGISTRY_KEYS.openDocuments)}
      </Link>
    </dd>
  );
}

export interface RegistryRowItemProps {
  readonly row: RegistryRow;
  readonly registry: DocumentRegistryResponse;
  /** Το όνομα του εγγράφου που την αντικατέστησε — μόνο για `superseded`. */
  readonly supersededByName: string | null;
}

export function RegistryRowItem({ row, registry, supersededByName }: RegistryRowItemProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const look = REGISTRY_STATE_LOOK[row.state];
  const Icon = look.icon;
  const superseded = row.state === 'superseded';
  return (
    <article className={cn('flex flex-col gap-3 rounded-md border border-border bg-card p-4', superseded && 'opacity-80')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 text-base font-semibold text-foreground">{t(DOCUMENT_KIND_LABEL_KEYS[row.document.kind])}</h3>
        <Badge variant={look.badge} className="gap-1">
          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          {t(REGISTRY_STATE_LABEL_KEYS[row.state])}
        </Badge>
      </header>
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
        <PropertyValue document={row.document} names={registry} />
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
