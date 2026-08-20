/**
 * =============================================================================
 * ΑΛΥΣΙΔΑ ΠΑΡΟΧΩΝ EMAIL — «αν πέσει ο ένας, φεύγει από τον άλλο;» (ADR-777 §8.26)
 * =============================================================================
 *
 * 🔴 **Η ΕΦΕΔΡΕΙΑ ΗΤΑΝ ΓΡΑΜΜΕΝΗ ΣΤΟ ΣΧΟΛΙΟ ΚΑΙ ΔΕΝ ΥΠΗΡΧΕ ΠΟΥΘΕΝΑ.**
 *
 * Το `services/email.service.ts:2` δηλώνει κατά λέξη *«Enterprise Email Service with
 * Resend + Mailgun **fallback**»*. Η γραμμή 109 του ίδιου αρχείου έλεγε:
 *
 * ```ts
 * const provider = resend ? 'resend' : mailgunAdapter ? 'mailgun' : null;
 * ```
 *
 * Αυτό είναι **επιλογή**, όχι εφεδρεία. Ο πάροχος διαλέγεται **μία φορά, από την
 * ύπαρξη κλειδιού** — και αν η κλήση του αποτύχει, ο κώδικας **πετά**. Ο δεύτερος
 * πάροχος δεν δοκιμάζεται **ποτέ**, ούτε μία φορά, σε καμία διαδρομή. Η λέξη
 * «fallback» περιέγραφε κάτι που δεν είχε γραφτεί.
 *
 * ⚠️ **Ίδιο σχήμα με τα υπόλοιπα ευρήματα του έργου**: μια υπόσχεση σε σχόλιο που
 * κανείς δεν εκτελεί (CHECK 3.36: *«ένα anchor χωρίς gate είναι σχόλιο»*). Και είναι
 * **χειρότερη** από την απουσία: όποιος διαβάσει τη γραμμή 2 σταματά να ψάχνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΤΟΥΣ ΜΕΓΑΛΟΥΣ — ερευνημένο
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Οι υπηρεσίες παράδοσης (SendGrid · Mailgun · Postmark) εγγυώνται επαναλήψεις
 * **μέσα** στον εαυτό τους. Καμία δεν έχει γνώμη για το τι γίνεται όταν πέσει **η
 * ίδια** — αυτό είναι δουλειά του αποστολέα, και οι περισσότερες εφαρμογές δεν το
 * κάνουν καθόλου. Τα πολυ-παροχικά εργαλεία (Novu, Courier) το προσφέρουν ως
 * *provider failover*, αλλά **αναφέρουν μόνο τον νικητή**.
 *
 * Εμείς κρατάμε **κάθε απόπειρα ονομαστικά** ({@link ChainOutcome}): ποιος
 * δοκιμάστηκε, με ποια σειρά, τι απάντησε ο καθένας. Χωρίς αυτό, το «δεν έφυγε το
 * email» δεν ξεχωρίζει από το «δεν υπήρχε πάροχος» — και τα δύο έχουν εντελώς
 * διαφορετική θεραπεία (το πρώτο θέλει αναμονή, το δεύτερο θέλει κλειδί).
 *
 * ⚠️ **ΤΕΣΣΕΡΙΣ ΡΗΤΕΣ ΚΑΤΑΛΗΞΕΙΣ, ΠΟΤΕ boolean.** Η `no-provider` **δεν** είναι
 * είδος αποτυχίας παράδοσης: κανείς δεν δοκιμάστηκε. Αν χωνόταν μέσα στην
 * `all-failed`, το μήνυμα θα κατέληγε σε dead-letter μετά από τρεις προσπάθειες
 * που **δεν έγιναν ποτέ** — τρεις γύροι για κάτι που διορθώνεται μόνο με μεταβλητή
 * περιβάλλοντος.
 *
 * 🔶 **ΔΗΛΩΜΕΝΗ ΣΗΜΕΡΙΝΗ ΚΑΤΑΣΤΑΣΗ, ΜΕΤΡΗΜΕΝΗ 2026-08-19**: το `RESEND_API_KEY`
 * **λείπει** από το περιβάλλον, άρα η αλυσίδα έχει σήμερα **έναν** κρίκο (Mailgun)
 * και η μετάπτωση **δεν μπορεί να συμβεί στην παραγωγή**. Αυτό δεν κάνει τον κώδικα
 * αδρανή φρουρό (ADR-749 §5): η μετάπτωση **εκτελείται** στις άγκυρες με πλαστούς
 * παρόχους, και η κατάσταση «ένας μόνο κρίκος» είναι **ορατή** μέσω του
 * {@link describeChain} αντί να είναι σιωπηλή. Μόλις μπει το κλειδί, η εφεδρεία
 * ενεργοποιείται **χωρίς αλλαγή κώδικα**.
 *
 * @module server/comms/email-provider-chain
 * @see ADR-777 §8.26
 * @see server/comms/email-adapter — ο κρίκος Mailgun
 */

