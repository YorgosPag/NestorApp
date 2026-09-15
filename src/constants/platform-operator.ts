/**
 * =============================================================================
 * Ο ΦΟΡΕΑΣ ΤΗΣ ΠΛΑΤΦΟΡΜΑΣ — «ποιος είναι υπεύθυνος για αυτή την υπηρεσία;» (ADR-861)
 * =============================================================================
 *
 * **Μηδέν εξαρτήσεις. Καμία εισαγωγή.** Ίδιο σχήμα με τη ρίζα του ονόματος
 * (`product-identity.ts`, ADR-857) και για τον ίδιο λόγο: τα στοιχεία του φορέα τα
 * χρειάζονται οι νομικές σελίδες, τα email, η **εκκίνηση του διακομιστή** και τα cron.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΕΛΕΙΠΕ ΑΠΟ ΟΛΟ ΤΟ ΔΕΝΤΡΟ (grep 2026-09-15)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δύο κείμενα νόμου ζητούν την ίδια «ταμπέλα», **ανεξάρτητα** το ένα από το άλλο:
 * - **ΓΚΠΔ άρθ. 13(1)(α)** — ταυτότητα **και** στοιχεία επικοινωνίας του υπευθύνου επεξεργασίας·
 * - **Π.Δ. 131/2003 άρθ. 4** — επωνυμία · γεωγραφική διεύθυνση · email · ΓΕΜΗ · ΑΦΜ, σε **όλο** τον ιστότοπο.
 *
 * Ο κώδικας είχε μόνο ένα email στο `legal.json` και τη διεύθυνση αποστολής email.
 * Καμία διεύθυνση, κανένας ΑΦΜ, κανένας υπεύθυνος (ADR-841 Α23.13 §3β).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΙΣΤΟΡΙΚΟ ΜΕ ΗΜΕΡΟΜΗΝΙΕΣ, ΟΧΙ ΤΙΜΗ — Η ΜΕΤΑΒΙΒΑΣΗ ΕΙΝΑΙ ΣΥΜΒΑΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο φορέας είναι σήμερα φυσικό πρόσωπο και **μπορεί να μεταβιβαστεί** (απόφαση Giorgio
 * 2026-09-15). Οι μεγάλοι ξαναγράφουν το κείμενο της πολιτικής όταν αλλάζει οντότητα.
 * Εδώ η αλλαγή είναι **νέα γραμμή με `effectiveFrom`** και η παλιά **μένει**, ώστε κάθε
 * παλιά έκδοση νομικού εγγράφου να μπορεί να δείξει **τον φορέα που ίσχυε τότε** (ADR-861 Φ3).
 *
 * ⛔ **ΠΟΤΕ επεξεργασία παλιάς γραμμής.** Διόρθωση λάθους σε ισχύουσα γραμμή = νέα γραμμή
 * με σημερινή ημερομηνία. Η παλιά γραμμή είναι ό,τι **δημοσιεύτηκε**.
 * ⛔ **ΠΟΤΕ πλαστά ή «ενδεικτικά» στοιχεία.** Άδειο ιστορικό ⇒ `pending`, και η εφαρμογή
 * **αρνείται** δημόσιο άνοιγμα (`lib/environment/environment-startup.ts`).
 *
 * ⚠️ **Τα στοιχεία είναι δημόσια εκ του νόμου** (Π.Δ. 131/2003) και δόθηκαν από τον ίδιο τον
 * φορέα για δημοσίευση. Γι' αυτό ζουν στο git και όχι σε μεταβλητή περιβάλλοντος: μεταβλητή
 * **έξω από το git** θα ήταν «ταμπέλα» που καμία πύλη και κανένα ιστορικό δεν βλέπει.
 *
 * @module constants/platform-operator
 * @see ADR-861 — η απόφαση, οι φέτες και τα δηλωμένα όρια
 */

/** Ημερολογιακή μέρα `YYYY-MM-DD` — λεξικογραφική σύγκριση = χρονολογική. */
export type CalendarDay = string;

/**
 * **Ποιος** — φυσικό ή νομικό πρόσωπο. Διακριτή ένωση, ποτέ προαιρετικά πεδία: μια εταιρεία
 * χωρίς νομική μορφή ή ένα φυσικό πρόσωπο με «νομική μορφή» είναι αδύνατα **στον τύπο**.
 */
export type OperatorIdentity =
  | {
      readonly kind: 'natural-person';
      readonly fullName: string;
      /** Διακριτικός τίτλος, αν υπάρχει — `null` όταν δεν έχει δηλωθεί. */
      readonly tradeName: string | null;
    }
  | {
      readonly kind: 'legal-entity';
      readonly legalName: string;
      /** π.χ. ΙΚΕ · ΟΕ · ΑΕ — όπως στο ΓΕΜΗ. */
      readonly legalForm: string;
    };

/**
 * Η γεωγραφική διεύθυνση που **δημοσιεύεται** (Π.Δ. 131/2003).
 *
 * ⚠️ Τα ονόματα πεδίων είναι του `ProjectAddress` (`street` · `number` · `postalCode` · `city` ·
 * `country`) — **κανένα** πεδίο ταυτότητας διοικητικής ιεραρχίας (`…Id`), άρα **δεν** είναι
 * έκτο λεξιλόγιο διευθύνσεων (CHECK 3.44 / ADR-772). Είναι ταχυδρομική γραμμή, όχι γεωαναφορά.
 */
export interface OperatorSeat {
  readonly street: string;
  readonly number: string;
  readonly postalCode: string;
  readonly city: string;
  /** ISO 3166-1 alpha-2 — το όνομα της χώρας το αποδίδει το i18n, ποτέ η ρίζα. */
  readonly country: string;
}

