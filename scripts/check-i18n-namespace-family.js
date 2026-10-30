#!/usr/bin/env node
/**
 * CHECK 3.108 — ΠΥΛΗ ΤΗΣ ΜΙΑΣ ΔΗΛΩΣΗΣ ΟΙΚΟΓΕΝΕΙΑΣ NAMESPACES (ADR-280 §11).
 *
 * «Γράφει κάποιος με το χέρι μια **οικογένεια** namespaces που ο hook ήδη φορτώνει μόνος του;»
 *
 * 🔴 **Η ΠΗΓΗ ΥΠΗΡΧΕ, ΚΑΝΕΙΣ ΔΕΝ ΤΗ ΧΡΗΣΙΜΟΠΟΙΟΥΣΕ.** Το `useTranslation('building')` επεκτείνεται ήδη σε
 * `building` + 5 splits (`resolveAllNamespaces()` ← `COMPAT_NAMESPACE_MAP`, ADR-280). Παρ' όλα αυτά η λίστα
 * `['building', 'building-address', …, 'building-timeline']` ήταν γραμμένη **100 φορές** — και η κλάση **~650**
 * φορές σε **10 οικογένειες** (μετρημένο 2026-10-30). Νέο split = 650 χειρόγραφες αλλαγές· όποια ξεχαστεί
 * ζωγραφίζει ωμό κλειδί. Η πρακτική i18next/Modern.js είναι «ζήτα το namespace του feature, όχι τα αρχεία του».
 *
 * Κανόνες (⛔ ZERO TOL, καμία baseline — το codemod έφερε το δέντρο στο μηδέν):
 *   Κ1 — `useTranslation([...])` με γονέα P **και** split του P (εκτός `[0]`, που ορίζει το primary) που είναι
 *        **αποδεδειγμένα αφαιρέσιμο** ⇒ γράψε `'P'`. Όπου η αφαίρεση θα άλλαζε λέξη (κοινό κλειδί με άλλο namespace
 *        της λίστας) η κλήση είναι `order-bearing`: δεν είναι επανάληψη, είναι σύγκρουση κλειδιών — αναφέρεται, δεν
 *        μπλοκάρει.
 *   Κ2 — `useTranslation([...])` με **όλα** τα splits του P χωρίς τον P ⇒ ίδια κλάση, άλλη μορφή.
 *   Κ3 — bundle του `namespace-bundles.ts` που περιέχει τον P πρέπει να περιέχει **όλα** τα splits του: είναι
 *        δεύτερο αντίγραφο της οικογένειας (το διαβάζουν και μη-hook καταναλωτές, π.χ. preload αλλαγής γλώσσας),
 *        άρα η απόκλισή του από τον χάρτη γίνεται εδώ **μη εκφράσιμη**.
 *
 * `--fix` = το codemod: σβήνει τα περιττά splits ΜΟΝΟ όταν το `equivalence.js` αποδείξει ότι κανένα κείμενο δεν
 * αλλάζει (σειρά προτεραιότητας, σε κάθε γλώσσα). Αλλιώς αφήνει την κλήση και την αναφέρει.
 *
 * CLI:
 *   node scripts/check-i18n-namespace-family.js            (σταδιοποιημένα)
 *   node scripts/check-i18n-namespace-family.js --all | --report | --generate-baseline
 *   node scripts/check-i18n-namespace-family.js --fix [--dry-run] [--exclude=<υποσυμβολοσειρά>,…]
 *
 * Escape: `SKIP_I18N_NAMESPACE_FAMILY=1`
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { commitInput } = require('./lib/gate-input');
const {
  loadCompatNamespaces, loadNamespaceBundles, NAMESPACE_BUNDLES_FILE, NAMESPACE_COMPAT_FILE,
} = require('./lib/i18n-namespace-extract');
const { KINDS, findArrayCalls, classify, proposeFix, renderList } = require('./lib/i18n-namespace-family/scan');
const { loadLocaleIndex, proveEquivalent } = require('./lib/i18n-namespace-family/equivalence');
const { requestOf } = require('./lib/i18n-namespace-family/request');
const { BASELINE_FILE, readBaseline, compareWithBaseline, writeBaseline } = require('./lib/i18n-namespace-family/baseline');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BUNDLE_DRIFT = 'bundle-missing-split'; // ⛔ Κ3
const ORDER_BEARING_NEW = 'order-bearing-new'; // 🔴 RATCHET κατά ταυτότητα
const BLOCKING = [KINDS.PARENT_WITH_SPLITS, KINDS.ALL_SPLITS, BUNDLE_DRIFT, ORDER_BEARING_NEW];
const SOURCE = /\.(ts|tsx)$/;

/** Πλήρες όταν ζητηθεί — ή όταν αλλάζει η ίδια η αυθεντία (ο χάρτης/τα bundles κρίνουν ΚΑΘΕ αρχείο). */
function selectFiles(argv, input) {
  const authority = [NAMESPACE_COMPAT_FILE, NAMESPACE_BUNDLES_FILE];
  const staged = input.staged((rel) => SOURCE.test(rel)).filter(input.exists);
  const full = ['--all', '--report', '--fix', '--generate-baseline'].some((f) => argv.includes(f))
    || staged.some((abs) => authority.includes(input.rel(abs)));
  const files = full ? input.productionSources(['src']) : staged.filter((abs) => !/__tests__|\.test\./.test(abs));
  return { full, files: files.filter((abs) => SOURCE.test(abs)) };
}

