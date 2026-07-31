/**
 * =============================================================================
 * ΤΥΠΟΙ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΜΟΥ — ADR-739
 * =============================================================================
 *
 * Το σχήμα μιας προγραμματισμένης εργασίας. Η *λίστα* ζει στο
 * `src/config/cron-schedule.ts`· εδώ μένει μόνο το συμβόλαιο.
 *
 * Σχεδιαστική αρχή: **μια δήλωση, τρεις καταναλωτές.** Η ίδια εγγραφή τροφοδοτεί
 * (α) τον dispatcher που αποφασίζει τι οφείλεται, (β) το Sentry monitor που
 * χτυπά καμπανάκι όταν κάτι *δεν* έτρεξε, και (γ) τα tests που επιβάλλουν ότι
 * κάθε route είναι δηλωμένο. Αν το πρόγραμμα ζούσε χωριστά από τη ρύθμιση του
 * συναγερμού, θα μπορούσαν να αποκλίνουν — και η απόκλιση θα ήταν αόρατη ακριβώς
 * όσο ήταν και η τριμηνη σιωπή που γέννησε αυτό το ADR.
 *
 * @module types/cron-schedule
 * @see ADR-739
 */

/** Αποτέλεσμα εκτέλεσης — ό,τι επιστρέφει η συνάρτηση ενός job. */
export interface CronJobResult {
  /** Σύντομη περιγραφή για log/Sentry — π.χ. `purged 4, skipped 1`. */
  readonly summary: string;
  /** Ελεύθερα αριθμητικά μεγέθη (purged, sent, deleted…) για παρατηρησιμότητα. */
  readonly metrics?: Readonly<Record<string, number>>;
}

/** Η εκτελέσιμη μορφή ενός job: καθαρή συνάρτηση, χωρίς HTTP. */
export type CronJobRunner = () => Promise<CronJobResult>;

/**
 * Γιατί ένα δηλωμένο job δεν είναι ενεργό.
 *
 * Είναι **απαιτούμενο** όταν `enabled === false`: ένα ανενεργό job χωρίς αιτία
 * είναι δυσδιάκριτο από ένα ξεχασμένο job, και η διάκριση αυτή είναι ακριβώς το
 * σφάλμα που κράτησε τρεις μήνες.
 */
export type CronDisabledReason =
  /** Αντικαταστάθηκε από άλλο job — δες `supersededBy`. */
  | 'superseded'
  /** Δεν προγραμματίστηκε ποτέ· συμπεριφορά σε παραγωγή άγνωστη. */
  | 'never-scheduled'
  /** Προσωρινά ανενεργό με ρητή απόφαση. */
  | 'paused';

/** Κοινά πεδία, ανεξαρτήτως ενεργού/ανενεργού. */
interface CronJobBase {
  /**
   * Σταθερό αναγνωριστικό. Είναι **και** το `monitorSlug` του Sentry **και** το
   * κλειδί του lease στη Firestore. Αλλαγή του σπάει το ιστορικό του monitor και
   * ελευθερώνει το παλιό lease — μην το μετονομάσεις για αισθητικούς λόγους.
   */
  readonly slug: string;
  /** Το αντίστοιχο route, για χειροκίνητη ενεργοποίηση και για το test εξαντλητικότητας. */
  readonly path: `/api/cron/${string}`;
  /** Τι κάνει, σε μία γραμμή. Φαίνεται στα logs και στο ADR. */
  readonly description: string;
}

