#!/usr/bin/env node
/**
 * CHECK 3.92 — ΠΥΛΗ ΤΟΥ ΣΥΝΟΡΟΥ ΙΔΕΜΠΟΤΙΑΣ (ADR-872 · ADR-853 Ε3 Φάση 2)
 *
 * «Εκτελείται κάθε πράξη ΜΙΑ φορά ανά `Idempotency-Key` — και όποιος το παρακάμπτει, το είπε με λόγο;»
 *
 * Κ1 ⛔ Κάθε `{ mode: 'natural' }` έχει `why` — κείμενο, όχι κενό. «Natural» χωρίς λόγο είναι η διπλή
 *       πράξη που κλείνει το σύνορο, με άδεια.
 * Κ2 ⛔ Κάθε ΡΙΖΑ-σύνορο καλεί το `runIdempotently` όσες φορές δηλώνει (ο `withAuth` δύο: ανώνυμος +
 *       αυθεντικοποιημένος κλάδος). Σύνορο που έπαψε να το καλεί = 338 routes απροστάτευτα, σιωπηλά.
 * Κ3 🔴 RATCHET κατά ταυτότητα: route που αλλάζει δεδομένα (`POST/PUT/PATCH/DELETE`) και ΔΕΝ καλεί
 *       κανένα σύνορο. Τα σύνορα ΥΠΟΛΟΓΙΖΟΝΤΑΙ (σταθερό σημείο): ρίζες + κάθε εξαγόμενη συνάρτηση που
 *       καλεί σύνορο (`runGuarded`, `createMigrationRoute`, `projectPreviewRoute`…). Καμία χειρόγραφη
 *       λίστα factories — θα πάλιωνε στην πρώτη νέα factory.
 *
 * ⚠️ Δεν κρίνεται «ξαναστέλνει κάποιος δεύτερος βρόχος πράξη;» — δεν αποφασίζεται στατικά (βρόχος σε hook,
 *    σε βιβλιοθήκη, σε `setTimeout`). Δηλωμένο όριο, ADR-872 §6.
 *
 * Εκτέλεση: node scripts/check-idempotency-boundary.js [--report | --write-baseline]
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { compareSets, loadBaseline, writeBaselineFile, rel } = require('./lib/ratchet-baseline');

const REPO = path.resolve(__dirname, '..');
const BASELINE_FILE = path.join(REPO, '.idempotency-boundary-baseline.json');
const SCAN_ROOTS = ['src/lib', 'src/app/api', 'src/server'];
const ROUTE_ROOT = 'src/app/api';
const MUTATING = /export\s+(const|async\s+function|function)\s+(POST|PUT|PATCH|DELETE)\b/;
const TEST_PATH = /(^|\/)__tests__\/|\.(test|spec)\.[cm]?[jt]sx?$/;
const MIN_WHY_CHARS = 15;
/** Ένα εξαγόμενο `POST` σε κοινό αρχείο είναι **handler**, όχι factory: ως «σύνορο» θα κάλυπτε ψευδώς κάθε κλήση του. */
const HTTP_METHOD_NAME = /^(GET|HEAD|OPTIONS|POST|PUT|PATCH|DELETE)$/;

/** Οι ρίζες: ποιο αρχείο ορίζει ποιο σύνορο, και πόσες φορές καλεί το στρώμα. */
const ROOTS = [
  { name: 'withAuth', file: 'src/lib/auth/middleware.ts', calls: 2 },
  { name: 'withPersonalOrOrgAuth', file: 'src/lib/auth/personal-scope-middleware.ts', calls: 1 },
  // ADR-876 §5 — η ΔΗΜΟΣΙΑ πόρτα της πύλης προμηθευτή: καμία ταυτότητα Firebase, ο καλών ΕΙΝΑΙ ο
  // σύνδεσμός του. Καλεί το στρώμα απευθείας (principal = ο σύνδεσμος, όχι `anon`) — τρίτη ρίζα, όχι
  // παράκαμψη: το Κ2 επιβεβαιώνει ότι το καλεί ακόμη.
  { name: 'withVendorLinkDoor', file: 'src/server/vendor-portal/vendor-link-door.ts', calls: 1 },
];
const LAYER = 'runIdempotently';

