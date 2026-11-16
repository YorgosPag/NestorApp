'use client';

/**
 * @fileoverview ADR-915 §45 Φ2 — **η προθεσμία παράδοσης στο πλαϊνό πάνελ**: «Προθεσμία παράδοσης: 13/11» + προέλευση ·
 *   βαθμίδα καθυστέρησης · «η παράδοση είναι μετά την υπογραφή» · ιστορικό αλλαγών · ορισμός/αλλαγή προθεσμίας.
 * @related lib/document-validity/issuance-delivery-due.ts (ο ΕΝΑΣ κριτής) · issuance-delivery-labels.ts ·
 *   RegistryIssuanceDeliveryCell.tsx (το κελί + τα κοινά κομμάτια) · RegistryIssuanceStep.tsx · RegistryIssuanceDialogs.tsx
 * ⚠️ Το κελί του πίνακα **δεν** εισάγει αυτό το αρχείο (σέρνει τους διαλόγους — CHECK 3.34).
 * @module components/document-registry/RegistryIssuanceDelivery
 *
 * 🔑 **Καμία δεύτερη κρίση**: προθεσμία, βαθμίδα και σύγκρουση έρχονται έτοιμες στο `view.delivery`
 *    (`issuanceDeliveryStatusOf`, με το ρολόι της απόκρισης) — ίδια πηγή με την καρτέλα «Καθυστερούν».
 * 🔑 **Σχήμα + λέξη, όχι μόνο χρώμα** (CHECK 3.41): κάθε βαθμίδα έχει δικό της εικονίδιο και κείμενο.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDate } from '@/lib/intl-formatting';
import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceDeliveryStatus } from '@/lib/document-validity/issuance-delivery-due';
import { REGISTRY_NS } from '@/components/document-registry/document-registry-labels';
import { DELIVERY_CHANGE_KEYS, DELIVERY_KEYS, DELIVERY_REMINDER_KEYS, DELIVERY_SOURCE_KEYS } from '@/components/document-registry/issuance-delivery-labels';
import { pendingDeliveryChangeOf } from '@/lib/document-validity/issuance-delivery-change';
import { DeliveryLatenessBadge, MissesSigning } from '@/components/document-registry/RegistryIssuanceDeliveryCell';
import { DeliveryReminderButton, type DeliveryReminderTarget } from '@/components/document-registry/RegistryDeliveryReminder';
import { lastDeliveryReminderAt, type IssuanceDeliveryReminders } from '@/lib/document-validity/issuance-delivery-reminder';
import {
  IssuanceAcceptDeliveryChangeDialog,
  IssuanceDeclineDeliveryChangeDialog,
  IssuanceDeliveryDialog,
} from '@/components/document-registry/RegistryIssuanceDialogs';
import type { RegistryIssuanceView } from '@/components/document-registry/registry-issuance';

type Translate = ReturnType<typeof useTranslation>['t'];

/** Από πού ήρθε η προθεσμία — από την προσφορά λέει και τις εργάσιμες, σε αλλαγή και την αιτιολογία. */
function sourceText(t: Translate, status: IssuanceDeliveryStatus, record: IssuanceAssignmentRecord): string | null {
  const { due } = status;
  if (due === null) return null;
  if (due.source === 'quote') return t(DELIVERY_SOURCE_KEYS.quote, { count: record.quote?.deliveryBusinessDays ?? 0 });
  if (due.source === 'rescheduled') return t(DELIVERY_SOURCE_KEYS.rescheduled, { reason: due.reason ?? '' });
  return t(DELIVERY_SOURCE_KEYS.office);
}

/** Το ιστορικό των καταχωρίσεων του γραφείου — κάθε αλλαγή με ημέρα και αιτιολογία (ποτέ σιωπηλή αντικατάσταση). */
function ScheduleHistory({ record }: { readonly record: IssuanceAssignmentRecord }): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  if (record.deliverySchedule.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs text-muted-foreground">
      {record.deliverySchedule.map((entry) => (
        <li key={entry.at}>
          {entry.reason === null
            ? t(DELIVERY_KEYS.scheduledLine, { date: formatDate(entry.dueOn), at: formatDate(entry.at) })
            : t(DELIVERY_KEYS.rescheduledLine, { date: formatDate(entry.dueOn), at: formatDate(entry.at), reason: entry.reason })}
        </li>
      ))}
    </ul>
  );
}

