/**
 * =============================================================================
 * ΣΥΝΑΘΡΟΙΣΗ ΕΞΕΡΧΟΜΕΝΩΝ — «πότε δύο email γίνονται ένα;» (ADR-777 §8.25)
 * =============================================================================
 *
 * **Καθαρή συνάρτηση. Καμία Firestore, κανένα δίκτυο, κανένα ρολόι.** Παίρνει τα
 * ώριμα μηνύματα της ουράς και επιστρέφει **πλάνο παράδοσης**: ποια φεύγουν μόνα
 * τους και ποια ταξιδεύουν μαζί. Η εκτέλεση του πλάνου ανήκει στον αγωγό.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ — ΗΤΑΝ **ΓΡΑΜΜΕΝΟ** ΩΣ ΟΡΙΟ, ΟΧΙ ΞΕΧΑΣΜΕΝΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `email-delivery-window.ts` δηλώνει ρητά: *«Τρία γεγονότα με `daily` γίνονται
 * τρία email στις 20:00, όχι ένα με τρεις γραμμές»*, και ονομάζει τον **αποστολέα**
 * ως τη σωστή θέση της συνάθροισης — «γιατί μόνο εκεί υπάρχουν όλα τα εκκρεμή ενός
 * ανθρώπου ταυτόχρονα». Αυτό το module είναι εκείνη η θέση.
 *
 * 🔑 **Και είναι πράγματι η ΜΟΝΗ σωστή θέση, όχι απλώς μια βολική.** Τη στιγμή που
 * γεννιέται μια ειδοποίηση, κανείς δεν ξέρει αν θα γεννηθεί δεύτερη πριν ανοίξει το
 * παράθυρο των 20:00 — η πληροφορία **δεν υπάρχει ακόμη**. Συνάθροιση στη γέννηση θα
 * απαιτούσε είτε να περιμένει το πρώτο μήνυμα (και να ξανακάνει το ίδιο ερώτημα
 * αργότερα), είτε να μαντέψει. Στον αγωγό η απάντηση είναι **μετρημένη**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΡΙΑ ΠΡΑΓΜΑΤΑ **ΔΕΝ** ΣΥΝΑΘΡΟΙΖΟΝΤΑΙ — ΚΑΙ ΚΑΘΕ ΕΝΑ ΓΙΑ ΔΙΚΟ ΤΟΥ ΛΟΓΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Κατάσταση | Γιατί μένει μόνο του |
 * |---|---|
 * | `urgent` | Είναι τα **5 από τα 29** υποχρεωτικά συμβάντα (ασφάλεια). Ένα «ο λογαριασμός σας παραβιάστηκε» τυλιγμένο σε «Έχετε 4 νέες ειδοποιήσεις» **χάνει ακριβώς αυτό που το κάνει υποχρεωτικό**: το θέμα του. Ο παραλήπτης διαβάζει θέματα, όχι σώματα |
 * | `not-a-notification` | Οι κοινοποιήσεις ακινήτων/φωτογραφιών φέρνουν **δικό τους** επώνυμο HTML (`email-templates`). Συναθροίζοντάς τα θα πετούσαμε το πρότυπο και θα κρατούσαμε το απλό κείμενο — υποβάθμιση, όχι βελτίωση |
 * | `alone` | 🔑 **Ένα μήνυμα ΔΕΝ γίνεται σύνοψη.** «Έχετε 1 νέα ειδοποίηση → *ανοίξτε για να δείτε ποια*» είναι **αυστηρά χειρότερο** από το να δει κατευθείαν το θέμα. Η σύνοψη κερδίζει μόνο όταν αντικαθιστά **πολλές** διακοπές με μία |
 *
 * 🏆 **Το τρίτο είναι εκεί που οι μεγάλοι αστοχούν.** Το GitHub, το Jira και το
 * Confluence στέλνουν σύνοψη **ακόμη και για ένα** συμβάν, με γενικό θέμα που δεν
 * λέει τίποτα. Εμείς ρωτάμε πρώτα αν η σύνοψη **κερδίζει κάτι**, και όταν δεν
 * κερδίζει, παραδίδουμε το πρωτότυπο αυτούσιο.
 *
 * ⚠️ **ΤΟ ΠΛΑΝΟ ΕΙΝΑΙ ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ.** Κάθε μήνυμα προσγειώνεται σε **ακριβώς
 * μία** εγγραφή — {@link planCoversEveryMessage} υπάρχει για να **αποτύχει
 * θορυβωδώς** αν όχι. Ένα μήνυμα που χάνεται από το πλάνο δεν αποτυγχάνει: μένει
 * `pending` για πάντα, δηλαδή **σιωπηλή απώλεια** — ακριβώς το ελάττωμα που
 * γέννησε ολόκληρο τον αγωγό.
 *
 * @module server/notifications/email-digest
 * @see ADR-777 §8.25
 * @see server/notifications/email-delivery-window — «πότε», εδώ είναι το «μαζί;»
 */

