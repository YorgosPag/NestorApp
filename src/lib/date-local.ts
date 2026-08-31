

/**
 * Current timestamp as ISO 8601 string.
 * Single source of truth for `new Date().toISOString()` — replaces every
 * scattered occurrence so we have ONE place to change if we ever need to
 * (a) inject a clock for tests, (b) switch to a monotonic source, or
 * (c) normalise timezone handling.
 *
 * @see ADR-314 Phase C.1
 */
export const nowISO = (): string => new Date().toISOString();

/**
 * **Σήμερα, ως ΗΜΕΡΟΛΟΓΙΑΚΗ ημερομηνία του χρήστη** — `YYYY-MM-DD`.
 *
 * 🔴 **ΔΕΝ είναι `nowISO().slice(0, 10)`, και η διαφορά είναι πραγματικό σφάλμα.**
 * Το `nowISO()` δίνει **UTC**· η Ελλάδα είναι UTC+2/+3. Άρα κάθε βράδυ, από τις
 * 21:00 (ή 22:00 με θερινή ώρα) μέχρι τα μεσάνυχτα, το κόψιμο δίνει την **επόμενη**
 * ημέρα — και ο άνθρωπος που ρωτά «τι υπάρχει **σήμερα**» παίρνει απάντηση για αύριο.
 *
 * 🔑 **Γιατί εδώ και όχι στον καταναλωτή**: το ADR-777 Α9 χρειάστηκε *«σημερινή
 * ημερομηνία ISO»* ως **ρητή παράμετρο** της μηχανής ταιριάσματος (η μηχανή είναι
 * καθαρή και **δεν διαβάζει ρολόι**). Γραμμένο στον καταναλωτή, θα ξαναγραφόταν σε
 * κάθε επόμενη οθόνη — και η πιθανότερη παραλλαγή είναι ακριβώς το λανθασμένο
 * `slice(0, 10)`. Το SSoT ημερομηνίας είναι **εδώ**· ο κανόνας το λέει ρητά.
 *
 * ⚠️ Χρησιμοποιεί τα **τοπικά** πεδία (`getFullYear`/`getMonth`/`getDate`), όχι
 * μορφοποίηση με locale: το `toLocaleDateString` αλλάζει **σειρά και διαχωριστικό**
 * ανά περιβάλλον, και το αποτέλεσμα εδώ οφείλει να είναι **ταξινομήσιμο ISO** —
 * το συγκρίνουν λεξικογραφικά οι άξονες χρόνου της ζήτησης (`from <= todayDate`).
 *
 * @see ADR-777 §7 Α9 — `matchDemandAgainstListing(demand, facts, todayDate)`
 */
