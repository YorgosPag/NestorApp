#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.80 — Η ΠΥΛΗ ΤΟΥ ΘΑΝΑΣΙΜΟΥ ΚΥΚΛΟΥ (ADR-858 Δ4)
 * =============================================================================
 *
 * Ερώτημα: *«θα **ΣΚΑΣΕΙ** αυτός ο κύκλος;»* — όχι *«υπάρχει κύκλος;»*.
 *
 * 🔴 **ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ Η ΠΥΛΗ ΚΥΚΛΩΝ.** Το `depcruise:cycles` αναφέρει **1159** ευρήματα.
 * Τα 1158 είναι **αβλαβή** και το ένα έριξε την παραγωγή στις 2026-09-12
 * (`Cannot access 'o' before initialization`, σελίδα πωλήσεων που δεν ανοίγει καν τον CAD
 * viewer). Ένα σύνολο όπου το 99,9% είναι θόρυβος **δεν είναι σήμα** — γι' αυτό ο κύκλος
 * έζησε μήνες μέσα σε baseline που όλοι κοιτούσαν.
 *
 * 🔑 **Η ΔΙΑΚΡΙΣΗ**: κύκλος + **ανάγνωση εισαγόμενου binding σε χρόνο αξιολόγησης module**.
 * Χωρίς το δεύτερο, η σειρά αξιολόγησης δεν έχει σημασία· με αυτό, ο bundler αποφασίζει αν
 * βλέπεις τιμή ή `ReferenceError` — και **αλλάζει την απόφαση ανά build** (tree-shaking).
 * Γι' αυτό το ίδιο commit «δουλεύει τοπικά» και σκάει στην παραγωγή.
 *
 * 🏆 **ΠΡΩΤΟΤΥΠΙΑ, ΜΕΤΡΗΜΕΝΗ.** Η έρευνα (2026-09-12) δεν βρήκε **κανένα** εργαλείο —
 * madge · dpdm · skott · `import/no-cycle` · circular-dependency-plugin ·
 * dependency-cruiser — που να κάνει αυτή τη διάκριση. Το TC39 **`import defer`** (Stage 3)
 * θα την έκανε περιττή, αλλά **δεν υπάρχει** σε V8/Node/Next.js. Η levelization του Lakos
 * την προλαμβάνει με πειθαρχία· αυτή η πύλη τη **μετράει**.
 *
 * ⚠️ **ΔΗΛΩΜΕΝΟ ΟΡΙΟ**: λέει *«μπορεί να σκάσει»*, όχι *«σκάει»* — η έκβαση εξαρτάται από
 * το ποιο entry ξεκινά την αλυσίδα, ιδιότητα του **bundle**, όχι του κώδικα. Γι' αυτό
 * **RATCHET κατά ταυτότητα** και όχι zero-tolerance.
 *
 * Εκτέλεση:  npm run test:module-init
 * Παράκαμψη: SKIP_MODULE_INIT=1
 * 📘 docs/gates/3.80.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { buildGraph, findSCCs, PROJECT_ROOT } = require('./lib/module-init/graph');
const { judgeSCCs } = require('./lib/module-init/judge');

const BASELINE = path.join(PROJECT_ROOT, '.module-init-baseline.json');

const rel = (abs) => path.relative(PROJECT_ROOT, abs).split(path.sep).join('/');

/** Ταυτότητα: **ποιος διαβάζει ΤΙ από ποιον**. Ο αριθμός γραμμής ΔΕΝ μπαίνει (μετακίνηση ≠ νέα). */
const identityOf = (f) => `${rel(f.from)}→${rel(f.to)}|${f.names.join(',')}`;

function measure() {
  const { graph, sources, files } = buildGraph();
  const sccs = findSCCs(graph);
  const findings = judgeSCCs(sccs, graph, sources).map((f) => ({
    from: rel(f.from),
    to: rel(f.to),
    names: f.names,
    componentSize: f.componentSize,
  }));
  findings.sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));
  return {
    scanned: files.length,
    cyclicGroups: sccs.length,
    cyclicFiles: sccs.reduce((n, c) => n + c.length, 0),
    findings,
  };
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE)) return null;
  return new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).findings.map(identityOf));
}

