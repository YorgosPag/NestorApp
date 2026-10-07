#!/usr/bin/env node
/**
 * =============================================================================
 * CHECK 3.100 — Η ΠΥΛΗ ΤΗΣ ΕΓΓΡΑΦΗΣ ΣΕ ΑΠΟΣΥΡΜΕΝΟ ΑΚΙΝΗΤΟ (ADR-281 · ADR-329 §3.9)
 * =============================================================================
 *
 * «Γράφει κάποια διαδρομή πάνω σε ακίνητο χωρίς να ρωτήσει αν είναι αποσυρμένο;»
 *
 * 🔴 ΓΙΑΤΙ: ο φρουρός `requirePropertyInTenantScope` δέχεται ΥΠΟΧΡΕΩΤΙΚΟ `intent`. Με `'write'`
 * καλεί το `assertNotRetired('property', …)` ⇒ 409 `ENTITY_RETIRED` για ακίνητο σε αρχείο ή κάδο.
 * Ο τύπος αναγκάζει το όρισμα — ΔΕΝ αναγκάζει κάθε διαδρομή που γράφει να περάσει από τον φρουρό.
 * Μια νέα `route.ts` που γράφει και δεν ρωτά, ξαναγράφει ακίνητο στον κάδο χωρίς κανένα σφάλμα.
 *
 * ── ΤΑ ΚΡΙΤΗΡΙΑ (κάθε ένα δική του γραμμή) ────────────────────────────────────────────
 *  Κ1 κάθε κλήση του φρουρού στο `src/` έχει `intent` στο όρισμά της: ένα από τα τέσσερα
 *     κυριολεκτικά, ή προώθηση (`intent`, `params.intent`). «Φρουρός» είναι και το κέλυφος
 *     `propertyRoute({ …, intent })` — ο ισχυρισμός ότι ΚΑΛΕΙ τον φρουρό επαληθεύεται στο αρχείο του
 *  Κ2 κάθε `route.ts` κάτω από `properties/[id]/**` που εξάγει POST/PUT/PATCH/DELETE έχει φρουρό
 *     με `'write'|'lifecycle'|'withdraw'`, Ή `assertNotRetired(`, Ή `// retired-write-exempt: <λόγος>`
 *  Κ3 όποια ΔΕΝ έχει κανένα από τα τρία, δηλώνεται στο `UNGUARDED_ROUTES` (διαδρομή → λόγος) —
 *     κλειστό σύνολο: κάθε εγγραφή ΥΠΑΡΧΕΙ, είναι ΑΚΟΜΑ ΧΡΕΙΑΖΟΜΕΝΗ, και ο ισχυρισμός «φτάνει στο
 *     `loadShowcaseSources`» ΕΠΑΛΗΘΕΥΕΤΑΙ (η συνάρτηση καλεί `assertNotRetired`), δεν εμπιστεύεται
 *
 * ⚠️ ΟΡΙΟ ΓΡΑΝΟΥΛΑΡΙΟΤΗΤΑΣ: επίπεδο ΑΡΧΕΙΟΥ, όχι handler. Αρχείο με GET με `'write'` και POST χωρίς
 * φρουρό περνά. Το πιάνει μόνο αρχείο όπου ΟΛΟΙ οι φρουροί είναι `'read'`.
 *
 * ⚠️ AST, ΠΟΤΕ ΚΕΙΜΕΝΟ. 🔓 Εξαίρεση ΜΟΝΟ με λόγο: `// retired-write-exempt: <λόγος>`.
 *
 * @see ADR-281 · ADR-329 §3.9 · docs/gates/3.100.md
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ts = require(path.join(PROJECT_ROOT, 'node_modules', 'typescript'));
const { collectSourceFiles } = require('./lib/module-graph/scan-config');
const { toPosix } = require('./lib/module-graph/resolve-specifier');

const GUARD = 'requirePropertyInTenantScope';
/** Το ΕΝΑ κέλυφος των διαδρομών ακινήτου: `propertyRoute({ …, intent })` προωθεί το `intent` στον φρουρό. */
const SHELL = 'propertyRoute';
const SHELL_FILE = 'src/app/api/properties/_shared/property-route.ts';
const ASSERT = 'assertNotRetired';
const INTENTS = new Set(['read', 'write', 'lifecycle', 'withdraw']);
const WRITING_INTENTS = new Set(['write', 'lifecycle', 'withdraw']);
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ROUTE_RE = /^src\/app\/api\/properties\/\[id\]\/(?:.*\/)?route\.ts$/;
const EXEMPT_RE = /^\s*\/\/\s*retired-write-exempt:(.*)$/gm;
const HELPERS = 'src/app/api/properties/[id]/showcase/generate/helpers.ts';
const SHOWCASE_GATE = 'loadShowcaseSources';