/** Κ3 — κάθε bundle που περιέχει γονέα πρέπει να περιέχει όλα τα splits του. */
function bundleViolations(input, compat) {
  const out = [];
  for (const [name, list] of loadNamespaceBundles(input.root, input)) {
    for (const parent of list.filter((ns) => compat.has(ns))) {
      const missing = compat.get(parent).filter((s) => !list.includes(s));
      if (missing.length) {
        out.push({ file: NAMESPACE_BUNDLES_FILE, state: BUNDLE_DRIFT, detail: `${name}: λείπουν ${missing.join(', ')} του «${parent}»` });
      }
    }
  }
  return out;
}

/**
 * Το πλαίσιο απόδειξης ενός αρχείου — τεμπέλικα: locale και AST φορτώνονται ΜΟΝΟ αν υπάρχει κάτι να αποδειχθεί
 * (σταδιοποιημένο commit χωρίς Κ1-σχήμα ⇒ μηδέν κόστος).
 */
function proofContext(input, compat, shared) {
  return (abs, content) => {
    let request = null;
    return {
      compat,
      localeIndex: () => (shared.localeIndex ??= loadLocaleIndex(input)),
      request: () => (request ??= requestOf(content, input.rel(abs))),
    };
  };
}

/**
 * Η ΚΡΙΣΗ μιας κλήσης — ΜΙΑ, για την πύλη ΚΑΙ για το `--fix`: Κ1-σχήμα ⇒ πρόταση ⇒ απόδειξη. Αποδεδειγμένα
 * αφαιρέσιμο = ⛔ Κ1 (με τη διόρθωση)· η σειρά φέρει νόημα = ✅ `order-bearing` (με τον λόγο).
 */
function judge(call, ctx) {
  const { kind, parents } = classify(call.items, ctx.compat);
  if (kind !== KINDS.PARENT_WITH_SPLITS) return { kind, parents };
  const next = proposeFix(call.items, ctx.compat);
  const proof = proveEquivalent(call.items, next, ctx.compat, ctx.localeIndex(), ctx.request());
  if (!proof.equivalent) return { kind: KINDS.ORDER_BEARING, parents, reason: proof.reason };
  return { kind, parents, next };
}

function measure(argv = [], input = commitInput(PROJECT_ROOT, argv)) {
  const compat = loadCompatNamespaces(input.root, input);
  if (compat.size === 0) throw new Error(`CHECK 3.108 — κενός ${NAMESPACE_COMPAT_FILE}: η πύλη δεν μπορεί να κρίνει`);
  const { full, files } = selectFiles(argv, input);
  const contextOf = proofContext(input, compat, {});
  const tally = Object.fromEntries([...Object.values(KINDS), BUNDLE_DRIFT, ORDER_BEARING_NEW].map((s) => [s, 0]));
  const violations = [];
  const orderBearing = [];
  for (const abs of files) {
    const content = input.read(abs) || '';
    const ctx = contextOf(abs, content);
    for (const call of findArrayCalls(content)) {
      const { kind, parents, reason } = judge(call, ctx);
      if (!(kind in tally)) throw new Error(`CHECK 3.108 — άγνωστη κατάσταση «${kind}»`);
      tally[kind]++;
      const where = { file: input.rel(abs), line: call.line, state: kind };
      if (kind === KINDS.ORDER_BEARING) orderBearing.push({ ...where, items: call.items, detail: reason });
      else if (kind !== KINDS.CLEAN) violations.push({ ...where, detail: `[${call.items}] — οικογένεια ${parents}` });
    }
  }
  const drift = bundleViolations(input, compat);
  tally[BUNDLE_DRIFT] = drift.length;
  violations.push(...drift);
  const { fresh, stale } = compareWithBaseline(orderBearing, readBaseline(input));
  tally[ORDER_BEARING_NEW] = fresh.length;
  violations.push(...fresh.map((o) => ({ ...o, state: ORDER_BEARING_NEW, detail: `νέα σύγκρουση σειράς — ${o.detail}` })));
  return {
    scope: full ? 'all' : 'staged', files: files.length, tally, violations, orderBearing,
    stale: full ? stale : [], blocking: violations, compat,
  };
}

