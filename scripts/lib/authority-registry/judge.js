'use strict';

/**
 * CHECK 3.68 — Η ΚΡΙΣΗ (ADR-801 §4).
 *
 * **ΤΡΕΙΣ ΑΝΕΞΑΡΤΗΤΟΙ ΚΑΝΟΝΕΣ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»** (μάθημα CHECK 3.41) — και το
 * κριτήριο του διαχωρισμού είναι ότι έχουν **ΔΙΑΦΟΡΕΤΙΚΗ ΘΕΡΑΠΕΙΑ**:
 *
 *   Κ1 🔴 `inline-decider`      → *κάλεσε τον κριτή*
 *   Κ2 ⛔ `orphan-declaration` · `reasonless-declaration` → *δήλωσε με λόγο, ή σβήσε τη δήλωση*
 *   Κ3 ⛔ `ghost-role` · `orphan-legacy` → ***σβήσε τον νεκρό κλάδο***
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο μισό ελάττωμα**: ένα αρχείο
 * που καλεί **σωστά** τον κριτή **και** κρατά `case 'foreman':` περνά τον Κ1 και
 * αποτυγχάνει **μόνο** στον Κ3.
 */

const { guardIdOf } = require('./role-guards');

const STATES = {
  INLINE_DECIDER: 'inline-decider',
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  GHOST_ROLE: 'ghost-role',
  ORPHAN_LEGACY: 'orphan-legacy',
  VOCABULARY_DRIFT: 'vocabulary-drift',
  DECLARED_DECIDER: 'declared-decider',
  POLICY_DECLARATION: 'policy-declaration',
  SSOT: 'ssot',
  // ── Κ1′ (ADR-801 §2.11) — Ο ΦΡΟΥΡΟΣ ΡΟΛΟΥ ΜΕΣΑ ΣΤΟΝ HANDLER ──────────────
  UNDECLARED_ROLE_GUARD: 'undeclared-role-guard',
  DECLARED_ROLE_GUARD: 'declared-role-guard',
  ORPHAN_GUARD_DECLARATION: 'orphan-guard-declaration',
  REASONLESS_GUARD_DECLARATION: 'reasonless-guard-declaration',
  ROLE_CONDITIONED_FLOW: 'role-conditioned-flow',
};

/** ⛔ Όσες **δεν μπαίνουν ΠΟΤΕ σε baseline** — το `buildPayload` ρίχνει. */
const BLOCKING = [
  STATES.ORPHAN_DECLARATION,
  STATES.REASONLESS_DECLARATION,
  STATES.GHOST_ROLE,
  STATES.ORPHAN_LEGACY,
  STATES.VOCABULARY_DRIFT,
  STATES.UNDECLARED_ROLE_GUARD,
  STATES.ORPHAN_GUARD_DECLARATION,
  STATES.REASONLESS_GUARD_DECLARATION,
];

/** Το ελάχιστο μήκος λόγου — πρότυπο CHECK 3.58 / 3.61. */
const MIN_REASON = 40;