const SHOWCASE_REASON = 'φτάνει στο `loadShowcaseSources`, που καλεί `assertNotRetired` (ΜΙΑ φορά, για δημιουργία · αναγέννηση · pdf)';
const P = 'src/app/api/properties/[id]/';

/** Το κλειστό σύνολο (Κ3): διαδρομή → { λόγος, via: η συνάρτηση που ΕΠΑΛΗΘΕΥΕΤΑΙ ή null }. */
const UNGUARDED_ROUTES = {
  [`${P}showcase/generate/route.ts`]: { reason: SHOWCASE_REASON, via: SHOWCASE_GATE },
  [`${P}showcase/pdf/route.ts`]: { reason: SHOWCASE_REASON, via: SHOWCASE_GATE },
  [`${P}showcase/regenerate/route.ts`]: {
    reason: `${SHOWCASE_REASON} — μέσω \`regeneratePdfForShare\``, via: 'regeneratePdfForShare' },
  [`${P}generate-description/route.ts`]: {
    reason: 'δεν γράφει στο ακίνητο — επιστρέφει κείμενο AI, ο καλών αποφασίζει αν θα το αποθηκεύσει', via: null },
};

const STATES = {
  GUARDED: 'guarded-write',
  DECLARED: 'declared-unguarded',
  EXEMPT: 'exempt-with-reason',
  INTENT_MISSING: 'guard-intent-missing',
  INTENT_INVALID: 'guard-intent-invalid',
  READ_ONLY: 'mutating-route-read-only',
  UNGUARDED: 'unguarded-mutating-route',
  EXEMPT_NO_REASON: 'exempt-without-reason',
  STALE: 'stale-declared-route',
  CLAIM_FALSE: 'declared-claim-unverified',
};
const BLOCKING = [
  STATES.INTENT_MISSING, STATES.INTENT_INVALID, STATES.READ_ONLY, STATES.UNGUARDED,
  STATES.EXEMPT_NO_REASON, STATES.STALE, STATES.CLAIM_FALSE,
];

