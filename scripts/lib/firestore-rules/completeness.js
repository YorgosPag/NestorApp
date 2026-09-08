#!/usr/bin/env node
/**
 * CHECK 3.16 — **Validation G: ΚΑΜΙΑ ΜΗΤΡΑ ΔΕΝ ΕΙΝΑΙ ΜΕΡΙΚΗ ΣΙΩΠΗΛΑ** (ADR-298 Α21.16).
 *
 * Οι Validations A-F ρωτούν «υπάρχει σουίτα;», «συμφωνεί το σχήμα του κανόνα;».
 * Η **G** ρωτά το ερώτημα που κανείς δεν έκανε επί πέντε μήνες:
 *
 *     «δηλώνει αυτή η εγγραφή **και τα 35 κελιά**, ή σιωπά για κάποια;»
 *
 * ---------------------------------------------------------------------------
 * ΤΡΙΑ ΚΡΙΤΗΡΙΑ
 * ---------------------------------------------------------------------------
 *
 * **Κ1 ⛔ ZERO-TOL — πληρότητα.** `matrix + exemptions === 35` σε κάθε εγγραφή.
 *   Το επιβάλλει ήδη η `defineMatrix()` σε χρόνο φόρτωσης· εδώ ξαναρωτιέται
 *   επίτηδες *(N.7.2 #4, belt-and-suspenders)*: αν κάποιος «λύσει» το throw για
 *   να προχωρήσει, η πύλη το πιάνει στο `git add`.
 *
 * **Κ2 ⛔ ZERO-TOL — απαντήσιμη εξαίρεση.** Κάθε εξαίρεση φέρει `why` / `owner` /
 *   `since` / `review`. Χωρίς αυτά ξαναγεννιέται το ακριβές πρόβλημα που λύνουμε:
 *   **1.654 `reason` tags που κανείς δεν διαβάζει**.
 *
 * **Κ3 🔴 RATCHET — το χρέος μόνο μικραίνει.**
 *   ⚠️ Το ratchet είναι στα **ΕΙΔΗ** του χρέους, όχι στα στιγμιότυπα: κλειδί
 *   `πρότυπο → πρόσωπο:πράξη`. Ο λόγος είναι **μετρημένος** — το κενό ήταν
 *   **ανά πρότυπο**, ομοιόμορφα (και τα 14 `deny_all` στο 15/35, και τα 18
 *   `role_dual` στο 25/35). Μια **νέα συλλογή** που ακολουθεί υπάρχον πρότυπο
 *   δεν προσθέτει **καμία** νέα άγνωστη πρόθεση — θα ήταν λάθος να μπλοκαριστεί,
 *   και θα οδηγούσε στο γνωστό αντίδοτο: να γραφτούν κελιά «για να περάσει»,
 *   δηλαδή **κελιά με μαντεμένη πρόθεση**, που είναι χειρότερα από κενά.
 *   Ό,τι **ανεβαίνει** ως πλήθος το λέει η αναφορά ρητά, με ονόματα.
 *
 *   Το `collectionExtras` κλείνει τη μοναδική τρύπα αυτής της επιλογής: εξαίρεση
 *   που μια **συλλογή** έχει ενώ το **πρότυπό** της δεν την έχει (μπορεί να
 *   προκύψει μόνο από χειρόγραφη παρέμβαση) είναι ⛔ zero-tolerance.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ ΛΗΓΜΕΝΗ ΕΠΑΝΕΞΕΤΑΣΗ = **ΠΡΟΕΙΔΟΠΟΙΗΣΗ**, ΟΧΙ ΜΠΛΟΚΟ — ΕΠΙΤΗΔΕΣ
 * ---------------------------------------------------------------------------
 * Ένα `review` που πέρασε θα μπλόκαρε commit που **δεν άγγιξε τίποτα σχετικό**,
 * μόνο επειδή κύλησε το ημερολόγιο («time bomb»). Το πρότυπο του Chromium για τα
 * `expires_after` των histograms είναι **ορατότητα**, όχι διακοπή — και μια
 * πύλη που σταματά τυχαία δουλειά μαθαίνει στον κόσμο να την παρακάμπτει.
 *
 * @see ADR-298 §8 Α21.16
 * @see tests/firestore-rules/_registry/coverage-completeness.ts — ο κατασκευαστής
 * @module scripts/lib/firestore-rules/completeness
 */

'use strict';

const path = require('node:path');

