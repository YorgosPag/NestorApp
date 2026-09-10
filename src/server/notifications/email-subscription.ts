/**
 * =============================================================================
 * Η ΣΥΝΔΡΟΜΗ ΣΤΑ EMAIL ΕΙΔΟΠΟΙΗΣΕΩΝ — ο συγγραφέας της διαγραφής (ADR-848)
 * =============================================================================
 *
 * Τρεις αλλαγές, **κλειστό σύνολο**, και όλες αναστρέψιμες:
 *
 * | Αλλαγή | Τι γράφει | Ποιος τη ζητά |
 * |---|---|---|
 * | `unsubscribe` | `emailEnabled: false` | Το one-click του προγράμματος email (RFC 8058) · το κουμπί «Διακοπή» |
 * | `daily` | `emailEnabled: true`, `emailFrequency: 'daily'` | «Λιγότερα, όχι κανένα» — η επιλογή που προσφέρουν Medium/LinkedIn πριν χάσουν τον συνδρομητή |
 * | `restore` | την **προηγούμενη** κατάσταση, αυτούσια | Το κουμπί «Αναίρεση» |
 *
 * 🔑 **Γιατί `restore` και όχι «resubscribe»**: ένα «ξαναενεργοποίησε» θα έγραφε
 * `emailEnabled: true` και θα έχανε ό,τι είχε ο άνθρωπος πριν — π.χ. `weekly`.
 * Η αναίρεση του Gmail επαναφέρει **ακριβώς** το προηγούμενο· έτσι και εδώ: κάθε
 * αλλαγή **επιστρέφει** το `previous`, και η αναίρεση το στέλνει πίσω.
 *
 * ⚠️ **Transaction, όχι ανάγνωση-και-μετά-γραφή**: το `previous` πρέπει να είναι η
 * κατάσταση που **αντικαταστάθηκε**, όχι μια που διαβάστηκε πριν από άλλη αλλαγή.
 *
 * ⚠️ **Τα υποχρεωτικά email ασφαλείας ΔΕΝ επηρεάζονται** — το `decideEmailDelivery`
 * τα στέλνει πριν ρωτήσει οποιαδήποτε ρύθμιση. Η σελίδα προτιμήσεων το λέει ρητά.
 *
 * @module server/notifications/email-subscription
 * @see lib/notifications/email-subscription-contract — οι τύποι και οι κριτές
 */

import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import type {
  EmailSubscriptionChange,
  EmailSubscriptionState,
} from '@/lib/notifications/email-subscription-contract';
import type { UserNotificationSettings } from '@/services/user-notification-settings/user-notification-settings.types';

import {
  loadUserNotificationSettings,
  mergeStoredSettings,
} from './user-notification-settings-store';

/** Τι άλλαξε — το `previous` είναι το εισιτήριο της αναίρεσης. */
export interface AppliedSubscriptionChange {
  readonly previous: EmailSubscriptionState;
  readonly current: EmailSubscriptionState;
}

/** Το κομμάτι email ολόκληρων ρυθμίσεων. */
export function subscriptionStateOf(
  settings: Pick<UserNotificationSettings, 'emailEnabled' | 'emailFrequency'>,
): EmailSubscriptionState {
  return { emailEnabled: settings.emailEnabled, emailFrequency: settings.emailFrequency };
}

/** **Η επόμενη κατάσταση.** Καθαρή συνάρτηση — όλη η πολιτική, χωρίς βάση. */
export function nextSubscriptionState(
  current: EmailSubscriptionState,
  change: EmailSubscriptionChange,
): EmailSubscriptionState {
  switch (change.kind) {
    case 'unsubscribe':
      return { ...current, emailEnabled: false };
    case 'daily':
      return { emailEnabled: true, emailFrequency: 'daily' };
    case 'restore':
      return change.state;
  }
}

/** Η τρέχουσα κατάσταση — για τη σελίδα, **χωρίς** να γράψει τίποτα (GET). */
export async function readEmailSubscriptionState(uid: string): Promise<EmailSubscriptionState> {
  return subscriptionStateOf(await loadUserNotificationSettings(uid));
}

/**
 * **Εφάρμοσε την αλλαγή**, ατομικά, και πες τι αντικαταστάθηκε.
 *
 * `set(…, { merge: true })`: έγγραφο που δεν υπάρχει ακόμη (ο άνθρωπος δεν άνοιξε
 * ποτέ τις ρυθμίσεις του) δημιουργείται με **μόνο** αυτά τα πεδία — οι αναγνώστες
 * βάζουν τις προεπιλογές από κάτω (`mergeStoredSettings`).
 */
export async function applyEmailSubscriptionChange(
  uid: string,
  change: EmailSubscriptionChange,
): Promise<AppliedSubscriptionChange> {
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTIONS.USER_NOTIFICATION_SETTINGS).doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.exists
      ? ((snapshot.data() ?? {}) as Partial<UserNotificationSettings>)
      : undefined;
    const previous = subscriptionStateOf(mergeStoredSettings(uid, stored));
    const current = nextSubscriptionState(previous, change);

    transaction.set(
      ref,
      { userId: uid, ...current, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { previous, current };
  });
}
