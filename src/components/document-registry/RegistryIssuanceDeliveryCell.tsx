'use client';

/**
 * @fileoverview ADR-915 §45 Φ2 — **η προθεσμία στο κελί του πίνακα**: «· έως 13/11» + βαθμίδα καθυστέρησης (εικονίδιο +
 *   λέξη + σήμα) + «⚠ μετά την υπογραφή». Και τα κομμάτια που μοιράζεται με το πάνελ (σήμα βαθμίδας · σύγκρουση).
 * @related RegistryRowAction.tsx (κελί) · RegistryIssuanceDelivery.tsx (πάνελ) · issuance-delivery-labels.ts
 * @module components/document-registry/RegistryIssuanceDeliveryCell
 *
 * ⚠️ **Χωριστό από το πάνελ, επίτηδες** (CHECK 3.34): ο πίνακας είναι στο πρώτο καρέ της σελίδας. Αν το κελί εισήγαγε
 *    το πάνελ, θα έσερνε τους διαλόγους της ανάθεσης και όλο το λεξιλόγιό τους στο slice της διαδρομής — μετρημένο:
 *    10.780 → 17.124 bytes και +8 τριάδες χρέους εισδοχής. Εδώ **μόνο** ό,τι δείχνει η γραμμή.
 * 🔑 **Καμία δεύτερη κρίση**: η κατάσταση έρχεται έτοιμη (`issuanceDeliveryStatusOf`, ρολόι της απόκρισης).
 * 🔑 **Σχήμα + λέξη, όχι μόνο χρώμα** (CHECK 3.41).
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { IssuanceDeliveryStatus, IssuanceLateness } from '@/lib/document-validity/issuance-delivery-due';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { DELIVERY_KEYS, DELIVERY_TIER_KEYS, DELIVERY_TIER_LOOK } from '@/components/document-registry/issuance-delivery-labels';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Η λέξη της βαθμίδας — οι αριθμητικές με `{count}` (πληθυντικός ICU). */
function tierText(t: Translate, lateness: IssuanceLateness): string {
  switch (lateness.tier) {
    case 'overdue': return t(DELIVERY_TIER_KEYS.overdue, { count: lateness.days });
    case 'due-soon': return t(DELIVERY_TIER_KEYS['due-soon'], { count: lateness.daysLeft });
    case 'due-today': return t(DELIVERY_TIER_KEYS['due-today']);
    case 'on-track': return t(DELIVERY_TIER_KEYS['on-track']);
    case 'no-due-date': return t(DELIVERY_TIER_KEYS['no-due-date']);
  }
}

/** Η βαθμίδα ως σήμα: εικονίδιο + λέξη — το χρώμα είναι το τρίτο κανάλι, όχι το μόνο. */
export function DeliveryLatenessBadge({ lateness }: { readonly lateness: IssuanceLateness }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const look = DELIVERY_TIER_LOOK[lateness.tier];
  const Icon = look.icon;
  return (
    <Badge variant={look.badge} className="gap-1 font-normal">
      <Icon className="size-3" aria-hidden="true" />
      {tierText(t, lateness)}
    </Badge>
  );
}

/** «⚠ μετά την υπογραφή» — σύντομο στο κελί, πλήρες (με τις δύο ημερομηνίες) στο πάνελ. */
export function MissesSigning({ dueOn, signingDay, short }: { readonly dueOn: string; readonly signingDay: string | null; readonly short: boolean }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const text = short || signingDay === null
    ? t(DELIVERY_KEYS.missesSigningShort)
    : t(DELIVERY_KEYS.missesSigning, { due: formatDate(dueOn), signing: formatDate(signingDay) });
  return (
    <span className="inline-flex items-center gap-1 text-destructive">
      <AlertTriangle className="size-3" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Το κελί: «· έως 13/11» + βαθμίδα + (αν ισχύει) «μετά την υπογραφή». Χωρίς προθεσμία ⇒ μόνο το σήμα «χωρίς προθεσμία». */
export function DeliveryCellLine({ status, signingDay }: { readonly status: IssuanceDeliveryStatus; readonly signingDay: string | null }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { due } = status;
  return (
    <>
      {due === null ? null : <span>{t(DELIVERY_KEYS.until, { date: formatDate(due.dueOn) })}</span>}{' '}
      <DeliveryLatenessBadge lateness={status.lateness} />
      {due !== null && status.missesSigning ? <>{' '}<MissesSigning dueOn={due.dueOn} signingDay={signingDay} short /></> : null}
    </>
  );
}
