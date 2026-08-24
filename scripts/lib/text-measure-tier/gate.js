/**
 * CHECK 3.64 — Η ΚΡΙΣΗ ΤΗΣ ΒΑΘΜΙΔΑΣ ΜΕΤΡΗΣΗΣ (ADR-799 Φάση 2)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ΤΟ ΕΡΩΤΗΜΑ: «μέτρησε αυτή η σουίτα κείμενο σε βαθμίδα που **ΔΕΝ ΒΛΕΠΕΙ** ό,τι
 * της ζητήθηκε — και αν ναι, το ξέρει κάποιος;»
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🔑 **ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ «tier 3»** — είναι «tier 3 **ΚΑΙ** ζητήθηκε στυλ».
 * Μετρημένο ζωντανά: σουίτες όπως το ίδιο το `text-advance.test.ts` μετρούν **επίτηδες** σε
 * `nominal` χωρίς να ζητούν `bold`/`italic`/οικογένεια ⇒ η βαθμίδα απαντά **ακριβώς** την
 * ερώτηση και **δεν** είναι παραβίαση. Κριτήριο «όποιος πέφτει σε tier 3» θα τις κατήγγειλε
 * όλες — δεκάδες ψευδώς θετικά, πολύ πάνω από τον πήχη **<10%**, ακριβώς η παγίδα που
 * ονομάζει το ADR-799 §7.
 *
 * ⚠️ **ΠΑΡΑΤΗΡΗΣΗ, ΟΧΙ ΕΥΡΕΤΙΚΟ**: το `dropped` είναι **παραγόμενο** από (αίτημα × βαθμίδα)
 * μέσα στην ίδια την κλήση που έδωσε τον αριθμό. Μηδέν ψευδώς θετικά **εξ ορισμού**.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { readCensus, staleInputs, isBlind } = require('./census.js');

const DECLARATIONS_FILE = '.text-measure-tier.json';
const MIN_REASON_LENGTH = 40;

const GATE_STATES = Object.freeze({
  // Α · ΣΟΥΙΤΕΣ
  UNDECLARED_BLIND: 'undeclared-blind-measure',
  DECLARED_BLIND: 'declared-blind-measure',
  STYLED_MEASURE: 'styled-measure',
  HONEST_NOMINAL: 'honest-nominal',
  // Β · ΔΗΛΩΣΕΙΣ
  ORPHAN_DECLARATION: 'orphan-declaration',
  REASONLESS_DECLARATION: 'reasonless-declaration',
  DECLARATION_USED: 'declaration-used',
  // Γ · ΑΠΟΓΡΑΦΗ
  MISSING_CENSUS: 'missing-census',
  STALE_CENSUS: 'stale-census',
  CENSUS_FRESH: 'census-fresh',
});

const S = GATE_STATES;

const LEDGER_STATES = Object.freeze({
  suites: [S.UNDECLARED_BLIND, S.DECLARED_BLIND, S.STYLED_MEASURE, S.HONEST_NOMINAL],
  declarations: [S.ORPHAN_DECLARATION, S.REASONLESS_DECLARATION, S.DECLARATION_USED],
  census: [S.MISSING_CENSUS, S.STALE_CENSUS, S.CENSUS_FRESH],
});

const BLOCKING = Object.freeze([
  S.UNDECLARED_BLIND,
  S.ORPHAN_DECLARATION,
  S.REASONLESS_DECLARATION,
  S.MISSING_CENSUS,
  S.STALE_CENSUS,
]);

const tallyOf = (states) => Object.fromEntries(states.map((s) => [s, 0]));

/** Fail-closed: κακοσχηματισμένο ⇒ σφάλμα με όνομα, ποτέ σιωπηλό `{}`. */
function loadDeclarations(repoRoot) {
  const file = path.join(repoRoot, DECLARATIONS_FILE);
  if (!fs.existsSync(file)) {
    throw new Error(`${DECLARATIONS_FILE} λείπει — το κλειστό σύνολο είναι μέρος της πύλης.`);
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!raw || typeof raw.blindMeasureSuites !== 'object' || raw.blindMeasureSuites === null) {
    throw new Error(`${DECLARATIONS_FILE}: περίμενα αντικείμενο "blindMeasureSuites".`);
  }
  return raw.blindMeasureSuites;
}

/**
 * Α · ΣΟΥΙΤΕΣ — **η σειρά είναι συμβόλαιο**: πρώτα το τυφλό, ώστε μια σουίτα που μετρά και
 * σωστά και τυφλά να **μην** κρύβεται πίσω από το σωστό της μισό.
 */
