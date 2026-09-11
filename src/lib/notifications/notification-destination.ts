/**
 * @fileoverview **ΠΟΥ ΟΔΗΓΕΙ ΜΙΑ ΕΙΔΟΠΟΙΗΣΗ — ΚΑΙ ΣΕ ΠΟΙΟΝ ΧΩΡΟ.** Ένα λεξιλόγιο, δύο κατευθύνσεις.
 * @related ADR-849 §6δ Β1 · ADR-848 (ο παραγωγός κατέχει τον προορισμό) · ADR-787 Ε-3 §8 · Ε-5
 * @module lib/notifications/notification-destination
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΛΑΤΤΩΜΑ: Ο ΠΡΟΟΡΙΣΜΟΣ ΤΑΞΙΔΕΥΕ ΧΩΡΙΣ ΤΟΝ ΧΩΡΟ ΤΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η ειδοποίηση κρατούσε μόνο τη διαδρομή (`/properties/prop_x`) — και ο χώρος
 * συμπληρωνόταν τη στιγμή του κλικ από τον **θεατή**: το `/n/{id}` με το claim του, το
 * κουδούνι με την τρέχουσα διεύθυνση. Ένας άνθρωπος σε δύο γραφεία, ή ο διαχειριστής
 * πλατφόρμας που καταχώρησε σε ξένο, προσγειωνόταν σε **άλλο** γραφείο από αυτό του
 * γεγονότος ⇒ «Το ακίνητο δεν βρέθηκε». Μετρημένο ζωντανά (ADR-849 §6δ).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΟ ΠΡΟΤΥΠΟ — ΚΑΙ ΠΟΥ ΠΑΜΕ ΠΑΡΑΠΕΡΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **Slack** `app_redirect?team=<ID>` — ο χώρος-στόχος **ρητά** στον σύνδεσμο, από τον
 *   παραγωγό (docs.slack.dev/interactivity/deep-linking).
 * · **Microsoft Teams** — κάθε deep link κουβαλά `tenantId`.
 * · **GitHub Notifications** — η ειδοποίηση κρατά `repository` + αναφορά στην οντότητα·
 *   ο τελικός σύνδεσμος **παράγεται** (docs.github.com/en/rest/activity/notifications).
 *
 * 🔑 Εδώ και τα δύο μαζί: ο παραγωγός **δηλώνει** τον χώρο (Slack/Teams) και η τελική
 * διεύθυνση **λύνεται τη στιγμή του κλικ** (GitHub) — άρα ένα γραφείο που αλλάζει
 * ψευδώνυμο δεν σπάει **κανένα** παλιό email. Και ο χώρος παραμένει **αίτημα**: τη
 * συμμετοχή την κρίνει ο φύλακας του `o/[workspace]/layout.tsx`, όχι αυτό το πεδίο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΤΟ ΠΕΔΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * · **ΟΧΙ δεύτερος άξονας απομόνωσης** (ADR-787 Ε-3 §8): ζει στο `meta.workspace`,
 *   ποτέ ως `companyId` στην κορυφή του εγγράφου. Η ειδοποίηση ανήκει στον **άνθρωπο**
 *   (`userId`)· ο χώρος είναι **ετικέτα** — πού ανοίγει, από πού ήρθε.
 * · **ΟΧΙ συμπέρασμα από το `tenantId`** — ρητά απορριφθέν (`place-detail-route.ts`,
 *   ADR-749): πεδίο που υπάρχει για άλλο λόγο δεν αποκτά δεύτερη ερμηνεία.
 * · **ΟΧΙ το κλειδί `workspaceRefKey`** σε έγγραφο — αποθηκεύεται η **ένωση**, που
 *   ξανακρίνεται στην ανάγνωση ({@link readDestinationWorkspace}).
 *
 * **Layering**: leaf — καμία ανάγνωση, κανένα `server-only`. Το διαβάζουν ο διακομιστής
 * (`/n/{id}`, επανάληψη, ανιχνευτής απόκλισης) και ο πελάτης (το κουδούνι).
 */

