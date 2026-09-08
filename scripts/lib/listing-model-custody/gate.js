/**
 * Η ΜΗΧΑΝΗ ΤΗΣ ΠΥΛΗΣ ΤΗΣ ΕΠΙΜΕΛΕΙΑΣ ΤΟΥ ΜΟΝΤΕΛΟΥ (CHECK 3.76 · ADR-845 §8)
 *
 * ⚠️ **ΓΡΑΜΜΕΣ, ΟΧΙ AST — ΚΑΙ Ο ΛΟΓΟΣ ΓΡΑΦΕΤΑΙ ΕΔΩ ΓΙΑ ΝΑ ΜΗΝ «ΔΙΟΡΘΩΘΕΙ».**
 * Το ερώτημα είναι *«καλεί κάποιος αυτό το σύμβολο;»*, και η **μόνη** σύγχυση που
 * μπορεί να προκύψει είναι η αναφορά μέσα σε τεκμηρίωση — τα `{@link …}` του ίδιου
 * του κώδικα. Αυτό λύνεται **πλήρως** παραλείποντας τις γραμμές σχολίου, χωρίς
 * parser. Ένα AST εδώ θα ήταν δεύτερη μηχανή για ερώτημα που δεν τη χρειάζεται.
 *
 * 🔶 **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: κλήση γραμμένη **μέσα σε συμβολοσειρά** σε γραμμή που δεν
 * είναι σχόλιο θα μετρούσε ως κλήση. Δεν θεραπεύεται, **επίτηδες**: το σφάλμα
 * είναι προς την **ασφαλή** μεριά *(ψευδώς θετικό σε κώδικα που ούτως ή άλλως
 * μιλά για το σύμβολο)*, και η αντίθετη κατεύθυνση — να χαθεί αληθινή κλήση —
 * είναι η μόνη που κάνει την πύλη να λέει ψέματα.
 *
 * @module scripts/lib/listing-model-custody/gate
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  CALL_OWNERS,
  FORBIDDEN_EMPTYING,
  GATE_STATES,
  GUARDED_SYMBOLS,
  GUARD_STATES,
  MIN_REASON_LENGTH,
  REQUIRED_ANCHORS,
  isCallOwner,
  repoRelativePosix,
} = require('./contract.js');

/** Ό,τι μπλοκάρει το commit — **κλειστό σύνολο**, ώστε νέα κατάσταση να μη σιωπά. */
const BLOCKING = Object.freeze([
  GATE_STATES.CUSTODY_BYPASS,
  GATE_STATES.MANUAL_EMPTYING,
  GUARD_STATES.ORPHAN_OWNER,
  GUARD_STATES.REASONLESS_OWNER,
  GUARD_STATES.ORPHAN_SYMBOL,
  GUARD_STATES.ANCHOR_ABSENT,
  GUARD_STATES.ANCHOR_QUESTION_LOST,
]);

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage']);

/** Οι γραμμές που **εκτελούνται** — χωρίς σχόλια. Δες το δηλωμένο όριο στην κεφαλίδα. */
function executableLines(source) {
  return source.split(/\r?\n/).filter((line) => {
    const t = line.trim();
    return t !== '' && !t.startsWith('*') && !t.startsWith('//') && !t.startsWith('/*');
  });
}

