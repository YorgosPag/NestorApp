'use client';

/**
 * @fileoverview **Το κουμπί «Ανάκληση παράδοσης»** μιας παράδοσης της οποίας η πώληση δεν ισχύει πια (ADR-916 §5.19 Φ-Δ.5 · Δ8).
 * @related hooks/property-handover/useHandoverOfficeActions (η πράξη) · HandoverEntryCard.tsx (η κάρτα) ·
 *          lib/property-handover/handover-withdrawal-plan (`handoverWithdrawalOfferOf` — η ΙΔΙΑ κρίση με την πόρτα)
 * @module components/property-handover-office/HandoverWithdrawal
 *
 * 🔑 **Το κουμπί ΔΕΝ κρίνει**: εμφανίζεται όταν το λέει το `status.withdrawal` (άγκυρα — ίδια συνάρτηση με την πόρτα).
 * ⚠️ **Μη αναστρέψιμη** (DocuSign void): διάλογος καταστροφικής πράξης που λέει **τι μένει** στον αγοραστή και τι σταματά,
 *    με υποχρεωτική αιτιολογία **και** ρητή επιβεβαίωση. Η πόρτα τα ξαναελέγχει όλα, όποιος κι αν είναι ο πελάτης.
 */

import React from 'react';
import { Undo2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/textarea';
import { HANDOVER_OFFICE_REASON_MAX, HANDOVER_OFFICE_REASON_MIN } from '@/config/property-handover-office-policy';
import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HandoverWithdrawalOffer } from '@/types/property-handover';

const K = 'properties-detail:handover.withdrawal';

interface HandoverWithdrawalProps {
  readonly handoverId: string;
  readonly offer: HandoverWithdrawalOffer;
  readonly actions: HandoverOfficeActions;
}

/** Τα πεδία του διαλόγου — τι σημαίνει η πράξη, η αιτιολογία, η επιβεβαίωση. */
function WithdrawalFields({ reason, onReason, confirmed, onConfirmed }: {
  readonly reason: string;
  readonly onReason: (reason: string) => void;
  readonly confirmed: boolean;
  readonly onConfirmed: (confirmed: boolean) => void;
}): React.ReactElement {
  const { t } = useTranslation(['properties-detail']);
  const confirmId = React.useId();
  return (
    <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
      <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        <li>{t(`${K}.means.kept`)}</li>
        <li>{t(`${K}.means.stops`)}</li>
        <li>{t(`${K}.means.notice`)}</li>
      </ul>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t(`${K}.reasonLabel`, { min: HANDOVER_OFFICE_REASON_MIN })}</span>
        <Textarea rows={3} maxLength={HANDOVER_OFFICE_REASON_MAX} value={reason} onChange={(event) => onReason(event.target.value)} />
      </label>
      <p className="m-0 flex items-start gap-2 text-sm text-foreground">
        <Checkbox id={confirmId} checked={confirmed} onCheckedChange={(state) => onConfirmed(state === true)} />
        <label htmlFor={confirmId}>{t(`${K}.confirmIrreversible`)}</label>
      </p>
    </fieldset>
  );
}

export function HandoverWithdrawal({ handoverId, offer, actions }: HandoverWithdrawalProps): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [confirmed, setConfirmed] = React.useState(false);
  if (offer === 'none') return null;

  const busy = actions.busyId === handoverId;
  const ready = reason.trim().length >= HANDOVER_OFFICE_REASON_MIN && confirmed;
  const onConfirm = async () => {
    const done = await actions.withdraw({ handoverId, reason });
    if (done) setOpen(false);
  };

  return (
    <>
      <Button type="button" size="sm" variant="destructive" className="w-fit gap-1.5" disabled={actions.busyId !== null}
        aria-busy={busy} onClick={() => setOpen(true)}>
        <Undo2 className={iconSizes.sm} aria-hidden="true" />
        {t(`${K}.action`)}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t(`${K}.title`)}
        description={t(`${K}.description`)}
        confirmText={t(`${K}.confirmAction`)}
        variant="destructive"
        loading={busy}
        disabled={!ready}
        keepOpenWhilePending
        onConfirm={onConfirm}
      >
        <WithdrawalFields reason={reason} onReason={setReason} confirmed={confirmed} onConfirmed={setConfirmed} />
      </ConfirmDialog>
    </>
  );
}