import {
  orgWorkspace,
  personalWorkspace,
  type WorkspaceRef,
} from '@/types/workspace-membership';

/** Μια ενέργεια της ειδοποίησης — το κουμπί «Προβολή» του κουδουνιού, ο σύνδεσμος του email. */
export interface DestinationAction {
  readonly id: string;
  /**
   * ⚠️ **Δεν φτάνει ποτέ σε οθόνη**: ο `NotificationDrawer` αποδίδει δικό του
   * μεταφρασμένο κείμενο. Σταθερό αναγνωριστικό, ποτέ ελληνικό (N.11).
   */
  readonly label: string;
  readonly url?: string;
  readonly destructive?: boolean;
}

/**
 * **Ο προορισμός ΚΑΙ ο χώρος του — ποτέ ο πρώτος χωρίς τον δεύτερο.**
 *
 * 🔑 Ο τύπος είναι ο φρουρός: το `DispatchRequest` δέχεται `actions` **μόνο** μαζί με
 * `workspace`, άρα ένας έβδομος παραγωγός δεν μπορεί να ξεχάσει τον χώρο — **δεν
 * μεταγλωττίζεται** (ίδιο ιδίωμα με το ADR-787 §5.1 δ: το απαγορευμένο γίνεται
 * αδύνατο να γραφτεί).
 */
export interface NotificationDestination {
  readonly actions: readonly DestinationAction[];
  readonly workspace: WorkspaceRef;
}

/** Το αναγνωριστικό — και η ετικέτα — του μοναδικού κουμπιού «Προβολή». */
const VIEW_ACTION = 'view' as const;

/**
 * **Ο συνήθης προορισμός**: ένα κουμπί «Προβολή» προς μια διαδρομή, μέσα σε έναν χώρο.
 *
 * ⚠️ Το `url` έρχεται **πάντα** από βοηθό διαδρομής (`…Href`), ποτέ χειρόγραφο — το
 * φυλά η άγκυρα Κ2 της `notification-destination-custody`.
 */
export function viewDestination(url: string, workspace: WorkspaceRef): NotificationDestination {
  return { actions: [{ id: VIEW_ACTION, label: VIEW_ACTION, url }], workspace };
}

/** Το `url` της πρώτης ενέργειας — ό,τι κι αν έγραψε κάποτε η βάση. */
export function firstActionUrl(actions: unknown): unknown {
  if (!Array.isArray(actions)) return undefined;
  const first: unknown = actions[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return Reflect.get(first, 'url');
}

/**
 * **Ο χώρος-στόχος όπως τον αποθήκευσε ο παραγωγός** — ξανακριμένος, ή `null`.
 *
 * ⚠️ Το έγγραφο έρχεται από τη **βάση**, όχι από τον μεταγλωττιστή: κάθε πεδίο κρίνεται.
 *
 * 🔴 **Ο ιδιωτικός χώρος γίνεται δεκτός ΜΟΝΟ αν είναι του παραλήπτη.** Μια ειδοποίηση
 * που θα έδειχνε στον ιδιωτικό χώρο **άλλου** ανθρώπου είναι αλλοιωμένη — δεν υπάρχει
 * παραγωγός που να τη γράφει. Αντί να ανοίξει «κάπου», πέφτει στο `null` (παλιά
 * συμπεριφορά, όπως ένα έγγραφο πριν από το Β1).
 *
 * @param recipientId — ο `userId` της ειδοποίησης (ο άνθρωπος στον οποίο ανήκει)
 */
export function readDestinationWorkspace(value: unknown, recipientId: string): WorkspaceRef | null {
  if (typeof value !== 'object' || value === null) return null;

  const kind: unknown = Reflect.get(value, 'kind');
  if (kind === 'org') {
    const companyId: unknown = Reflect.get(value, 'companyId');
    return typeof companyId === 'string' && companyId.length > 0 ? orgWorkspace(companyId) : null;
  }
  if (kind === 'personal') {
    const userId: unknown = Reflect.get(value, 'userId');
    return typeof userId === 'string' && userId.length > 0 && userId === recipientId
      ? personalWorkspace(userId)
      : null;
  }
  return null;
}
