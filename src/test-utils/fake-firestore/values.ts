/**
 * @fileoverview **Τιμές πεδίων** του ενιαίου ψεύτικου Firestore — ανάγνωση διαδρομής, σύγκριση, σύμβολα `FieldValue`.
 *
 * Καθαρές συναρτήσεις, χωρίς κατάσταση: ό,τι εδώ είναι **σημασιολογία του Firestore**, όχι του fake. Γι' αυτό κάθε
 * κανόνας εδώ έχει ισχυρισμό στη σουίτα συμβολαίου (`contract/firestore-contract.ts`), που τρέχει **και** στον emulator.
 *
 * @module test-utils/fake-firestore/values
 * @see adrs/ADR-742 §7sexdecies
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore';

export type Doc = Record<string, unknown>;

/**
 * `instanceof` που **δεν πετά** όταν ένα test έχει κάνει `jest.mock('firebase-admin/firestore')` με απλό αντικείμενο
 * (π.χ. `contact-lookup.test.ts`: `FieldValue` χωρίς κλάση, καθόλου `Timestamp`). Το fake μιλά **το ίδιο** module με τον
 * κώδικα υπό δοκιμή: ό,τι εκείνος δεν μπορεί να κατασκευάσει, το fake δεν χρειάζεται να αναγνωρίσει.
 */
function isInstance<T>(value: unknown, ctor: (abstract new (...args: never[]) => T) | undefined): value is T {
  return typeof ctor === 'function' && value instanceof ctor;
}

/** `a.b.c` → η τιμή, ή `undefined` — διαδρομή πεδίου, όπως ο Firestore, όχι σκέτο κλειδί. */
export function readPath(doc: Doc, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (node, key) => (node === null || typeof node !== 'object' ? undefined : (node as Doc)[key]),
    doc,
  );
}

/**
 * **Σειρά τύπων του Firestore** (null < boolean < αριθμός < χρονοσφραγίδα < κείμενο < …). Ανόμοιοι τύποι **ποτέ** δεν
 * συγκρίνονται με εξαναγκασμό (το `'5' <= 10` της JavaScript είναι `true` — του Firestore όχι).
 */
function typeRank(value: unknown): number {
  if (value === null) return 0;
  if (typeof value === 'boolean') return 1;
  if (typeof value === 'number') return 2;
  if (isInstance(value, Timestamp)) return 3;
  if (typeof value === 'string') return 4;
  return 9;
}

function scalarOf(value: unknown): unknown {
  return isInstance(value, Timestamp) ? value.toMillis() : value;
}

/**
 * Σύγκριση **ταξινόμησης** (`orderBy`): πρώτα ο τύπος, μετά η τιμή. `Timestamp` χρονολογικά (ADR-894 §10 Β2/Β3)·
 * κείμενο λεξικογραφικά — σωστό για ISO σε UTC **ακριβώς επειδή** η αλφαβητική σειρά ταυτίζεται με τη χρονολογική.
 */
export function compareValues(a: unknown, b: unknown): number {
  const rank = typeRank(a) - typeRank(b);
  if (rank !== 0) return rank;
  const left = scalarOf(a);
  const right = scalarOf(b);
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'string' && typeof right === 'string') return left < right ? -1 : left > right ? 1 : 0;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return 0;
}

/** Ισότητα τιμών — `Timestamp` κατά τιμή (`isEqual`), όλα τα άλλα με `===` (όπως συγκρίνει ο Firestore τα βαθμωτά). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (isInstance(a, Timestamp) && isInstance(b, Timestamp)) return a.isEqual(b);
  return a === b;
}

/** Ανισότητα εύρους: **μόνο** ίδιος συγκρίσιμος τύπος (αριθμός · κείμενο · χρονοσφραγίδα)· αλλιώς `false`. */
function rangeMatches(op: '<' | '<=' | '>' | '>=', value: unknown, bound: unknown): boolean {
  const rank = typeRank(value);
  if (rank !== typeRank(bound) || rank < 2 || rank > 4) return false;
  const order = compareValues(value, bound);
  if (op === '<') return order < 0;
  if (op === '<=') return order <= 0;
  if (op === '>') return order > 0;
  return order >= 0;
}

export type WhereOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';

export interface WhereClause {
  readonly field: string;
  readonly op: WhereOp;
  readonly value: unknown;
}

/**
 * Ταιριάζει το έγγραφο στον όρο; Το `!=` **εξαιρεί** έγγραφα χωρίς το πεδίο — όπως ο Firestore (ίδια οικογένεια με
 * την παγίδα του `orderBy`, ADR-890 §17).
 */
export function matchesClause(doc: Doc, clause: WhereClause): boolean {
  const raw = readPath(doc, clause.field);
  switch (clause.op) {
    case '==': return valuesEqual(raw, clause.value);
    case '!=': return raw !== undefined && !valuesEqual(raw, clause.value);
    case 'in': return Array.isArray(clause.value) && clause.value.some((candidate) => valuesEqual(raw, candidate));
    case 'array-contains': return Array.isArray(raw) && raw.some((item) => valuesEqual(item, clause.value));
    default: return rangeMatches(clause.op, raw, clause.value);
  }
}