const { loadBaseline, writeBaselineFile } = require('../ratchet-baseline');
const { loadCoverageManifest, PROJECT_ROOT } = require('./load-manifest');

const BASELINE_FILE = path.join(
  PROJECT_ROOT,
  '.firestore-rules-coverage-baseline.json',
);

/** 7 πρόσωπα × 5 πράξεις. Δεν διαβάζεται από αλλού επίτηδες: αν αλλάξει ο
 *  πληθυσμός των προσώπων, η αναντιστοιχία **πρέπει** να χτυπήσει εδώ. */
const REQUIRED_CELLS = 35;

const cellKey = (c) => `${c.persona}:${c.operation}`;

// ---------------------------------------------------------------------------
// Μέτρηση
// ---------------------------------------------------------------------------

/**
 * Διαβάζει το μητρώο και παράγει την τρέχουσα εικόνα του χρέους.
 *
 * @returns {{
 *   patterns: Record<string, Record<string, number>>,
 *   collectionExtras: Record<string, string[]>,
 *   totals: { collections: number, cells: number, exemptions: number },
 *   partial: { collection: string, declared: number, exempt: number }[],
 *   malformed: string[],
 *   expired: { collection: string, cell: string, review: string, owner: string }[],
 * }}
 */
function measure(today = new Date().toISOString().slice(0, 10)) {
  const { coverage } = loadCoverageManifest();

  /**
   * builder → κελί → πόσες συλλογές το εξαιρούν.
   *
   * ⚠️ **ΑΝΑ BUILDER, ΟΧΙ ΑΝΑ `pattern` — ΜΕΤΡΗΘΗΚΕ.** Ένα `RulesPattern`
   * φιλοξενεί **πολλούς** builders με διαφορετικά κενά (το `tenant_direct` έχει
   * `tenantDirectMatrix`, `crmDirectMatrix`, `attendanceEventMatrix`,
   * `contactRelationshipsMatrix`…). Με ομαδοποίηση κατά `pattern` οι
   * «αποκλίνουσες» συλλογές βγήκαν **65** από 127 — θόρυβος. Ανά builder: **12**,
   * και όλες πραγματικές. Θόρυβος σε πύλη δεν είναι αυστηρότητα· είναι ο τρόπος
   * να πάψει να τη διαβάζει ο κόσμος.
   */
  const builders = {};
  /** συλλογή → τα κελιά που ΑΥΤΗ εξαιρεί (σχήμα v2 του ADR-749, ανά ζεύγος). */
  const perCollection = {};
  /** συλλογή → builder, ώστε μια ΝΕΑ συλλογή να κριθεί με το χρέος του δικού της. */
  const builderOf = {};
  const partial = [];
  const malformed = [];
  const expired = [];
  let cells = 0;
  let exemptions = 0;

  for (const entry of coverage) {
    const declared = entry.matrix?.length ?? 0;
    const exempt = entry.exemptions?.length ?? 0;
    cells += declared;
    exemptions += exempt;

    if (declared + exempt !== REQUIRED_CELLS) {
      partial.push({ collection: entry.collection, declared, exempt });
    }

    const bucket = (builders[entry.matrixId] ||= {});
    const own = (perCollection[entry.collection] ||= []);
    builderOf[entry.collection] = entry.matrixId;
    for (const e of entry.exemptions || []) {
      const key = cellKey(e);
      bucket[key] = (bucket[key] || 0) + 1;
      own.push(key);

      if (
        !e.why ||
        e.why.trim().length < 40 ||
        !e.owner ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.since || '') ||
        !/^\d{4}-\d{2}-\d{2}$/.test(e.review || '')
      ) {
        malformed.push(`${entry.collection} → ${key}`);
      } else if (e.review < today) {
        expired.push({
          collection: entry.collection,
          cell: key,
          review: e.review,
          owner: e.owner,
        });
      }

    }
  }

  for (const keys of Object.values(perCollection)) keys.sort();

  return {
    builders,
    perCollection,
    builderOf,
    totals: { collections: coverage.length, cells, exemptions },
    partial,
    malformed,
    expired,
  };
}

// ---------------------------------------------------------------------------
// Σύγκριση με τη baseline
// ---------------------------------------------------------------------------

/**
 * @returns {{ violations: string[], notes: string[] }}
 */