import { resolveHumanLanguage, type HumanLanguage } from '@/i18n/languages';
import { emailTextsFor } from '@/server/comms/email-texts';
import { MESSAGE_CATEGORIES, MESSAGE_PRIORITIES } from '@/types/communications';

// 🔗 ADR-848 — η ΑΠΟΔΟΣΗ μετακόμισε σε δικό της module (κείμενο + HTML + σύνδεσμοι),
// κοινό με το μεμονωμένο email. Εδώ μένει η ΑΠΟΦΑΣΗ «ποια φεύγουν μαζί».
import {
  NO_LINKS,
  distinctDigestMembers,
  renderDigestHtml,
  renderDigestText,
  renderSoloHtml,
  renderSoloText,
  type EmailLinks,
  type RenderableMessage,
} from './notification-email-render';

/**
 * Ένα ώριμο μήνυμα της ουράς, στη μορφή που χρειάζεται η **απόφαση** συνάθροισης.
 *
 * ⚠️ Σκόπιμα **δεν** είναι το έγγραφο Firestore: ο σχεδιαστής δεν επιτρέπεται να
 * αγγίξει `ref.update()`. Ο αγωγός ξαναβρίσκει τα έγγραφα από το {@link PendingEmail.id}.
 *
 * 🔗 ADR-848 — κληρονομεί από το `RenderableMessage` τα προαιρετικά `notificationId`
 * (ο μόνιμος σύνδεσμος) και `recipientId` (το token διαγραφής). Παλιά έγγραφα της
 * ουράς δεν τα έχουν ⇒ email **όπως πριν**, καμία migration.
 */
export interface PendingEmail extends RenderableMessage {
  readonly id: string;
  /** Η **διεύθυνση** — όχι ταυτότητα χρήστη. Το κλειδί ομαδοποίησης. */
  readonly to: string;
  readonly subject: string;
  readonly content: string;
  /** `metadata.priority` του εγγράφου. */
  readonly priority: string;
  /** `metadata.category` του εγγράφου. */
  readonly category: string;
  /**
   * 🌐 §8.29 — `metadata.language` του εγγράφου: **η γλώσσα του παραλήπτη, όπως
   * ήταν τη στιγμή που γεννήθηκε το μήνυμα**.
   *
   * ⚠️ **Τύπος `string`, όχι `HumanLanguage`** — και είναι σκόπιμο. Το πεδίο έρχεται
   * από έγγραφο Firestore: μπορεί να λείπει (κάθε μήνυμα γραμμένο **πριν** το
   * §8.29), να είναι `'pseudo'`, ή ό,τι άλλο. Ένας αυστηρός τύπος εδώ θα ήταν
   * **ψέμα προς τον μεταγλωττιστή**. Η στένωση γίνεται μία φορά, στο
   * {@link languageOf}.
   */
  readonly language?: string;
  // 📧 ADR-849 — το `eventType` (για την πύλη της αποστολής ΚΑΙ την εμβέλεια των συνδέσμων)
  // κληρονομείται από το `RenderableMessage`: το ρωτούν πλέον και η απόδοση και η πύλη.
}

