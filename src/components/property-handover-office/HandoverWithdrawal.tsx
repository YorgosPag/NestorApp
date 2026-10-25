'use client';

/**
 * @fileoverview **Το κουμπί «Ανάκληση παράδοσης»** μιας παράδοσης της οποίας η πώληση δεν ισχύει πια (ADR-916 §5.19 Φ-Δ.5 · Δ8).
 * @related hooks/property-handover/useHandoverOfficeActions (η πράξη) · HandoverEntryCard.tsx (η κάρτα) ·
 *          lib/property-handover/handover-withdrawal-plan (`handoverWithdrawalOfferOf` — η ΙΔΙΑ κρίση με την πόρτα) ·
 *          HandoverIrreversibleAction.tsx (το ΕΝΑ σχήμα μη αναστρέψιμης πράξης)
 * @module components/property-handover-office/HandoverWithdrawal
 *
 * 🔑 **Το κουμπί ΔΕΝ κρίνει**: εμφανίζεται όταν το λέει το `status.withdrawal` (άγκυρα — ίδια συνάρτηση με την πόρτα).
 * ⚠️ **Μη αναστρέψιμη** (DocuSign void): διάλογος καταστροφικής πράξης που λέει **τι μένει** στον αγοραστή και τι σταματά,
 *    με υποχρεωτική αιτιολογία **και** ρητή επιβεβαίωση. Η πόρτα τα ξαναελέγχει όλα, όποιος κι αν είναι ο πελάτης.
 */

import React from 'react';
import { Undo2 } from 'lucide-react';

import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HandoverWithdrawalOffer } from '@/types/property-handover';

import { HandoverIrreversibleAction } from './HandoverIrreversibleAction';

const K = 'properties-detail:handover.withdrawal';

/** Τι σημαίνει η ανάκληση — τι μένει στον αγοραστή, τι σταματά, ποιος ειδοποιείται. */
const MEANS = ['kept', 'stops', 'notice'] as const;

interface HandoverWithdrawalProps {
  readonly handoverId: string;
  readonly offer: HandoverWithdrawalOffer;
  readonly actions: HandoverOfficeActions;
}

export function HandoverWithdrawal({ handoverId, offer, actions }: HandoverWithdrawalProps): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  if (offer === 'none') return null;
  return (
    <HandoverIrreversibleAction keys={K} means={MEANS} description={t(`${K}.description`)} icon={Undo2} buttonVariant="destructive"
      busyId={actions.busyId} busyKey={handoverId} onSubmit={(reason) => actions.withdraw({ handoverId, reason })} />
  );
}
