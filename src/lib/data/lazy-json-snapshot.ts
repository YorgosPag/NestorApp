/**
 * @fileoverview SSoT — **τεμπέλικη, μία-φορά φόρτωση ενός παράγωγου JSON** από το
 * `public/data`, με ρητή κατάσταση άγνοιας.
 * @related hooks/useLazySnapshot.ts (το μισό που ξέρει από React) · ADR-846 Φ2.5
 * @module lib/data/lazy-json-snapshot
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΑΓΩΓΗ — ΚΑΙ ΓΙΑΤΙ **ΠΡΙΝ** ΓΡΑΦΤΕΙ Ο ΔΕΥΤΕΡΟΣ ΚΑΤΑΝΑΛΩΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο μηχανισμός γεννήθηκε ιδιωτικός μέσα στο `useAdministrativeHierarchy` — module
 * cache + **single-flight** υπόσχεση + `try/catch` που αφήνει το cache **άδειο** +
 * καθάρισμα της υπόσχεσης ώστε η αποτυχία να μην κλειδώνει τη σελίδα. Τέσσερις
 * αποφάσεις, καμία προφανής, **όλες** πληρωμένες με πραγματικό περιστατικό *(§6.2 του
 * handoff: άδειος επιλογέας σε κάθε κρύο φόρτωμα)*.
 *
 * Τα αποτυπώματα *(`lib/geo/admin-footprints.ts`)* είναι **ακριβώς** το ίδιο σχήμα:
 * παράγωγο αρχείο στο `public/data`, ένας αναγνώστης, «δεν φόρτωσε» = «δεν ξέρω».
 * Γραμμένο δεύτερη φορά, θα ήταν το κλασικό sibling clone του **N.18** — και το
 * χειρότερο είδος του, γιατί οι τέσσερις αποφάσεις θα **απόκλιναν σιωπηλά**: ο
 * δεύτερος συγγραφέας θυμάται τα τρία και ξεχνά το ένα, και το ένα εμφανίζεται μήνες
 * μετά ως «κάποιες φορές δεν φορτώνει».
 *
 * ⚠️ **Το `ssot:discover` ΔΕΝ θα το έπιανε** *(διαφορετικά ονόματα)*, ούτε το CHECK
 * 3.18 *(σαρώνει `-maxdepth 1` σε τρεις φακέλους — ούτε `hooks/`, ούτε `lib/geo/`)*.
 * Μόνο ο token-based `jscpd` θα το έβλεπε, **αφού** είχε γραφτεί. Άρα η εξαγωγή
 * γίνεται **πρώτη**, όχι ως καθάρισμα μετά.
 *
 * **Layering**: leaf — καμία εξάρτηση, ούτε React. Το μισό που ξέρει από React ζει
 * στο `hooks/useLazySnapshot.ts`, ώστε αυτό εδώ να μπορεί να κληθεί από οπουδήποτε.
 */

/**
 * Ένα παράγωγο αρχείο που φορτώνεται **το πολύ μία φορά** και διαβάζεται συγχρόνως.
 *
 * 🔑 **`peek()` και `load()` είναι ΞΕΧΩΡΙΣΤΑ επίτηδες.** Οι αναγνώστες *(π.χ.
 * `lineageIdsOf`, `footprintOf`)* είναι **σύγχρονες, καθαρές** συναρτήσεις που τις καλεί
 * ένας κριτής-φύλλο· δεν επιτρέπεται να γίνουν `async` επειδή τα δεδομένα τυχαίνει να
 * έρχονται από δίκτυο. Το `load()` το καλεί **μία** φορά όποιος έχει τον κύκλο ζωής (το
 * hook)· το `peek()` το καλούν **όλοι**, όποτε θέλουν.
 */
export interface LazyJsonSnapshot<TSnapshot> {
  /**
   * Το στιγμιότυπο αν έχει φορτωθεί **επιτυχώς**, αλλιώς `null`.
   *
   * ⚠️ **`null` = «δεν ξέρω», ΠΟΤΕ «είναι άδειο»** *(N.12)*. Καλύπτει και το «δεν
   * ρώτησα ακόμη» και το «ρώτησα και απέτυχε» — και οι δύο πρέπει να οδηγούν στην ίδια
   * συμπεριφορά: ο καταναλωτής **δεν αποφασίζει**.
   */
  readonly peek: () => TSnapshot | null;

