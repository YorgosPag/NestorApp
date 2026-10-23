'use client';

/**
 * @fileoverview **«Νέα πρόσκληση» — η πράξη της καρτέλας «Παράδοση»** (ADR-916 §5.17 Φ-Δ.3).
 * @related services/property-handover/property-handover-invitation-renewal.client · πρότυπο `useInvitationActions` (ADR-853 Φ6)
 * @module hooks/property-handover/useHandoverInvitationRenewal
 *
 * 🔑 **Η ΑΡΝΗΣΗ ΞΑΝΑΦΕΡΝΕΙ ΤΗΝ ΚΑΡΤΕΛΑ**: ένα `not-renewable` / `handover-unknown` σημαίνει ότι **η οθόνη μας είναι
 *    μπαγιάτικη** (ο αγοραστής αποδέχτηκε, ή συνάδελφος έστειλε πρώτος) — να αφήσουμε το κουμπί θα ζητούσε από τον άνθρωπο να
 *    ξαναπατήσει κάτι που **δεν μπορεί** να πετύχει. Μόνο το `failed` (δεν μάθαμε) αφήνει την καρτέλα ως έχει.
 * 🔑 **Η επιτυχία ΞΑΝΑΦΕΡΝΕΙ ΤΗΝ ΚΑΡΤΕΛΑ**: το πρώτο email φεύγει **πριν** απαντήσει ο διακομιστής, άρα η νέα κατάσταση
 *    («περιμένει τον αγοραστή» ή «δεν παραδόθηκε») είναι η **αλήθεια** — ποτέ αισιόδοξη υπόθεση που θα διαψευστεί σιωπηλά.
 */

import { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { renewHandoverInvitationFromScreen } from '@/services/property-handover/property-handover-invitation-renewal.client';

const K = 'properties-detail:handover.renewal';

export interface HandoverInvitationRenewalActions {
  /** Η παράδοση με πράξη σε εξέλιξη — `null` όταν καμία (ένα κλικ, μία πράξη). */
  readonly busyId: string | null;
  readonly renew: (handoverId: string, confirmDeclined: boolean) => Promise<void>;
}

export function useHandoverInvitationRenewal(propertyId: string, reload: () => void): HandoverInvitationRenewalActions {
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation(['properties-detail']);
  const [busyId, setBusyId] = useState<string | null>(null);

  const renew = useCallback(
    async (handoverId: string, confirmDeclined: boolean) => {
      setBusyId(handoverId);
      try {
        const result = await renewHandoverInvitationFromScreen(propertyId, { handoverId, confirmDeclined });
        if (result.kind === 'failed') {
          notifyError(t(`${K}.failed`));
          return;
        }
        if (result.kind === 'refused') notifyError(t(`${K}.refusal.${result.reason}`));
        else success(t(`${K}.success`));
        reload();
      } finally {
        setBusyId(null);
      }
    },
    [propertyId, reload, success, notifyError, t],
  );

  return { busyId, renew };
}