/** Γιατί αυτό το μήνυμα φεύγει μόνο του. **Ονομασμένο, ποτέ boolean.** */
export type SoloReason = 'urgent' | 'not-a-notification' | 'alone';

/** Μία γραμμή του πλάνου παράδοσης. */
export type DeliveryPlanEntry =
  /** Φεύγει αυτούσιο, με το **δικό του** θέμα και σώμα. */
  | { readonly kind: 'solo'; readonly message: PendingEmail; readonly reason: SoloReason }
  /** Ένα email που κουβαλά **όλα** τα `members`. */
  | {
      readonly kind: 'digest';
      readonly to: string;
      /**
       * 🌐 §8.29 — η γλώσσα **ολόκληρης** της σύνοψης, ήδη λυμένη.
       *
       * Δηλώνεται στο πλάνο (αντί να ξαναπαράγεται από τα μέλη) γιατί είναι μέρος
       * της **ταυτότητας** της ομάδας: δύο συνόψεις προς την ίδια διεύθυνση
       * ξεχωρίζουν **μόνο** από αυτήν.
       */
      readonly language: HumanLanguage;
      readonly members: readonly PendingEmail[];
      readonly subject: string;
      readonly content: string;
      readonly html: string;
    };

/**
 * ✅ **ΤΟ ΟΡΙΟ ΕΚΛΕΙΣΕ (§8.29): η σύνοψη γράφεται στη γλώσσα ΤΟΥ ΠΑΡΑΛΗΠΤΗ.**
 *
 * Εδώ ζούσε το `DIGEST_TEXTS`, σταθερό ελληνικό αντικείμενο, με το όριο **γραμμένο**
 * από κάτω: *«μονόγλωσσο· θα γίνει ανά παραλήπτη όταν το `UserNotificationSettings`
 * αποκτήσει γλώσσα»*. Το πεδίο υπάρχει πλέον, οπότε τα κείμενα ήρθαν στο
 * {@link emailTextsFor} — μαζί με το θέμα-εφεδρεία που ήταν γραμμένο **τρεις φορές**.
 *
 * ⚠️ Παραμένει σταθερός πίνακας, **όχι `t()`**: ο λόγος δεν ήταν ποτέ ότι δεν
 * ξέραμε τη γλώσσα — ήταν ότι σε cron **δεν υπάρχει** ενεργό i18next να ρωτηθεί, και
 * αυτό δεν άλλαξε. Άλλαξε μόνο ότι η γλώσσα είναι πλέον **παράμετρος**.
 */

/** Κάτω από αυτό το πλήθος, η σύνοψη **χάνει** από το πρωτότυπο. */
export const MIN_DIGEST_SIZE = 2;

/**
 * Η γλώσσα ενός μηνύματος — **μία** στένωση, στην είσοδο.
 *
 * Μήνυμα γραμμένο πριν το §8.29 δεν έχει καθόλου πεδίο· πέφτει στην προεπιλογή,
 * δηλαδή συμπεριφέρεται **ακριβώς όπως πριν**. Καμία migration, ίδιο σχήμα με το
 * `??` της ζώνης ώρας (§8.28).
 */
function languageOf(message: PendingEmail): HumanLanguage {
  return resolveHumanLanguage(message.language);
}

/**
 * Μπορεί αυτό το μήνυμα να μπει σε σύνοψη;
 *
 * `null` = ναι· διαφορετικά **ο λόγος** που δεν μπορεί.
 */
function soloReasonOf(message: PendingEmail): Exclude<SoloReason, 'alone'> | null {
  if (message.priority === MESSAGE_PRIORITIES.URGENT) return 'urgent';
  if (message.category !== MESSAGE_CATEGORIES.NOTIFICATION) return 'not-a-notification';
  return null;
}

type DigestContent = Pick<Extract<DeliveryPlanEntry, { kind: 'digest' }>, 'subject' | 'content' | 'html'>;

