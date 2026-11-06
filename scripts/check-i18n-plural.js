#!/usr/bin/env node
/**
 * CHECK 3.115 — ΠΥΛΗ ΤΟΥ ΠΛΗΘΥΝΤΙΚΟΥ (ADR-932).
 *
 * «Λέει αυτό το μήνυμα **"1 παραγγελίες"**; — μετρά το `{count}` χωρίς πληθυντικό ICU, ή λείπει
 *  από τον πληθυντικό του κατηγορία που η γλώσσα του επιλέγει;»
 *
 * 🔴 **ΤΟ ΓΕΓΟΝΟΣ (2026-11-06, ADR-928 §5.24.3)**: η αρχική των προμηθειών έγραφε «1 παραγγελίες» /
 *    «1 orders». Η πρώτη μέτρηση σε όλο το δέντρο: **961** μηνύματα με `{count}` έξω από `plural`.
 *    Καμία πύλη δεν ρωτούσε: το **3.9** ελέγχει ότι γράφεται `{x}` και όχι `{{x}}`, το **3.8** ότι το
 *    κλειδί υπάρχει. Το `0` σήμαινε «κανείς δεν κοίταξε».
 *
 * 🏆 **Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΚΑΙ ΕΝΑ ΒΗΜΑ ΠΑΡΑΠΕΡΑ**: το `eslint-plugin-formatjs` (`enforce-plural-rules`)
 *    ελέγχει τις κατηγορίες ενός μηνύματος που **ήδη** είναι πληθυντικός, με λίστα γραμμένη με το χέρι,
 *    και μόνο μέσα στον κώδικα. Εδώ: (α) ο **ξεχασμένος** πληθυντικός, (β) οι κατηγορίες από το **CLDR**
 *    της γλώσσας του αρχείου (`Intl.PluralRules`), (γ) ο **ίδιος parser** με τον χρόνο εκτέλεσης.
 *
 * Καταστάσεις (κλειστό σύνολο, fail-closed — `lib/i18n-plural/judge.js`):
 *   🔴 RATCHET κατά ταυτότητα: `bare-count` · `missing-category` · `unparsable`
 *   ⛔ ZERO-TOL: `foreign-category` · δήλωση χωρίς λόγο · δήλωση που δεν ισχύει πια
 *   ✅ `declared-invariant` (`.i18n-plural-declarations.json`, με λόγο) · `plural`
 *
 * CLI:
 *   node scripts/check-i18n-plural.js                    # κρίση vs baseline
 *   node scripts/check-i18n-plural.js --report
 *   node scripts/check-i18n-plural.js --write-baseline
 *
 * Escape: `SKIP_I18N_PLURAL=1`
 */

'use strict';

const path = require('node:path');

const ratchet = require('./lib/ratchet-baseline');
const { STATES, ZERO_TOLERANCE, judgeMessage, leafMessages, messageId } = require('./lib/i18n-plural/judge');

const ROOT = ratchet.PROJECT_ROOT;
const BASELINE_FILE = path.join(ROOT, '.i18n-plural-baseline.json');
const DECLARATIONS_FILE = '.i18n-plural-declarations.json';
const LOCALES_DIR = 'src/i18n/locales';
/** `src/i18n/locales/<γλώσσα>/<ns>.json` — ακριβώς ένα επίπεδο κάτω από τη γλώσσα. */
const LOCALE_FILE = /^src\/i18n\/locales\/([^/]+)\/([^/]+)\.json$/;
const RATCHETED = [STATES.BARE, STATES.MISSING_CATEGORY, STATES.UNPARSABLE];
const DECL = { WITHOUT_REASON: 'declaration-without-reason', STALE: 'declaration-stale' };

/** Οι δηλώσεις αμετάβλητου: `{ "<γλώσσα>/<ns>:<κλειδί>": "λόγος" }`. Λείπει ⇒ κενό· χαλασμένο ⇒ `throw`. */
function readDeclarations(input) {
  const text = input.read(DECLARATIONS_FILE);
  if (text === null) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed.invariants !== 'object') throw new Error(`${DECLARATIONS_FILE}: λείπει το «invariants»`);
  return parsed.invariants;
}

/** Τα ευρήματα ενός αρχείου locale, με ταυτότητα και κατάσταση. */
function judgeFile(input, abs, invariants, tally) {
  const rel = input.rel(abs);
  const [, lang, ns] = rel.match(LOCALE_FILE);
  const source = input.read(abs);
  const rows = [];
  for (const [key, text] of leafMessages(JSON.parse(source))) {
    const id = messageId(lang, ns, key);
    for (const f of judgeMessage(text, lang)) {
      const declared = f.state === STATES.BARE && Object.hasOwn(invariants, id);
      const state = declared ? STATES.DECLARED : f.state;
      tally[state]++;
      rows.push({ id, state, file: rel, line: lineOf(source, key, text), detail: `${id} — ${f.detail || state}` });
    }
  }
  return rows;
}

/**
 * Η γραμμή του μηνύματος, για να δείχνει η αποτυχία ΠΟΥ (`αρχείο:γραμμή`, κλικάρισιμο). Μόνο για ανάγνωση από
 * άνθρωπο — η ταυτότητα της baseline είναι το κλειδί, ποτέ η γραμμή (μετακινείται με κάθε προσθήκη από πάνω).
 * Ίδια τιμή σε δύο κλειδιά ⇒ η πρώτη· δεν βρέθηκε (escapes) ⇒ 0.
 */
