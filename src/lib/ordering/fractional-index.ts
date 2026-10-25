/**
 * @fileoverview **FRACTIONAL INDEXING** — κλειδί σειράς ανά στοιχείο, ώστε η αναδιάταξη να
 * γράφει **μόνο τον μετακινούμενο**.
 * @module lib/ordering/fractional-index
 * @related ADR-923 §5.2 (κατηγορίες/ιδιότητες καταλόγου) · lib/ordering/declared-order.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΠΟΤΕ ΑΥΤΟ ΚΑΙ ΠΟΤΕ Ο ΑΔΕΛΦΟΣ `declared-order` — το κριτήριο είναι ΜΕΤΡΗΣΙΜΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο αδελφός `declared-order.ts` γράφει ρητά γιατί **δεν** χρησιμοποιεί αυτή τη μηχανή:
 * *«δεκάδες στοιχεία σε **ένα** έγγραφο με **μία** ατομική γραφή»* — εκεί η σειρά ζει στον
 * πίνακα του εγγράφου και το κλειδί ανά στοιχείο θα ήταν περιττό.
 *
 * Εδώ είναι η **άλλη** περίπτωση, ακριβώς όπως την ορίζει η ίδια βιβλιογραφία: στοιχεία
 * **απλωμένα σε πολλά έγγραφα** (μία κατηγορία = ένα έγγραφο Firestore, εκατοντάδες ανά
 * δέντρο), που μπορεί να αναδιατάσσουν **ταυτόχρονα** δύο μέλη της ίδιας εταιρείας. Με
 * ακέραιο `sortOrder`, η μετακίνηση στη θέση 2 μιας λίστας 300 στοιχείων ξαναγράφει 298
 * έγγραφα — και δύο ταυτόχρονες μετακινήσεις συγκρούονται. Με κλειδί-κλάσμα γράφεται
 * **ένα**, και δύο μετακινήσεις σε διαφορετικά σημεία δεν αγγίζουν η μία την άλλη.
 * Ιδίωμα: Figma (multiplayer), tldraw (z-order σχημάτων), Linear.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚙️ Ο ΑΛΓΟΡΙΘΜΟΣ — D. Greenspan, «Implementing Fractional Indexing» (2020)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Κλειδί = **ακέραιο μέρος** (ο πρώτος χαρακτήρας κωδικοποιεί το μήκος του) + **κλασματικό
 * μέρος** (ψηφία base-62 χωρίς τελικό μηδέν). Η σειρά είναι **λεξικογραφική κατά code unit**.
 * Γραμμένο από την αρχή πάνω στη δημοσιευμένη περιγραφή — η γνωστή υλοποίηση αναφοράς έχει
 * άδεια CC0, που δεν ανήκει στη λίστα επιτρεπόμενων αδειών του N.5.
 *
 * ⚠️ **ΠΟΤΕ `localeCompare`** για ταξινόμηση: τα κλειδιά είναι case-sensitive (`'a' > 'Z'`)
 * και η σύγκριση locale θα τα ανακάτευε. Χρησιμοποίησε {@link compareOrderKeys}.
 */

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ZERO = DIGITS[0];
const LAST_DIGIT = DIGITS[DIGITS.length - 1];
const INTEGER_ZERO = 'a0';
const SMALLEST_INTEGER = `A${ZERO.repeat(26)}`;

/** Σφάλμα μη έγκυρου κλειδιού — ονομασμένο, ώστε ο καλών να το ξεχωρίζει. */
export class OrderKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderKeyError';
  }
}

function integerLength(head: string): number {
  if (head >= 'a' && head <= 'z') return head.charCodeAt(0) - 'a'.charCodeAt(0) + 2;
  if (head >= 'A' && head <= 'Z') return 'Z'.charCodeAt(0) - head.charCodeAt(0) + 2;
  throw new OrderKeyError(`invalid order key head: ${head}`);
}

function integerPart(key: string): string {
  const length = integerLength(key.charAt(0));
  if (length > key.length) throw new OrderKeyError(`invalid order key: ${key}`);
  return key.slice(0, length);
}

function assertValidKey(key: string): void {
  if (key === SMALLEST_INTEGER) throw new OrderKeyError(`invalid order key: ${key}`);
  const fraction = key.slice(integerPart(key).length);
  if (fraction.endsWith(ZERO)) throw new OrderKeyError(`invalid order key: ${key}`);
  for (const char of key.slice(1)) {
    if (!DIGITS.includes(char)) throw new OrderKeyError(`invalid order key: ${key}`);
  }
}

/** Είναι η τιμή έγκυρο κλειδί σειράς; — για ό,τι έρχεται απ' έξω. */
export function isValidOrderKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    assertValidKey(value);
    return true;
  } catch {
    return false;
  }
}