import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('EmailProviderChain');

/** Ένα email προς αποστολή, ανεξάρτητο από πάροχο. */
export interface OutboundEmail {
  readonly to: string;
  readonly subject: string;
  /** Απλό κείμενο — **πάντα** παρόν, για αναγνώστες χωρίς HTML. */
  readonly text: string;
  readonly html?: string;
  readonly from?: string;
}

/** Τι απάντησε **ένας** πάροχος. Ονομασμένο, ποτέ boolean. */
export type ProviderAttempt =
  | { readonly kind: 'delivered'; readonly messageId?: string }
  | { readonly kind: 'rejected'; readonly error: string };

/** Ένας κρίκος της αλυσίδας. */
export interface EmailProvider {
  /** Ονομαστικά, ώστε η αναφορά να λέει **ποιος** έπεσε. */
  readonly name: string;
  /**
   * Είναι ρυθμισμένος; **Ρωτιέται πριν την κλήση**, ώστε ένας κρίκος χωρίς κλειδί
   * να μη μετρά ως αποτυχία παράδοσης — δεν δοκιμάστηκε καν.
   */
  readonly configured: boolean;
  send(message: OutboundEmail): Promise<ProviderAttempt>;
}

/** Μία καταγεγραμμένη απόπειρα, για την αναφορά. */
export interface AttemptRecord {
  readonly provider: string;
  readonly error: string;
}

/** Τι απέγινε **η αλυσίδα**. */
export type ChainOutcome =
  | {
      readonly kind: 'delivered';
      readonly provider: string;
      readonly messageId?: string;
      /** 🔑 `true` όταν ο πρώτος κρίκος απέτυχε και έσωσε ο επόμενος. */
      readonly failedOver: boolean;
    }
  | { readonly kind: 'all-failed'; readonly attempts: readonly AttemptRecord[] }
  /** **Κανείς δεν δοκιμάστηκε** — λείπει ρύθμιση, όχι αποτυχία παράδοσης. */
  | { readonly kind: 'no-provider' };

/**
 * **Στείλε από τον πρώτο που μπορεί· αν πέσει, από τον επόμενο.**
 *
 * ⚠️ **Οι μη ρυθμισμένοι κρίκοι παραλείπονται ΠΡΙΝ την κλήση**, και δεν μπαίνουν
 * στις `attempts`: μια λίστα αποτυχιών που περιέχει «ο πάροχος χωρίς κλειδί
 * απέτυχε» θα έστελνε τον αναγνώστη να ψάξει βλάβη δικτύου εκεί που λείπει
 * μεταβλητή περιβάλλοντος.
 *
 * ⚠️ **Η σειρά της λίστας ΕΙΝΑΙ η πολιτική προτίμησης** και ορίζεται από τον
 * καλούντα, όχι εδώ. Η αλυσίδα δεν έχει γνώμη για το ποιος πάροχος είναι καλύτερος.
 */
