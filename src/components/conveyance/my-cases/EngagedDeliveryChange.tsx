'use client';

/**
 * @fileoverview ADR-915 §45.20 Φ6γ — **«Αίτημα νέας ημερομηνίας»** στον χώρο της ανάθεσης (πλευρά επαγγελματία).
 * @related lib/document-validity/issuance-delivery-change.ts (`DeliveryChangeGlance` — η όψη) ·
 *   services/conveyance/conveyance-engagement-gateway.ts (`requestIssuanceDeliveryChange`) ·
 *   app/api/engagements/[engagementId]/issuance/delivery-change/route.ts (η πόρτα)
 * @module components/conveyance/my-cases/EngagedDeliveryChange
 *
 * 🏆 **Πρότυπο Procore/ACC «Request date change»**: αίτημα **με αιτιολογία** προς τον κάτοχο της προθεσμίας — ποτέ
 *    αλλαγή από τον ίδιο. Μέχρι την απάντηση ισχύει η τρέχουσα προθεσμία, και το λέμε ρητά.
 * 🔑 **Ένα εκκρεμές τη φορά**: όσο εκκρεμεί, το κουμπί δεν υπάρχει — στη θέση του η γραμμή «αναμένεται απάντηση».
 * 🔑 Οι ίδιοι κανόνες με τον μειωτή (από σήμερα · όχι η τρέχουσα · αιτιολογία ≤ πολιτικής)· ο server ξανακρίνει.
 * 🔒 Ε-9′: η όψη φέρει μόνο ημερομηνίες και αιτιολογίες — **ποιος** απάντησε στο γραφείο δεν φαίνεται.
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34) — και για τους κωδικούς άρνησης, ποτέ `${code}`.
 */

