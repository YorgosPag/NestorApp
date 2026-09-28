import 'server-only';

/**
 * @fileoverview SSoT — **τεμπέλικη, μία-φορά ανάγνωση ενός παράγωγου JSON του
 * `public/data` ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ**, με ρητή κατάσταση άγνοιας.
 * @related lib/data/lazy-json-snapshot.ts (**ο δίδυμος του περιηγητή**) ·
 *   services/places/administrative-hierarchy.reader.ts ·
 *   services/places/admin-footprints.reader.ts · ADR-846 §9 #13
 * @module lib/data/server-json-file
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΑΓΩΓΗ — ΚΑΙ ΓΙΑΤΙ **ΠΡΙΝ** ΓΡΑΦΤΕΙ Ο ΔΕΥΤΕΡΟΣ ΑΝΑΓΝΩΣΤΗΣ
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Ο μηχανισμός γεννήθηκε ιδιωτικός μέσα στο `administrative-hierarchy.reader.ts` —
 * module cache + **single-flight** υπόσχεση + `try/catch` που επιστρέφει `null` αντί να
 * πετάξει + `finally` που καθαρίζει την υπόσχεση ώστε η αποτυχία να μην κλειδώσει τη
 * διεργασία. **Τέσσερις** αποφάσεις, καμία προφανής — και **ακριβώς** οι ίδιες
 * τέσσερις που το `lazy-json-snapshot.ts` κατέγραψε για την πλευρά του περιηγητή.
 *
 * Η φάση §9 #13 χρειάστηκε τον **δεύτερο**: τα αποτυπώματα, από τη μεριά του
 * διακομιστή. Γραμμένος με το χέρι, θα ήταν το κλασικό **sibling clone του N.18** — και
 * το χειρότερο είδος του, γιατί οι τέσσερις αποφάσεις θα **απόκλιναν σιωπηλά**: ο
 * δεύτερος συγγραφέας θυμάται τις τρεις και ξεχνά τη μία, και η μία εμφανίζεται μήνες
 * μετά ως *«κάποιες φορές ο διακομιστής δεν βλέπει τα όρια»*.
 *
 * 🔑 **Το μάθημα ήταν ήδη γραμμένο, μία στρώση παραπάνω**: το `lazy-json-snapshot.ts`
 * εξήχθη **πριν** γραφτεί ο δεύτερος καταναλωτής του, με ρητή αιτιολογία. Εδώ
 * εφαρμόζεται το **ίδιο** πρότυπο στην **άλλη** πλευρά του σύρματος.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ `fs`, ΚΑΙ ΟΧΙ `fetch` Ή ΣΤΑΤΙΚΟ `import`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 **Το `fetch('/data/…')` ΔΕΝ δουλεύει στο Node** — σχετικό URL, δεν επιλύεται. Και
 * επειδή ο δίδυμος του περιηγητή **καταπίνει** την αποτυχία *(σωστά, για τη δική του
 * πλευρά)*, ένας γραφέας που τον καλούσε από τον διακομιστή θα έπαιρνε σιωπηλά **κενό
 * στιγμιότυπο** και θα έγραφε **«καμία απόδειξη» παντού, με όλα τα σήματα πράσινα**.
 *
 * Ένα **στατικό** `import` θα έδενε τα megabytes μέσα στο bundle **κάθε** διαδρομής που
 * αγγίζει έστω και έμμεσα το module — δηλαδή θα πλήρωνε ο κρύος χρόνος εκκίνησης
 * διαδρομών που **ποτέ** δεν ρωτούν. Με `fs` + module cache, το κόστος πληρώνεται
 * **μία φορά, από όποιον το ζήτησε**.
 *
 * ⚠️ Διαβάζεται το **δημόσιο** αντίγραφο *(`public/data/`)* — το ίδιο αρχείο που
 * κατεβάζει ο περιηγητής. **Μία αυθεντία για τα δύο μονοπάτια**: αν αποκλίνανε, ο
 * διακομιστής θα έκρινε πάνω σε δεδομένα που ο επισκέπτης δεν βλέπει ποτέ.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Ένα παράγωγο αρχείο του `public/data`, διαβασμένο **το πολύ μία φορά**. */
export interface ServerJsonFile<TSnapshot> {
  /**
   * Το στιγμιότυπο, ή `null`.
   *
   * ⚠️ **`null` = «ΔΕΝ ΜΠΟΡΕΣΑ ΝΑ ΡΩΤΗΣΩ», ΠΟΤΕ «είναι άδειο»** *(N.12)*. Ο καλών
   * οφείλει να το μεταφράσει σε *«δεν αποφασίζω»* — ποτέ σε *«καμία απόδειξη»*, που
   * είναι **διαφορετικό γεγονός** και γράφεται σε δημόσιο έγγραφο.
   */
  readonly read: () => Promise<TSnapshot | null>;
}

/** Ό,τι χρειάζεται για να οριστεί ένα τέτοιο αρχείο. */
export interface ServerJsonFileSpec<TSnapshot> {
  /** Τα τμήματα της διαδρομής **μέσα** στο `public/`, π.χ. `['data', 'x.json']`. */
  readonly publicPath: readonly string[];
  /**
   * Ωμό `unknown` → στιγμιότυπο. **Οφείλει να πετάξει** αν το σχήμα δεν είναι το
   * αναμενόμενο — ο έλεγχος σχήματος **δεν είναι τυπικότητα**: μισογραμμένο ή
   * μισοκατεβασμένο αρχείο περνά χαρούμενα το `JSON.parse` και σκάει αργότερα, αλλού.
   *
   * 🔑 **Δίνεται ο ΙΔΙΟΣ `build` με την πλευρά του περιηγητή** — αλλιώς οι δύο πλευρές
   * θα δέχονταν διαφορετικά σύνολα γραμμών από το **ίδιο byte**.
   */
  readonly build: (payload: unknown) => TSnapshot;
  /** Πώς αναφέρεται η αποτυχία. Ο καλών λογίζει με **το δικό του** όνομα module. */
  readonly onFailure: (error: unknown) => void;
}