function judgeSuites(observations, declarations, push, used) {
  for (const obs of observations) {
    if (isBlind(obs)) {
      if (declarations[obs.file]) {
        used.add(obs.file);
        push(S.DECLARED_BLIND, obs.file, `${obs.nominal}× nominal, χαμένοι άξονες: ${obs.dropped.join('+')}`);
      } else {
        push(S.UNDECLARED_BLIND, obs.file,
          `${obs.nominal}× μέτρηση σε βαθμίδα που ΔΕΝ βλέπει: ${obs.dropped.join('+')}`);
      }
      continue;
    }
    if (obs.glyph + obs.css > 0) {
      push(S.STYLED_MEASURE, obs.file, `glyph=${obs.glyph} css=${obs.css}`);
      continue;
    }
    push(S.HONEST_NOMINAL, obs.file, `${obs.nominal}× nominal, κανένας άξονας δεν ζητήθηκε`);
  }
}

/** Β · ΔΗΛΩΣΕΙΣ — κλειστό σύνολο με υποχρεωτικό λόγο. */
function judgeDeclarations(declarations, used, push) {
  for (const [file, entry] of Object.entries(declarations).sort()) {
    const reason = entry && typeof entry === 'object' ? entry.reason : null;
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      push(S.REASONLESS_DECLARATION, file, `ο λόγος είναι ΥΠΟΧΡΕΩΤΙΚΟΣ και >=${MIN_REASON_LENGTH} χαρακτήρες`);
      continue;
    }
    if (!used.has(file)) {
      push(S.ORPHAN_DECLARATION, file, 'δεν παρατηρήθηκε ποτέ τυφλή μέτρηση — σβήσε τη δήλωση');
      continue;
    }
    push(S.DECLARATION_USED, file, reason);
  }
}

/**
 * Γ · ΑΠΟΓΡΑΦΗ — *κρίνουμε φάντασμα;*
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: το αποτύπωμα καλύπτει τη μηχανή μέτρησης και τις **ήδη
 * παρατηρημένες** σουίτες. Μια **ΝΕΑ** σουίτα που αρχίζει να μετρά τυφλά είναι, εξ ορισμού,
 * αόρατη σε αποθηκευμένη απογραφή — γι' αυτό το **Layer 2 τρέχει την απογραφή ΑΝΕΥ ΟΡΩΝ**.
 * Το Layer 1 φυλά την **παλινδρόμηση**· το Layer 2 φυλά την **ανακάλυψη**.
 */
function judgeCensus(repoRoot, census, push) {
  if (!census) {
    push(S.MISSING_CENSUS, 'απογραφή', 'τρέξε `npm run text-measure:census`');
    return;
  }
  const drifted = staleInputs(repoRoot, census);
  if (drifted.length > 0) {
    push(S.STALE_CENSUS, 'απογραφή', `άλλαξαν από την τελευταία εκτέλεση: ${drifted.slice(0, 4).join(', ')}${drifted.length > 4 ? ` (+${drifted.length - 4})` : ''}`);
    return;
  }
  push(S.CENSUS_FRESH, 'απογραφή', `${census.observations.length} σουίτες παρατηρημένες`);
}

function sweep(repoRoot) {
  const declarations = loadDeclarations(repoRoot);
  const census = readCensus(repoRoot);

  const ledgers = {};
  const rows = [];
  for (const [name, states] of Object.entries(LEDGER_STATES)) ledgers[name] = { tally: tallyOf(states), population: 0 };
  const pushTo = (ledger) => (state, id, detail) => {
    if (!LEDGER_STATES[ledger].includes(state)) throw new Error(`ΑΓΝΩΣΤΗ κατάσταση "${state}" στο katastixo ${ledger}`);
    ledgers[ledger].tally[state] += 1;
    rows.push({ ledger, state, id, detail });
  };

  const used = new Set();
  judgeCensus(repoRoot, census, pushTo('census'));
  judgeSuites(census ? census.observations : [], declarations, pushTo('suites'), used);
  judgeDeclarations(declarations, used, pushTo('declarations'));

  for (const [name, states] of Object.entries(LEDGER_STATES)) {
    ledgers[name].population = states.reduce((n, s) => n + ledgers[name].tally[s], 0);
  }
  return { ledgers, rows, violations: rows.filter((r) => BLOCKING.includes(r.state)), census, declarations };
}

module.exports = { DECLARATIONS_FILE, MIN_REASON_LENGTH, GATE_STATES, LEDGER_STATES, BLOCKING, loadDeclarations, sweep };
