/**
 * =============================================================================
 * Η ΣΥΝΔΡΟΜΗ ΣΤΑ EMAIL ΕΙΔΟΠΟΙΗΣΕΩΝ — ο συγγραφέας της διαγραφής (ADR-848 · ADR-849)
 * =============================================================================
 *
 * Τέσσερις αλλαγές, **κλειστό σύνολο**, και όλες αναστρέψιμες:
 *
 * | Αλλαγή | Τι γράφει | Ποιος τη ζητά |
 * |---|---|---|
 * | `unsubscribe` | `emailEnabled: false` | Το one-click (RFC 8058) με εμβέλεια «όλα» · το κουμπί «Διακοπή» |
 * | `daily` | `emailEnabled: true`, `emailFrequency: 'daily'` | «Λιγότερα, όχι κανένα» (Medium/LinkedIn) |
 * | `restore` | τα **καθολικά** της προηγούμενης κατάστασης | Η «Αναίρεση» μιας καθολικής αλλαγής |
 * | `type` (ADR-849) | `emailCategories.<κατ>.<κλειδί>` | Το one-click με εμβέλεια **τύπου** · ο διακόπτης ανά τύπο της σελίδας (και η αναίρεσή του) |
 *
 * 🔑 **Γιατί `restore` και όχι «resubscribe»**: ένα «ξαναενεργοποίησε» θα έγραφε
 * `emailEnabled: true` και θα έχανε ό,τι είχε ο άνθρωπος πριν — π.χ. `weekly`.
 * Η αναίρεση του Gmail επαναφέρει **ακριβώς** το προηγούμενο· έτσι και εδώ.
 *
 * ⚠️ **Transaction, όχι ανάγνωση-και-μετά-γραφή**: το `previous` πρέπει να είναι η
 * κατάσταση που **αντικαταστάθηκε**, όχι μια που διαβάστηκε πριν από άλλη αλλαγή.
 *
 * ⚠️ **Τα υποχρεωτικά email ασφαλείας ΔΕΝ επηρεάζονται** — το `decideEmailDelivery`
 * τα στέλνει πριν ρωτήσει οποιαδήποτε ρύθμιση, και το συμβόλαιο αρνείται `type` πάνω τους.
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
import {
  mutedEmailTypes,
  parseSettingPath,
} from '@/services/user-notification-settings/notification-preference-policy';
import type { EmailTypeMode } from '@/services/user-notification-settings/user-notification-settings.email-types';
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
  settings: Pick<UserNotificationSettings, 'emailEnabled' | 'emailFrequency' | 'emailCategories'>,
): EmailSubscriptionState {
  return {
    emailEnabled: settings.emailEnabled,
    emailFrequency: settings.emailFrequency,
    mutedTypes: mutedEmailTypes(settings),
  };
}

/** Οι σιγασμένοι τύποι μετά από μια `type` — ταξινομημένοι, χωρίς διπλότυπα. */
function nextMutedTypes(
  muted: readonly string[],
  settings: readonly string[],
  mode: EmailTypeMode,
): string[] {
  const next = new Set(muted);
  for (const path of settings) {
    if (mode === 'off') next.add(path);
    else next.delete(path);
  }
  return [...next].sort();
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
      return { ...current, emailEnabled: true, emailFrequency: 'daily' };
    case 'restore':
      return { ...current, emailEnabled: change.state.emailEnabled, emailFrequency: change.state.emailFrequency };
    case 'type':
      return { ...current, mutedTypes: nextMutedTypes(current.mutedTypes, change.settings, change.mode) };
  }
}

/**
 * **Τι γράφεται στο έγγραφο** — μόνο τα πεδία που αφορά η αλλαγή.
 *
 * ⚠️ Για `type`: ένθετο αντικείμενο `{ emailCategories: { κατ: { κλειδί: mode } } }` με
 * `merge: true` — η Firestore συγχωνεύει **σε βάθος**, οπότε οι υπόλοιποι τύποι μένουν ανέγγιχτοι.
 */
function documentPatch(
  change: EmailSubscriptionChange,
  current: EmailSubscriptionState,
): Record<string, unknown> {
  if (change.kind !== 'type') {
    return { emailEnabled: current.emailEnabled, emailFrequency: current.emailFrequency };
  }
  const emailCategories: Record<string, Record<string, EmailTypeMode>> = {};
  for (const path of change.settings) {
    const ref = parseSettingPath(path);
    if (ref === null) continue;
    const row = emailCategories[ref.category] ?? {};
    row[ref.settingKey] = change.mode;
    emailCategories[ref.category] = row;
  }
  return { emailCategories };
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
    const previous = subscriptionStateOf(mergeStoredSettings(uid, snapshot.exists ? snapshot.data() : undefined));
    const current = nextSubscriptionState(previous, change);

    transaction.set(
      ref,
      { userId: uid, ...documentPatch(change, current), updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return { previous, current };
  });
}
