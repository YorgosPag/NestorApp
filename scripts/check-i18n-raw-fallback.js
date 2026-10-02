#!/usr/bin/env node
/**
 * CHECK 3.97 — Η ΠΥΛΗ ΤΗΣ ΩΜΗΣ ΕΦΕΔΡΕΙΑΣ i18n (ADR-898 §18.2)
 * «Δείχνει αυτή η κλήση `t(…)` την ΩΜΗ τιμή όταν λείψει το κλειδί;»
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (μετρημένο 2026-10-02)**: η λίστα κτιρίων έδειχνε ωμά `in_progress` / `mixed` / `commercial`.
 *    Ο κώδικας ζητούσε `category.${x}` ενώ το locale είχε `categories.${x}` — και το `defaultValue: category`
 *    το έκρυβε ΜΗΝΕΣ: ούτε ο άνθρωπος έβλεπε ωμό κλειδί, ούτε το CHECK 3.8 κλειδί που λείπει (δυναμικό).
 *    Το N.11 πιάνει ΜΟΝΟ κυριολεκτικό `defaultValue`· χειρότερα, το `check-hardcoded-strings.sh` ΣΥΜΒΟΥΛΕΥΕ
 *    `defaultValue: \`${var}\`` ως «διόρθωση».
 * 🔑 AST (TypeScript compiler API), ΟΧΙ regex — ο ανιχνευτής και το σκεπτικό: `lib/i18n-raw-fallback/detect.js`.
 * 🔴 RATCHET ανά αρχείο (`.i18n-raw-fallback-baseline.json`): νέο αρχείο με εύρημα / αύξηση ⇒ ΜΠΛΟΚ.
 *
 * CLI:
 *   node scripts/check-i18n-raw-fallback.js a.tsx b.ts       # staged (pre-commit, Phase 1)
 *   node scripts/check-i18n-raw-fallback.js --all            # πλήρες `src/`
 *   node scripts/check-i18n-raw-fallback.js --write-baseline # reseed (πάντα πλήρες)
 *
 * Env: SKIP_I18N_RAW_FALLBACK=1 · I18N_RAW_FALLBACK_ROOT · I18N_RAW_FALLBACK_BASELINE_FILE (fixtures των tests)
 * Exit: 0 = εντάξει · 1 = παλινδρόμηση ή baseline λείπει/χαλασμένη (fail-closed).
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { findRawFallbacks } = require('./lib/i18n-raw-fallback/detect');
const { inScope, walkScope, compare, totals, normalize } = require('./lib/i18n-raw-fallback/ratchet');
const { PROJECT_ROOT, loadBaseline, writeBaselineFile } = require('./lib/ratchet-baseline');

const ROOT = process.env.I18N_RAW_FALLBACK_ROOT || PROJECT_ROOT;
const BASELINE = process.env.I18N_RAW_FALLBACK_BASELINE_FILE || path.join(ROOT, '.i18n-raw-fallback-baseline.json');
const RED = '\x1b[0;31m';
const GREEN = '\x1b[0;32m';
const YELLOW = '\x1b[1;33m';
const NC = '\x1b[0m';

/** `{ counts: { file: n }, details: { file: [{line,text}] } }` — μόνο αρχεία με ευρήματα. */
function scan(files) {
  const counts = {};
  const details = {};
  for (const file of files) {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    // Πρόφιλτρο ΧΩΡΙΣ απώλεια: εύρημα απαιτεί το όνομα `defaultValue` στο κείμενο (και η shorthand μορφή).
    if (!text.includes('defaultValue')) continue;
    const found = findRawFallbacks(text, file);
    if (found.length === 0) continue;
    counts[file] = found.length;
    details[file] = found;
  }
  return { counts, details };
}

