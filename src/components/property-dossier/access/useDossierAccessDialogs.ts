'use client';

/**
 * @fileoverview **Το μυαλό της κάρτας «Πρόσβαση»** — ποιος διάλογος είναι ανοιχτός και τι κάνει κάθε πράξη (ADR-916 Φ-Ε1 Σ4).
 * @module components/property-dossier/access/useDossierAccessDialogs
 * @related `useDossierAccess.ts` (κατάσταση + πόρτες) · `DossierAccessCard.tsx` (η σήμανση)
 *
 * 🔑 **Ένας** διάλογος κάθε φορά (διακριτή ένωση `OpenDialog`) — ποτέ δύο σημαίες που μπορούν να διαφωνήσουν.
 * 🔑 Κάθε πράξη με **ονομασμένη** έκβαση: άρνηση ⇒ τι να κάνει ο άνθρωπος (`SLOT_OCCUPIED` ⇒ «ανανέωσε ή ανακάλεσε
 *    πρώτα»)· η αποστολή του email λέγεται ρητά — «δεν στάλθηκε» δεν είναι σιωπή. Ο διάλογος κλείνει **μόνο** στην
 *    επιτυχία: η άρνηση αφήνει ό,τι έγραψε ο άνθρωπος στη θέση του.
 */

import { useCallback, useState } from 'react';

import type { DossierShareDays } from '@/config/engagement-policy';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { DossierInvitationRequest } from '@/lib/property-dossier/dossier-access-request-schema';
import { useNotifications } from '@/providers/NotificationProvider';
import type { DossierAccessSlot, DossierEngagementSummary } from '@/types/dossier-access';
import type { DossierEngagementRole, DossierShareReach } from '@/types/engagement';

import type { DossierSlotActions } from './DossierAccessSlotRow';
import type { DossierInviteSeed } from './DossierInviteDialog';
import { useDossierAccess, type DossierAccessControls, type DossierAccessOutcome } from './useDossierAccess';

const K = 'property-market:dossier.access';

type EngagementDialogKind = 'reach' | 'renew' | 'revoke';

type OpenDialog =
  | { readonly kind: 'invite'; readonly seed: DossierInviteSeed }
  | { readonly kind: EngagementDialogKind; readonly engagement: DossierEngagementSummary }
  | { readonly kind: 'cancel-invitation'; readonly slot: DossierAccessSlot };

export interface DossierAccessDialogs {
  readonly access: DossierAccessControls;
  readonly inviteSeed: DossierInviteSeed | null;
  readonly cancellingSlot: DossierAccessSlot | null;
  readonly target: (kind: EngagementDialogKind) => DossierEngagementSummary | null;
  readonly busyFor: (role: DossierEngagementRole | undefined) => boolean;
  readonly rowActions: (slot: DossierAccessSlot) => Omit<DossierSlotActions, 'archived'>;
  readonly close: () => void;
  readonly sendInvite: (request: DossierInvitationRequest) => void;
  readonly saveReach: (engagement: DossierEngagementSummary, reach: DossierShareReach) => void;
  readonly renew: (engagement: DossierEngagementSummary, shareDays: DossierShareDays) => void;
  readonly confirmRevoke: () => void;
  readonly confirmCancelInvitation: () => void;
}

/** Η έκβαση → μήνυμα· επιστρέφει «πέτυχε;» για να κλείσει ο διάλογος μόνο τότε. */
function useReport(): (outcome: DossierAccessOutcome) => boolean {
  const { t } = useTranslation(['property-market', 'conveyance']);
  const { error: notifyError, success: notifySuccess } = useNotifications();
  return useCallback((outcome: DossierAccessOutcome) => {
    if (!outcome.ok) notifyError(t(`${K}.rejections.${outcome.rejection}`));
    else if (outcome.invited === 'accepted') notifySuccess(t('conveyance:engagement.invitation.delivery.accepted'));
    else if (outcome.invited) notifyError(t(`conveyance:engagement.invitation.delivery.${outcome.invited}`));
    return outcome.ok;
  }, [notifyError, notifySuccess, t]);
}

/** Επαναποστολή ⇒ το email της εκκρεμούς πρόσκλησης· νέα πρόσκληση ⇒ κενό. */
function inviteSeedOf(slot: DossierAccessSlot): DossierInviteSeed {
  return { role: slot.role, email: slot.invitation?.state === 'pending' ? slot.invitation.inviteeEmail : '' };
}

/** Τα κουμπιά μιας γραμμής ανοίγουν **τον** διάλογό τους — καμία πράξη χωρίς διάλογο ή επιβεβαίωση. */
function openers(setOpen: (dialog: OpenDialog) => void): Omit<DossierSlotActions, 'archived' | 'busy'> {
  return {
    onInvite: (slot) => setOpen({ kind: 'invite', seed: inviteSeedOf(slot) }),
    onCancelInvitation: (slot) => setOpen({ kind: 'cancel-invitation', slot }),
    onRenew: (engagement) => setOpen({ kind: 'renew', engagement }),
    onReach: (engagement) => setOpen({ kind: 'reach', engagement }),
    onRevoke: (engagement) => setOpen({ kind: 'revoke', engagement }),
  };
}

export function useDossierAccessDialogs(dossierId: string): DossierAccessDialogs {
  const access = useDossierAccess(dossierId);
  const report = useReport();
  const [open, setOpen] = useState<OpenDialog | null>(null);
  const close = useCallback(() => setOpen(null), []);
  /** Η πράξη τρέχει· η έκβαση λέγεται· ο διάλογος κλείνει μόνο αν πέτυχε. */
  const settle = useCallback((pending: Promise<DossierAccessOutcome>) => {
    void pending.then(report).then((ok) => { if (ok) setOpen(null); });
  }, [report]);

  const target = (kind: EngagementDialogKind) => (open !== null && open.kind === kind && 'engagement' in open ? open.engagement : null);
  const revoking = target('revoke');
  const cancellingSlot = open?.kind === 'cancel-invitation' ? open.slot : null;

  return {
    access,
    inviteSeed: open?.kind === 'invite' ? open.seed : null,
    cancellingSlot,
    target,
    busyFor: (role) => role !== undefined && access.pending.has(role),
    rowActions: (slot) => ({ busy: access.pending.has(slot.role), ...openers(setOpen) }),
    close,
    sendInvite: (request) => settle(access.invite(request)),
    saveReach: (engagement, reach) => settle(access.change(engagement.role, engagement.engagementId, { action: 'reach', reach })),
    renew: (engagement, shareDays) => settle(access.change(engagement.role, engagement.engagementId, { action: 'renew', shareDays })),
    confirmRevoke: () => { if (revoking) settle(access.change(revoking.role, revoking.engagementId, { action: 'revoke' })); },
    confirmCancelInvitation: () => {
      const invitation = cancellingSlot?.invitation;
      if (cancellingSlot && invitation) settle(access.cancelInvitation(cancellingSlot.role, invitation.invitationId));
    },
  };
}
