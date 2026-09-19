#!/usr/bin/env node
/**
 * CHECK 3.90 — **η πύλη του ενός συνόρου** (ADR-868). ZERO TOLERANCE, **καμία baseline**.
 *
 * «Υπάρχει **δημόσιο endpoint** που δεν περνά από το σύνορο `withAuth`;»
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ (μετρημένο 2026-09-19, ADR-777 §8.60.20.9 #9/#12)
 * ─────────────────────────────────────────────────────────────────────────────
 * Κάθε εξαγωγή αρχείου `'use server'` είναι **server action = δημόσιο POST endpoint**
 * — *«reachable via a direct POST request, not just through your application's UI»*
 * (Next.js, Data Security). Στο δέντρο ζούσαν **7** τέτοια αρχεία και **κανένα** δεν
 * επαλήθευε ταυτότητα:
 *   - `communications.service.ts`: με `companyId: undefined` διάβαζε `messages`
 *     **ΟΛΩΝ** των εταιρειών· approve/reject με `adminUid`/`companyId` **του πελάτη**·
 *   - `storage.service.ts`: οποιαδήποτε αποθήκη με οποιοδήποτε id (έκλεισε στο #9)·
 *   - 2 ροές LLM χωρίς auth · 1 repository Admin SDK · 1 αρχείο **μόνο τύπων**.
 * Η σελίδα φύλαγε (`requireAdminForPage`)· το endpoint όχι. *«A page-level authentication
 * check does not extend to the Server Actions defined within it.»*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏆 ΤΙ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ — ΚΑΙ ΠΟΥ ΤΟΥΣ ΞΕΠΕΡΝΑΜΕ
 * ─────────────────────────────────────────────────────────────────────────────
 * Η Next.js γράφει: *«We recommend choosing one data fetching approach and avoiding
 * mixing them. This makes it clear for both developers … and security auditors what to
 * expect»* — και για υπάρχουσες μεγάλες εφαρμογές προτείνει **HTTP APIs**. Εδώ ο ένας
 * τρόπος είναι το `withAuth` (~319 διαδρομές, rate limit, κρίση χώρου, CHECK 3.58/3.68).
 * 🔑 **Η σύσταση όμως μένει σύσταση**: κανένα εργαλείο του οικοσυστήματος δεν την
 *    επιβάλλει, και ο έλεγχος «καλεί κάθε action τον φύλακα;» είναι **αναποκρίσιμος**
 *    στατικά (ο φύλακας μπορεί να είναι υπό συνθήκη, σε βοηθό, μετά από ανάγνωση). Εμείς
 *    δεν ρωτάμε το αναποκρίσιμο — ρωτάμε το **αποκρίσιμο**: *υπάρχει δεύτερος τύπος
 *    endpoint;* Απάντηση με AST, χωρίς ψευδώς θετικά, χωρίς baseline.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΚΡΙΤΗΡΙΟ — ΚΑΙ ΓΙΑΤΙ AST, ΟΧΙ ΚΕΙΜΕΝΟ
 * ─────────────────────────────────────────────────────────────────────────────
 * Οδηγία (directive) είναι **μόνο** συμβολοσειρά-δήλωση στον **πρόλογο** ενός αρχείου ή
 * σώματος συνάρτησης (ECMAScript §14.1.1). Ένα `'use server'` σε σχόλιο, σε μήνυμα, ή
 * μετά από άλλη εντολή **δεν** είναι οδηγία. Σάρωση κειμένου θα καταδίκαζε ακριβώς τα
 * σχόλια που **τεκμηριώνουν** τη βλάβη (το μάθημα `stripComments` του CHECK 3.68).
 * Κρίνονται: ο πρόλογος του αρχείου + ο πρόλογος **κάθε** σώματος συνάρτησης (η Next.js
 * δέχεται και inline actions: `async function f() { 'use server'; … }`).
 *
 * ⚠️ **ΚΑΝΕΝΑ ΚΛΕΙΣΤΟ ΣΥΝΟΛΟ ΕΞΑΙΡΕΣΕΩΝ, ΕΠΙΤΗΔΕΣ.** Ένα endpoint εκτός συνόρου δεν είναι
 *    «εξαίρεση με λόγο» — είναι **δεύτερη αρχιτεκτονική**. Αν χρειαστεί ποτέ (π.χ. forms με
 *    progressive enhancement), η θέση του είναι **τροποποίηση του ADR-868 και αυτής της
 *    πύλης**, με φύλακα που το αποδεικνύει — όχι μια γραμμή σε JSON.
 * ⚠️ **ΤΑ TESTS ΕΞΑΙΡΟΥΝΤΑΙ** (`__tests__/`, `*.test.*`, `*.spec.*`): δεν μπαίνουν σε bundle.
 *
 * Usage:
 *   node scripts/check-server-action-boundary.js            # πλήρης σάρωση src/ (πάντα)
 *   node scripts/check-server-action-boundary.js --report   # απογραφή, χωρίς κρίση
 *
 * Escape: SKIP_SERVER_ACTION_BOUNDARY=1 (αιτιολόγησε στον Giorgio)
 * Exit codes: 0 = pass, 1 = blocked
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const REPO = path.resolve(__dirname, '..');
const SCAN_ROOT = 'src';
const DIRECTIVE = 'use server';
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_PATH = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/;

// ─── AST ─────────────────────────────────────────────────────────────────────

function scriptKindOf(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/**
 * Οι οδηγίες του **προλόγου** μιας λίστας εντολών — σταματά στην πρώτη μη-οδηγία.
 * ⚠️ Παρενθετική συμβολοσειρά (`('use server')`) **δεν** είναι οδηγία (ECMAScript).
 */
