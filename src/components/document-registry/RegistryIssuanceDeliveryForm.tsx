'use client';

/**
 * @fileoverview ADR-915 §45 Φ2 — **η φόρμα της προθεσμίας παράδοσης**: νέα ημερομηνία + αιτιολογία (υποχρεωτική όταν
 *   αλλάζει υπάρχουσα προθεσμία). Φορτώνεται με `next/dynamic` **μόνο όταν ανοίξει ο διάλογος** (CHECK 3.34).
 * @related RegistryIssuanceDialogs.tsx (το κέλυφος) · lib/document-validity/issuance-delivery-due.ts (`scheduledDelivery`)
 * @module components/document-registry/RegistryIssuanceDeliveryForm
 *
 * 🔑 Ο ίδιος κανόνας με τον μειωτή: αλλαγή χωρίς αιτιολογία ⇒ το κουμπί μένει ανενεργό· ίδια ημερομηνία ⇒ τίποτα να
 *    σταλεί. Ο διακομιστής ξανακρίνει (CAS στο στάδιο, `terms-refused`).
 * 🔑 Παρελθοντική ημερομηνία **επιτρέπεται**: μια συμφωνία που έγινε εκτός εφαρμογής καταγράφεται όπως έγινε — και η
 *    γραμμή γίνεται αμέσως «καθυστερεί».
 */

import React, { useId, useState } from 'react';

import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isDateKey } from '@/lib/calendar/date-key';
import { ISSUANCE_NOTE_MAX } from '@/lib/document-validity/issuance-assignment';
import { useIssuanceAssignmentActions } from '@/components/document-registry/issuance-assignment-context';
import { issuanceTargetOf, type RegistryIssuanceView } from '@/components/document-registry/registry-issuance';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { DELIVERY_CHANGE_KEYS, DELIVERY_KEYS } from '@/components/document-registry/issuance-delivery-labels';
import { DELIVERY_CHANGE_POLICY } from '@/lib/document-validity/issuance-delivery-change';
import { ISSUANCE_KEYS, PROPOSE_KEYS } from '@/components/document-registry/issuance-labels';

export interface DeliveryScheduleFormProps {
  readonly view: RegistryIssuanceView;
  readonly close: () => void;
  /** Η τρέχουσα προθεσμία — `null` ⇒ ορισμός (η αιτιολογία προαιρετική). */
  readonly currentDueOn: string | null;
  /**
   * §45.20 Φ6γ — «Αποδοχή» αιτήματος του επαγγελματία: η φόρμα ξεκινά με τη **ζητούμενη** ημερομηνία και την αιτιολογία
   * του αιτήματος. Το γραφείο μπορεί να ορίσει και άλλη (Procore) — η ίδια πράξη `schedule-delivery` απαντά το αίτημα.
   */
  readonly prefill?: { readonly dueOn: string; readonly reason: string };
}

export function DeliveryScheduleForm({ view, close, currentDueOn, prefill }: DeliveryScheduleFormProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [dueOn, setDueOn] = useState(prefill?.dueOn ?? currentDueOn ?? '');
  const [reason, setReason] = useState(prefill?.reason ?? '');
  const dateId = useId();
  const reasonId = useId();
  const hintId = useId();
  const change = currentDueOn !== null;
  const trimmed = reason.trim();
  const valid = isDateKey(dueOn) && dueOn !== currentDueOn && (!change || trimmed !== '');
  const submit = () => {
    if (actions === null || !valid) return;
    close();
    actions.act({ action: 'schedule-delivery', ...issuanceTargetOf(view), dueOn, reason: trimmed === '' ? null : trimmed });
  };
  return (
    <>
      <Label htmlFor={dateId} className="text-sm font-medium">{t(DELIVERY_KEYS.dateLabel)}</Label>
      <Input id={dateId} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
      <Label htmlFor={reasonId} className="text-sm font-medium">{t(DELIVERY_KEYS.reasonLabel)}</Label>
      <Textarea
        id={reasonId} value={reason} maxLength={ISSUANCE_NOTE_MAX} required={change}
        aria-describedby={change ? hintId : undefined} onChange={(event) => setReason(event.target.value)}
      />
      {change ? <p id={hintId} className="m-0 text-xs text-muted-foreground">{t(DELIVERY_KEYS.reasonRequired)}</p> : null}
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(DELIVERY_KEYS.submit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={valid}
      />
    </>
  );
}

/**
 * §45.20 Φ6γ — **απόρριψη** του αιτήματος νέας ημερομηνίας: αιτιολογία υποχρεωτική (τη διαβάζει ο επαγγελματίας στην
 * ειδοποίηση και στον χώρο του). Η τρέχουσα προθεσμία μένει ως έχει. Ο server ξανακρίνει (εκκρεμεί ακόμη; CAS).
 */
export function DeclineDeliveryChangeForm({ view, close }: { readonly view: RegistryIssuanceView; readonly close: () => void }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const actions = useIssuanceAssignmentActions();
  const [reason, setReason] = useState('');
  const reasonId = useId();
  const trimmed = reason.trim();
  const submit = () => {
    if (actions === null || trimmed === '') return;
    close();
    actions.act({ action: 'decline-delivery-change', ...issuanceTargetOf(view), reason: trimmed });
  };
  return (
    <>
      <Label htmlFor={reasonId} className="text-sm font-medium">{t(DELIVERY_KEYS.reasonLabel)}</Label>
      <Textarea id={reasonId} value={reason} required maxLength={DELIVERY_CHANGE_POLICY.reasonMax} onChange={(event) => setReason(event.target.value)} />
      <DialogActionFooter
        cancelLabel={t(PROPOSE_KEYS.cancel)} confirmLabel={t(DELIVERY_CHANGE_KEYS.declineSubmit)} busyLabel={t(ISSUANCE_KEYS.saving)}
        confirmVariant="destructive" onCancel={close} onConfirm={submit} isSubmitting={false} canSubmit={trimmed !== ''}
      />
    </>
  );
}