export async function sendThroughChain(
  providers: readonly EmailProvider[],
  message: OutboundEmail,
): Promise<ChainOutcome> {
  const usable = providers.filter((provider) => provider.configured);
  if (usable.length === 0) return { kind: 'no-provider' };

  const attempts: AttemptRecord[] = [];

  for (const provider of usable) {
    const result = await attemptOne(provider, message);

    if (result.kind === 'delivered') {
      if (attempts.length > 0) {
        // 🔑 Η μετάπτωση **δεν είναι σιωπηλή επιτυχία**. Το email έφυγε, αλλά ένας
        // πάροχος είναι πεσμένος και κάποιος πρέπει να το μάθει πριν πέσει και ο άλλος.
        logger.warn('Μετάπτωση παρόχου email — ο προηγούμενος απέτυχε', {
          data: {
            delivered: provider.name,
            failed: attempts.map((attempt) => `${attempt.provider}: ${attempt.error}`).join(' | '),
          },
        });
      }
      return {
        kind: 'delivered',
        provider: provider.name,
        messageId: result.messageId,
        failedOver: attempts.length > 0,
      };
    }

    attempts.push({ provider: provider.name, error: result.error });
  }

  return { kind: 'all-failed', attempts };
}

/**
 * Πόσο περιμένουμε **έναν** πάροχο πριν τον θεωρήσουμε πεσμένο.
 *
 * ⚠️ **Το όριο ανήκει στην αλυσίδα, όχι στον καλούντα** — και αυτό διορθώνει
 * υπαρκτό κενό: ο φρουρός `withProviderTimeout` ζούσε **μόνο** στο
 * `services/email.service.ts` (γεννήθηκε από το συμβάν 2026-04-19, *«Resend hung
 * silently → 408 in UI»*). Ο αγωγός cron δεν τον είχε **καθόλου**: ένας κολλημένος
 * πάροχος θα κρατούσε την εργασία μέχρι να τη σκοτώσει η πλατφόρμα, και **καμία**
 * μετάπτωση δεν θα συνέβαινε — γιατί η δεύτερη απόπειρα δεν φτάνει ποτέ.
 *
 * 🔑 Χωρίς όριο, η εφεδρεία είναι διακοσμητική: η συνηθέστερη βλάβη παρόχου δεν
 * είναι το «όχι», είναι η **σιωπή**.
 */
export const PROVIDER_TIMEOUT_MS = 20_000;

/**
 * Μία απόπειρα, **περιφραγμένη δύο φορές**: εξαίρεση **και** χρόνος.
 *
 * ⚠️ Ένας πάροχος που **πετά** δεν επιτρέπεται να ρίξει την αλυσίδα: αυτό ακριβώς
 * θα εμπόδιζε τον επόμενο κρίκο να δοκιμαστεί, δηλαδή θα ακύρωνε τον λόγο ύπαρξης
 * του module. Η εξαίρεση γίνεται **ονομασμένη απόρριψη**.
 */
async function attemptOne(
  provider: EmailProvider,
  message: OutboundEmail,
): Promise<ProviderAttempt> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      provider.send(message),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${provider.name}: timeout μετά από ${PROVIDER_TIMEOUT_MS}ms`)),
          PROVIDER_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (error) {
    return {
      kind: 'rejected',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Χωρίς αυτό, ένας γρήγορος πάροχος αφήνει ζωντανό χρονόμετρο και η διεργασία
    // Node **δεν τερματίζει** — σε cron σημαίνει εργασία που δεν κλείνει ποτέ.
    if (timer) clearTimeout(timer);
  }
}

/**
 * **Ποιοι κρίκοι υπάρχουν σήμερα;** — ώστε το «ένας μόνο πάροχος» να είναι
 * μετρήσιμο αντί για υπόθεση.
 *
 * Υπάρχει επειδή η διαφορά «η εφεδρεία δεν λειτούργησε» / «δεν υπήρχε εφεδρεία» δεν
 * φαίνεται από πουθενά αλλού, και είναι η διαφορά ανάμεσα σε βλάβη και σε ρύθμιση.
 */
export function describeChain(providers: readonly EmailProvider[]): {
  readonly configured: readonly string[];
  readonly missing: readonly string[];
  /** `false` όταν δεν υπάρχει **κανένας δεύτερος** κρίκος να σώσει. */
  readonly hasFailover: boolean;
} {
  const configured = providers.filter((provider) => provider.configured).map((p) => p.name);
  const missing = providers.filter((provider) => !provider.configured).map((p) => p.name);
  return { configured, missing, hasFailover: configured.length >= 2 };
}
