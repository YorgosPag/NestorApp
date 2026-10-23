'use client';

/**
 * @fileoverview **Οι πράξεις του γραφείου στην καρτέλα «Παράδοση»** — «Νέα πρόσκληση» (Φ-Δ.3) · «Απόφαση για αρχείο» (Φ-Δ.4).
 * @related services/property-handover/property-handover-office-action.client (το ΕΝΑ σχήμα πράξης) ·
 *          πρότυπο `useInvitationActions` (ADR-853 Φ6)
 * @module hooks/property-handover/useHandoverOfficeActions
 *
 * 🔑 **ΜΙΑ ιδιότητα `actions`, πολλές πράξεις** — η καρτέλα δεν μεγαλώνει από ένα prop ανά πράξη, και **ένα** `busyId`
 *    σημαίνει μία πράξη τη φορά σε όλη την καρτέλα (ένα κλικ, μία πράξη).
 * 🔑 **Η ΑΡΝΗΣΗ ΞΑΝΑΦΕΡΝΕΙ ΤΗΝ ΚΑΡΤΕΛΑ**: ένα `not-renewable` / `stale` / `already-delivered` σημαίνει ότι **η οθόνη μας είναι
 *    μπαγιάτικη** (ο αγοραστής αποδέχτηκε · συνάδελφος αποφάσισε πρώτος · η μηχανή παρέδωσε) — να αφήσουμε το κουμπί θα ζητούσε
 *    από τον άνθρωπο να ξαναπατήσει κάτι που **δεν μπορεί** να πετύχει. Μόνο το `failed` (δεν μάθαμε) αφήνει την καρτέλα ως έχει.
 * 🔑 **Η επιτυχία ΞΑΝΑΦΕΡΝΕΙ ΤΗΝ ΚΑΡΤΕΛΑ**: ο διακομιστής απαντά **μετά** τη συμφιλίωση, άρα η νέα κατάσταση είναι η
 *    **αλήθεια** — ποτέ αισιόδοξη υπόθεση που θα διαψευστεί σιωπηλά.
 */

import { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { decideHandoverFileFromScreen } from '@/services/property-handover/property-handover-file-decision.client';
import { renewHandoverInvitationFromScreen } from '@/services/property-handover/property-handover-invitation-renewal.client';
import type { HandoverFileDecisionRequest } from '@/types/property-handover-file-decision';

const RENEWAL = 'properties-detail:handover.renewal';
const FILE_DECISION = 'properties-detail:handover.fileDecision';

export interface HandoverOfficeActions {
  /** Η παράδοση **ή** το αρχείο με πράξη σε εξέλιξη — `null` όταν καμία. */
  readonly busyId: string | null;
  readonly renew: (handoverId: string, confirmDeclined: boolean) => Promise<void>;
  /** `true` ⇒ η πράξη ολοκληρώθηκε (με επιτυχία ή άρνηση) — ο διάλογος κλείνει· `false` ⇒ «δεν μπόρεσα», μένει ανοιχτός. */
  readonly decideFile: (request: HandoverFileDecisionRequest) => Promise<boolean>;
}

type OfficeOutcome = { readonly kind: 'failed' } | { readonly kind: 'refused'; readonly reason: string } | { readonly kind: 'ok' };

/** Το ΕΝΑ σχήμα: busy → πράξη → ειδοποίηση → (άρνηση ή επιτυχία) ξαναφόρτωση. `true` ⇒ ολοκληρώθηκε. */
function useOfficeActionRunner(reload: () => void) {
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation(['properties-detail']);
  const [busyId, setBusyId] = useState<string | null>(null);
  const run = useCallback(
    async (id: string, keys: string, act: () => Promise<OfficeOutcome>): Promise<boolean> => {
      setBusyId(id);
      try {
        const outcome = await act();
        if (outcome.kind === 'failed') {
          notifyError(t(`${keys}.failed`));
          return false;
        }
        if (outcome.kind === 'refused') notifyError(t(`${keys}.refusal.${outcome.reason}`));
        else success(t(`${keys}.success`));
        reload();
        return true;
      } finally {
        setBusyId(null);
      }
    },
    [reload, success, notifyError, t],
  );
  return { busyId, run };
}

export function useHandoverOfficeActions(propertyId: string, reload: () => void): HandoverOfficeActions {
  const { busyId, run } = useOfficeActionRunner(reload);

  const renew = useCallback(
    async (handoverId: string, confirmDeclined: boolean) => {
      await run(handoverId, RENEWAL, async () => {
        const result = await renewHandoverInvitationFromScreen(propertyId, { handoverId, confirmDeclined });
        return result.kind === 'renewed' ? { kind: 'ok' } : result;
      });
    },
    [propertyId, run],
  );

  const decideFile = useCallback(
    (request: HandoverFileDecisionRequest) =>
      run(request.fileId, FILE_DECISION, async () => {
        const result = await decideHandoverFileFromScreen(propertyId, request);
        return result.kind === 'decided' || result.kind === 'unchanged' ? { kind: 'ok' } : result;
      }),
    [propertyId, run],
  );

  return { busyId, renew, decideFile };
}