export function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function normalizeToDate(val: unknown): Date | null {
  if (!val) return null;
  // Firestore Timestamp (client or admin SDK) — both expose toDate()
  const timestampCandidate = val as { toDate?: () => Date; toMillis?: () => number };
  if (timestampCandidate && typeof timestampCandidate.toDate === 'function') return timestampCandidate.toDate();
  // A Timestamp-like that exposes only toMillis(). Ένας ζωντανός Firestore
  // Timestamp έχει **και τα δύο**, οπότε το `toDate()` παραπάνω τον πιάνει πρώτο·
  // αυτός ο κλάδος υπάρχει για τους τύπους που δηλώνουν μόνο `{ toMillis(): number }`
  // (DXF overlays, BIM openings) και για test doubles.
  // ⚠️ ADR-218 §Phase 4: η **απουσία** αυτού του κλάδου ήταν η αιτία 6 από τους 11
  // τοπικούς κλώνους — δεν αντέγραφαν από τεμπελιά, ο SSoT δεν διάβαζε το σχήμα τους.
  if (timestampCandidate && typeof timestampCandidate.toMillis === 'function') {
    const fromMillis = new Date(timestampCandidate.toMillis());
    return isNaN(fromMillis.getTime()) ? null : fromMillis;
  }
  // JS Date
  if (val instanceof Date) return val;
  // A Timestamp that has been through JSON.stringify. The client SDK serialises
  // to { seconds, nanoseconds }; the Admin SDK has no toJSON() at all and its
  // private fields leak out as { _seconds, _nanoseconds }. Both arrive here as
  // plain objects with no methods, so they must be read structurally.
  const secondsCandidate = val as { seconds?: unknown; _seconds?: unknown };
  const seconds =
    typeof secondsCandidate.seconds === 'number'
      ? secondsCandidate.seconds
      : typeof secondsCandidate._seconds === 'number'
        ? secondsCandidate._seconds
        : null;
  if (seconds !== null) {
    const fromSeconds = new Date(seconds * 1000);
    return isNaN(fromSeconds.getTime()) ? null : fromSeconds;
  }
  // ISO string / epoch
  const d = new Date(val as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Timestamp / Date / string / number → ISO string, or null.
 * Single source of truth for Firestore timestamp → string conversion.
 * @see ADR-218
 */
export function normalizeToISO(val: unknown): string | null {
  const d = normalizeToDate(val);
  return d ? d.toISOString() : null;
}

/**
 * Extract a Firestore document field as ISO string.
 * Replaces scattered `getTimestampString()` / `toISOStringOrPassthrough()` helpers.
 * @see ADR-218
 */
export function fieldToISO(
  data: Record<string, unknown>,
  field: string,
  fallback?: string
): string {
  return normalizeToISO(data[field]) ?? (fallback ?? '');
}

/** Ένα εικοσιτετράωρο σε χιλιοστά του δευτερολέπτου. */
export const MS_PER_DAY = 86_400_000;

/**
 * **Πρόσθεσε ΜΗΝΕΣ σε μια στιγμή** — με τη σύμβαση που περιμένει ο άνθρωπος και
 * απαιτεί ο νόμος: *«η ίδια μέρα του μήνα, ή η **τελευταία** αν δεν υπάρχει»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ `d.setMonth(d.getMonth() + n)` — **ΚΑΙ ΤΟ ΕΡΓΟ ΤΟ ΓΡΑΦΕΙ ΗΔΗ ΤΡΕΙΣ ΦΟΡΕΣ ΕΤΣΙ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ωμός τελεστής **ξεχειλίζει σιωπηλά**: *31 Ιανουαρίου + 1 μήνας* γίνεται
 * **3 Μαρτίου** (ο Φεβρουάριος δεν έχει 31, οπότε ο κατασκευαστής «κυλά» τις
 * περισσευούμενες ημέρες στον επόμενο μήνα). Δεν πετάει, δεν προειδοποιεί — απλώς
 * δίνει ημερομηνία **δύο ή τριών ημερών αργότερα** από τη συμφωνημένη.
 *
 * ⚠️ **Σε προθεσμία που ορίζει ΝΟΜΟΣ αυτό δεν είναι ανακρίβεια, είναι παράβαση.**
 * Αποκλειστική εντολή **οκτώ μηνών** που ξεκινά **30 Ιουνίου** οφείλει να λήγει
 * **28/29 Φεβρουαρίου**· ο ωμός τελεστής ζητά «30 Φεβρουαρίου» και δίνει **2 Μαρτίου**.
 * Το πλαφόν των 8 μηνών γίνεται **8 μήνες και δύο ημέρες** — αόρατα, και ακριβώς
 * στις εντολές που ξεκινούν στο τέλος του μήνα. Ο έλεγχος που υποτίθεται ότι
 * **φυλάει** το όριο θα το **παραβίαζε ο ίδιος**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΔΙΠΛΟΤΥΠΟ (N.0.2, 2026-08-29):** `lib/counterproposal-engine.ts:35` ·
 * `lib/draw-schedule-engine.ts:29` · `lib/auth/audit-policy.ts:170` — **τρεις**
 * υλοποιήσεις, **και οι τρεις με το σφάλμα ξεχείλισης**. Δεν μεταναστεύουν σε αυτό
 * το commit επίτηδες: το σωστό κόψιμο **αλλάζει αριθμούς** σε δύο οικονομικές μηχανές
 * (χρονοδιάγραμμα εκταμιεύσεων · αντιπροτάσεις), δηλαδή είναι αλλαγή **συμπεριφοράς**
 * που χρειάζεται δικές της άγκυρες. Καταγράφηκαν στο `.claude-rules/pending-ratchet-work.md`.
 * **Αυτό εδώ δεν είναι τέταρτο αντίγραφο — είναι ο κανονικός τόπος όπου θα δείξουν οι τρεις**
 * *(ίδια κίνηση με το `lib/contacts/primary-email.ts`)*.
 *
 * 🔑 **UTC, όχι τοπική ώρα**, και είναι η ίδια απόφαση με το {@link nowISO}: μια
 * συμβατική προθεσμία δεν μετακινείται επειδή άλλαξε η θερινή ώρα στο ενδιάμεσο.
 *
 * @param iso — η αφετηρία ως ISO στιγμή. Μη αναγνώσιμη τιμή ⇒ `null`, ποτέ `NaN`
 *   που ταξιδεύει *(ίδιο δόγμα με το {@link normalizeToMillisOrNull})*.
 * @param months — ακέραιος· αρνητικός επιτρέπεται (αφαίρεση).
 */
export function addMonthsUTC(iso: string, months: number): string | null {
  const start = normalizeToDate(iso);
  if (start === null || !Number.isInteger(months)) return null;

  const day = start.getUTCDate();
  // 🔑 Στην **1η** του μήνα καμία ημερομηνία δεν ξεχειλίζει — κάθε μήνας έχει 1η.
  //    Μετακινούμε πρώτα τον μήνα με ασφάλεια, και **μετά** βάζουμε την ημέρα.
  const moved = new Date(start.getTime());
  moved.setUTCDate(1);
  moved.setUTCMonth(moved.getUTCMonth() + months);

  const lastDayOfTarget = new Date(
    Date.UTC(moved.getUTCFullYear(), moved.getUTCMonth() + 1, 0),
  ).getUTCDate();

  moved.setUTCDate(Math.min(day, lastDayOfTarget));
  return moved.toISOString();
}

/**
 * Timestamp / Date / string / number → epoch millis, ή `null` όταν η τιμή **δεν
 * είναι αναγνώσιμη χρονική στιγμή**.
 *
 * Αυτή είναι η **μοναδική** συνάρτηση του module που επιστρέφει ωμά millis. Ο
 * τύπος `number | null` είναι σκόπιμος: ο compiler αναγκάζει τον καλούντα να
 * απαντήσει «τι κάνω όταν δεν ξέρω;» στο σημείο κλήσης. Ένα sentinel μέσα στο
 * `number` (`0` ή `NaN`) **δεν** το κάνει αυτό — και οι δύο περνούν αθόρυβα από
 * κάθε gate που έχει το repo.
 *
 * Αν αυτό που θέλεις είναι **ταξινόμηση**, μην καλέσεις αυτή· κάλεσε
 * {@link compareInstantsDesc} / {@link compareInstantsAsc}. Δεν χρειάζεσαι τον
 * αριθμό, χρειάζεσαι τη σειρά — και ο comparator δεν εκθέτει sentinel καθόλου.
 *
 * @see ADR-218 §Phase 4 — γιατί έφυγε το `normalizeToMillis` που επέστρεφε `0`
 */
export function normalizeToMillisOrNull(val: unknown): number | null {
  return normalizeToDate(val)?.getTime() ?? null;
}

/**
 * **ΤΙ ΕΙΔΟΥΣ ΖΕΥΓΟΣ ΕΙΝΑΙ ΑΥΤΟ;** — το σχήμα ενός διαστήματος, ως **όνομα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΛΕΞΙΛΟΓΙΟ ΚΑΙ ΟΧΙ `boolean` — ΤΟ ΕΡΩΤΗΜΑ ΕΧΕΙ **ΤΕΣΣΕΡΙΣ** ΑΠΑΝΤΗΣΕΙΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `isValidInterval(): boolean` συγχωνεύει **τρεις διαφορετικές βλάβες** σε ένα
 * «όχι» — και οι τρεις έχουν **διαφορετική θεραπεία** για τον άνθρωπο:
 *
 * | Σχήμα | Τι σημαίνει | Τι κάνει ο άνθρωπος |
 * |---|---|---|
 * | `proper` | γνήσιο διάστημα (`από < ως`), ή **ανοιχτό** τέλος | τίποτα |
 * | `empty` | `από === ως` — **δεν καλύπτει καμία στιγμή** | **πρόσθεσε διάρκεια** |
 * | `reversed` | `ως < από` — **δεν περιγράφει διάστημα** | **αντίστρεψε τα άκρα** |
 * | `unreadable` | άκρο που δεν διαβάζεται ως στιγμή | **διόρθωσε τη μορφή** |
 *
 * Ίδιο σκεπτικό με το ζεύγος `mandate-expiry-past` / `mandate-term-exceeds-statute`:
 * ένας κοινός κωδικός θα έστελνε τον άνθρωπο να διορθώσει **λάθος πράγμα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 Η ΑΓΟΡΑ — ΜΕΤΡΗΜΕΝΗ 2026-08-31, ΚΑΙ **ΔΕΝ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟΝ ΕΑΥΤΟ ΤΗΣ**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Σύστημα | Τι κάνει με το κενό `[x,x)` | Πού το λέει |
 * |---|---|---|
 * | **SQL:2011** `PERIOD FOR` | **αδύνατο** — η δήλωση περιόδου προσθέτει *σιωπηρά* `CHECK (start < end)` | στη **δήλωση** |
 * | **PostgreSQL** range types | κανονικοποιείται σε `empty`· `empty && x` = **false**, πάντα | στη **γέννηση** |
 * | **Allen's interval algebra** | `[x,x)` είναι **παράνομο** διάστημα, εκτός φορμαλισμού | στον **ορισμό** |
 * | **Joda-Time** | 🔴 **ΑΣΥΝΕΠΕΣ, και τεκμηριωμένο ως τέτοιο** | **πουθενά** |
 *
 * 🔴 **Το Joda το γράφει με παραδείγματα**: `[09:00,10:00) overlaps [09:00,09:00)` =
 * **false** *(«abuts before»)* αλλά `[09:00,10:00) overlaps [09:30,09:30)` = **true**.
 * Δηλαδή **το ίδιο κενό διάστημα επικαλύπτεται ή όχι ανάλογα με το πού πέφτει**.
 *
 * ⚠️ **Και ο τύπος του Joda είναι ΑΚΡΙΒΩΣ ο τύπος που είχαμε** (`aFrom < bTo ∧ bFrom <
 * aTo`) — τον έχει αντιγράψει όλος ο κόσμος. Είναι **ακριβής για μη κενά** διαστήματα
 * και **απροσδιόριστος** για το κενό, γιατί προϋποθέτει `από < ως` και **κανείς δεν το
 * ελέγχει**. Το βρήκε άγκυρα της Φ2 (ADR-835 §16.3β).
 *
 * 🏆 **ΠΟΥ ΞΕΠΕΡΝΑΜΕ ΚΑΙ ΤΟΥΣ ΤΕΣΣΕΡΙΣ**: όλοι συμφωνούν ότι το κενό **δεν είναι
 * περίοδος** — και διαφωνούν μόνο στο **πού** το λένε. Η SQL:2011 το λέει αυτόματα
 * αλλά με **ένα boolean** *(ίδιο μήνυμα για «ανάποδο» και «μηδενικό»)*· η PostgreSQL
 * κανονικοποιεί **σιωπηλά** *(το `[4,4)` γίνεται `empty` χωρίς να το μάθει κανείς, και
 * ο `EXCLUDE` απλώς δεν πυροδοτεί — πρέπει να **θυμηθείς** το `CHECK (NOT isempty(…))`)*·
 * το Allen το κηρύσσει παράνομο χωρίς να πει τι να κάνεις με δεδομένο που **υπάρχει
 * ήδη**. Εδώ κάθε σχήμα έχει **όνομα**, το σύνολο είναι **κλειστό**, και ο τομέας
 * **δεν μεταγλωττίζεται** μέχρι να απαντήσει τι κάνει με το καθένα.
 */
export const INTERVAL_SHAPES = ['proper', 'empty', 'reversed', 'unreadable'] as const;

export type IntervalShape = (typeof INTERVAL_SHAPES)[number];

/** Το διάστημα διαβασμένο **μία** φορά: σχήμα + άκρα σε millis. Ο κοινός πυρήνας. */
interface ReadInterval {
  readonly shape: IntervalShape;
  /** Έγκυρο **μόνο** όταν `shape === 'proper'` ή `'empty'`. */
  readonly from: number;
  /** `Infinity` = ανοιχτό τέλος. Έγκυρο **μόνο** όταν `shape === 'proper'`/`'empty'`. */
  readonly to: number;
}

/**
 * 🔑 **Ο ΕΝΑΣ αναγνώστης** — τον μοιράζονται το {@link intervalShape} και το
 * {@link intervalsOverlap}, ώστε «τι είναι αυτό το ζεύγος» να απαντιέται **μία** φορά.
 * Δύο αναγνώστες θα ήταν δύο αλήθειες για το ίδιο δεδομένο (ADR-749).
 */
function readInterval(start: unknown, end: unknown): ReadInterval {
  const from = normalizeToMillisOrNull(start);
  if (from === null) return { shape: 'unreadable', from: NaN, to: NaN };

  // 🔑 `null`/`undefined` = «δεν λήγει» ⇒ `+Infinity`. Κάθε **άλλη** μη αναγνώσιμη
  //    τιμή είναι **βλάβη δεδομένου** — τα δύο δεν ισοπεδώνονται: «ανοιχτή σύμβαση»
  //    και «χαλασμένη ημερομηνία» έχουν εντελώς διαφορετική θεραπεία.
  const to = end === null || end === undefined ? Infinity : normalizeToMillisOrNull(end);
  if (to === null) return { shape: 'unreadable', from: NaN, to: NaN };

  if (to < from) return { shape: 'reversed', from, to };
  if (to === from) return { shape: 'empty', from, to };
  return { shape: 'proper', from, to };
}

/**
 * **Τι είδους διάστημα είναι αυτό το ζεύγος;** Δες {@link INTERVAL_SHAPES}.
 *
 * ⚠️ **Δεν κρίνει αν ΕΠΙΤΡΕΠΕΤΑΙ** — μόνο **τι είναι**. Το αν ένα `empty` είναι
 * σφάλμα το αποφασίζει ο **τομέας**: για μια εντολή μεσιτείας είναι *«αποκλειστικότητα
 * που δεν καλύπτει καμία μέρα»* ⇒ παραβίαση· για ένα φίλτρο αναζήτησης θα ήταν απλώς
 * «κανένα αποτέλεσμα». Ίδιο ιδίωμα με το `MandateConflictVerdict`: ο κριτής λέει **τι
 * βρήκε**, ο καλών λέει **τι σημαίνει**.
 */
export function intervalShape(start: unknown, end: unknown): IntervalShape {
  return readInterval(start, end).shape;
}

/**
 * **Επικαλύπτονται χρονικά αυτά τα δύο διαστήματα;** — ημι-ανοιχτά, `[έναρξη, λήξη)`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΗΜΙ-ΑΝΟΙΧΤΑ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΟΛΟ ΝΟΗΜΑ — ΟΧΙ ΛΕΠΤΟΛΟΓΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το τέλος **δεν ανήκει** στο διάστημα. Άρα δύο **διαδοχικές** συμβάσεις — η μία
 * λήγει ακριβώς τη στιγμή που η άλλη αρχίζει — **ΔΕΝ συγκρούονται**. Με κλειστά
 * διαστήματα (`<=`) θα συγκρούονταν σε **μία στιγμή**, και η διαδοχή θα ήταν αδύνατη:
 * ο ιδιοκτήτης θα έπρεπε να αφήσει κενό, χωρίς να μάθει ποτέ γιατί.
 *
 * 🔑 Είναι η σύμβαση του `tstzrange` της PostgreSQL (`[)` εξ ορισμού) και του
 * τελεστή `&&` που χρησιμοποιεί το `EXCLUDE USING GIST` — το ίδιο πρότυπο που
 * υλοποιεί ο κριτής εντολών (`lib/mandate/mandate-conflict.ts`).
 *
 * ⚠️ **Άγνωστη στιγμή ⇒ `null`, ΠΟΤΕ `false`.** Ένα `false` θα σήμαινε *«δεν
 * επικαλύπτονται»* — δηλαδή θα **επέτρεπε** τη σύγκρουση επειδή δεν μπορέσαμε να τη
 * διαβάσουμε. Το *«δεν ξέρω»* πρέπει να φτάσει στον καλούντα ώστε **εκείνος** να
 * αποφασίσει τι σημαίνει (N.12: *άγνωστο ≠ κενό*). Ίδιο δόγμα με το
 * {@link normalizeToMillisOrNull} και το `addMonthsUTC`.
 *
 * ⚠️ **Ανοιχτό τέλος**: `null`/`undefined` λήξη σημαίνει *«δεν λήγει»* — έγκυρη
 * είσοδος, όχι σφάλμα. Η **έναρξη** είναι πάντα υποχρεωτική: διάστημα χωρίς αρχή δεν
 * τοποθετείται στον χρόνο και δεν μπορεί να κριθεί.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΚΕΝΟ ΔΙΑΣΤΗΜΑ ΔΕΝ ΤΕΜΝΕΙ ΤΙΠΟΤΑ — **ΔΙΟΡΘΩΘΗΚΕ 2026-08-31** (ADR-835 Ε-10)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τότε αυτή η συνάρτηση είχε **τον τύπο του Joda-Time** *(`aFrom < bTo ∧ bFrom <
 * aTo`)*, που είναι ακριβής για **γνήσια** διαστήματα και **απροσδιόριστος** για το
 * κενό — και το αποτέλεσμα ήταν, μετρημένα, **ασυνεπές**:
 *
 * | `[12,12)` έναντι | Πριν | **Τώρα** |
 * |---|---|---|
 * | `[10,17)` — **μέσα** του | 🔴 `true` | ✅ `false` |
 * | `[12,17)` — στην **αρχή** του | `false` | ✅ `false` |
 * | `[10,12)` — στο **τέλος** του | `false` | ✅ `false` |
 *
 * ⚠️ **Δεν ήταν δικό μας λάθος — είναι το λάθος που αντέγραψε ο κόσμος.** Το Joda το
 * τεκμηριώνει με παραδείγματα: *«`[09:00,10:00)` overlaps `[09:00,09:00)` = false
 * (abuts before)`»* αλλά *«`[09:00,10:00)` overlaps `[09:30,09:30)` = **true**»*.
 * Η **PostgreSQL** κάνει το σωστό (`empty && x` = `false`, πάντα), και ο λόγος είναι
 * σκέτη θεωρία συνόλων: `∅ ∩ X = ∅`.
 *
 * 🔴 **ΚΑΙ ΓΙΑΤΙ `false`, ΟΧΙ `null`**: το `null` εδώ σημαίνει *«δεν μπόρεσα να
 * κρίνω»*. Το κενό διάστημα διαβάζεται **μια χαρά** και η απάντηση είναι **γνωστή**.
 * Ένα `null` θα έκανε το **γνωστό** άγνωστο — ο N.12 ανάποδα. Το *«μηδενική διάρκεια
 * δεν επιτρέπεται»* είναι κρίση **του τομέα**, όχι της άλγεβρας: το λέει το
 * {@link intervalShape}, και το επιβάλλουν τα invariants (`mandate-term-empty`).
 *
 * @returns `true` αν μοιράζονται **έστω μία στιγμή**· `false` αν όχι — **και πάντα**
 *   όταν κάποιο από τα δύο είναι **κενό**· `null` αν κάποιο άκρο δεν διαβάζεται, ή αν
 *   κάποιο διάστημα είναι **ανάποδο** — δεδομένο που δεν περιγράφει διάστημα και δεν
 *   πρέπει να κριθεί σιωπηλά.
 */
export function intervalsOverlap(
  aStart: unknown,
  aEnd: unknown,
  bStart: unknown,
  bEnd: unknown,
): boolean | null {
  const a = readInterval(aStart, aEnd);
  const b = readInterval(bStart, bEnd);

  // 🔴 «Δεν ξέρω» — χαλασμένο άκρο ή ανάποδο διάστημα. **Ποτέ `false`**: ένα `false`
  //    θα σήμαινε *«δεν επικαλύπτονται»*, δηλαδή θα **επέτρεπε** τη σύγκρουση επειδή
  //    δεν μπορέσαμε να τη διαβάσουμε (N.12: *άγνωστο ≠ κενό*).
  if (a.shape === 'unreadable' || b.shape === 'unreadable') return null;
  if (a.shape === 'reversed' || b.shape === 'reversed') return null;

  // 🔑 **Το κενό σύνολο δεν τέμνει τίποτα** — ούτε καν τον εαυτό του. Δες παραπάνω.
  if (a.shape === 'empty' || b.shape === 'empty') return false;

  // Ο κανονικός έλεγχος επικάλυψης ημι-ανοιχτών διαστημάτων: **γνήσιες** ανισότητες
  // και στις δύο πλευρές. Ένα `<=` εδώ θα έκανε τη διαδοχή σύγκρουση.
  //
  // ⚠️ Φτάνει εδώ **μόνο** με `proper × proper` — δηλαδή με την προϋπόθεση που ο τύπος
  //    πάντα είχε και **κανείς δεν έλεγχε**.
  return a.from < b.to && b.from < a.to;
}

/**
 * Κοινός πυρήνας των δύο comparators. `direction` = 1 για αύξουσα, -1 για φθίνουσα.
 *
 * **Οι άγνωστες στιγμές πηγαίνουν πάντα τελευταίες, και στις δύο κατευθύνσεις** —
 * η σύμβαση `NULLS LAST` της SQL, και αυτό που κάνει κάθε επαγγελματικός πίνακας:
 * μια εγγραφή χωρίς ημερομηνία δεν είναι «η αρχαιότερη», είναι «άγνωστη», και ο
 * χρήστης θέλει πρώτα αυτά που ξέρει. Με φθίνουσα σειρά το αποτέλεσμα είναι
 * **ταυτόσημο** με το παλιό sentinel `0` — καμία αλλαγή συμπεριφοράς στα υπάρχοντα
 * σημεία κλήσης, που ήταν όλα φθίνοντα.
 */
function compareInstants(a: unknown, b: unknown, direction: 1 | -1): number {
  const aMs = normalizeToMillisOrNull(a);
  const bMs = normalizeToMillisOrNull(b);
  if (aMs === null) return bMs === null ? 0 : 1;
  if (bMs === null) return -1;
  const diff = aMs - bMs;
  // `0 * -1` είναι `-0`. Το `Array.sort` το χειρίζεται σωστά, αλλά ένας comparator
  // που επιστρέφει `-0` αποτυγχάνει σε `Object.is`-based ελέγχους ισότητας και
  // είναι απλώς λάθος συμβόλαιο. Επιστρέφουμε κανονικό μηδέν.
  return diff === 0 ? 0 : diff * direction;
}

/**
 * Comparator παλαιότερου→νεότερου· άγνωστες στιγμές τελευταίες.
 * `items.sort((a, b) => compareInstantsAsc(a.createdAt, b.createdAt))`
 * @see ADR-218 §Phase 4
 */
export function compareInstantsAsc(a: unknown, b: unknown): number {
  return compareInstants(a, b, 1);
}

/**
 * Comparator νεότερου→παλαιότερου· άγνωστες στιγμές τελευταίες.
 * `items.sort((a, b) => compareInstantsDesc(a.createdAt, b.createdAt))`
 * @see ADR-218 §Phase 4
 */
export function compareInstantsDesc(a: unknown, b: unknown): number {
  return compareInstants(a, b, -1);
}

/**
 * Ημέρες που πέρασαν από τη `val` μέχρι το `now`, ή `null` αν η `val` δεν είναι
 * αναγνώσιμη στιγμή. **Κλασματικό** αποτέλεσμα — η στρογγυλοποίηση είναι απόφαση
 * πολιτικής του καλούντος (`Math.floor` για «συμπληρωμένες ημέρες», ωμό για κατώφλια).
 *
 * Το `now` είναι παράμετρος ώστε τα tests να μη χρειάζονται fake timers.
 *
 * @see ADR-218 §Phase 4
 */
export function daysSinceOrNull(val: unknown, now: number = Date.now()): number | null {
  const ms = normalizeToMillisOrNull(val);
  return ms === null ? null : (now - ms) / MS_PER_DAY;
}

/**
 * Ημέρες που απομένουν μέχρι τη `val`, ή `null` αν δεν είναι αναγνώσιμη στιγμή.
 * Αρνητικό = η στιγμή έχει ήδη περάσει. Κλασματικό, όπως το {@link daysSinceOrNull}.
 *
 * @see ADR-218 §Phase 4
 */
export function daysUntilOrNull(val: unknown, now: number = Date.now()): number | null {
  const ms = normalizeToMillisOrNull(val);
  return ms === null ? null : (ms - now) / MS_PER_DAY;
}

/**
 * Ημερομηνία + ώρα `"HH:MM"` → ένα Date.
 *
 * SSoT για το `time.split(':').map(Number)` + `setHours(h, m, 0, 0)` ζευγάρι, που
 * ήταν αντιγραμμένο σε 4 σημεία (CalendarCreateDialog, TaskEditDialog,
 * TaskDetailPanel ×2). Δεν μεταλλάσσει το `date` που του δίνεις.
 *
 * Μη έγκυρη ώρα → η ημερομηνία επιστρέφεται με μηδενισμένη ώρα, ποτέ `Invalid Date`.
 *
 * @see ADR-584
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const combined = new Date(date);
  combined.setHours(
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0
  );
  return combined;
}

/**
 * Timestamp / Date / string / number → `{ date, time: "HH:MM" }`.
 *
 * Η αντίστροφη του {@link combineDateAndTime}, για να γεμίζουν τα form fields από
 * ένα αποθηκευμένο `dueDate`. Χτίζει πάνω στο {@link normalizeToDate} αντί να
 * ξαναελέγχει μόνη της για `toDate` — έτσι πιάνει και τα JSON-serialised
 * Timestamps (`{ seconds }` / `{ _seconds }`) που η παλιά ad-hoc `parseDueDate`
 * έχανε.
 *
 * @see ADR-584
 */
export function splitDateAndTime(
  val: unknown,
  fallbackTime = '09:00'
): { date: Date; time: string } {
  const d = normalizeToDate(val);
  if (!d) return { date: new Date(), time: fallbackTime };
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return { date: d, time: `${hh}:${mm}` };
}

/**
 * Extract timestamp from nested object path (e.g., "audit.createdAt").
 * Replaces `getNestedTimestamp()` in conversations/route.ts.
 * @see ADR-218
 */
export function getNestedTimestampISO(data: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = data;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[part];
  }
  return normalizeToISO(current) ?? (typeof current === 'string' ? current : '');
}
