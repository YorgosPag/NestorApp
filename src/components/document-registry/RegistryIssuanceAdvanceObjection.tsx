'use client';

/**
 * @fileoverview ADR-943 Φ5δ (Ζ-3) — **αντίρρηση στην αυτοψία από το γραφείο, για λογαριασμό του ιδιοκτήτη** (π.χ. τηλεφώνησε
 *   ή δεν έχει πρόσβαση στο email του). Ίδια συνέπεια με την αντίρρηση από τον σύνδεσμο: τα χρήματα παγώνουν και αποφασίζει
 *   το γραφείο (διαφορά). Φαίνεται μόνο μέσα στο παράθυρο αντίρρησης (`canObjectToStart`) και με δικαίωμα.
 * @related lib/document-validity/issuance-advance-reducer.ts (`object-start` από `office` — η κρίση) ·
 *   app/(auth)/document-request/DocumentRequestAdvanceObjection.tsx (η ίδια πράξη από τον ιδιοκτήτη) ·
 *   RegistryIssuanceAdvanceLine.tsx (πού ζει)
 * @module components/document-registry/RegistryIssuanceAdvanceObjection
 *
 * 🔑 Η κρίση «μέσα στο παράθυρο» εδώ είναι **εργονομία**· ο μειωτής την ξανακάνει με το ρολόι του διακομιστή.
 * 🔒 Ε-9′: η αιτιολογία μένει στο γραφείο — ο μηχανικός μαθαίνει μόνο ότι υπάρχει αντίρρηση.
 */

import React, { useId, useState } from 'react';

import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { ISSUANCE_ADVANCE_OBJECTION_KEYS, ISSUANCE_KEYS, PROPOSE_KEYS } from '@/components/document-registry/issuance-labels';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { IssuanceDialogShell } from '@/components/document-registry/RegistryIssuanceDialogs';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { nowISO } from '@/lib/date-local';
import { ADVANCE_POLICY, advanceStateOf, canObjectToStart } from '@/lib/document-validity/issuance-advance';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';

function ObjectionForm({ view, close }: { readonly view: RegistryIssuanceView; readonly close: () => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const trimmed = reason.trim();
  const submit = () => {
    if (actions === null || trimmed === '') return;
    close();
    actions.act({ action: 'object-start', ...issuanceTargetOf(view), reason: trimmed });
  };
  return (
    <>
      <Label htmlFor={reasonId} className="text-sm font-medium">{t(ISSUANCE_ADVANCE_OBJECTION_KEYS.reasonLabel)}</Label>
      <Textarea id={reasonId} value={reason} required maxLength={ADVANCE_POLICY.objectionReasonMax} onChange={(event) => setReason(event.target.value)} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(ISSUANCE_ADVANCE_OBJECTION_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={trimmed !== ''}
      />
    </>
  );
}

export function RegistryIssuanceAdvanceObjection({ view, record }: { readonly view: RegistryIssuanceView; readonly record: IssuanceAssignmentRecord }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  if (!(actions?.canAct ?? false) || record.cancellation !== null || !canObjectToStart(advanceStateOf(record), nowISO())) return null;
  return (
    <IssuanceDialogShell
      trigger={t(ISSUANCE_ADVANCE_OBJECTION_KEYS.trigger)} title={t(ISSUANCE_ADVANCE_OBJECTION_KEYS.title)}
      description={t(ISSUANCE_ADVANCE_OBJECTION_KEYS.description)}
    >
      {(close) => <ObjectionForm view={view} close={close} />}
    </IssuanceDialogShell>
  );
}