/**
 * Φτιάχνει τον τεμπέλη αναγνώστη ενός παράγωγου JSON, από τη μεριά του διακομιστή.
 *
 * 🔑 **Η κατάσταση ζει σε ΚΛΕΙΣΤΗ (closure), όχι σε μεταβλητές module** — ίδια απόφαση
 * με τον δίδυμο του περιηγητή: δύο διαφορετικά αρχεία δεν μπορούν να μοιραστούν κατά
 * λάθος cache, και η ίδια μηχανή στήνεται δεύτερη φορά σε test χωρίς να «θυμάται».
 *
 * ⚠️ **Το cache ζει όσο η διεργασία.** Τα παράγωγα αρχεία αλλάζουν με **build**, ή —
 * για την ιεραρχία — με **διοικητική μεταρρύθμιση**. Καμία από τις δύο δεν συμβαίνει
 * ενόσω τρέχει ο διακομιστής.
 */
export function createServerJsonFile<TSnapshot>(
  spec: ServerJsonFileSpec<TSnapshot>,
): ServerJsonFile<TSnapshot> {
  let cached: TSnapshot | null = null;
  let inFlight: Promise<TSnapshot | null> | null = null;

  async function read(): Promise<TSnapshot | null> {
    if (cached !== null) return cached;
    if (inFlight !== null) return inFlight;

    inFlight = (async () => {
      try {
        const filePath = path.join(process.cwd(), 'public', ...spec.publicPath);
        cached = spec.build(JSON.parse(await readFile(filePath, 'utf8')));
        return cached;
      } catch (error) {
        // ⚠️ **Δεν γράφεται ΤΙΠΟΤΑ στο cache** — έτσι το επόμενο αίτημα **ξαναρωτά**,
        //    αντί να κληρονομήσει την αποτυχία για όλη τη ζωή της διεργασίας.
        spec.onFailure(error);
        return null;
      } finally {
        // 🔑 **Καθαρίζεται ΠΑΝΤΑ** — και σε επιτυχία και σε αποτυχία. Χωρίς αυτό, κάθε
        //    επόμενος καλών θα περίμενε την **ίδια αποτυχημένη** υπόσχεση.
        inFlight = null;
      }
    })();

    return inFlight;
  }

  return { read };
}

/** Μια **οικογένεια** αρχείων ανά κλειδί (ένα ανά περιοχή), με φραγμένη μνήμη. */
export interface KeyedServerJsonFiles<TSnapshot> {
  readonly read: (key: string) => Promise<TSnapshot | null>;
}

/**
 * **Ένα αρχείο ανά κλειδί, με LRU** — για τις οικογένειες του `public/data` που δεν χωρούν ολόκληρες
 * στη διεργασία (όρια ADR-883: 7.432 αρχεία · τιμές συμβολαίων ADR-889: 1.000).
 *
 * 🔑 Γεννήθηκε ιδιωτικό μέσα στο `admin-boundaries.reader.ts` και εξήχθη όταν ήρθε ο **δεύτερος**
 * καταναλωτής (ADR-889 Φ2) — N.0.2. Η σειρά εισαγωγής του `Map` **είναι** η σειρά χρήσης: κάθε
 * ανάγνωση μετακινεί το κλειδί στο τέλος, και η υπέρβαση πετά το πρώτο.
 */
export function createKeyedServerJsonFiles<TSnapshot>(
  maxEntries: number,
  specOf: (key: string) => ServerJsonFileSpec<TSnapshot>,
): KeyedServerJsonFiles<TSnapshot> {
  const files = new Map<string, ServerJsonFile<TSnapshot>>();

  function fileOf(key: string): ServerJsonFile<TSnapshot> {
    const existing = files.get(key);
    if (existing !== undefined) {
      files.delete(key);
      files.set(key, existing);
      return existing;
    }
    const file = createServerJsonFile(specOf(key));
    files.set(key, file);
    if (files.size > maxEntries) {
      const oldest = files.keys().next().value;
      if (oldest !== undefined) files.delete(oldest);
    }
    return file;
  }

  return { read: (key) => fileOf(key).read() };
}

/**
 * **Αναγνώστης σχήματος (`T | null`) → `build` που ΠΕΤΑ** — ώστε ένα αρχείο παλιού σχήματος να καταλήγει στο
 * `onFailure` (και στο `null` = «δεν ξέρω»), ποτέ σε σιωπηλά λάθος στιγμιότυπο.
 * 🔑 Εξήχθη από το `market-transactions.reader.ts` όταν ήρθε δεύτερος καταναλωτής (ADR-889 Φ5, ζώνες) — N.0.2.
 */
export function strictJsonShape<T>(read: (payload: unknown) => T | null, what: string): (payload: unknown) => T {
  return (payload) => {
    const value = read(payload);
    if (value === null) throw new TypeError(`${what}: μη αναμενόμενο σχήμα`);
    return value;
  };
}

/** `onFailure` που γράφει **προειδοποίηση** με το μήνυμα του σφάλματος (και ό,τι πλαίσιο δώσει ο καλών). */
export function warnOnJsonFailure(
  logger: { readonly warn: (message: string, meta: Record<string, string>) => void },
  message: string,
  extra: Record<string, string> = {},
): (error: unknown) => void {
  return (error) => logger.warn(message, { ...extra, error: error instanceof Error ? error.message : String(error) });
}