/** Ενεργό job: έχει ώρα, ζώνη, όρια και εκτελέσιμο σώμα. */
interface CronJobEnabled extends CronJobBase {
  readonly enabled: true;
  /** Έκφραση cron 5 πεδίων, στη ζώνη `timezone`. */
  readonly schedule: string;
  /**
   * Ζώνη ώρας IANA. Δηλώνεται **ρητά** σε κάθε εγγραφή αντί να κληρονομείται:
   * μια σιωπηρή προεπιλογή σημαίνει ότι η απάντηση στο «τι ώρα τρέχει;» εξαρτάται
   * από τη ρύθμιση του container — δηλαδή δεν είναι στο git.
   */
  readonly timezone: string;
  /** Ανοχή καθυστέρησης πριν το Sentry το θεωρήσει χαμένο (λεπτά). */
  readonly checkinMarginMinutes: number;
  /** Μέγιστη διάρκεια πριν το Sentry το θεωρήσει κολλημένο (λεπτά). */
  readonly maxRuntimeMinutes: number;
  /**
   * Πόσο κρατά το lease. Πρέπει να είναι **≥ `maxRuntimeMinutes`**, αλλιώς το
   * lease λήγει ενώ το job ακόμη τρέχει και ένα επόμενο tick το ξαναρχίζει.
   * Επιβάλλεται από test.
   */
  readonly leaseMinutes: number;
  /** Το σώμα της εργασίας. Καθαρή συνάρτηση — ο dispatcher δεν κάνει HTTP. */
  readonly run: CronJobRunner;
}

/** Ανενεργό job: δηλωμένο και ορατό, αλλά δεν εκτελείται. */
interface CronJobDisabled extends CronJobBase {
  readonly enabled: false;
  readonly disabledReason: CronDisabledReason;
  /** Ποιο job το αντικατέστησε (όταν `disabledReason === 'superseded'`). */
  readonly supersededBy?: string;
  /** Τι πρέπει να ισχύσει για να ενεργοποιηθεί. Γραμμένο για άνθρωπο. */
  readonly reactivateWhen: string;
}

/**
 * Μια εγγραφή προγράμματος.
 *
 * Διακριτή ένωση σκόπιμα: το `run` υπάρχει **μόνο** στα ενεργά. Έτσι ο
 * μεταγλωττιστής απαγορεύει την εκτέλεση ενός ανενεργού job — δεν χρειάζεται
 * έλεγχος στον dispatcher που θα μπορούσε να ξεχαστεί.
 */
export type CronJobDefinition = CronJobEnabled | CronJobDisabled;

/** Στένωση τύπου για ενεργά jobs. */
export function isEnabledCronJob(
  job: CronJobDefinition
): job is CronJobEnabled {
  return job.enabled;
}

/** Κατάσταση εκτέλεσης, όπως αποθηκεύεται ανά job στη Firestore. */
export interface CronJobState {
  readonly slug: string;
  /** Πότε ολοκληρώθηκε **επιτυχώς** τελευταία φορά (ISO). Οδηγεί το catch-up. */
  readonly lastSuccessAt: string | null;
  /** Πότε ξεκίνησε η τελευταία απόπειρα (ISO). */
  readonly lastAttemptAt: string | null;
  /** Μέχρι πότε ισχύει το τρέχον lease (ISO). `null` = ελεύθερο. */
  readonly leaseExpiresAt: string | null;
  /** Ποιος κρατά το lease — για διάγνωση, όχι για ορθότητα. */
  readonly leaseOwner: string | null;
  /** Διαδοχικές αποτυχίες· μηδενίζεται στην επιτυχία. */
  readonly consecutiveFailures: number;
  /** Μήνυμα της τελευταίας αποτυχίας. */
  readonly lastError: string | null;
}

/** Έκβαση μιας απόπειρας εκτέλεσης, όπως την αναφέρει ο dispatcher. */
export type CronRunOutcome =
  | { readonly slug: string; readonly status: 'success'; readonly durationMs: number; readonly summary: string }
  | { readonly slug: string; readonly status: 'failed'; readonly durationMs: number; readonly error: string }
  /** Άλλος το κρατά — φυσιολογικό, όχι σφάλμα. */
  | { readonly slug: string; readonly status: 'skipped-locked' };

/** Συγκεντρωτική απάντηση του `/api/cron/dispatch`. */
export interface CronDispatchReport {
  /** Η στιγμή που αξιολογήθηκε το πρόγραμμα (ISO). */
  readonly tickAt: string;
  /** Slugs που κρίθηκαν οφειλόμενα σε αυτό το tick. */
  readonly due: readonly string[];
  readonly outcomes: readonly CronRunOutcome[];
  readonly durationMs: number;
}
