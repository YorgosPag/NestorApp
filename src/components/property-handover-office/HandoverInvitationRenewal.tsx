'use client';

/**
 * @fileoverview **Το κουμπί «Νέα πρόσκληση»** μιας παράδοσης (ADR-916 §5.17 Φ-Δ.3 · §8 Ο9).
 * @related hooks/property-handover/useHandoverOfficeActions (η πράξη) · HandoverEntryCard.tsx (η κάρτα)
 * @module components/property-handover-office/HandoverInvitationRenewal
 *
 * 🔑 **Το κουμπί ΔΕΝ κρίνει**: εμφανίζεται όταν το λέει το `status.renewal`, που βγαίνει από την **ίδια** συνάρτηση με την
 *    πόρτα (`handoverInvitationRenewalOfferOf`, άγκυρα Ζ17) — η οθόνη δεν υπόσχεται πράξη που ο διακομιστής θα αρνηθεί.
 * ⚠️ **Μετά από άρνηση, μόνο ρητά** (DocuSign: declined = τερματικό): `ConfirmDialog` που λέει ότι ο αγοραστής **είχε
 *    αρνηθεί** — η πόρτα αρνείται `declined-unconfirmed` χωρίς αυτή την επιβεβαίωση, όποιος κι αν είναι ο πελάτης.
 */

import React from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { HandoverOfficeActions } from '@/hooks/property-handover/useHandoverOfficeActions';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { HandoverInvitationRenewalOffer } from '@/types/property-handover';

const K = 'properties-detail:handover.renewal';

interface HandoverInvitationRenewalProps {
  readonly handoverId: string;
  readonly offer: HandoverInvitationRenewalOffer;
  readonly actions: HandoverOfficeActions;
}

export function HandoverInvitationRenewal({ handoverId, offer, actions }: HandoverInvitationRenewalProps): React.ReactElement | null {
  const { t } = useTranslation(['properties-detail']);
  const iconSizes = useIconSizes();
  const [confirming, setConfirming] = React.useState(false);
  if (offer === 'none') return null;

  const busy = actions.busyId === handoverId;
  const afterDecline = offer === 'renew-after-decline';
  const onClick = () => (afterDecline ? setConfirming(true) : void actions.renew(handoverId, false));

  return (
    <>
      <Button type="button" size="sm" className="w-fit gap-1.5" disabled={actions.busyId !== null} aria-busy={busy} onClick={onClick}>
        <Send className={iconSizes.sm} aria-hidden="true" />
        {t(busy ? `${K}.busy` : `${K}.action`)}
      </Button>
      {afterDecline && (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t(`${K}.confirmTitle`)}
          description={t(`${K}.confirmDescription`)}
          confirmText={t(`${K}.confirmAction`)}
          variant="warning"
          loading={busy}
          keepOpenWhilePending
          onConfirm={async () => {
            await actions.renew(handoverId, true);
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}