function compare(current, baseline) {
  const violations = [];
  const notes = [];

  if (!baseline) {
    violations.push(
      'Λείπει το `.firestore-rules-coverage-baseline.json`. Σπείρ\' το με ' +
        '`node scripts/check-firestore-rules-test-coverage.js --generate-baseline` ' +
        'ΑΦΟΥ επιβεβαιώσεις ότι η τρέχουσα εικόνα είναι αυτή που θέλεις να κλειδώσεις.',
    );
    return { violations, notes };
  }
  if (baseline.__invalid) {
    violations.push(
      'Το `.firestore-rules-coverage-baseline.json` είναι χαλασμένο. Μια ' +
        'χαλασμένη baseline ΔΕΝ επιτρέπεται να διαβαστεί ως «0 παραβιάσεις».',
    );
    return { violations, notes };
  }

  // -------------------------------------------------------------------------
  // Κ3α — ΥΠΑΡΧΟΥΣΑ ΣΥΛΛΟΓΗ: ⛔ μηδενική ανοχή, ανά (συλλογή, κελί).
  //
  // Σχήμα v2 του ADR-749, μεταφρασμένο εδώ. Το «ανά ζεύγος» ΔΕΝ είναι υπερβολή:
  // ratchet σε **σύνολο** αφήνει την **ανταλλαγή** να περάσει — μια συλλογή
  // κλείνει το `anonymous:delete` και ανοίγει το `same_tenant_user:create`, ο
  // αριθμός μένει ίδιος, και το χρέος **μετακινήθηκε** αντί να μικρύνει.
  // -------------------------------------------------------------------------
  const basePerCollection = baseline.perCollection || {};
  const baseBuilders = baseline.builders || {};

  for (const [collection, keys] of Object.entries(current.perCollection)) {
    const known = basePerCollection[collection];

    if (known === undefined) {
      // Κ3β — ΝΕΑ ΣΥΛΛΟΓΗ: επιτρέπεται μόνο **γνωστό είδος** χρέους.
      //
      // ⚠️ Γιατί όχι σκέτο ⛔: μια νέα συλλογή που γράφεται
      // `...tenantDirectMatrix()` κληρονομεί τις **ίδιες** ανοιχτές προθέσεις που
      // ήδη ξέρουμε — δεν γεννά καμία καινούργια. Μπλοκάροντάς την, η πύλη θα
      // δίδασκε το γνωστό αντίδοτο: να γραφτούν κελιά «για να περάσει», δηλαδή
      // κελιά με **μαντεμένη** πρόθεση, που είναι χειρότερα από κενά.
      const builderDebt = baseBuilders[current.builderOf[collection]] || {};
      const unknown = keys.filter((k) => !(k in builderDebt));
      if (unknown.length > 0) {
        violations.push(
          `ΝΕΑ ΣΥΛΛΟΓΗ ΜΕ ΑΓΝΩΣΤΟ ΧΡΕΟΣ: η \`${collection}\` ` +
            `(builder \`${current.builderOf[collection]}\`) εξαιρεί ` +
            `${unknown.join(', ')} — κελιά που ο builder της ΔΕΝ εξαιρούσε στη ` +
            'baseline. Νέα συλλογή επιτρέπεται να κληρονομήσει γνωστές ανοιχτές ' +
            'προθέσεις· δεν επιτρέπεται να γεννήσει καινούργιες.',
        );
      } else if (keys.length > 0) {
        notes.push(
          `\`${collection}\`: νέα συλλογή, ${keys.length} κληρονομημένες ` +
            'εξαιρέσεις από το πρότυπό της (ΟΧΙ νέο είδος χρέους).',
        );
      }
      continue;
    }

    const knownSet = new Set(known);
    for (const key of keys) {
      if (!knownSet.has(key)) {
        violations.push(
          `ΤΟ ΧΡΕΟΣ ΜΕΓΑΛΩΣΕ: η συλλογή \`${collection}\` εξαιρεί πλέον το κελί ` +
            `\`${key}\`, που στη baseline ήταν **δηλωμένο**. Το ratchet πάει μόνο ` +
            'προς τα κάτω: ένα κελί που κάποτε εκτελούνταν δεν ξαναγίνεται ' +
            'ανοιχτή ερώτηση χωρίς λόγο που να το εξηγεί.',
        );
      }
    }
  }

  const baseTotal = baseline.totals?.exemptions;
  if (typeof baseTotal === 'number' && current.totals.exemptions < baseTotal) {
    notes.push(
      `✅ Το χρέος έπεσε: ${baseTotal} → ${current.totals.exemptions} εξαιρέσεις. ` +
        'Ξανασπείρε τη baseline για να κλειδώσει η πρόοδος ' +
        '(`--generate-baseline`).',
    );
  }

  return { violations, notes };
}