/** Ένα αρχείο: από το ΤΕΛΟΣ προς την αρχή, ώστε οι θέσεις των προηγούμενων κλήσεων να μένουν έγκυρες. */
function fixContent(content, ctx, onSkip) {
  let next = content;
  let rewritten = 0;
  for (const call of findArrayCalls(content).reverse()) {
    const verdict = judge(call, ctx);
    if (verdict.kind === KINDS.ORDER_BEARING) onSkip(call.line, verdict.reason);
    if (!verdict.next) continue;
    next = next.slice(0, call.start) + renderList(verdict.next, call.quote) + next.slice(call.end);
    rewritten++;
  }
  return { next, rewritten };
}

/** Το codemod (`--fix [--dry-run] [--exclude=…]`). Γράφει ΜΟΝΟ ό,τι η `judge` απέδειξε ισοδύναμο. */
function fix(argv, input = commitInput(PROJECT_ROOT, [])) {
  const excludes = (argv.find((a) => a.startsWith('--exclude=')) || '--exclude=').slice(10).split(',').filter(Boolean);
  const compat = loadCompatNamespaces(input.root, input);
  const contextOf = proofContext(input, compat, {});
  const result = { rewritten: 0, files: 0, skipped: [], excluded: [], changed: [] };
  for (const abs of selectFiles(['--all'], input).files) {
    const rel = input.rel(abs);
    const content = input.read(abs) || '';
    const { next, rewritten } = fixContent(content, contextOf(abs, content), (line, reason) => result.skipped.push({ file: rel, line, reason }));
    if (next === content) continue;
    if (excludes.some((x) => rel.includes(x))) { result.excluded.push(rel); continue; }
    result.rewritten += rewritten;
    result.changed.push(rel);
    if (argv.includes('--dry-run')) continue;
    fs.writeFileSync(path.join(input.root, rel), next, 'utf8');
    result.files++;
  }
  return result;
}

function printReport(m) {
  console.log(`📋 CHECK 3.108 — εμβέλεια: ${m.scope} · αρχεία: ${m.files} · οικογένειες: ${m.compat.size}`);
  // ⚠️ Κάθε κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που λείπει διαβάζεται ως «δεν υπάρχει έλεγχος».
  for (const state of Object.keys(m.tally)) {
    console.log(`   ${BLOCKING.includes(state) ? '⛔' : '✅'} ${state.padEnd(22)} ${m.tally[state]}`);
  }
  for (const v of m.violations) console.log(`   ⛔ ${v.file}${v.line ? `:${v.line}` : ''}: ${v.detail}`);
  for (const o of m.orderBearing) console.log(`   ↕️  ${o.file}:${o.line}: η σειρά κρίνει — ${o.detail}`);
  for (const id of m.stale) console.log(`   🧹 μπαγιάτικη γραμμή baseline (σφίξε την): ${id}`);
}

/** ⚠️ ΡΑΦΗ ΕΝΕΣΗΣ: σε καθαρό δέντρο ένα `main()` που δεν κοιτάζει το αποτέλεσμα θα έβγαινε εξίσου πράσινο. */
function main(argv, measureFn = measure, fixFn = fix) {
  if (process.env.SKIP_I18N_NAMESPACE_FAMILY) return 0;
  if (argv.includes('--fix')) {
    const r = fixFn(argv);
    console.log(`🔧 CHECK 3.108 --fix: ${r.rewritten} κλήσεις σε ${r.files} αρχεία · παραλείφθηκαν ${r.skipped.length} · εξαιρέθηκαν ${r.excluded.length}`);
    for (const s of r.skipped) console.log(`   ⏭️  ${s.file}:${s.line} — ${s.reason}`);
    for (const e of r.excluded) console.log(`   🚫 ${e}`);
    return 0;
  }
  const m = measureFn(argv);
  if (argv.includes('--report')) { printReport(m); return 0; }
  if (argv.includes('--generate-baseline')) {
    const payload = writeBaseline(PROJECT_ROOT, m.orderBearing);
    console.log(`📝 ${BASELINE_FILE}: ${payload._meta.totalSites} order-bearing ταυτότητες`);
    return 0;
  }
  if (!m.blocking.length) return 0;
  console.error(`\n❌ CHECK 3.108 — ${m.blocking.length} χειρόγραφη/ες οικογένεια/ες namespaces:\n`);
  for (const v of m.blocking) console.error(`  ⛔ ${v.file}${v.line ? `:${v.line}` : ''}: ${v.state} ${v.detail}`);
  console.error('\n   Ο hook φορτώνει ΗΔΗ τα splits του γονέα (COMPAT_NAMESPACE_MAP, ADR-280).');
  console.error("   Γράψε μόνο τον γονέα — π.χ. useTranslation('building') — ή ακόμη καλύτερα ΜΟΝΟ το split που χρειάζεσαι.");
  console.error('   Αυτόματα (με απόδειξη ισοδυναμίας): node scripts/check-i18n-namespace-family.js --fix');
  return 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = {
  measure, fix, fixContent, judge, main, printReport, bundleViolations, BLOCKING, BUNDLE_DRIFT, ORDER_BEARING_NEW, PROJECT_ROOT,
};