  /**
   * Φορτώνει **μία** φορά. Ταυτόχρονοι καλούντες περιμένουν την **ίδια** υπόσχεση —
   * χωρίς αυτό, τρία components που προσαρτώνται μαζί κατεβάζουν το αρχείο τρεις φορές.
   */
  readonly load: () => Promise<void>;
}

/** Ό,τι χρειάζεται για να οριστεί ένα τέτοιο αρχείο. */
export interface LazyJsonSnapshotSpec<TSnapshot> {
  /** Η δημόσια διαδρομή, π.χ. `/data/admin-footprints.json`. */
  readonly url: string;
  /**
   * Ωμό `unknown` → στιγμιότυπο. **Οφείλει να πετάξει** αν το σχήμα δεν είναι το
   * αναμενόμενο.
   *
   * 🔴 **Ο έλεγχος σχήματος ΔΕΝ είναι τυπικότητα.** Ένα `fetch(...).json()` επιστρέφει
   * χαρούμενα τη σελίδα σφάλματος του διακομιστή ή το HTML fallback του SPA· ο επόμενος
   * βρόχος πετά `TypeError: … is not iterable` **μέσα σε render**, και ένα δημόσιο,
   * ανώνυμο component εξαφανίζεται. Συνέβη — δες `useAdministrativeHierarchy`.
   */
  readonly build: (payload: unknown) => TSnapshot;
  /** Πώς αναφέρεται η αποτυχία. Ο καλών λογίζει με **το δικό του** όνομα module. */
  readonly onFailure: (error: unknown) => void;
}

/**
 * Η **ίδια μηχανή** για στιγμιότυπο που δεν είναι ένα αρχείο — π.χ. σύνθεση από δύο άλλα
 * (ADR-883 §5.10: το όριο ενός οικισμού = ευρετήριο → όριο του γονέα). Το `produce` **πετά**
 * για «δεν ξέρω»· cache, single-flight και επανάληψη μετά από αποτυχία μένουν ΕΔΩ, μία φορά.
 */
export interface LazySnapshotSpec<TSnapshot> {
  readonly produce: () => Promise<TSnapshot>;
  readonly onFailure: (error: unknown) => void;
}

/**
 * Φτιάχνει τεμπέλη αναγνώστη από οποιαδήποτε ασύγχρονη παραγωγή.
 *
 * 🔑 **Η κατάσταση ζει σε ΚΛΕΙΣΤΗ (closure), όχι σε μεταβλητές module.** Έτσι δύο
 * διαφορετικές πηγές δεν μπορούν να μοιραστούν κατά λάθος cache, και η ίδια μηχανή
 * μπορεί να στηθεί δεύτερη φορά σε test χωρίς να «θυμάται» την προηγούμενη.
 */
export function createLazySnapshot<TSnapshot>(spec: LazySnapshotSpec<TSnapshot>): LazyJsonSnapshot<TSnapshot> {
  let cached: TSnapshot | null = null;
  let inFlight: Promise<void> | null = null;

  async function load(): Promise<void> {
    if (cached !== null) return;
    if (inFlight !== null) {
      await inFlight;
      return;
    }

    inFlight = (async () => {
      try {
        cached = await spec.produce();
      } catch (error) {
        // ⚠️ **Δεν γράφεται ΤΙΠΟΤΑ στο cache.** Έτσι μια επόμενη προσάρτηση
        //    **ξαναρωτά**, αντί να κληρονομήσει την αποτυχία για όλη τη ζωή της σελίδας.
        spec.onFailure(error);
      }
    })();

    await inFlight;
    // 🔑 **Καθαρίζεται ΠΑΝΤΑ** — και σε επιτυχία και σε αποτυχία. Χωρίς αυτό, κάθε
    //    επόμενος καλών θα περίμενε την **ίδια αποτυχημένη** υπόσχεση και δεν θα
    //    ξαναδοκίμαζε ποτέ.
    inFlight = null;
  }

  return { peek: () => cached, load };
}

/** Φτιάχνει τον τεμπέλη αναγνώστη ενός παράγωγου JSON — η συνηθισμένη περίπτωση. */
export function createLazyJsonSnapshot<TSnapshot>(
  spec: LazyJsonSnapshotSpec<TSnapshot>,
): LazyJsonSnapshot<TSnapshot> {
  return createLazySnapshot({
    produce: async () => {
      const response = await fetch(spec.url);
      return spec.build(await response.json());
    },
    onFailure: spec.onFailure,
  });
}