/** Υποψήφιο όνομα ρόλου: πεζά + underscore, 4-24 χαρακτήρες. */
const CANDIDATE = /['"`]([a-z][a-z_0-9]{3,23})['"`]/g;

// =============================================================================
// ΦΑΝΤΑΣΜΑΤΑ — Ο Κ3
// =============================================================================

/**
 * Τα ονόματα που **στέκονται σε θέση ρόλου** μέσα σε ένα παράθυρο.
 *
 * ⚠️ **Η ΘΕΣΗ ΕΙΝΑΙ ΤΟ ΚΡΙΤΗΡΙΟ, ΟΧΙ Η ΓΕΙΤΝΙΑΣΗ.** Το παράθυρο `switch` είναι
 * **ολόκληρο το αρχείο** — μαζεύοντας από εκεί κάθε συμβολοσειρά, η πύλη θα
 * κατήγγελλε κάθε λέξη του αρχείου ως «φάντασμα ρόλου». Γι' αυτό:
 *   · `switch` ⇒ **μόνο** `case '<x>':`
 *   · πίνακας/`Set` ⇒ **μόνο** μέχρι το κλείσιμο `]`
 */
function namesInRolePosition(win) {
  if (win.kind === 'switch') {
    return [...win.text.matchAll(/case\s+['"`]([a-z][a-z_0-9]{3,23})['"`]/g)].map((m) => m[1]);
  }
  const cut = win.text.indexOf(']');
  const body = cut >= 0 ? win.text.slice(0, cut) : win.text;
  return [...body.matchAll(CANDIDATE)].map((m) => m[1]);
}

/** Τα φαντάσματα ενός αρχείου: ονόματα σε θέση ρόλου που **δεν υπάρχουν πουθενά**. */
function ghostsOf(entry, known) {
  const ghosts = new Set();
  for (const win of entry.windows) {
    for (const name of namesInRolePosition(win)) {
      if (!known.has(name)) ghosts.add(name);
    }
  }
  return [...ghosts].sort();
}

// =============================================================================
// Η ΚΡΙΣΗ
// =============================================================================

/**
 * **Κ1′ — Ο ΦΡΟΥΡΟΣ ΡΟΛΟΥ ΜΕΣΑ ΣΤΟΝ HANDLER** (ADR-801 §2.11).
 *
 * ⚠️ **ΑΝΕΞΑΡΤΗΤΟΣ ΚΑΝΟΝΑΣ, ΠΟΤΕ «Ή» ΜΕ ΤΟΝ Κ1** — μάθημα CHECK 3.41, και το
 * κριτήριο του διαχωρισμού είναι ότι έχουν **ΔΙΑΦΟΡΕΤΙΚΗ ΘΕΡΑΠΕΙΑ**:
 *
 * | | Ερώτημα | Θεραπεία |
 * |---|---|---|
 * | **Κ1** | *ποιος **κρίνει** με δικό του σύνολο ρόλων;* | κάλεσε τον `decideCapability` |
 * | **Κ1′** | *ποιος **αρνείται** με βάση τον ρόλο μέσα στον handler;* | ανύψωσέ το σε `requiredGlobalRoles` |
 *
 * Ένας κανόνας με «ή» θα έμενε **πράσινος πάνω στο μισό ελάττωμα**: το
 * `admin-migration-runner.ts` δεν έχει **κανένα** όνομα ρόλου σε εισαγωγικά, άρα ο
 * Κ1 δεν το βλέπει καν· τα τέσσερα `isAdmin = super_admin || company_admin` είναι
 * **και** τα δύο, και ο καθένας τα ονομάζει με **άλλη** θεραπεία.
 *
 * 🔶 Οι έλεγχοι που **δεν** αρνούνται μετρώνται ως `role-conditioned-flow` και
 * **δεν απαριθμούνται** — είναι το τυφλό σημείο **με αριθμό**, πρότυπο
 * `unanalyzable-heritage` του CHECK 3.44. Ανύψωσή τους θα έκλεινε τη διαδρομή σε
 * όλους πλην υπερδιαχειριστή: *θα έσπαγε λειτουργία ενώ θα έμοιαζε σκλήρυνση*.
 */
function judgeRoleGuards(inventory) {
  const declared = new Map((inventory.registry.roleGuards || []).map((g) => [g.id, g]));
  const seen = new Set();
  const rows = [];

  for (const check of inventory.roleChecks || []) {
    if (!check.denies) {
      rows.push({
        id: `${check.file}:${check.line}`,
        state: STATES.ROLE_CONDITIONED_FLOW,
        detail: `ο ρόλος ρυθμίζει ροή/δεδομένα χωρίς να αρνείται — «${check.condition}»`,
      });
      continue;
    }
    const id = guardIdOf(check);
    const declaration = declared.get(id);
    if (declaration === undefined) {
      rows.push({
        id,
        state: STATES.UNDECLARED_ROLE_GUARD,
        detail: `${check.file}:${check.line} αρνείται με βάση ΜΟΝΟ τον ρόλο του καλούντος`
          + ' — ανύψωσέ το σε `requiredGlobalRoles` στη δήλωση της διαδρομής',
      });
      continue;
    }
    seen.add(id);
    const why = (declaration.why || '').trim();
    rows.push(why.length >= MIN_REASON
      ? { id, state: STATES.DECLARED_ROLE_GUARD, detail: `${check.file}:${check.line} — δηλωμένος με λόγο` }
      : {
        id,
        state: STATES.REASONLESS_GUARD_DECLARATION,
        detail: `ο λόγος έχει ${why.length} χαρακτήρες (ελάχιστο ${MIN_REASON})`,
      });
  }

  for (const id of declared.keys()) {
    if (seen.has(id)) continue;
    rows.push({
      id,
      state: STATES.ORPHAN_GUARD_DECLARATION,
      detail: 'δηλωμένος φρουρός που δεν υπάρχει πια (ή άλλαξε συνθήκη) — σβήσε ή ενημέρωσε τη δήλωση',
    });
  }
  return rows;
}

function declarationMap(registry) {
  return new Map((registry.inlineDeciders || []).map((d) => [d.id, d]));
}

/**
 * Το σύνολο των ονομάτων που **επιτρέπεται** να σταθούν σε θέση ρόλου.
 *
 * ⚠️ Τα `permissions` είναι εδώ **επειδή μετρήθηκε**: το `admin_access` είναι
 * `PermissionId`, όχι ρόλος, και ήταν **1 στα 3** ευρήματα της πρώτης μέτρησης
 * (**33% ψευδώς θετικά**) πριν μπει στο σύνολο.
 */
function knownNames(vocabularies, registry) {
  return new Set([
    ...vocabularies.globalRoles,
    ...vocabularies.predefinedRoles,
    ...vocabularies.permissions,
    ...(registry.legacyRoleNames || []).map((l) => l.name),
  ]);
}

function ssotFiles(registry) {
  return new Set(Object.values(registry.ssot).filter((v) => typeof v === 'string' && v.includes('/')));
}

/**
 * @returns {{rows: Array, tally: Object, ghosts: Array, drift: Array}}
 */
function judge(inventory) {
  const { registry, vocabularies, entries } = inventory;
  const declared = declarationMap(registry);
  const known = knownNames(vocabularies, registry);
  const ssot = ssotFiles(registry);

  const rows = [];
  const seenDeclarations = new Set();

  // ── ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΟΥ ΜΗΤΡΩΟΥ ΣΥΜΦΩΝΕΙ ΜΕ ΤΟ SSoT; ──────────────────────────
  // Χωρίς αυτό, ένας δείκτης που πάλιωσε θα έκανε το προφίλτρο να μη βρίσκει
  // τίποτα ⇒ «0 παραβιάσεις, πάντα» — το σχήμα «κανείς δεν κοίταξε».
  const expected = [...vocabularies.globalRoles].sort().join(',');
  const actual = [...registry.claimRoleVocabulary].sort().join(',');
  if (expected !== actual) {
    rows.push({
      id: 'claimRoleVocabulary',
      state: STATES.VOCABULARY_DRIFT,
      detail: `το μητρώο λέει [${actual}] ενώ το GLOBAL_ROLES λέει [${expected}]`,
    });
  }

  // ── ΤΑ ΑΡΧΕΙΑ ────────────────────────────────────────────────────────────
  for (const entry of entries) {
    const ghosts = ghostsOf(entry, known);
    for (const ghost of ghosts) {
      rows.push({
        id: `${ghost}@${entry.file}`,
        state: STATES.GHOST_ROLE,
        detail: `«${ghost}» στέκεται σε θέση ρόλου και δεν υπάρχει σε κανένα λεξιλόγιο`,
      });
    }

    const state = classifyFile(entry, { ssot, declared, seenDeclarations });
    rows.push({ id: entry.file, state, detail: detailFor(state, entry, declared) });
  }

  rows.push(...orphanDeclarations(declared, seenDeclarations));
  rows.push(...orphanLegacy(registry, entries));
  rows.push(...judgeRoleGuards(inventory));

  return { rows, tally: tallyOf(rows), known: [...known].sort() };
}

/** Η **σειρά** είναι συμβόλαιο: SSoT → δηλωμένος → κρίνει → απλή δήλωση πολιτικής. */
function classifyFile(entry, ctx) {
  if (ctx.ssot.has(entry.file)) return STATES.SSOT;
  if (ctx.declared.has(entry.file)) {
    ctx.seenDeclarations.add(entry.file);
    const why = ctx.declared.get(entry.file).why || '';
    return why.trim().length >= MIN_REASON
      ? STATES.DECLARED_DECIDER
      : STATES.REASONLESS_DECLARATION;
  }
  return entry.gate ? STATES.INLINE_DECIDER : STATES.POLICY_DECLARATION;
}

function detailFor(state, entry, declared) {
  if (state === STATES.REASONLESS_DECLARATION) {
    return `ο λόγος έχει ${(declared.get(entry.file).why || '').trim().length} χαρακτήρες (ελάχιστο ${MIN_REASON})`;
  }
  if (state === STATES.INLINE_DECIDER) {
    return `κρίνει με σύνολο ρόλων στη γραμμή ${entry.windows[0].line}`;
  }
  return `${entry.windows.length} παράθυρο(α)`;
}

function orphanDeclarations(declared, seen) {
  return [...declared.keys()]
    .filter((id) => !seen.has(id))
    .map((id) => ({
      id,
      state: STATES.ORPHAN_DECLARATION,
      detail: 'δηλωμένη εξαίρεση που δεν κρίνει πια (ή δεν υπάρχει) — σβήσε τη δήλωση',
    }));
}

/**
 * ⚠️ **Δηλωμένο legacy όνομα που ΔΕΝ εμφανίζεται πουθενά ⇒ ΜΠΛΟΚ.** Αλλιώς το
 * μητρώο κρατά για πάντα άδεια ονόματα και ο επόμενος δεν ξέρει ποια ισχύουν —
 * το ίδιο μάθημα με τα `_reservedNames` του CHECK 3.58.
 */
function orphanLegacy(registry, entries) {
  const seen = new Set();
  for (const entry of entries) {
    for (const win of entry.windows) {
      for (const name of namesInRolePosition(win)) seen.add(name);
    }
  }
  return (registry.legacyRoleNames || [])
    .filter((l) => !seen.has(l.name))
    .map((l) => ({
      id: `legacy:${l.name}`,
      state: STATES.ORPHAN_LEGACY,
      detail: `το «${l.name}» δεν στέκεται πουθενά σε θέση ρόλου — σβήσε τη δήλωση`,
    }));
}

/**
 * **ΚΛΕΙΣΤΗ ΛΟΓΙΣΤΙΚΗ, fail-closed.** Άγνωστη κατάσταση ⇒ `throw` **με όνομα**:
 * η λογιστική είναι το όργανο που εγγυάται ότι κανείς δεν χάνεται σιωπηλά, και
 * **δεν επιτρέπεται να χαθεί η ίδια σιωπηλά** (μάθημα CHECK 3.39 / `Κ15β`).
 */
function tallyOf(rows) {
  const t = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  for (const row of rows) {
    if (t[row.state] === undefined) throw new Error(`CHECK 3.68 — άγνωστη κατάσταση «${row.state}»`);
    t[row.state] += 1;
  }
  const sum = Object.values(t).reduce((a, b) => a + b, 0);
  if (sum !== rows.length) throw new Error(`CHECK 3.68 — η λογιστική δεν κλείνει: ${sum} ≠ ${rows.length}`);
  return t;
}

function idsOf(verdict, state) {
  return verdict.rows.filter((r) => r.state === state).map((r) => r.id);
}

module.exports = {
  STATES, BLOCKING, MIN_REASON,
  namesInRolePosition, ghostsOf, knownNames, ssotFiles,
  classifyFile, orphanDeclarations, orphanLegacy, judgeRoleGuards, tallyOf, idsOf, judge,
};