/**
 * **Τι λέει μια ομάδα** — πάνω στις **διακριτές** γραμμές της (ADR-777 §8.69.12).
 *
 * 🛡️ Τα `members` της εγγραφής μένουν **όλα** (κλειστή λογιστική, σήμανση `sent` σε κάθε
 * έγγραφο)· το **κείμενο** όμως μετρά ό,τι βλέπει ο αναγνώστης. Αν μετά τη σύμπτυξη μείνει
 * **μία** γραμμή, το email αποδίδεται **ως μεμονωμένο** — ίδιο δόγμα με το `alone`: «1 νέα
 * ειδοποίηση» είναι αυστηρά χειρότερο από το ίδιο το θέμα.
 */
function digestContentOf(
  members: readonly PendingEmail[],
  language: HumanLanguage,
  links: EmailLinks,
): DigestContent {
  const lines = distinctDigestMembers(members);
  if (lines.length < MIN_DIGEST_SIZE) {
    const [line] = lines;
    return {
      subject: line.subject,
      content: renderSoloText(line, language, links),
      html: renderSoloHtml(line, language, line.subject, links),
    };
  }
  const subject = emailTextsFor(language).digest.subject(lines.length);
  return {
    subject,
    content: renderDigestText(lines, language, links),
    html: renderDigestHtml(lines, language, subject, links),
  };
}

/**
 * **Ποια email φεύγουν μαζί;**
 *
 * ⚠️ **Η σειρά εξόδου είναι ντετερμινιστική** — κατά πρώτη εμφάνιση του παραλήπτη
 * στην είσοδο, και μέσα σε κάθε ομάδα κατά σειρά εισόδου. Η είσοδος έρχεται
 * ταξινομημένη κατά `scheduledAt` από τον αγωγό, άρα η σύνοψη διαβάζεται
 * **χρονολογικά**. Ένα `Map` κρατά σειρά εισαγωγής· ένα απλό αντικείμενο **όχι**
 * (αριθμητικά κλειδιά ταξινομούνται πρώτα) — και οι διευθύνσεις email δεν είναι
 * αριθμοί σήμερα, αλλά η εγγύηση δεν πρέπει να εξαρτάται από αυτό.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🌐 §8.29 — ΤΟ ΚΛΕΙΔΙ ΕΙΝΑΙ **ΔΙΕΥΘΥΝΣΗ + ΓΛΩΣΣΑ**, ΟΧΙ ΜΟΝΟ ΔΙΕΥΘΥΝΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 🔑 **Ένα email έχει ΕΝΑ θέμα.** Τη στιγμή που τα κείμενα απέκτησαν γλώσσα, το
 * «ομαδοποίησε κατά παραλήπτη» έγινε **ανεπαρκές**: αν ο χρήστης άλλαξε γλώσσα μέσα
 * στη μέρα, η ουρά του κρατά μηνύματα σφραγισμένα και με τις δύο. Ένα κοινό κλειδί
 * θα τα ένωνε και **κάποιος θα αποφάσιζε σιωπηλά** ποια γλώσσα κερδίζει — «η πρώτη»
 * ή «η τελευταία», δηλαδή απάντηση που εξαρτάται από τη σειρά της ουράς.
 *
 * Με σύνθετο κλειδί δεν χρειάζεται να αποφασίσει κανείς: γίνονται **δύο** συνόψεις,
 * η καθεμία **εσωτερικά συνεπής**. Το κόστος είναι ένα επιπλέον email σε μια
 * σπάνια περίπτωση· το όφελος είναι ότι **δεν υπάρχει** περίπτωση όπου ο παραλήπτης
 * βλέπει αγγλικό θέμα πάνω από ελληνικές γραμμές.
 *
 * ⚠️ **Η κλειστή λογιστική δεν κουνιέται**: το {@link planCoversEveryMessage} μετρά
 * **μηνύματα**, όχι ομάδες. Ένα μήνυμα εξακολουθεί να προσγειώνεται σε ακριβώς μία
 * εγγραφή, όποιο κι αν είναι το κλειδί.
 */