function lineOf(source, key, text) {
  const needle = `${JSON.stringify(key.split('.').pop())}: ${JSON.stringify(text)}`;
  const at = source.indexOf(needle);
  return at < 0 ? 0 : source.slice(0, at).split('\n').length;
}

/** Οι ⛔ των δηλώσεων: χωρίς λόγο, ή για μήνυμα που ΔΕΝ είναι πια σκέτο (PHPStan `reportUnmatchedIgnoredErrors`). */
function judgeDeclarations(invariants, rows) {
  const declaredIds = new Set(rows.filter((r) => r.state === STATES.DECLARED).map((r) => r.id));
  const out = [];
  for (const [id, why] of Object.entries(invariants)) {
    if (typeof why !== 'string' || why.trim().length < 10) out.push({ state: DECL.WITHOUT_REASON, detail: `${id} — ο λόγος λείπει ή είναι κενός` });
    if (!declaredIds.has(id)) out.push({ state: DECL.STALE, detail: `${id} — δεν υπάρχει πια σκέτο {count} εκεί: σβήσε τη δήλωση` });
  }
  return out;
}

function measure(_args, input) {
  const files = input.files([LOCALES_DIR], { accept: (rel) => LOCALE_FILE.test(rel) }).sort();
  const invariants = readDeclarations(input);
  const tally = Object.fromEntries(Object.values(STATES).map((s) => [s, 0]));
  const rows = files.flatMap((abs) => judgeFile(input, abs, invariants, tally));
  const known = new Set(Object.values(STATES));
  for (const r of rows) if (!known.has(r.state)) throw new Error(`CHECK 3.115 — άγνωστη κατάσταση «${r.state}»`);
  const violations = rows.filter((r) => RATCHETED.includes(r.state)).map((r) => ({ ...r, key: `${r.state} ${r.id}` }));
  const zeroTolerance = [
    ...rows.filter((r) => ZERO_TOLERANCE.includes(r.state) && !RATCHETED.includes(r.state)),
    ...judgeDeclarations(invariants, rows),
  ];
  return {
    files: files.length, tally, violations, zeroTolerance,
    violationIds: [...new Set(violations.map((v) => v.key))].sort(),
    declarations: [],   // ⚠️ οι δηλώσεις είναι ΤΕΛΙΚΗ κατάσταση, όχι χρέος: κρίνονται με λόγο, δεν κλειδώνονται
  };
}

function printReport(m) {
  console.log(`📋 CHECK 3.115 — αρχεία locale: ${m.files}`);
  // ⚠️ Κάθε κάδος τυπώνεται ΑΚΟΜΑ ΚΑΙ ΣΤΟ ΜΗΔΕΝ: ένα «0» που λείπει διαβάζεται ως «δεν υπάρχει έλεγχος».
  for (const state of Object.values(STATES)) {
    const mark = RATCHETED.includes(state) ? '🔴' : (ZERO_TOLERANCE.includes(state) ? '⛔' : '✅');
    console.log(`   ${mark} ${state.padEnd(26)} ${m.tally[state]}`);
  }
  for (const state of Object.values(DECL)) {
    console.log(`   ⛔ ${state.padEnd(26)} ${m.zeroTolerance.filter((z) => z.state === state).length}`);
  }
  const byNs = {};
  for (const v of m.violations) { const ns = v.id.split(':')[0]; byNs[ns] = (byNs[ns] || 0) + 1; }
  const top = Object.entries(byNs).sort((a, b) => b[1] - a[1]).slice(0, 12);
  if (top.length) console.log(`\n   Περισσότερα ευρήματα: ${top.map(([ns, n]) => `${ns} ${n}`).join(' · ')}`);
  for (const z of m.zeroTolerance) console.log(`   ⛔ [${z.state}] ${z.detail}`);
}

function buildPayload(m) {
  return ratchet.ratchetPayload(m, {
    _doc: 'CHECK 3.115 / ADR-932 — RATCHET ΚΑΤΑ ΤΑΥΤΟΤΗΤΑ («κατάσταση γλώσσα/ns:κλειδί»). Μόνο μικραίνει.',
    _warning: 'Θεραπεία: {count, plural, one {# …} other {# …}} — ή, αν η λέξη δεν κλίνεται, δήλωση με λόγο στο '
      + `${DECLARATIONS_FILE}. ΠΟΤΕ προσθήκη εδώ.`,
  });
}

const descriptor = {
  adr: 'ADR-932 (CHECK 3.115)',
  skipEnv: 'SKIP_I18N_PLURAL',
  baselineFile: BASELINE_FILE,
  labels: { violations: 'μηνύματα χωρίς σωστό πληθυντικό', declarations: 'δηλώσεις' },
  commands: ratchet.npmRatchetCommands('i18n-plural'),
  measure,
  buildPayload,
  printReport,
  violationId: (v) => v.key,
  refusals: (m) => m.zeroTolerance.map((z) => `[${z.state}] ${z.detail}`),
  messages: {
    worse: 'νέο μήνυμα που λέει «1 παραγγελίες» (ή πληθυντικός χωρίς κατηγορία της γλώσσας του)',
    newDeclLabel: 'νέα δήλωση',
  },
};

if (require.main === module) ratchet.runSetRatchetCli(descriptor);

module.exports = { measure, buildPayload, printReport, descriptor, BASELINE_FILE, DECLARATIONS_FILE, RATCHETED, DECL };