// ---------------------------------------------------------------------------
// Δημόσια επιφάνεια
// ---------------------------------------------------------------------------

/**
 * Τρέχει ολόκληρη τη Validation G.
 *
 * @returns {{ violations: string[], warnings: string[], notes: string[], current: object }}
 */
function validateCompleteness() {
  const current = measure();
  const violations = [];
  const warnings = [];

  for (const p of current.partial) {
    violations.push(
      `Κ1 ΜΕΡΙΚΗ ΜΗΤΡΑ: \`${p.collection}\` δηλώνει ${p.declared} κελιά + ` +
        `${p.exempt} εξαιρέσεις = ${p.declared + p.exempt}, όχι ${REQUIRED_CELLS}. ` +
        'Η `defineMatrix()` έπρεπε να το είχε σταματήσει — αν φτάσαμε εδώ, ' +
        'κάποιος παρέκαμψε τον κατασκευαστή.',
    );
  }
  for (const m of current.malformed) {
    violations.push(
      `Κ2 ΑΝΑΠΑΝΤΗΤΗ ΕΞΑΙΡΕΣΗ: ${m} — λείπει \`why\` (≥40 χαρ.), \`owner\`, ` +
        '`since` ή `review`. Εξαίρεση χωρίς λόγο και ιδιοκτήτη δεν κλείνει ποτέ.',
    );
  }

  const baseline = loadBaseline(BASELINE_FILE);
  const { violations: ratchet, notes } = compare(current, baseline);
  violations.push(...ratchet);

  if (current.expired.length > 0) {
    const byOwner = new Map();
    for (const e of current.expired) {
      byOwner.set(e.owner, (byOwner.get(e.owner) || 0) + 1);
    }
    warnings.push(
      `⏰ ${current.expired.length} εξαιρέσεις πέρασαν την ημερομηνία ` +
        `επανεξέτασης (${[...byOwner]
          .map(([o, n]) => `${o}: ${n}`)
          .join(', ')}). ΔΕΝ μπλοκάρει — αλλά η ερώτηση έχει ωριμάσει.`,
    );
  }

  return { violations, warnings, notes, current };
}

/** Γράφει τη baseline από **το ίδιο εκτελέσιμο** με τον έλεγχο (PHPStan/ESLint). */
function generateBaseline() {
  const current = measure();
  writeBaselineFile(BASELINE_FILE, {
    _meta: {
      description:
        'ADR-298 Α21.16 — ratchet πληρότητας της μήτρας κάλυψης Firestore ' +
        'rules. Κάθε εγγραφή δηλώνει και τα 35 κελιά: είτε εκτελέσιμο κελί, ' +
        'είτε εξαίρεση με λόγο/ιδιοκτήτη/ημερομηνία επανεξέτασης.',
      schema: 1,
      generated: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      rule:
        'ΑΝΑ (συλλογή, κελί): καμία υπάρχουσα συλλογή δεν αποκτά εξαίρεση που ' +
        'δεν είχε — έτσι μπλοκάρει και η ΑΝΤΑΛΛΑΓΗ, όχι μόνο η αύξηση. Νέα ' +
        'συλλογή επιτρέπεται να κληρονομήσει τις ΓΝΩΣΤΕΣ ανοιχτές προθέσεις του ' +
        'builder της, ποτέ να γεννήσει καινούργιες.',
      engine: 'scripts/lib/firestore-rules/completeness.js (ΜΙΑ μηχανή — ADR-749)',
      howToRead:
        '`builders` = το ΕΙΔΟΣ του χρέους (builder → κελί → πόσες συλλογές). ' +
        '`perCollection` = το ΣΤΙΓΜΙΟΤΥΠΟ. Άνοιξε ΑΥΤΟ το αρχείο πριν ' +
        'επικαλεστείς αριθμό — μην τον αντιγράψεις από πρόζα (N.12).',
    },
    totals: current.totals,
    builders: current.builders,
    perCollection: current.perCollection,
  });
  return current;
}

module.exports = {
  BASELINE_FILE,
  REQUIRED_CELLS,
  measure,
  compare,
  validateCompleteness,
  generateBaseline,
};