// ─── ΑΡΧΕΙΑ ──────────────────────────────────────────────────────────────────

function walk(root, dir, out) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const relPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(root, relPath, out);
    else if (/\.tsx?$/.test(entry.name) && !TEST_PATH.test(relPath)) out.push(relPath);
  }
  return out;
}

function parse(root, file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  return { text, source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true) };
}

// ─── AST ─────────────────────────────────────────────────────────────────────

/** Το όνομα που καλείται: `f(...)` ⇒ `f` · `a.b(...)` ⇒ `b`. */
function calleeName(call) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

function callsIn(node, names) {
  let found = 0;
  const visit = (n) => {
    if (ts.isCallExpression(n) && names.has(calleeName(n))) found += 1;
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

const isExported = (node) => (ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) !== 0;

/** Εξαγόμενες συναρτήσεις του αρχείου: `export function f` · `export const f = (...) => …`. */
function exportedFunctions(source) {
  const found = [];
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement)) {
      found.push({ name: statement.name.text, body: statement });
    }
    if (ts.isVariableStatement(statement) && isExported(statement)) {
      for (const d of statement.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer) found.push({ name: d.name.text, body: d.initializer });
      }
    }
  }
  return found;
}

/** 🔑 Σταθερό σημείο: ρίζες + κάθε εξαγόμενη συνάρτηση (εκτός routes) που καλεί ήδη γνωστό σύνορο. */
function discoverBoundaries(parsed) {
  const boundaries = new Set(ROOTS.map((r) => r.name));
  const candidates = parsed.filter((p) => !p.file.endsWith('/route.ts'))
    .flatMap((p) => exportedFunctions(p.source))
    .filter((fn) => !HTTP_METHOD_NAME.test(fn.name));
  let grew = true;
  while (grew) {
    grew = false;
    for (const fn of candidates) {
      if (!boundaries.has(fn.name) && callsIn(fn.body, boundaries) > 0) {
        boundaries.add(fn.name);
        grew = true;
      }
    }
  }
  return boundaries;
}

