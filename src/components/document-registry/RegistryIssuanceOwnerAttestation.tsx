'use client';

/**
 * @fileoverview ADR-915 §45.15 (1β-γ-2) — **ό,τι δήλωσε ο ιδιοκτήτης για τους ιδιοκτήτες, στο πάνελ του γραφείου**: κάθε
 *   διόρθωση ΑΦΜ που η επαφή **δεν** έχει ακόμη, με «Εφαρμογή στην επαφή» (ένα πάτημα), και η σημείωση «λείπει κάποιος».
 * @related lib/document-validity/issuance-owner-attestation.ts (`pendingVatCorrectionsOf` — η κρίση) ·
 *   registry-owner-vat-apply.ts (η αποστολή, δυναμικά) · RegistryIssuanceStep.tsx (ο γονέας)
 * @module components/document-registry/RegistryIssuanceOwnerAttestation
 *
 * 🔑 **Παράγεται, δεν αποθηκεύεται**: τεκμήριο ≠ τρέχον ΑΦΜ της επαφής ⇒ εκκρεμεί. Η επαφή διορθώθηκε (από εδώ ή από την
 *    καρτέλα της) ⇒ η γραμμή σβήνει μόνη της.
 * 🔑 Χωρίς δικαίωμα (`canAct: false`) η εκκρεμότητα **φαίνεται**, το κουμπί όχι (εργονομία, όχι ασφάλεια — ADR-801).
 */

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { REGISTRY_NS, ISSUER_KEYS } from '@/components/document-registry/document-registry-labels';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { OWNER_VAT_KEYS } from '@/components/document-registry/issuance-owner-vat-labels';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { pendingVatCorrectionsOf, type OwnerAttestationEntry } from '@/lib/document-validity/issuance-owner-attestation';
import { useNotifications } from '@/providers/NotificationProvider';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';

export interface RegistryIssuanceOwnerAttestationProps {
  readonly view: RegistryIssuanceView;
  readonly record: IssuanceAssignmentRecord;
  readonly registry: Pick<DocumentRegistryResponse, 'people'>;
  readonly canAct: boolean;
}

/** Το τρέχον ΑΦΜ από το μητρώο — `undefined` = η επαφή δεν διαβάστηκε (καμία κρίση). */
function currentVatOf(registry: RegistryIssuanceOwnerAttestationProps['registry']) {
  return (contactId: string): string | null | undefined => {
    const person = registry.people[contactId];
    return person === undefined ? undefined : person.vatNumber ?? null;
  };
}

function ApplyButton({ view, entry }: { readonly view: RegistryIssuanceView; readonly entry: OwnerAttestationEntry }) {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const { success, error } = useNotifications();
  const [sending, setSending] = useState(false);
  if (actions === null || entry.vatNumber === null) return null;
  const vatNumber = entry.vatNumber;
  const apply = async () => {
    setSending(true);
    try {
      const { applyOwnerVat } = await import('@/components/document-registry/registry-owner-vat-apply');
      await applyOwnerVat({ propertyId: view.propertyId, kind: view.kind, contactId: entry.contactId, vatNumber }, { t, success, error, revalidate: actions.revalidate });
    } finally {
      setSending(false);
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" className="w-fit" disabled={sending} aria-busy={sending} onClick={() => { void apply(); }}>
      {sending ? t(OWNER_VAT_KEYS.applying) : t(OWNER_VAT_KEYS.apply)}
    </Button>
  );
}

export function RegistryIssuanceOwnerAttestation({ view, record, registry, canAct }: RegistryIssuanceOwnerAttestationProps): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const attestation = record.decision?.ownerAttestation ?? null;
  const pending = pendingVatCorrectionsOf(attestation, currentVatOf(registry));
  const missingNote = attestation?.missingNote ?? null;
  if (pending.length === 0 && missingNote === null) return null;
  return (
    <section className="flex flex-col gap-2 text-sm" aria-label={t(OWNER_VAT_KEYS.heading)}>
      <h4 className="m-0 text-sm font-medium">{t(OWNER_VAT_KEYS.heading)}</h4>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {pending.map((entry) => {
          const name = registry.people[entry.contactId]?.name ?? t(ISSUER_KEYS.obligorUnnamed);
          const current = registry.people[entry.contactId]?.vatNumber ?? null;
          return (
            <li key={entry.contactId} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span>
                {current === null
                  ? t(OWNER_VAT_KEYS.pendingNoCurrent, { name, vat: entry.vatNumber ?? '' })
                  : t(OWNER_VAT_KEYS.pending, { name, vat: entry.vatNumber ?? '', current })}
              </span>
              {canAct ? <ApplyButton view={view} entry={entry} /> : null}
            </li>
          );
        })}
      </ul>
      {missingNote === null ? null : <p className="m-0 text-muted-foreground">{t(OWNER_VAT_KEYS.missingNote, { note: missingNote })}</p>}
    </section>
  );
}
