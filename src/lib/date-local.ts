

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