export function planEmailDelivery(
  messages: readonly PendingEmail[],
  /** ADR-848 — πού δείχνουν οι σύνδεσμοι. **Ένεση**, ώστε ο σχεδιαστής να μένει καθαρός. */
  links: EmailLinks = NO_LINKS,
): readonly DeliveryPlanEntry[] {
  const groups = new Map<string, { to: string; language: HumanLanguage; members: PendingEmail[] }>();
  const solos: DeliveryPlanEntry[] = [];

  for (const message of messages) {
    const reason = soloReasonOf(message);
    if (reason) {
      solos.push({ kind: 'solo', message, reason });
      continue;
    }
    const language = languageOf(message);
    // ⚠️ Ο διαχωριστής `\n` είναι **αδύνατος** μέσα σε διεύθυνση email (RFC 5321) και
    // μέσα σε αναγνωριστικό γλώσσας. Ένα `:` ή `|` θα ήταν εξίσου απίθανο αλλά όχι
    // αδύνατο, και μια σύγκρουση κλειδιού εδώ θα ένωνε **ξένους παραλήπτες**.
    const key = `${message.to}\n${language}`;
    const existing = groups.get(key);
    if (existing) existing.members.push(message);
    else groups.set(key, { to: message.to, language, members: [message] });
  }

  const plan: DeliveryPlanEntry[] = [];

  for (const { to, language, members } of groups.values()) {
    if (members.length < MIN_DIGEST_SIZE) {
      plan.push({ kind: 'solo', message: members[0], reason: 'alone' });
      continue;
    }
    plan.push({ kind: 'digest', to, language, members, ...digestContentOf(members, language, links) });
  }

  // Τα μοναχικά μπαίνουν **στο τέλος**, ώστε η σειρά των ομάδων να μην εξαρτάται
  // από το πόσα επείγοντα παρεμβλήθηκαν ανάμεσά τους.
  return [...plan, ...solos];
}

/**
 * **Καλύπτει το πλάνο κάθε μήνυμα, ακριβώς μία φορά;**
 *
 * Υπάρχει **για να αποτύχει θορυβωδώς**. Ένα μήνυμα εκτός πλάνου δεν σφάλλει —
 * μένει `pending` και ξαναδοκιμάζεται αιώνια, χωρίς κανείς να το μάθει.
 */
export function planCoversEveryMessage(
  plan: readonly DeliveryPlanEntry[],
  messages: readonly PendingEmail[],
): boolean {
  const planned: string[] = [];
  for (const entry of plan) {
    if (entry.kind === 'solo') planned.push(entry.message.id);
    else planned.push(...entry.members.map((member) => member.id));
  }

  const unique = new Set(planned);
  // Το πλήθος **και** η μοναδικότητα: ίδιο μέγεθος με διπλοεγγραφή θα σήμαινε ότι
  // ένα μήνυμα στάλθηκε δύο φορές ενώ ένα άλλο χάθηκε — και τα δύο σιωπηλά.
  if (unique.size !== planned.length) return false;
  if (unique.size !== messages.length) return false;

  return messages.every((message) => unique.has(message.id));
}

// 🔗 ADR-848 — ο κριτής `bodyAddsAnything` (§8.54) και η απόδοση κειμένου/HTML της
// σύνοψης ζουν πλέον στο `notification-email-render.ts`: ΕΝΑΣ κριτής για σύνοψη ΚΑΙ
// μεμονωμένο email, ώστε η επόμενη διόρθωση να μη φτάσει μόνο στο ένα από τα δύο.
// ⚠️ Και ΠΑΡΑΜΕΝΕΙ χωρίς `wrapInBrandedTemplate`, σκόπιμα: το επώνυμο πρότυπο ανήκει
// στις κοινοποιήσεις προς **πελάτες**· οι ειδοποιήσεις πάνε σε **χρήστες** της εφαρμογής.