/** Κάθε `.ts`/`.tsx` κάτω από τη ρίζα, εκτός δοκιμών. */
function collectSources(dir, root, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name === '__tests__') continue;
      collectSources(full, root, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Καλεί αυτό το αρχείο το σύμβολο — σε γραμμή που **εκτελείται**; */
function callsSymbol(lines, symbol) {
  const call = new RegExp(`\\b${symbol}\\s*\\(`);
  return lines.some((line) => call.test(line));
}

/** Ορίζει αυτό το αρχείο το σύμβολο; */
function definesSymbol(lines, symbol) {
  const def = new RegExp(`\\b(?:function|const|let)\\s+${symbol}\\b`);
  return lines.some((line) => def.test(line));
}

/** Η ταξινόμηση **ενός** αρχείου — μία ερώτηση, μία απάντηση. */
function classifyFile(rel, source, symbolTable = GUARDED_SYMBOLS) {
  const symbols = Object.keys(symbolTable);
  const mentionsAny = symbols.some((s) => source.includes(s));
  const lines = executableLines(source);

  if (FORBIDDEN_EMPTYING.pattern.test(lines.join('\n')) && !isCallOwner(rel)) {
    return { state: GATE_STATES.MANUAL_EMPTYING, detail: FORBIDDEN_EMPTYING.reason, symbols: [] };
  }
  if (!mentionsAny) return { state: GATE_STATES.NOT_A_CUSTODY_FILE, symbols: [] };

  const defined = symbols.filter((s) => definesSymbol(lines, s));
  const called = symbols.filter((s) => !defined.includes(s) && callsSymbol(lines, s));

  if (called.length === 0 && defined.length > 0) {
    return { state: GATE_STATES.DEFINER, symbols: defined };
  }
  if (called.length === 0) return { state: GATE_STATES.MENTION_ONLY, symbols: [] };
  if (isCallOwner(rel)) return { state: GATE_STATES.OWNER, symbols: called };

  return {
    state: GATE_STATES.CUSTODY_BYPASS,
    symbols: called,
    detail: called.map((s) => `${s}: ${symbolTable[s]}`).join(' | '),
  };
}

/**
 * Κ1′ — οι **δηλώσεις** ιδιοκτησίας κρίνονται χωριστά από τα αρχεία.
 *
 * ⚠️ Τα κλειστά σύνολα περνούν ως **παράμετροι με προεπιλογή**, όχι ως κλειστά
 * `require`: αλλιώς η άγκυρα δεν μπορεί να **μεταλλάξει την είσοδο** και το μόνο
 * που θα αποδείκνυε θα ήταν *«σήμερα είναι πράσινο»* — δηλαδή τίποτα.
 */
function auditOwners(callersByOwner, owners = CALL_OWNERS) {
  const findings = [];
  for (const [rel, reason] of Object.entries(owners)) {
    if (typeof reason !== 'string' || reason.trim().length < MIN_REASON_LENGTH) {
      findings.push({ state: GUARD_STATES.REASONLESS_OWNER, rel, detail: 'λόγος < 40 χαρακτήρες' });
    }
    if (!callersByOwner.has(rel)) {
      findings.push({
        state: GUARD_STATES.ORPHAN_OWNER,
        rel,
        detail: 'δηλωμένος ιδιοκτήτης που ΔΕΝ καλεί πια — το κλειστό σύνολο σάπισε σιωπηλά',
      });
    }
  }
  return findings;
}

/** Κ3 — **κανένα** φυλασσόμενο σύμβολο δεν επιτρέπεται να μείνει χωρίς καλούντα. */
function auditSymbolReach(callerCount, symbols = GUARDED_SYMBOLS) {
  return Object.entries(symbols)
    .filter(([symbol]) => (callerCount.get(symbol) ?? 0) === 0)
    .map(([symbol, why]) => ({
      state: GUARD_STATES.ORPHAN_SYMBOL,
      rel: symbol,
      detail: `μηδέν μη-test καλούντες — ο μηχανισμός είναι ΝΕΚΡΟΣ ενώ η πύλη θα έλεγε «καθαρό». ${why}`,
    }));
}

/** Κ4 — οι άγκυρες υπάρχουν και **ρωτούν ακόμη** ό,τι υποσχέθηκαν. */
function auditAnchors(root, anchors = REQUIRED_ANCHORS) {
  const findings = [];
  for (const [rel, titles] of Object.entries(anchors)) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
      findings.push({ state: GUARD_STATES.ANCHOR_ABSENT, rel, detail: 'το αρχείο της άγκυρας λείπει' });
      continue;
    }
    const source = fs.readFileSync(full, 'utf8');
    for (const title of titles) {
      if (!source.includes(title)) {
        findings.push({ state: GUARD_STATES.ANCHOR_QUESTION_LOST, rel, detail: `χάθηκε: «${title}»` });
      }
    }
  }
  return findings;
}

/** Το πλήρες πέρασμα — **ένα**, πάνω στο `src/`. */
function sweep(root) {
  const files = collectSources(path.join(root, 'src'), root);
  const tally = Object.create(null);
  const violations = [];
  const callersByOwner = new Map();
  const callerCount = new Map();

  for (const full of files) {
    const rel = repoRelativePosix(full, root);
    const verdict = classifyFile(rel, fs.readFileSync(full, 'utf8'));
    tally[verdict.state] = (tally[verdict.state] ?? 0) + 1;
    for (const symbol of verdict.symbols) {
      if (verdict.state === GATE_STATES.DEFINER) continue;
      callerCount.set(symbol, (callerCount.get(symbol) ?? 0) + 1);
    }
    if (verdict.state === GATE_STATES.OWNER) callersByOwner.set(rel, verdict.symbols);
    if (BLOCKING.includes(verdict.state)) {
      violations.push({ state: verdict.state, rel, detail: verdict.detail ?? '' });
    }
  }

  const guardFindings = [
    ...auditOwners(callersByOwner),
    ...auditSymbolReach(callerCount),
    ...auditAnchors(root),
  ];
  const guardTally = Object.create(null);
  for (const f of guardFindings) guardTally[f.state] = (guardTally[f.state] ?? 0) + 1;
  guardTally[GUARD_STATES.GUARD_HEALTHY] = guardFindings.length === 0 ? 1 : 0;

  return {
    tally,
    guardTally,
    scanned: files.length,
    violations: [...violations, ...guardFindings],
  };
}

module.exports = {
  BLOCKING,
  auditAnchors,
  auditOwners,
  auditSymbolReach,
  classifyFile,
  collectSources,
  executableLines,
  sweep,
};