/** §45 Φ3 — «Τελευταία υπενθύμιση · Επόμενη αυτόματη» + το κουμπί (μόνο στο πάνελ — ο πίνακας δείχνει μόνο το κουμπί). */
function DeliveryReminderLine({ target, reminders }: { readonly target: DeliveryReminderTarget; readonly reminders: IssuanceDeliveryReminders | null }): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const last = lastDeliveryReminderAt(reminders);
  const next = reminders?.dueAt ?? null;
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <span>{last === null ? t(DELIVERY_REMINDER_KEYS.none) : t(DELIVERY_REMINDER_KEYS.last, { date: formatDate(last) })}</span>
      {next === null ? null : <span>{t(DELIVERY_REMINDER_KEYS.next, { date: formatDate(next) })}</span>}
      <DeliveryReminderButton target={target} />
    </p>
  );
}

/**
 * §45.20 Φ6γ — το **εκκρεμές** αίτημα νέας ημερομηνίας του επαγγελματία: ζητούμενη ημέρα · πότε · αιτιολογία, και (με
 * δικαίωμα) «Αποδοχή» (προσυμπληρωμένη φόρμα προθεσμίας) / «Απόρριψη» (με αιτιολογία). Ο κριτής «εκκρεμεί» είναι ο ΕΝΑΣ
 * του μειωτή (`pendingDeliveryChangeOf`) — καμία δεύτερη ανάγνωση εδώ.
 */
function PendingDeliveryChange({ view, record, currentDueOn, canAct }: {
  readonly view: RegistryIssuanceView;
  readonly record: IssuanceAssignmentRecord;
  readonly currentDueOn: string | null;
  readonly canAct: boolean;
}): React.ReactElement | null {
  const { t } = useTranslation([REGISTRY_NS]);
  const pending = pendingDeliveryChangeOf(record);
  if (pending === null) return null;
  return (
    <aside role="status" className="flex flex-col gap-1 rounded-md border border-border p-2 text-xs">
      <p className="m-0 font-medium text-foreground">
        {t(DELIVERY_CHANGE_KEYS.requested, { date: formatDate(pending.dueOn), at: formatDate(pending.at) })}
      </p>
      <p className="m-0 text-muted-foreground">{t(DELIVERY_CHANGE_KEYS.reason, { reason: pending.reason })}</p>
      {canAct ? (
        <footer className="flex flex-wrap gap-2">
          <IssuanceAcceptDeliveryChangeDialog view={view} currentDueOn={currentDueOn} request={{ dueOn: pending.dueOn, reason: pending.reason }} />
          <IssuanceDeclineDeliveryChangeDialog view={view} />
        </footer>
      ) : null}
    </aside>
  );
}

export interface RegistryIssuanceDeliveryProps {
  readonly view: RegistryIssuanceView;
  readonly status: IssuanceDeliveryStatus;
  readonly record: IssuanceAssignmentRecord;
  readonly professionalName: string;
  readonly canAct: boolean;
}

/** Το πάνελ: προθεσμία + προέλευση · βαθμίδα · σύγκρουση με την υπογραφή · ιστορικό · ορισμός/αλλαγή. */
export function RegistryIssuanceDelivery({ view, status, record, professionalName, canAct }: RegistryIssuanceDeliveryProps): React.ReactElement {
  const { t } = useTranslation([REGISTRY_NS]);
  const { due } = status;
  const source = sourceText(t, status, record);
  return (
    <section aria-label={t(DELIVERY_KEYS.title)} className="flex flex-col gap-1">
      <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
        {due === null ? null : <span>{t(DELIVERY_KEYS.line, { date: formatDate(due.dueOn) })}</span>}
        <DeliveryLatenessBadge lateness={status.lateness} />
      </p>
      {source === null ? null : <p className="m-0 text-xs text-muted-foreground">{source}</p>}
      {due !== null && status.missesSigning ? (
        <p className="m-0 text-xs"><MissesSigning dueOn={due.dueOn} signingDay={view.signingDay} short={false} /></p>
      ) : null}
      <PendingDeliveryChange view={view} record={record} currentDueOn={due?.dueOn ?? null} canAct={canAct} />
      <ScheduleHistory record={record} />
      <DeliveryReminderLine target={view} reminders={record.deliveryReminders} />
      {canAct ? <IssuanceDeliveryDialog view={view} professionalName={professionalName} currentDueOn={due?.dueOn ?? null} /> : null}
    </section>
  );
}