import React, { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { isDateKey } from '@/lib/calendar/date-key';
import { conveyanceToday } from '@/lib/conveyance/conveyance-calendar';
import { DELIVERY_CHANGE_POLICY, type DeliveryChangeGlance } from '@/lib/document-validity/issuance-delivery-change';
import type { IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { formatDate } from '@/lib/intl-formatting';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  deliveryChangeRejectionOf,
  requestIssuanceDeliveryChange,
  type DeliveryChangeRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';

const K = 'conveyance:engagement.issuance.deliveryChange.';

const KEYS = {
  trigger: `${K}trigger`,
  title: `${K}title`,
  description: `${K}description`,
  descriptionWithDue: `${K}descriptionWithDue`,
  dateLabel: `${K}dateLabel`,
  reasonLabel: `${K}reasonLabel`,
  reasonHint: `${K}reasonHint`,
  cancel: `${K}cancel`,
  submit: `${K}submit`,
  sending: `${K}sending`,
  sent: `${K}sent`,
  pending: `${K}pending`,
  pendingReason: `${K}pendingReason`,
  accepted: `${K}accepted`,
  declined: `${K}declined`,
} as const;

const ERROR_KEYS: Readonly<Record<DeliveryChangeRejection | 'generic', string>> = {
  NOT_FOUND: `${K}errors.NOT_FOUND`,
  ENGAGEMENT_NOT_ACTIVE: `${K}errors.ENGAGEMENT_NOT_ACTIVE`,
  UNAVAILABLE: `${K}errors.UNAVAILABLE`,
  STALE: `${K}errors.STALE`,
  TRANSITION_REFUSED: `${K}errors.TRANSITION_REFUSED`,
  TERMS_REFUSED: `${K}errors.TERMS_REFUSED`,
  generic: `${K}errors.generic`,
};

export interface EngagedDeliveryChangeProps {
  readonly engagementId: string;
  readonly stage: IssuanceStage;
  /** Η τρέχουσα προθεσμία — `null` ⇒ δεν έχει οριστεί. */
  readonly currentDueOn: string | null;
  readonly glance: DeliveryChangeGlance;
  /** Ξαναδιάβασμα της όψης μετά από επιτυχία ή `STALE`. */
  readonly onChanged: () => void;
}

/** Το εκκρεμές αίτημα ή η τελευταία απάντηση — γεγονότα, ποτέ κενό. */
function ChangeStatus({ glance }: { readonly glance: DeliveryChangeGlance }): React.ReactElement | null {
  const { t } = useTranslation(['conveyance']);
  const { pending, lastAnswer } = glance;
  if (pending !== null) {
    return (
      <p className="m-0 text-xs text-muted-foreground" role="status">
        {t(KEYS.pending, { date: formatDate(pending.dueOn), at: formatDate(pending.at) })}
        {' '}
        {t(KEYS.pendingReason, { reason: pending.reason })}
      </p>
    );
  }
  if (lastAnswer === null) return null;
  const requested = formatDate(lastAnswer.requestedDueOn);
  return (
    <p className="m-0 text-xs text-muted-foreground">
      {lastAnswer.outcome === 'accepted'
        ? t(KEYS.accepted, { requested, date: lastAnswer.dueOn === null ? requested : formatDate(lastAnswer.dueOn) })
        : t(KEYS.declined, { requested, reason: lastAnswer.reason ?? '' })}
    </p>
  );
}

/** Η αποστολή: κάθε άρνηση της πόρτας ονομασμένη· `STALE` ⇒ ξαναδιάβασμα (ο άνθρωπος βλέπει το νέο στάδιο). */
function useDeliveryChangeSubmit(props: EngagedDeliveryChangeProps, close: () => void) {
  const { t } = useTranslation(['conveyance']);
  const { success, error } = useNotifications();
  const [busy, setBusy] = useState(false);
  const submit = (dueOn: string, reason: string) => {
    setBusy(true);
    requestIssuanceDeliveryChange(props.engagementId, { dueOn, reason, expectedStage: props.stage })
      .then(() => { success(t(KEYS.sent)); close(); props.onChanged(); })
      .catch((cause: unknown) => {
        const code = deliveryChangeRejectionOf(cause);
        error(t(ERROR_KEYS[code ?? 'generic']));
        if (code === 'STALE') props.onChanged();
      })
      .finally(() => setBusy(false));
  };
  return { busy, submit };
}

function DeliveryChangeForm({ props, close }: { readonly props: EngagedDeliveryChangeProps; readonly close: () => void }): React.ReactElement {
  const { t } = useTranslation(['conveyance']);
  const today = conveyanceToday();
  const [dueOn, setDueOn] = useState('');
  const [reason, setReason] = useState('');
  const dateId = useId();
  const reasonId = useId();
  const hintId = useId();
  const { busy, submit } = useDeliveryChangeSubmit(props, close);
  const trimmed = reason.trim();
  const valid = isDateKey(dueOn) && dueOn >= today && dueOn !== props.currentDueOn && trimmed !== '';
  return (
    <>
      <Label htmlFor={dateId} className="text-sm font-medium">{t(KEYS.dateLabel)}</Label>
      <Input id={dateId} type="date" min={today} value={dueOn} required onChange={(event) => setDueOn(event.target.value)} />
      <Label htmlFor={reasonId} className="text-sm font-medium">{t(KEYS.reasonLabel)}</Label>
      <Textarea
        id={reasonId} value={reason} required maxLength={DELIVERY_CHANGE_POLICY.reasonMax}
        aria-describedby={hintId} onChange={(event) => setReason(event.target.value)}
      />
      <p id={hintId} className="m-0 text-xs text-muted-foreground">{t(KEYS.reasonHint)}</p>
      <DialogActionFooter
        cancelLabel={t(KEYS.cancel)} confirmLabel={t(KEYS.submit)} busyLabel={t(KEYS.sending)}
        onCancel={close} onConfirm={() => { if (valid && !busy) submit(dueOn, trimmed); }} isSubmitting={busy} canSubmit={valid}
      />
    </>
  );
}

/** Η ενότητα: κατάσταση αιτήματος + (χωρίς εκκρεμές) το κουμπί που ανοίγει τον διάλογο. */
export function EngagedDeliveryChange(props: EngagedDeliveryChangeProps): React.ReactElement {
  const { t } = useTranslation(['conveyance']);
  const [open, setOpen] = useState(false);
  const description = props.currentDueOn === null
    ? t(KEYS.description)
    : t(KEYS.descriptionWithDue, { date: formatDate(props.currentDueOn) });
  return (
    <section aria-label={t(KEYS.title)} className="flex flex-col gap-2">
      <ChangeStatus glance={props.glance} />
      {props.glance.pending === null && (
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>{t(KEYS.trigger)}</Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(KEYS.title)}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {open ? <DeliveryChangeForm props={props} close={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