function writeBaseline(m) {
  const payload = {
    description:
      'ADR-858 Δ4 — baseline της CHECK 3.80 (θανάσιμοι κύκλοι: ανάγνωση εισαγόμενου binding ' +
      'σε χρόνο αξιολόγησης module, μέσα σε SCC). ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ (ποιος διαβάζει ΤΙ από ' +
      'ποιον): νέο εύρημα μπλοκάρει ακόμη κι αν το πλήθος έπεσε. Ratchet DOWN-only.',
    generatedBy: 'node scripts/check-module-init.js --write-baseline',
    adr: 'ADR-858',
    gate: '3.80',
    total: m.findings.length,
    cyclicGroups: m.cyclicGroups,
    findings: m.findings,
  };
  fs.writeFileSync(BASELINE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`✅ Baseline: ${m.findings.length} θανάσιμες ακμές → ${rel(BASELINE)}`);
}

function printFinding(f, mark) {
  console.error(`   ${mark} ${f.from}`);
  console.error(`      ↳ διαβάζει σε ΧΡΟΝΟ ΑΞΙΟΛΟΓΗΣΗΣ: ${f.names.join(', ')}`);
  console.error(`      ↳ από: ${f.to}  (κύκλος ${f.componentSize} αρχείων)`);
}

function main() {
  if (process.env.SKIP_MODULE_INIT === '1') {
    console.log('⏭️  CHECK 3.80 — παρακάμφθηκε (SKIP_MODULE_INIT=1)');
    return;
  }

  const m = measure();

  if (process.argv.includes('--write-baseline')) return writeBaseline(m);

  if (process.argv.includes('--report')) {
    console.log(`📐 CHECK 3.80 — αρχεία ${m.scanned} · ομάδες κύκλων ${m.cyclicGroups} ` +
      `(${m.cyclicFiles} αρχεία) · θανάσιμες ακμές ${m.findings.length}`);
    for (const f of m.findings) printFinding(f, '•');
    return;
  }

  const known = loadBaseline();
  if (known === null) {
    console.error('❌ CHECK 3.80 — λείπει baseline. Σπείρε τη: npm run module-init:baseline');
    process.exit(1);
  }

  const added = m.findings.filter((f) => !known.has(identityOf(f)));

  // 🔑 Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΥΠΩΝΕΤΑΙ ΠΑΝΤΑ: πύλη που σάρωσε μηδέν αρχεία είναι επίσης «πράσινη».
  console.log(
    `📐 CHECK 3.80 — θανάσιμες ακμές: ${m.findings.length} (baseline ${known.size}) · ` +
    `ομάδες κύκλων ${m.cyclicGroups} (${m.cyclicFiles} αρχεία) · σαρώθηκαν ${m.scanned}`,
  );
  if (m.scanned < 1000) {
    console.error('❌ CHECK 3.80 — σαρώθηκαν λιγότερα από 1000 αρχεία: η σάρωση χάλασε.');
    process.exit(1);
  }

  if (added.length === 0) {
    console.log('✅ Κανένας ΝΕΟΣ θανάσιμος κύκλος.');
    return;
  }

  console.error(`\n❌ CHECK 3.80 — ${added.length} ΝΕΑ ακμή(ές) που μπορεί να σκάσει στην παραγωγή:\n`);
  for (const f of added.slice(0, 20)) printFinding(f, '🚫');
  if (added.length > 20) console.error(`   … και ${added.length - 20} ακόμη`);
  console.error('\n   Θεραπεία — ΜΙΑ από τις δύο, και η πρώτη είναι καλύτερη:');
  console.error('     1. ΣΠΑΣΕ ΤΟΝ ΚΥΚΛΟ — συνήθως ένα primitive εισάγει barrel. Βαθιά εισαγωγή.');
  console.error('     2. ΑΝΑΒΑΛΕ ΤΗΝ ΑΝΑΓΝΩΣΗ — μετακίνησέ τη μέσα σε συνάρτηση (`hydrateOnce()`,');
  console.error('        βλ. `stores/createPersistedValue.ts`). Το binding διαβάζεται στην κλήση.');
  console.error('   ⛔ ΜΗΝ κάνεις --write-baseline για να «περάσει»: το baseline είναι DOWN-only.');
  console.error('   📘 docs/gates/3.80.md · ADR-858');
  process.exit(1);
}

if (require.main === module) main();

module.exports = { measure, identityOf, loadBaseline, BASELINE, rel };
