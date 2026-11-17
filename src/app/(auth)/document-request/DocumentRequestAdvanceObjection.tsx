'use client';

/**
 * @fileoverview ADR-943 Φ5β (Ζ-3) — **η αντίρρηση του ιδιοκτήτη** στη σελίδα της προκαταβολής: πότε αποδεσμεύονται τα
 *   χρήματα (με αντίστροφη μέτρηση), και «Κάτι δεν πήγε καλά» → αιτιολογία → υποβολή.
 * @related document-request-api.ts (`objectToAdvance`) · server/issuance-invitations/issuance-advance-objection.ts ·
 *   DocumentRequestAdvance.tsx (ο καλών)
 * @module app/(auth)/document-request/DocumentRequestAdvanceObjection
 *
 * 🏆 **Πάνω από Airbnb** (αναφορά προβλήματος μέσα σε 24ω από το check-in): η σελίδα λέει **ρητά** ότι αν όλα πήγαν
 *    καλά δεν χρειάζεται τίποτα, και **πότε** ακριβώς φεύγουν τα χρήματα· η αντίρρηση κρατά τα χρήματα χωρίς να χρειάζεται
 *    κανείς να «ακυρώσει» την αποδέσμευση (ο εκτελεστής ξαναρωτά τον τομέα).
 * 🔑 **Καμία αισιόδοξη κατάσταση πάνω σε χρήματα**: η σελίδα υιοθετεί την όψη που επιστρέφει ο διακομιστής.
 */

import React, { useEffect, useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ADVANCE_POLICY } from '@/lib/document-validity/issuance-advance';
import { formatDeadlineRelative } from '@/lib/intl-formatting';
import { formatOperatorDateTime } from '@/lib/operator-time-format';
import type { IssuanceAdvancePaymentView } from '@/types/issuance-invitation';

import { objectToAdvance } from './document-request-api';

const MINUTE_MS = 60_000;

/** «σε 2 ημέρες» → «σε 5 ώρες» — ξαναγράφεται κάθε λεπτό, ώστε η μέτρηση να μην μένει παγωμένη. */
function useMinuteTick(): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), MINUTE_MS);
    return () => window.clearInterval(id);
  }, []);
}

type Notice = 'done' | 'closed' | 'failed' | null;

function useObjection(token: string, accessCode: string | null, adopt: (next: IssuanceAdvancePaymentView) => void) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const submit = async (reason: string): Promise<boolean> => {
    setBusy(true);
    const outcome = await objectToAdvance(token, { reason, accessCode });
    setBusy(false);
    if (!outcome.ok) { setNotice('failed'); return false; }
    if (outcome.data.status === 'refused') { setNotice('closed'); return true; }
    adopt(outcome.data.advance);
    setNotice('done');
    return true;
  };
  return { busy, notice, submit };
}

function noticeText(t: ReturnType<typeof useTranslation>['t'], notice: Exclude<Notice, null>): string {
  switch (notice) {
    case 'done': return t('document-request:advance.objection.done');
    case 'closed': return t('document-request:advance.objection.closed');
    case 'failed': return t('document-request:advance.objection.failed');
  }
}

interface ObjectionProps {
  readonly token: string;
  readonly accessCode: string | null;
  readonly view: IssuanceAdvancePaymentView;
  readonly adopt: (next: IssuanceAdvancePaymentView) => void;
}

export function DocumentRequestAdvanceObjection({ token, accessCode, view, adopt }: ObjectionProps): React.ReactElement | null {
  const { t, i18n } = useTranslation(['document-request']);
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { busy, notice, submit } = useObjection(token, accessCode, adopt);
  useMinuteTick();
  const confirm = () => { if (!busy) void submit(reason.trim()).then((closeNow) => { if (closeNow) setOpen(false); }); };
  if (notice === null && view.releaseAt === null) return null;
  return (
    <section aria-label={t('document-request:advance.objection.heading')} className="flex flex-col gap-2">
      {view.releaseAt !== null ? (
        <p role="status" className="m-0 text-sm text-card-foreground">
          {t('document-request:advance.objection.releaseAt', { date: formatOperatorDateTime(view.releaseAt, i18n.language), relative: formatDeadlineRelative(view.releaseAt) })}
        </p>
      ) : null}
      {view.canObject ? (
        <Button type="button" variant="outline" className="w-fit" onClick={() => setOpen(true)}>{t('document-request:advance.objection.trigger')}</Button>
      ) : null}
      {notice === null ? null : (
        <p role={notice === 'failed' ? 'alert' : 'status'} className={`m-0 text-sm ${notice === 'failed' ? COLOR_BRIDGE.text.error : 'text-card-foreground'}`}>{noticeText(t, notice)}</p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('document-request:advance.objection.heading')}</DialogTitle>
            <DialogDescription>{t('document-request:advance.objection.intro')}</DialogDescription>
          </DialogHeader>
          <Label htmlFor={reasonId}>{t('document-request:advance.objection.reasonLabel')}</Label>
          <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={ADVANCE_POLICY.objectionReasonMax} rows={4} disabled={busy} />
          <DialogActionFooter
            cancelLabel={t('document-request:advance.objection.cancel')} confirmLabel={t('document-request:advance.objection.confirm')}
            busyLabel={t('document-request:advance.objection.sending')}
            onCancel={() => setOpen(false)} onConfirm={confirm} isSubmitting={busy} canSubmit={reason.trim().length > 0}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