function prologueDirectives(statements) {
  const directives = [];
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement)) break;
    if (!ts.isStringLiteral(statement.expression)) break;
    directives.push(statement.expression);
  }
  return directives;
}

/** Σώμα-μπλοκ συνάρτησης (δήλωση, έκφραση, βέλος με `{}`, μέθοδος, accessor). */
function functionBodyOf(node) {
  if (!ts.isFunctionLike(node)) return null;
  const body = node.body;
  return body && ts.isBlock(body) ? body : null;
}

function locationOf(sourceFile, node, scope) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  return { line: line + 1, scope };
}

/**
 * Κάθε οδηγία `'use server'` ενός κειμένου πηγής — **καθαρή** συνάρτηση (άγκυρες).
 * @returns {{ line: number, scope: 'module' | 'function' }[]}
 */
function findServerDirectives(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName, sourceText, ts.ScriptTarget.Latest, true, scriptKindOf(fileName),
  );
  const found = [];
  for (const literal of prologueDirectives(sourceFile.statements)) {
    if (literal.text === DIRECTIVE) found.push(locationOf(sourceFile, literal, 'module'));
  }
  const visit = (node) => {
    const body = functionBodyOf(node);
    if (body) {
      for (const literal of prologueDirectives(body.statements)) {
        if (literal.text === DIRECTIVE) found.push(locationOf(sourceFile, literal, 'function'));
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
  return found;
}

// ─── ΑΡΧΕΙΑ ──────────────────────────────────────────────────────────────────

/**
 * Υποψήφια αρχεία: tracked **και** untracked-μη-αγνοημένα που περιέχουν τη λέξη.
 * 🔑 Το `git grep` είναι μόνο **προφίλτρο** ταχύτητας — η κρίση είναι του AST. Το
 *    `--untracked` καλύπτει το νέο αρχείο **πριν** το `git add` (φθηνό εδώ: ένα μοτίβο).
 */
function candidateFiles(root) {
  try {
    const out = execFileSync(
      'git', ['grep', '-l', '--untracked', '-F', DIRECTIVE, '--', SCAN_ROOT],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out.split('\n').map(f => f.trim()).filter(Boolean);
  } catch (error) {
    if (error.status === 1) return []; // git grep: 1 = καμία αντιστοιχία
    throw error;
  }
}

function isScannable(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return SOURCE_EXTENSIONS.test(normalized) && !TEST_PATH.test(normalized);
}

/** @returns {{ file: string, line: number, scope: string }[]} */
function scan(root, files) {
  const violations = [];
  for (const file of files.filter(isScannable)) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    for (const hit of findServerDirectives(text, file)) {
      violations.push({ file: file.replace(/\\/g, '/'), ...hit });
    }
  }
  return violations;
}

// ─── ΑΝΑΦΟΡΑ ─────────────────────────────────────────────────────────────────

function printViolations(violations) {
  console.error('\n❌ CHECK 3.90 — δημόσιο endpoint ΕΚΤΟΣ του συνόρου `withAuth` (ADR-868)\n');
  for (const v of violations) {
    console.error(`   ${v.file}:${v.line}  '${DIRECTIVE}' (${v.scope === 'module' ? 'αρχείο' : 'συνάρτηση'})`);
  }
  console.error(`
   Κάθε εξαγωγή \`'use server'\` είναι δημόσιο POST endpoint — καλέσιμο χωρίς το UI σου.
   Θεραπεία, ανάλογα με το τι είναι το αρχείο:
     • τη ΚΑΛΕΙ πελάτης  ⇒ διαδρομή \`withAuth\` με ρητό wrapper ρυθμού + \`apiClient\` (πρότυπο:
       /api/admin/ai-inbox/communications/[communicationId]/triage)·
     • server κώδικας    ⇒ \`import 'server-only'\` (αρνείται το bundle πελάτη, ΔΕΝ δημοσιεύει)·
     • μόνο τύποι        ⇒ καμία οδηγία.
   ⚠️ ΜΗΝ «διορθώσεις» προσθέτοντας έλεγχο πάνω σε companyId/uid που έστειλε ο πελάτης.
   Escape: SKIP_SERVER_ACTION_BOUNDARY=1 (αιτιολόγησε)\n`);
}

function main() {
  if (process.env.SKIP_SERVER_ACTION_BOUNDARY) {
    console.log('⏭️  CHECK 3.90 παρακάμφθηκε (SKIP_SERVER_ACTION_BOUNDARY)');
    return 0;
  }
  const candidates = candidateFiles(REPO);
  const violations = scan(REPO, candidates);
  if (process.argv.includes('--report')) {
    console.log(`CHECK 3.90 — υποψήφια: ${candidates.length} · οδηγίες 'use server': ${violations.length}`);
    violations.forEach(v => console.log(`  ${v.file}:${v.line} (${v.scope})`));
    return 0;
  }
  if (violations.length > 0) {
    printViolations(violations);
    return 1;
  }
  console.log(`✅ CHECK 3.90 — ένα σύνορο: 0 οδηγίες 'use server' (${candidates.length} υποψήφια, κρίση AST)`);
  return 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { findServerDirectives, scan, isScannable, candidateFiles, DIRECTIVE };