/** Η μία σύγκριση κλειδιών (code unit, ποτέ locale). */
export function compareOrderKeys(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Μεσαίο κλασματικό μέρος αυστηρά ανάμεσα σε `a` και `b` (`b === null` = +∞). */
function midpoint(a: string, b: string | null): string {
  if (b !== null) {
    let shared = 0;
    while ((a.charAt(shared) || ZERO) === b.charAt(shared)) shared++;
    if (shared > 0) return b.slice(0, shared) + midpoint(a.slice(shared), b.slice(shared));
  }
  const digitA = a ? DIGITS.indexOf(a.charAt(0)) : 0;
  const digitB = b !== null ? DIGITS.indexOf(b.charAt(0)) : DIGITS.length;
  if (digitB - digitA > 1) return DIGITS.charAt(Math.round((digitA + digitB) / 2));
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS.charAt(digitA) + midpoint(a.slice(1), null);
}

function incrementInteger(value: string): string | null {
  const head = value.charAt(0);
  const digits = value.slice(1).split('');
  let carry = true;
  for (let i = digits.length - 1; carry && i >= 0; i--) {
    const next = DIGITS.indexOf(digits[i]) + 1;
    if (next === DIGITS.length) digits[i] = ZERO;
    else {
      digits[i] = DIGITS.charAt(next);
      carry = false;
    }
  }
  if (!carry) return head + digits.join('');
  if (head === 'Z') return INTEGER_ZERO;
  if (head === 'z') return null;
  const nextHead = String.fromCharCode(head.charCodeAt(0) + 1);
  if (nextHead > 'a') digits.push(ZERO);
  else digits.pop();
  return nextHead + digits.join('');
}

function decrementInteger(value: string): string | null {
  const head = value.charAt(0);
  const digits = value.slice(1).split('');
  let borrow = true;
  for (let i = digits.length - 1; borrow && i >= 0; i--) {
    const previous = DIGITS.indexOf(digits[i]) - 1;
    if (previous === -1) digits[i] = LAST_DIGIT;
    else {
      digits[i] = DIGITS.charAt(previous);
      borrow = false;
    }
  }
  if (!borrow) return head + digits.join('');
  if (head === 'a') return `Z${LAST_DIGIT}`;
  if (head === 'A') return null;
  const previousHead = String.fromCharCode(head.charCodeAt(0) - 1);
  if (previousHead < 'Z') digits.push(LAST_DIGIT);
  else digits.pop();
  return previousHead + digits.join('');
}

function keyBefore(b: string): string {
  const intB = integerPart(b);
  const fracB = b.slice(intB.length);
  if (intB === SMALLEST_INTEGER) return intB + midpoint('', fracB);
  if (intB < b) return intB;
  const decremented = decrementInteger(intB);
  if (decremented === null) throw new OrderKeyError('cannot decrement any further');
  return decremented;
}

function keyAfter(a: string): string {
  const intA = integerPart(a);
  const incremented = incrementInteger(intA);
  return incremented === null ? intA + midpoint(a.slice(intA.length), null) : incremented;
}

/**
 * **Κλειδί αυστηρά ανάμεσα σε `a` και `b`.** `null` = άκρο της λίστας.
 * `keyBetween(null, null)` = το πρώτο κλειδί μιας άδειας λίστας.
 */
export function keyBetween(a: string | null, b: string | null): string {
  if (a !== null) assertValidKey(a);
  if (b !== null) assertValidKey(b);
  if (a !== null && b !== null && a >= b) throw new OrderKeyError(`${a} >= ${b}`);
  if (a === null) return b === null ? INTEGER_ZERO : keyBefore(b);
  if (b === null) return keyAfter(a);
  const intA = integerPart(a);
  const intB = integerPart(b);
  if (intA === intB) return intA + midpoint(a.slice(intA.length), b.slice(intB.length));
  const incremented = incrementInteger(intA);
  if (incremented === null) throw new OrderKeyError('cannot increment any further');
  if (incremented < b) return incremented;
  return intA + midpoint(a.slice(intA.length), null);
}

/**
 * **`count` κλειδιά αυστηρά ανάμεσα σε `a` και `b`**, σε αύξουσα σειρά — για εισαγωγή
 * πολλών στοιχείων με μία κίνηση (π.χ. αρχικό δέντρο). Ισορροπημένο: τα κλειδιά μένουν κοντά.
 */
export function keysBetween(a: string | null, b: string | null, count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return [keyBetween(a, b)];
  if (b === null) {
    const keys: string[] = [];
    let previous = a;
    for (let i = 0; i < count; i++) {
      previous = keyBetween(previous, null);
      keys.push(previous);
    }
    return keys;
  }
  if (a === null) {
    const keys: string[] = [];
    let next: string = b;
    for (let i = 0; i < count; i++) {
      next = keyBetween(null, next);
      keys.unshift(next);
    }
    return keys;
  }
  const half = Math.floor(count / 2);
  const middle = keyBetween(a, b);
  return [...keysBetween(a, middle, half), middle, ...keysBetween(middle, b, count - half - 1)];
}