function writeBaseline() {
  const { counts } = scan(walkScope(ROOT));
  const { findings, files } = totals(counts);
  writeBaselineFile(BASELINE, {
    _meta: {
      check: 'CHECK 3.97',
      adr: 'ADR-898 §18.2',
      description: 'Κλήσεις μετάφρασης (`t`/`tX`/`x.t`) με `defaultValue` που ΔΕΝ είναι γνωστό κείμενο ⇒ ωμή τιμή στην οθόνη όταν λείψει το κλειδί, και κλειδί που λείπει αόρατο στο CHECK 3.8.',
      generatedBy: 'node scripts/check-i18n-raw-fallback.js --write-baseline',
      totalFindings: findings,
      totalFiles: files,
      note: 'Μόνο μειώνεται. Θεραπεία: κλειδί και στα δύο locales ή SSoT συνάρτηση ετικέτας με ρητό κλειδί `unknown` (π.χ. src/lib/buildings/building-enum-labels.ts) — ΠΟΤΕ προσθήκη εδώ.',
    },
    files: counts,
  });
  console.log(`✅ Baseline: ${path.relative(ROOT, BASELINE)} — ${findings} ευρήματα σε ${files} αρχεία`);
  return 0;
}

function printFailure(regressions, details) {
  console.log(`${RED}  ⛔ CHECK 3.97 (ADR-898 §18.2) — νέα ωμή εφεδρεία i18n${NC}`);
  for (const r of regressions) {
    const how = r.isNewFile ? 'ΝΕΟ ΑΡΧΕΙΟ — μηδενική ανοχή' : `${r.was} → ${r.now}`;
    console.log(`${RED}     ${r.file} (${how})${NC}`);
    for (const d of details[r.file] || []) console.log(`${RED}        γραμμή ${d.line}: ${d.text}${NC}`);
  }
  console.log([
    '     Όταν λείψει το κλειδί, ο άνθρωπος βλέπει την ΩΜΗ τιμή (`in_progress`) — και το CHECK 3.8 σωπαίνει.',
    '     Θεραπεία: πρόσθεσε το κλειδί και στα δύο locales (el + en) και άφησε το `defaultValue`,',
    '       ή SSoT συνάρτηση ετικέτας με ρητό κλειδί `unknown` (src/lib/buildings/building-enum-labels.ts).',
    '     ⚠️ ΜΗΝ «διορθώσεις» με `String(x)` ή `` `${x}` `` — είναι το ίδιο ωμό κείμενο.',
    '     Έσχατη διαφυγή (αιτιολόγησε στον Giorgio): SKIP_I18N_RAW_FALLBACK=1',
  ].join('\n'));
}

function main(argv = process.argv) {
  if (process.env.SKIP_I18N_RAW_FALLBACK) return 0;
  const args = argv.slice(2);
  if (args.includes('--write-baseline')) return writeBaseline();
  const scope = args.includes('--all') ? 'all' : 'staged';
  const files = scope === 'all' ? walkScope(ROOT) : args.filter((a) => !a.startsWith('--')).map(normalize).filter(inScope);
  if (files.length === 0) return 0;

  const baseline = loadBaseline(BASELINE);
  if (!baseline || baseline.__invalid || typeof baseline.files !== 'object') {
    console.log(`${RED}  ⛔ CHECK 3.97 — baseline ${baseline ? baseline.__invalid || 'χωρίς "files"' : 'λείπει'}: ${BASELINE}${NC}`);
    console.log('     Δημιούργησε: node scripts/check-i18n-raw-fallback.js --write-baseline');
    return 1; // fail-closed: χαλασμένη baseline ΠΟΤΕ δεν διαβάζεται ως «0 ευρήματα»
  }
  const { counts, details } = scan(files);
  const { regressions, progress } = compare(counts, baseline.files, scope, files);
  if (regressions.length > 0) {
    printFailure(regressions, details);
    return 1;
  }
  const seen = scope === 'all' ? `${totals(counts).findings} ευρήματα / ${totals(counts).files} αρχεία` : `${files.length} αρχεία`;
  console.log(`${GREEN}  ✅ CHECK 3.97 — καμία νέα ωμή εφεδρεία i18n (${seen})${NC}`);
  for (const p of progress) console.log(`${GREEN}     📉 ${p.file}: ${p.was} → ${p.now}${NC}`);
  if (progress.length) console.log(`${YELLOW}     Κλείδωσε την πρόοδο: npm run i18n-raw-fallback:baseline${NC}`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { main, scan };