/** Κ1: `{ mode: 'natural' }` χωρίς `why` κειμένου ≥ MIN_WHY_CHARS. */
function naturalWithoutReason(p) {
  const found = [];
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const prop = (key) => n.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText(p.source) === key);
      const mode = prop('mode');
      if (mode && ts.isStringLiteralLike(mode.initializer) && mode.initializer.text === 'natural') {
        const why = prop('why');
        const text = why && ts.isStringLiteralLike(why.initializer) ? why.initializer.text.trim() : '';
        if (text.length < MIN_WHY_CHARS) {
          const { line } = p.source.getLineAndCharacterOfPosition(n.getStart(p.source));
          found.push({ gate: 'Κ1', file: p.file, line: line + 1, detail: '`natural` χωρίς λόγο (`why`)' });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(p.source);
  return found;
}

/** Κ2: κάθε ρίζα καλεί το στρώμα όσες φορές δηλώνει. */
function rootsWithoutLayer(root) {
  return ROOTS.flatMap((r) => {
    if (!fs.existsSync(path.join(root, r.file))) {
      return [{ gate: 'Κ2', file: r.file, line: 1, detail: `λείπει το αρχείο της ρίζας \`${r.name}\`` }];
    }
    const count = callsIn(parse(root, r.file).source, new Set([LAYER]));
    return count >= r.calls ? [] : [{ gate: 'Κ2', file: r.file, line: 1, detail: `\`${r.name}\`: ${count}/${r.calls} κλήσεις \`${LAYER}\`` }];
  });
}

// ─── ΜΕΤΡΗΣΗ ─────────────────────────────────────────────────────────────────

function measure(root = REPO) {
  const files = SCAN_ROOTS.flatMap((dir) => walk(root, dir, []));
  const parsed = files.map((file) => ({ file, ...parse(root, file) }));
  const boundaries = discoverBoundaries(parsed);
  const zeroTol = [...parsed.flatMap(naturalWithoutReason), ...rootsWithoutLayer(root)];
  const outside = parsed
    .filter((p) => p.file.startsWith(`${ROUTE_ROOT}/`) && p.file.endsWith('/route.ts') && MUTATING.test(p.text))
    .filter((p) => callsIn(p.source, boundaries) === 0)
    .map((p) => p.file)
    .sort();
  return { zeroTol, outside, boundaries: [...boundaries].sort(), routes: parsed.length };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function printZeroTol(zeroTol) {
  console.error('\n❌ CHECK 3.92 — σύνορο ιδεμποτίας (ADR-872)\n');
  for (const v of zeroTol) console.error(`   [${v.gate}] ${v.file}:${v.line}  ${v.detail}`);
  console.error('\n   Κ1: γράψε ΓΙΑΤΙ το route είναι ιδεμποτικό εκ κατασκευής — ή βγάλε το `natural`.');
  console.error('   Κ2: η ρίζα-σύνορο πρέπει να καλεί το `runIdempotently` σε κάθε κλάδο που εκτελεί handler.');
  console.error('   📘 docs/gates/3.92.md · Διαφυγή (αιτιολόγησε στον Giorgio): SKIP_IDEMPOTENCY_BOUNDARY=1');
}

function main(argv = process.argv.slice(2)) {
  if (process.env.SKIP_IDEMPOTENCY_BOUNDARY) return 0;
  const m = measure();
  if (argv.includes('--report')) {
    console.log(`CHECK 3.92 — σύνορα (${m.boundaries.length}): ${m.boundaries.join(', ')}`);
    console.log(`Κ1/Κ2 παραβάσεις: ${m.zeroTol.length} · Κ3 routes εκτός συνόρου: ${m.outside.length}`);
    for (const f of m.outside) console.log(`   • ${f}`);
    return 0;
  }
  if (m.zeroTol.length > 0) { printZeroTol(m.zeroTol); return 1; }
  if (argv.includes('--write-baseline')) {
    writeBaselineFile(BASELINE_FILE, { adr: 'ADR-872', gate: '3.92', outside: m.outside });
    console.log(`✅ Baseline: ${rel(BASELINE_FILE)} — ${m.outside.length} routes εκτός συνόρου`);
    return 0;
  }
  const baseline = loadBaseline(BASELINE_FILE);
  if (!baseline || baseline.__invalid || !Array.isArray(baseline.outside)) {
    console.error(`❌ CHECK 3.92 — baseline χαλασμένη ή απούσα: ${rel(BASELINE_FILE)} (npm run idempotency-boundary:baseline)`);
    return 1; // fail-closed: ποτέ «καθαρό» χωρίς baseline
  }
  const diff = compareSets(m.outside, baseline.outside);
  if (diff.added.length > 0) {
    console.error('\n❌ CHECK 3.92 Κ3 — ΝΕΟ route που αλλάζει δεδομένα ΕΚΤΟΣ συνόρου (`withAuth` / `withPersonalOrOrgAuth`)\n');
    for (const f of diff.added) console.error(`   🚫 ${f}`);
    console.error('\n   Τύλιξέ το με το σύνορο (ή με factory που το καλεί). Server-to-server (webhook/cron) ⇒ ADR-872 §5.');
    return 1;
  }
  if (diff.removed.length > 0) console.log(`🟢 CHECK 3.92 — ${diff.removed.length} λιγότερα routes εκτός συνόρου· κλείδωσε: npm run idempotency-boundary:baseline`);
  return 0;
}

if (require.main === module) process.exit(main());

module.exports = { measure, discoverBoundaries, naturalWithoutReason, rootsWithoutLayer, exportedFunctions, parse, ROOTS, main };