/**
 * Ένα γραμματοκιβώτιο **και η απόδειξη ότι το διαβάζει άνθρωπος**.
 *
 * 🔴 **Γιατί η επιβεβαίωση είναι πεδίο και όχι υπόθεση**: το `nestorconstruct.gr` έχει MX τον
 * Mailgun (μετρημένο 2026-09-15), που **δεν** έχει γραμματοκιβώτια — μήνυμα φτάνει σε άνθρωπο
 * μόνο αν υπάρχει κανόνας προώθησης, και ο μόνος γνωστός (`inbound@`) πάει στο CRM. Μια
 * διεύθυνση απορρήτου που δεν διαβάζεται είναι **άγραφη ταμπέλα με άλλη μορφή**: η προθεσμία
 * απάντησης σε αίτημα υποκειμένου (ΓΚΠΔ άρθ. 12(3), ένας μήνας) τρέχει χωρίς να το ξέρει κανείς.
 */
export interface OperatorMailbox {
  readonly address: string;
  /** Μέρα που **επιβεβαιώθηκε** ότι μήνυμα προς αυτή τη διεύθυνση έφτασε σε άνθρωπο· `null` = όχι ακόμα. */
  readonly receivingConfirmedOn: CalendarDay | null;
}

/** Μία γραμμή του ιστορικού: ποιος ήταν ο φορέας **από** αυτή τη μέρα. */
export interface OperatorRecord {
  readonly effectiveFrom: CalendarDay;
  readonly identity: OperatorIdentity;
  readonly seat: OperatorSeat;
  readonly vatNumber: string;
  /** `null` = δεν υπάρχει εγγραφή στο ΓΕΜΗ (π.χ. φυσικό πρόσωπο χωρίς επιχείρηση). */
  readonly gemiNumber: string | null;
  /** Γενική επικοινωνία (Π.Δ. 131/2003). */
  readonly contact: OperatorMailbox;
  /** Σημείο επαφής για το απόρρητο — **όχι** DPO: δεν απαιτείται (ΓΚΠΔ άρθ. 37 · ν. 4624/2019 άρθ. 6–8). */
  readonly privacy: OperatorMailbox;
}

/** Η απάντηση στο «ποιος ήταν ο φορέας εκείνη τη μέρα;». **Ονομασμένη, ποτέ `null`.** */
export type OperatorStanding =
  | { readonly kind: 'declared'; readonly record: OperatorRecord }
  | { readonly kind: 'pending' };

/**
 * 🔑 **ΤΟ ΙΣΤΟΡΙΚΟ — append-only.** Νέος φορέας ή διόρθωση ⇒ **νέα γραμμή στο τέλος**.
 *
 * Γραμμή 1: στοιχεία που έδωσε ο ίδιος ο φορέας, 2026-09-15.
 */
export const PLATFORM_OPERATORS: readonly OperatorRecord[] = [
  {
    effectiveFrom: '2026-09-15',
    identity: { kind: 'natural-person', fullName: 'Γεώργιος Παγώνης', tradeName: null },
    seat: { street: 'Σαμοθράκης', number: '16', postalCode: '56334', city: 'Θεσσαλονίκη', country: 'GR' },
    vatNumber: '040817944',
    gemiNumber: null,
    // Ο φορέας ζήτησε `privacy@` **αν λειτουργεί**, αλλιώς `info@`. Καμία από τις δύο δεν έχει
    // επιβεβαιωθεί ότι φτάνει σε άνθρωπο ⇒ η γνωστή διεύθυνση, **ανεπιβεβαίωτη**, και το δημόσιο
    // άνοιγμα αρνείται μέχρι να συμπληρωθεί το `receivingConfirmedOn`.
    contact: { address: 'info@nestorconstruct.gr', receivingConfirmedOn: null },
    privacy: { address: 'info@nestorconstruct.gr', receivingConfirmedOn: null },
  },
];

/**
 * Η ζώνη ώρας του φορέα — η «μέρα» μιας μεταβίβασης είναι **ελληνική** μέρα.
 *
 * ⚠️ Χωρίς αυτήν, μεταβίβαση «από 1 Οκτωβρίου» θα ίσχυε στις 03:00 ώρα Ελλάδας (μεσάνυχτα UTC)
 * και ο διακομιστής θα έδειχνε λάθος φορέα τρεις ώρες.
 */
export const OPERATOR_TIME_ZONE = 'Europe/Athens';

/** Η ημερολογιακή μέρα μιας στιγμής, **στη ζώνη του φορέα**. */
export function calendarDayOf(instant: Date, timeZone: string = OPERATOR_TIME_ZONE): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * **Ποιος ήταν ο φορέας εκείνη τη μέρα;** — η γραμμή με το **μεγαλύτερο** `effectiveFrom ≤ day`.
 *
 * ⚠️ Δεν υποθέτει ταξινομημένο ιστορικό: το «append-only» είναι κανόνας γραφής, όχι εγγύηση
 * σειράς. Τη σειρά την **ελέγχει** η κρίση ετοιμότητας (`lib/platform-operator/operator-readiness.ts`).
 */
export function operatorOn(
  day: CalendarDay,
  history: readonly OperatorRecord[] = PLATFORM_OPERATORS,
): OperatorStanding {
  let found: OperatorRecord | null = null;
  for (const record of history) {
    if (record.effectiveFrom > day) continue;
    if (found === null || record.effectiveFrom >= found.effectiveFrom) found = record;
  }
  return found === null ? { kind: 'pending' } : { kind: 'declared', record: found };
}