/** Είναι η τιμή το σύμβολο `FieldValue.delete()`; */
export function isFieldDelete(value: unknown): boolean {
  return isInstance(value, FieldValue) && value.isEqual(FieldValue.delete());
}

/**
 * Το βήμα ενός `FieldValue.increment(n)`, ή `null` (ADR-777 §8.72). Το SDK κρατά το βήμα στο `operand` χωρίς δημόσιο
 * τύπο· το `isEqual` **επιβεβαιώνει** ότι είναι όντως αύξηση με αυτό το βήμα.
 */
function incrementOperand(value: unknown): number | null {
  if (!isInstance(value, FieldValue)) return null;
  const operand = (value as unknown as { readonly operand?: unknown }).operand;
  return typeof operand === 'number' && value.isEqual(FieldValue.increment(operand)) ? operand : null;
}

/** Εφαρμόζει μία τιμή πάνω στην προηγούμενη: αύξηση → άθροισμα, οτιδήποτε άλλο → η ίδια η τιμή. */
export function resolveWrite(previous: unknown, value: unknown): unknown {
  const step = incrementOperand(value);
  return step === null ? value : (typeof previous === 'number' ? previous : 0) + step;
}

/** Όλα τα πεδία ενός εγγράφου με τις αυξήσεις εφαρμοσμένες πάνω στο `existing` — πάντα **νέο** αντικείμενο. */
export function applyIncrements(existing: Doc, doc: Doc): Doc {
  const out: Doc = {};
  for (const [key, value] of Object.entries(doc)) out[key] = resolveWrite(existing[key], value);
  return out;
}

function isPlainObject(value: unknown): value is Doc {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * **Βαθύ αντίγραφο που κρατά τις κλάσεις** (`Timestamp`, `FieldValue`, `Date`): αντιγράφονται μόνο απλά αντικείμενα και
 * πίνακες. Το `structuredClone` θα μετέτρεπε κάθε `Timestamp` σε απλό αντικείμενο και κάθε `instanceof` μετά από
 * `update` θα ήταν ψευδές — πράσινο/κόκκινο για λόγο άσχετο με τον κώδικα.
 */
export function cloneDoc<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneDoc(item)) as T;
  if (!isPlainObject(value)) return value;
  const out: Doc = {};
  for (const [key, item] of Object.entries(value)) out[key] = cloneDoc(item);
  return out as T;
}

/**
 * **`update()` με διαδρομές πεδίων** (ADR-827 §9.13): το `{ 'a.b': v }` γράφει **εμφωλευμένα** και κρατά τα αδέλφια·
 * `FieldValue.delete()` σβήνει το κλειδί (ADR-867 Ε9)· `FieldValue.increment()` προσθέτει. Επιστρέφει νέο έγγραφο —
 * ποτέ επιτόπια μετάλλαξη, γιατί τα tests κρατούν στιγμιότυπα προηγούμενων αναγνώσεων.
 */
export function applyFieldPatch(current: Doc, patch: Doc): Doc {
  const next = cloneDoc(current);
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('.');
    const leaf = keys.pop() as string;
    let node = next;
    for (const key of keys) {
      if (!isPlainObject(node[key])) node[key] = {};
      node = node[key] as Doc;
    }
    if (isFieldDelete(value)) delete node[leaf];
    else node[leaf] = resolveWrite(node[leaf], value);
  }
  return next;
}

/**
 * **`set(…, { merge: true })`: ΒΑΘΙΑ συγχώνευση** — εμφωλευμένα αντικείμενα συγχωνεύονται και αυτά, `FieldValue.delete()`
 * σβήνει, `increment()` προσθέτει.
 *
 * 🔴 Το παλιό fake συγχώνευε **ρηχά** με σχόλιο «όπως το Admin SDK — μη βελτιώσεις σε βαθιά». Ήταν **λάθος**, και το
 * απέδειξε ο emulator (συμβόλαιο W5, 2026-09-30): `set({ profile: { role } }, { merge: true })` κρατά το `profile.name`.
 * Με το ρηχό fake, ένας γραφέας που **βασίζεται** στη βαθιά συγχώνευση θα φαινόταν να σβήνει αδέλφια που η παραγωγή
 * κρατά — κόκκινο για κώδικα σωστό. Μετρημένο: **κανένας** καλών δεν εξαρτιόταν από τη ρηχή εκδοχή.
 */
export function mergeDoc(existing: Doc, patch: Doc): Doc {
  const out = cloneDoc(existing);
  for (const [key, value] of Object.entries(patch)) {
    if (isFieldDelete(value)) delete out[key];
    else if (isPlainObject(value)) out[key] = mergeDoc(isPlainObject(out[key]) ? out[key] : {}, value);
    else out[key] = resolveWrite(out[key], value);
  }
  return out;
}
