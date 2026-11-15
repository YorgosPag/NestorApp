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
import { formatDateKey } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { RegistryDocumentRow } from '@/lib/document-validity/document-registry';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import { factsDeclarationOf } from '@/lib/document-validity/facts-declaration';
import { RegistryDependents } from '@/components/document-registry/RegistryDependents';
import { RegistryFactsDeclaration } from '@/components/document-registry/RegistryFactsDeclaration';
import { RegistryIssuerValue } from '@/components/document-registry/RegistryIssuerValue';
import { RegistryNextStep } from '@/components/document-registry/RegistryNextStep';
import { RegistryPropertyValue } from '@/components/document-registry/RegistryPropertyValue';
import { RegistryRowHeader } from '@/components/document-registry/RegistryRowHeader';
import { registryIssuanceOf } from '@/components/document-registry/registry-issuance';
import { registryObligorsOf } from '@/components/document-registry/registry-obligors';
import { areaIdOf, documentNameOf, relativeText } from '@/components/document-registry/registry-row-text';
import {
  REGISTRY_KEYS,
  EXPIRY_SOURCE_LABEL_KEYS,
  CONVEYANCE_NS,
  LEGALITY_NS,
  REGISTRY_NS,
  REGISTRY_STATE_HINT_KEYS,
} from '@/components/document-registry/document-registry-labels';


function ExpiryValue({ row, asOf }: { readonly row: RegistryDocumentRow; readonly asOf: string }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS, CONVEYANCE_NS, LEGALITY_NS]);
  const { expiresOn, source, discrepancy } = row.expiry;
  if (expiresOn === null) {
    // ADR-915 §33 — «δεν δηλώθηκε» ≠ «άγνωστη λήξη»: το πρώτο λύνεται με ένα πάτημα δίπλα.
    const undeclared = factsDeclarationOf(row.document) === 'declare';
    return <dd className="m-0 text-sm text-foreground">{t(undeclared ? REGISTRY_KEYS.undeclared : REGISTRY_KEYS.expiryUnknown)}</dd>;
  }
  const relative = relativeText(t, expiresOn, asOf);
  return (
    <dd className="m-0 flex flex-col gap-0.5 text-sm text-foreground">
      <span>
        <time dateTime={expiresOn} className="font-medium">{formatDateKey(expiresOn)}</time>
        {relative !== null ? <span className="text-muted-foreground"> · {relative}</span> : null}
      </span>
      {source !== null ? (
        <span className="text-xs text-muted-foreground">
          {t(EXPIRY_SOURCE_LABEL_KEYS[source])}
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
      <RegistryRowHeader state={row.state} />
      <dl className="m-0 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.property)}</dt>
        <RegistryPropertyValue propertyId={row.document.propertyId} names={registry} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.document)}</dt>
        <dd className="m-0 text-sm text-foreground">{documentNameOf(t, row.document, registry)}</dd>
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.expiry)}</dt>
        <ExpiryValue row={row} asOf={registry.asOf} />
        <dt className="text-sm text-muted-foreground">{t(REGISTRY_KEYS.state)}</dt>
        <dd className="m-0 text-sm text-muted-foreground">{t(REGISTRY_STATE_HINT_KEYS[row.state])}</dd>
        {superseded ? null : (
          <RegistryIssuerValue kind={row.document.kind} obligors={registryObligorsOf(row, registry)} />
        )}
      </dl>
      {superseded && supersededByName !== null ? (
        <p className="m-0 text-sm text-muted-foreground">{t(REGISTRY_KEYS.supersededBy, { name: supersededByName })}</p>
      ) : null}
      {/* §33 Δ4 — και σε αντικατεστημένη: ένα νέο αρχείο χωρίς ημερομηνίες χάνει τη θέση του μέχρι να δηλωθούν. */}
      <RegistryFactsDeclaration document={row.document} registry={registry} />
      {superseded ? null : (
        <RegistryNextStep
          kind={row.document.kind} state={row.state} areaId={areaIdOf(row.document.propertyId, registry)}
          issuance={registryIssuanceOf(row, registry)} registry={registry}
        />
      )}
      {superseded ? null : <RegistryDependents dependents={row.dependents} state={row.state} />}
    </article>
  );
}
