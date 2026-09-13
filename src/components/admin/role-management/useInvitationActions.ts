'use client';

/**
 * ADR-853 Φ6 — **ΟΙ ΔΥΟ ΠΡΑΞΕΙΣ ΤΗΣ ΓΡΑΜΜΗΣ**: ανάκληση και επαναποστολή.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΓΚΙΣΤΡΟ ΚΑΙ ΟΧΙ ΑΛΛΕΣ ΕΝΕΝΗΝΤΑ ΓΡΑΜΜΕΣ ΣΤΟ `UsersTab`
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `UsersTab` είναι ήδη **395 γραμμές** και κρατά τη μνήμη, τα φίλτρα, την ταξινόμηση
 * και **έξι** διαλόγους. Οι πράξεις της πρόσκλησης εκεί μέσα θα το έσπρωχναν στο όριο των
 * **500** (N.7.1) και — το σοβαρότερο — θα ήταν **αδύνατο να ελεγχθούν χωρίς να στηθεί
 * ολόκληρη η καρτέλα**. Εδώ είναι μια καθαρή μονάδα με τρεις εξόδους.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΕΠΑΝΑΠΟΣΤΟΛΗ ΕΙΝΑΙ Η ΕΚΔΟΣΗ — ΔΕΝ ΥΠΑΡΧΕΙ ΔΕΥΤΕΡΗ ΠΡΑΞΗ
 * ─────────────────────────────────────────────────────────────────────────────
 * Καλεί **τον ίδιο** `issueWorkspaceInvitationFromScreen` με το email και τον ρόλο της
 * γραμμής: ο διακομιστής γεννά **νέο** token με νέα λήξη και κάνει την προηγούμενη
 * `revoked` στην **ίδια** συναλλαγή (§7.3). Δεύτερη υλοποίηση εδώ θα ήταν **δίδυμο** του
 * διαλόγου — ο sibling clone που πιάνει το CHECK 3.28 ανεξάρτητα ονόματος (N.18).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΚΑΙ Η **ΑΡΝΗΣΗ** ΞΑΝΑΦΕΡΝΕΙ ΤΗ ΛΙΣΤΑ — ΤΟ ΜΗ ΠΡΟΦΑΝΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Ένα **409 `ALREADY_RESOLVED`** ή **404** δεν σημαίνει *«δεν έγινε τίποτα»* — σημαίνει
 * ότι **η οθόνη μας είναι μπαγιάτικη**: κάποιος δέχτηκε, ή συνάδελφος ανακάλεσε πρώτος.
 * Να δείξουμε το σφάλμα και **να αφήσουμε τη νεκρή γραμμή** θα ζητούσε από τον άνθρωπο να
 * ξαναπατήσει κουμπί που **δεν μπορεί** να πετύχει. Μόνο το `unavailable` (503) αφήνει τη
 * λίστα ως έχει — εκεί όντως δεν άλλαξε τίποτα.
 *
 * @module components/admin/role-management/useInvitationActions
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { useCallback, useState } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import {
  issueWorkspaceInvitationFromScreen,
  revokeWorkspaceInvitationFromScreen,
} from '@/services/workspace/workspace-invitation.client';
import type { WorkspaceInvitationView } from '@/types/workspace-invitation';

import { DELIVERY_KEY, INVITE_KEYS, ISSUE_SETBACK_KEY, REVOKE_SETBACK_KEY } from './invite-labels';

export interface InvitationActions {
  /** Το `id` της γραμμής που έχει πράξη σε εξέλιξη — `null` όταν καμία. */
  readonly busyId: string | null;
  readonly revoke: (invitation: WorkspaceInvitationView) => Promise<void>;
  readonly resend: (invitation: WorkspaceInvitationView) => Promise<void>;
}

export function useInvitationActions(refetch: () => void): InvitationActions {
  // ⚠️ **Κανένα `warning` εδώ, επίτηδες**: στην επαναποστολή η ακύρωση της προηγούμενης
  //    είναι **ο σκοπός** της πράξης, όχι έκπληξη. Στον διάλογο είναι — εκεί ο διαχειριστής
  //    νόμιζε ότι δημιουργεί καινούρια, και γι' αυτό **μόνο εκεί** προειδοποιούμε.
  const { success, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');
  const [busyId, setBusyId] = useState<string | null>(null);

  const revoke = useCallback(
    async (invitation: WorkspaceInvitationView) => {
      setBusyId(invitation.id);
      try {
        const result = await revokeWorkspaceInvitationFromScreen(invitation.id);
        if (result.kind === 'revoked') {
          success(t(INVITE_KEYS.revokeSuccess));
          refetch();
          return;
        }
        if (result.kind === 'failed') {
          notifyError(t(INVITE_KEYS.error));
          return;
        }
        notifyError(t(REVOKE_SETBACK_KEY[result.setback.kind]));
        // Δες την κεφαλίδα: «ήδη κλειστή» και «δεν βρέθηκε» σημαίνουν **μπαγιάτικη οθόνη**.
        if (result.setback.kind !== 'unavailable') refetch();
      } finally {
        setBusyId(null);
      }
    },
    [success, notifyError, t, refetch],
  );

  const resend = useCallback(
    async (invitation: WorkspaceInvitationView) => {
      setBusyId(invitation.id);
      try {
        const result = await issueWorkspaceInvitationFromScreen({
          email: invitation.inviteeEmail,
          role: invitation.role,
        });
        if (result.kind === 'refused') {
          notifyError(t(ISSUE_SETBACK_KEY[result.setback.kind]));
          return;
        }
        if (result.kind === 'failed') {
          notifyError(t(INVITE_KEYS.error));
          return;
        }
        success(t(INVITE_KEYS.success));
        // ⚠️ **Η παράδοση λέγεται ΚΑΙ εδώ**, αλλιώς η επαναποστολή είναι η μόνη διαδρομή
        //    όπου ένα μήνυμα που δεν έφυγε περνά **σιωπηλά** ως επιτυχία.
        if (result.issued.delivery !== 'accepted') {
          notifyError(t(DELIVERY_KEY[result.issued.delivery]));
        }
        refetch();
      } finally {
        setBusyId(null);
      }
    },
    [success, notifyError, t, refetch],
  );

  return { busyId, revoke, resend };
}
