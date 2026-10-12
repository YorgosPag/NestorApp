/**
 * CHECK 3.103 — ο ΚΡΙΤΗΣ του μελανιού (ADR-909 §6.9 · Γ2.8). Καθαρή συνάρτηση: μητρώο + αναθέσεις → ετυμηγορία.
 *
 * 🔑 ΔΥΟ ΖΩΝΕΣ, ΔΥΟ ΜΗΧΑΝΙΣΜΟΙ (δηλωμένες στο `.paper-ink-registry.json`):
 *    · `strict`  — ⛔ ΜΗΔΕΝΙΚΗ ΑΝΟΧΗ. Κάθε αναπόδεικτη ανάθεση οφείλει ΕΞΑΙΡΕΣΗ ΜΕ ΛΟΓΟ στο μητρώο.
 *    · `ratchet` — 🔴 κατά ταυτότητα. Ό,τι υπάρχει σήμερα είναι «ΔΕΝ ΚΡΙΘΗΚΕ», όχι «καθαρό»· νέα ταυτότητα μπλοκάρει.
 *
 * 🔑 Η ΤΑΥΤΟΤΗΤΑ είναι `αρχείο#συνάρτηση :: νεροχύτης = τιμή` — ΟΧΙ αριθμός γραμμής (μετακινείται) και ΟΧΙ πλήθος
 *    (το «5 → 5» κρύβει ανταλλαγή, ADR-749). Εξαίρεση σε `paintHoverHalo` ΔΕΝ καλύπτει νέα ωμή γραμμή μέσα της:
 *    καλύπτει ακριβώς τις αναθέσεις που ονομάζει.
 *
 * ⛔ ΟΙ ΤΕΣΣΕΡΙΣ ΑΡΝΗΣΕΙΣ (ποτέ σε baseline):
 *    Κ1 `undeclared`       — αναπόδεικτη ανάθεση στη ζώνη `strict` χωρίς εξαίρεση.
 *    Κ2 `unreasoned`       — εξαίρεση με άγνωστο είδος ή λόγο κάτω από {@link MIN_WHY} χαρακτήρες.
 *    Κ3 `stale`            — εξαίρεση που δεν αντιστοιχεί πια σε καμία αναπόδεικτη ανάθεση (PHPStan
 *                            `reportUnmatchedIgnoredErrors`): μια καταστολή που δεν χρειάζεται κρύβει την επόμενη βλάβη.
 *    Κ4 `approved-missing` — εγκεκριμένο όνομα που το δηλωμένο σπίτι του ΔΕΝ εξάγει (ο κατάλογος σάπισε).
 */

'use strict';

const MIN_WHY = 40;
const STATES = Object.freeze({
  UNDECLARED: 'undeclared', UNREASONED: 'unreasoned', STALE: 'stale', APPROVED_MISSING: 'approved-missing',
});

/** Η ταυτότητα μιας ανάθεσης· η 2η, 3η… ίδια ανάθεση στην ίδια συνάρτηση παίρνει επίθεμα `(×n)`. */
function identityOf(file, fn, text, ordinal) {
  return `${file}#${fn} :: ${text}${ordinal > 1 ? ` (×${ordinal})` : ''}`;
}

/** Αριθμεί τις επαναλήψεις του ίδιου `(αρχείο, συνάρτηση, κείμενο)` με τη σειρά που δίνονται. */
function createIdentifier() {
  const seen = new Map();
  return (file, fn, text) => {
    const key = `${file}#${fn} :: ${text}`;
    const ordinal = (seen.get(key) || 0) + 1;
    seen.set(key, ordinal);
    return identityOf(file, fn, text, ordinal);
  };
}

/** Οι αναπόδεικτες αναθέσεις μιας ζώνης, η καθεμία με την ταυτότητά της. */
function unprovenOf(scanned, zone) {
  const identify = createIdentifier();
  const out = [];
  for (const entry of scanned) {
    if (entry.zone !== zone) continue;
    for (const a of entry.assignments) {
      if (a.proven) continue;
      out.push({ id: identify(entry.file, a.fn, a.text), file: entry.file, line: a.line, fn: a.fn, text: a.text });
    }
  }
  return out;
}

/** Οι εξαιρέσεις του μητρώου ως ταυτότητες + όσες είναι κακοδηλωμένες (Κ2). */
function readExceptions(registry) {
  const identify = createIdentifier();
  const kinds = new Set(Object.keys(registry.kinds || {}));
  const ids = new Map();
  const unreasoned = [];
  for (const ex of registry.exceptions || []) {
    const label = `${ex.file}#${ex.fn}`;
    const why = typeof ex.why === 'string' ? ex.why.trim() : '';
    if (!kinds.has(ex.kind)) unreasoned.push(`${label} — άγνωστο είδος «${ex.kind}»`);
    if (why.length < MIN_WHY) unreasoned.push(`${label} — λόγος ${why.length} χαρακτήρων (ελάχιστο ${MIN_WHY})`);
    for (const text of ex.assignments || []) ids.set(identify(ex.file, ex.fn, text), ex.kind);
  }
  return { ids, unreasoned };
}

/**
 * @param {object} registry  το `.paper-ink-registry.json`
 * @param {{file:string, zone:'strict'|'ratchet', assignments:object[]}[]} scanned
 * @param {string[]} approvedMissing  εγκεκριμένα ονόματα που το σπίτι τους δεν εξάγει (το μετρά ο καλών — I/O)
 */
function judge(registry, scanned, approvedMissing = []) {
  const strict = unprovenOf(scanned, 'strict');
  const ratchet = unprovenOf(scanned, 'ratchet');
  const { ids: exceptionIds, unreasoned } = readExceptions(registry);
  const strictIds = new Set(strict.map((u) => u.id));

  const rows = [
    ...strict.filter((u) => !exceptionIds.has(u.id))
      .map((u) => ({ state: STATES.UNDECLARED, detail: `${u.file}:${u.line} — ${u.fn} :: ${u.text}` })),
    ...unreasoned.map((detail) => ({ state: STATES.UNREASONED, detail })),
    ...[...exceptionIds.keys()].filter((id) => !strictIds.has(id)).map((detail) => ({ state: STATES.STALE, detail })),
    ...approvedMissing.map((detail) => ({ state: STATES.APPROVED_MISSING, detail })),
  ];
  const declared = strict.filter((u) => exceptionIds.has(u.id));
  const all = scanned.flatMap((e) => e.assignments);
  return {
    refused: rows,
    violationIds: ratchet.map((u) => u.id).sort(),
    violations: ratchet.map((u) => ({ id: u.id, file: u.file, line: u.line, state: 'unjudged', detail: u.text })),
    declarations: declared.map((u) => u.id).sort(),
    byKind: tallyBy(declared.map((u) => exceptionIds.get(u.id))),
    tally: { assignments: all.length, proven: all.filter((a) => a.proven).length, strict: strict.length, ratchet: ratchet.length },
  };
}

function tallyBy(values) {
  const out = {};
  for (const v of values) out[v] = (out[v] || 0) + 1;
  return out;
}

module.exports = { judge, identityOf, STATES, MIN_WHY };