function sourceFileOf(absPath, text) {
  return ts.createSourceFile(absPath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/.test(absPath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
const isCallTo = (node, name) => ts.isCallExpression(node) && ts.isIdentifier(node.expression)
  && node.expression.text === name;
const isStringLiteral = (n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
/** Ο φρουρός ή το κέλυφος που τον καλεί: και τα δύο δηλώνουν `intent` στο πρώτο τους όρισμα. */
const isGuardCall = (node) => isCallTo(node, GUARD) || isCallTo(node, SHELL);

/** Τι δηλώνει το όρισμα της κλήσης του φρουρού για το `intent`; */
function intentOf(call) {
  const arg = call.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return { kind: 'missing' };
  const prop = arg.properties.find((p) => p.name && p.name.getText() === 'intent');
  if (!prop) return { kind: 'missing' };
  if (ts.isShorthandPropertyAssignment(prop)) return { kind: 'forward' };
  if (!ts.isPropertyAssignment(prop)) return { kind: 'missing' };
  const value = prop.initializer;
  if (isStringLiteral(value)) return INTENTS.has(value.text) ? { kind: 'literal', value: value.text } : { kind: 'invalid' };
  return ts.isIdentifier(value) || ts.isPropertyAccessExpression(value) ? { kind: 'forward' } : { kind: 'invalid' };
}

/** Κ1 για ένα αρχείο. */
function guardCallFindings(sf, rel) {
  const findings = [];
  const visit = (node) => {
    if (isGuardCall(node)) {
      const { kind } = intentOf(node);
      if (kind === 'missing' || kind === 'invalid') {
        findings.push({ state: kind === 'missing' ? STATES.INTENT_MISSING : STATES.INTENT_INVALID, file: rel, line: lineOf(sf, node),
          detail: `η κλήση του \`${GUARD}\` δεν δηλώνει \`intent\` ('read' | 'write' | 'lifecycle' | 'withdraw') ή προώθησή του` });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return findings;
}

/** Όνομα συνάρτησης που ορίζει ο κόμβος (δήλωση ή `const f = () => …`), αλλιώς null. */
function functionNameOf(node) {
  if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
  const fnInit = ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer));
  return fnInit ? node.name.text : null;
}

/** Οι συναρτήσεις του αρχείου που προωθούν `intent` στον φρουρό (ο τοπικός βοηθός). */
function forwardingFunctions(sf) {
  const names = new Set();
  const visit = (node, current) => {
    const own = functionNameOf(node) || current;
    if (isCallTo(node, GUARD) && intentOf(node).kind === 'forward' && own) names.add(own);
    ts.forEachChild(node, (child) => visit(child, own));
  };
  visit(sf, null);
  return names;
}

/** Ονόματα εξαγόμενων μεταλλακτικών handlers (`export const X` και `export function X`). */
function mutatingExports(sf) {
  const found = new Set();
  const exported = (n) => (n.modifiers || []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name && exported(stmt) && MUTATING.has(stmt.name.text)) found.add(stmt.name.text);
    if (!ts.isVariableStatement(stmt) || !exported(stmt)) continue;
    for (const d of stmt.declarationList.declarations) {
      if (ts.isIdentifier(d.name) && MUTATING.has(d.name.text)) found.add(d.name.text);
    }
  }
  return [...found];
}

/** Τα γεγονότα ενός route.ts που χρειάζονται Κ2/Κ3. */
function routeFacts(sf) {
  const helpers = forwardingFunctions(sf);
  const intents = new Set();
  let guardCalls = 0;
  let asserts = 0;
  const visit = (node) => {
    if (isGuardCall(node)) {
      guardCalls += 1;
      const i = intentOf(node);
      if (i.kind === 'literal') intents.add(i.value);
    }
    if (isCallTo(node, ASSERT)) asserts += 1;
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && helpers.has(node.expression.text)) {
      node.arguments.filter(isStringLiteral).forEach((a) => intents.add(a.text));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const exemptions = [...sf.text.matchAll(EXEMPT_RE)].map((m) => m[1].trim());
  return { mutating: mutatingExports(sf), intents, guardCalls, asserts, exemptions };
}

const hasWritingGuard = (f) => [...f.intents].some((i) => WRITING_INTENTS.has(i));

/** Κ2 + το «αδήλωτο» μέρος της Κ3 για ένα route.ts. */
function routeFindings(rel, facts, declared = UNGUARDED_ROUTES) {
  if (facts.mutating.length === 0) return [];
  const here = { file: rel };
  if (facts.exemptions.length > 0) {
    return facts.exemptions.every((r) => r.length > 0) ? [{ ...here, state: STATES.EXEMPT }]
      : [{ ...here, state: STATES.EXEMPT_NO_REASON, detail: 'εξαίρεση `retired-write-exempt` ΧΩΡΙΣ λόγο' }];
  }
  if (hasWritingGuard(facts) || facts.asserts > 0) return [{ ...here, state: STATES.GUARDED }];
  if (facts.guardCalls > 0) {
    return [{ ...here, state: STATES.READ_ONLY,
      detail: `εξάγει ${facts.mutating.join('/')} αλλά ΟΛΟΙ οι φρουροί είναι 'read' (ή προωθημένοι χωρίς κυριολεκτικό)` }];
  }
  if (declared[rel]) return [{ ...here, state: STATES.DECLARED }];
  return [{ ...here, state: STATES.UNGUARDED,
    detail: `εξάγει ${facts.mutating.join('/')} χωρίς φρουρό, \`${ASSERT}\` ή δηλωμένη εξαίρεση — ρώτα \`${GUARD}\` με intent 'write'` }];
}

/** Η συνάρτηση `name` του αρχείου περιέχει κλήση σε κάποιο από τα `callees`; */
function functionCalls(sf, name, callees) {
  let hit = false;
  const visit = (node, inside) => {
    const now = inside || functionNameOf(node) === name;
    if (now && callees.some((c) => isCallTo(node, c))) hit = true;
    ts.forEachChild(node, (child) => visit(child, now));
  };
  visit(sf, false);
  return hit;
}

/** Ο ισχυρισμός «φτάνει στο loadShowcaseSources» — επαληθευμένος στον κώδικα, όχι στο λόγο. */
function claimFindings(root, rel, via, routeSf) {
  const bad = (detail) => [{ state: STATES.CLAIM_FALSE, file: rel, detail }];
  if (!routeSf || !visitCalls(routeSf, via)) return bad(`το route δεν καλεί \`${via}\``);
  const helpersAbs = path.join(root, HELPERS);
  if (!fs.existsSync(helpersAbs)) return bad(`λείπει το ${HELPERS}`);
  const helpersSf = sourceFileOf(helpersAbs, fs.readFileSync(helpersAbs, 'utf8'));
  if (!functionCalls(helpersSf, SHOWCASE_GATE, [ASSERT])) return bad(`η \`${SHOWCASE_GATE}\` ΔΕΝ καλεί \`${ASSERT}(\``);
  if (via !== SHOWCASE_GATE && !functionCalls(helpersSf, via, [SHOWCASE_GATE, ASSERT])) {
    return bad(`η \`${via}\` δεν καλεί \`${SHOWCASE_GATE}\` ούτε \`${ASSERT}\``);
  }
  return [];
}

function visitCalls(sf, name) {
  let hit = false;
  const visit = (node) => { if (isCallTo(node, name)) hit = true; ts.forEachChild(node, visit); };
  visit(sf);
  return hit;
}

/** Κ3: κάθε δηλωμένη εγγραφή υπάρχει, χρειάζεται ακόμη, και ο ισχυρισμός της στέκει. */
function declaredFindings(root, declared, factsByRel) {
  const findings = [];
  for (const [rel, entry] of Object.entries(declared)) {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) {
      findings.push({ state: STATES.STALE, file: rel, detail: 'δηλωμένη διαδρομή που ΔΕΝ ΥΠΑΡΧΕΙ — σβήσε την εγγραφή' });
      continue;
    }
    const facts = factsByRel.get(rel);
    const needed = facts && facts.mutating.length > 0 && facts.guardCalls === 0 && facts.asserts === 0 && facts.exemptions.length === 0;
    if (!needed) {
      findings.push({ state: STATES.STALE, file: rel, detail: 'δηλωμένη αλλά ΔΕΝ χρειάζεται πια (φρουρός/assert/εξαίρεση ή κανένας μεταλλακτικός handler) — σβήσε την εγγραφή' });
    } else if (entry.via) {
      findings.push(...claimFindings(root, rel, entry.via, sourceFileOf(abs, fs.readFileSync(abs, 'utf8'))));
    }
  }
  return findings;
}

/** Ο ισχυρισμός «το κέλυφος καλεί τον φρουρό» — επαληθευμένος, αφού η Κ2 τον εμπιστεύεται. */
function shellFindings(root, usedBy) {
  if (!usedBy) return [];
  const bad = (detail) => [{ state: STATES.CLAIM_FALSE, file: usedBy, detail }];
  const abs = path.join(root, SHELL_FILE);
  if (!fs.existsSync(abs)) return bad(`καλεί \`${SHELL}\` αλλά λείπει το ${SHELL_FILE}`);
  const sf = sourceFileOf(abs, fs.readFileSync(abs, 'utf8'));
  return functionCalls(sf, SHELL, [GUARD]) ? [] : bad(`η \`${SHELL}\` ΔΕΝ καλεί \`${GUARD}(\``);
}

function scanRoute(root, abs, rel, declared, factsByRel, findings) {
  const facts = routeFacts(sourceFileOf(abs, fs.readFileSync(abs, 'utf8')));
  factsByRel.set(rel, facts);
  findings.push(...routeFindings(rel, facts, declared));
}

function measure(opts = {}) {
  const root = opts.root || PROJECT_ROOT;
  const declared = opts.declared || UNGUARDED_ROUTES;
  const files = (opts.codeFiles || collectSourceFiles(root, ['src'])).filter((f) => !/__tests__|\.test\.|\.spec\./.test(f));
  if (!opts.codeFiles && files.length < 1000) throw new Error(`ΦΡΟΥΡΟΣ: μόνο ${files.length} αρχεία — η σάρωση δεν κοίταξε`);
  const findings = [];
  const factsByRel = new Map();
  let shellUser = null;
  for (const abs of files) {
    const rel = toPosix(path.relative(root, abs));
    let text;
    try { text = fs.readFileSync(abs, 'utf8'); } catch { continue; }
    if (text.includes(GUARD) || text.includes(SHELL)) findings.push(...guardCallFindings(sourceFileOf(abs, text), rel));
    if (ROUTE_RE.test(rel)) scanRoute(root, abs, rel, declared, factsByRel, findings);
    if (!shellUser && ROUTE_RE.test(rel) && visitCalls(sourceFileOf(abs, text), SHELL)) shellUser = rel;
  }
  findings.push(...shellFindings(root, shellUser));
  findings.push(...declaredFindings(root, declared, factsByRel));
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, findings.filter((f) => f.state === s).length]));
  return { findings, tally, examined: files.length, routes: factsByRel.size };
}

function report(result, log = console.log) {
  const { tally, findings } = result;
  log('');
  log('🗑️  CHECK 3.100 — Πύλη της εγγραφής σε αποσυρμένο ακίνητο (ADR-281 · ADR-329 §3.9)');
  log(`   αρχεία που εξετάστηκαν: ${result.examined} · route.ts ακινήτων: ${result.routes}`);
  log('');
  for (const s of BLOCKING) log(`   ⛔ ${s.padEnd(30)} ${tally[s]}`);
  for (const s of [STATES.GUARDED, STATES.DECLARED, STATES.EXEMPT]) log(`   ✅ ${s.padEnd(30)} ${tally[s]}`);
  const blocking = findings.filter((f) => BLOCKING.includes(f.state));
  for (const f of blocking) log(`   ⛔ ${f.state}  ${f.file}${f.line ? ':' + f.line : ''}\n        ${f.detail}`);
  if (blocking.length) {
    log(`\n   ΘΕΡΑΠΕΙΑ: κάλεσε \`${GUARD}({ …, intent: 'write' })\` πριν γράψεις· αν το route δεν γράφει στο`);
    log('   ακίνητο, δήλωσέ το με λόγο στο `UNGUARDED_ROUTES` ή `// retired-write-exempt: <λόγος>`.');
  }
  return blocking.length;
}

function main() {
  if (process.env.SKIP_RETIRED_PROPERTY_WRITE === '1') {
    console.log('⏭️  CHECK 3.100 παραλείφθηκε (SKIP_RETIRED_PROPERTY_WRITE=1)');
    return 0;
  }
  const blocking = report(measure());
  console.log(blocking > 0
    ? `\n❌ CHECK 3.100 ΑΠΕΤΥΧΕ — ${blocking} μπλοκάρουσα(ες) παραβίαση(εις)\n`
    : '\n✅ CHECK 3.100 — κάθε διαδρομή που γράφει σε ακίνητο ρωτά αν είναι αποσυρμένο\n');
  return blocking > 0 ? 1 : 0;
}

if (require.main === module) process.exit(main());

module.exports = {
  measure, report, main, sourceFileOf, guardCallFindings, routeFacts, routeFindings, declaredFindings,
  STATES, BLOCKING, UNGUARDED_ROUTES, HELPERS,
};
