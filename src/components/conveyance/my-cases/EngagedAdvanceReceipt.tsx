'use client';

/**
 * @fileoverview ADR-943 Φ5δ (Κ-7) — ο μηχανικός καταγράφει τον **ΜΑΡΚ του παραστατικού της προκαταβολής**: ό,τι εισπράχθηκε,
 *   ούτε λεπτό παραπάνω. Τα πεδία είναι τα ΙΔΙΑ με του γραφείου (`IssuanceReceiptFields`).
 * @related services/conveyance/conveyance-engagement-gateway.ts (`recordIssuanceAdvanceReceipt`) ·
 *   app/api/engagements/[engagementId]/issuance/advance-receipt/route.ts (η πόρτα) · EngagedAdvance.tsx (πού ζει)
 * @module components/conveyance/my-cases/EngagedAdvanceReceipt
 *
 * ⚠️ Κυριολεκτικά κλειδιά (CHECK 3.34) — και για τους κωδικούς άρνησης, ποτέ `${code}`.
 */

import React, { useState } from 'react';

import { IssuanceReceiptFields, useReceiptDraft } from '@/components/document-registry/IssuanceReceiptFields';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { IssuanceStage } from '@/lib/document-validity/issuance-assignment';
import { formatMinor } from '@/lib/money/money';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  advanceReceiptRejectionOf,
  recordIssuanceAdvanceReceipt,
  type AdvanceReceiptRejection,
} from '@/services/conveyance/conveyance-engagement-gateway';

const K = 'conveyance:engagement.issuance.advance.receipt.';

const KEYS = {
  trigger: `${K}trigger`,
  title: `${K}title`,
  description: `${K}description`,
  cancel: `${K}cancel`,
  confirm: `${K}confirm`,
  sending: `${K}sending`,
  sent: `${K}sent`,
} as const;

const ERROR_KEYS: Readonly<Record<AdvanceReceiptRejection | 'generic', string>> = {
  NOT_FOUND: `${K}errors.NOT_FOUND`,
  ENGAGEMENT_NOT_ACTIVE: `${K}errors.ENGAGEMENT_NOT_ACTIVE`,
  UNAVAILABLE: `${K}errors.UNAVAILABLE`,
  STALE: `${K}errors.STALE`,
  TRANSITION_REFUSED: `${K}errors.TRANSITION_REFUSED`,
  RECEIPT_MISMATCH: `${K}errors.RECEIPT_MISMATCH`,
  generic: `${K}errors.generic`,
};

export interface EngagedAdvanceReceiptProps {
  readonly engagementId: string;
  readonly stage: IssuanceStage;
  /** Ό,τι εισπράχθηκε — το ποσό του παραστατικού (`AdvanceGlance.collectedMinor`). */
  readonly collectedMinor: number;
  readonly onChanged: () => void;
}

export function EngagedAdvanceReceipt(props: EngagedAdvanceReceiptProps): React.ReactElement {
  const { t } = useTranslation(['conveyance', 'document-registry']);
  const { success, error } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { draft, setDraft, valid, value } = useReceiptDraft();
  const submit = () => {
    if (busy || !valid) return;
    setBusy(true);
    recordIssuanceAdvanceReceipt(props.engagementId, { expectedStage: props.stage, ...value, totalMinor: props.collectedMinor })
      .then(() => { success(t(KEYS.sent)); setOpen(false); props.onChanged(); })
      .catch((cause: unknown) => {
        const code = advanceReceiptRejectionOf(cause);
        error(t(ERROR_KEYS[code ?? 'generic']));
        if (code === 'STALE') props.onChanged();
      })
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Button type="button" size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>{t(KEYS.trigger)}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(KEYS.title)}</DialogTitle>
            <DialogDescription>{t(KEYS.description, { amount: formatMinor(props.collectedMinor) })}</DialogDescription>
          </DialogHeader>
          <IssuanceReceiptFields draft={draft} onChange={setDraft} />
          <DialogActionFooter
            cancelLabel={t(KEYS.cancel)} confirmLabel={t(KEYS.confirm)} busyLabel={t(KEYS.sending)}
            onCancel={() => setOpen(false)} onConfirm={submit} isSubmitting={busy} canSubmit={valid}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
