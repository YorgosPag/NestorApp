#!/usr/bin/env node
/**
 * ADR-863 — ΓΕΝΝΗΤΟΡΑΣ ΤΗΣ ΑΠΟΔΟΣΗΣ ΑΔΕΙΩΝ ΓΙΑ Ο,ΤΙ ΔΙΑΝΕΜΕΤΑΙ.
 *
 * «Οι άδειες NOTICE απαιτούν το κείμενό τους να **συνοδεύει τα αντίγραφα**. Ό,τι κατεβαίνει
 *  στον browser είναι αντίγραφο. Το συνοδεύει;»
 *
 * **ΜΙΑ ΠΗΓΗ**: η απογραφή και η απόφαση άδειας είναι **αυτές του CHECK 12** — `runLicenseInventory`
 * + `resolveLicense` + `.license-policy.json`. Δεύτερη λίστα αδειών οπουδήποτε θα ήταν ADR-749
 * σε μικρογραφία. Το «απαιτεί απόδοση;» είναι το `requiresAttribution` της **ίδιας** πολιτικής,
 * που ρωτά και το CHECK 3.69 για τις γραμματοσειρές.
 *
 * CLI:
 *   node scripts/generate-third-party-notices.js            # γράφει τα artifacts
 *   node scripts/generate-third-party-notices.js --report   # μόνο λογιστική, καμία εγγραφή
 *
 * @module scripts/generate-third-party-notices
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const I = require('./lib/license-policy/inventory');
const P = require('./lib/license-policy/policy');
const J = require('./lib/license-policy/judge');
const T = require('./lib/third-party-notices/texts');
const G = require('./lib/third-party-notices/judge');
const S = require('./lib/third-party-notices/surfaces');
const R = require('./lib/third-party-notices/render');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'third-party');
const NOTICES_FILE = path.join(OUT_DIR, 'THIRD_PARTY_NOTICES.txt');
const SBOM_FILE = path.join(OUT_DIR, 'sbom.json');

/**
 * Το αποτύπωμα των **εισόδων**. Πρότυπο CHECK 3.33/3.34: ένα παραγόμενο artifact χωρίς
 * αποτύπωμα **παλιώνει σιωπηλά** — μετρημένα τέσσερις φορές σε αυτό το repo.
 * ⚠️ **Ποτέ `mtime`** (μάθημα 3.33): περιεχόμενο, με σταθερή σειρά.
 */
function inputsFingerprint() {
  const hash = crypto.createHash('sha256');
  const files = [
    path.join(ROOT, 'pnpm-lock.yaml'),
    path.join(ROOT, P.POLICY_FILE_NAME),
    path.join(ROOT, S.SNAPSHOT_FILE),
    ...listCanonical(),
  ];
  for (const file of files) {
    hash.update(path.relative(ROOT, file).replace(/\\/g, '/'));
    hash.update('\0');
    hash.update(fs.existsSync(file) ? fs.readFileSync(file) : Buffer.from('<απόν>'));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function listCanonical() {
  const dir = path.join(ROOT, T.CANONICAL_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).sort().map((name) => path.join(dir, name));
}

/** Η πολιτική που δεν διαβάζεται ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ «καμία παραβίαση». */
function loadPolicyOrThrow() {
  const loaded = P.loadPolicy(path.join(ROOT, P.POLICY_FILE_NAME));
  if (!loaded.ok) throw new Error(`${P.POLICY_FILE_NAME}: ${loaded.error}`);
  return loaded.policy;
}

/** Τι άδεια **είναι** το πακέτο — με τη λογική του CHECK 12, όχι δεύτερη υλοποίηση. */
function licenseOf(policy, pkg) {
  const resolved = J.resolveLicense(policy, pkg);
  return resolved.drift ? pkg.license : resolved.license;
}

/** Ένα «υποκείμενο κρίσης» ανά πακέτο: ταυτότητα, άδεια, επιφάνεια, κείμενο. */
function subjectOf(policy, snapshot, pkg) {
  const license = licenseOf(policy, pkg);
  const requiresAttribution = P.requiresAttribution(policy, license);
  return {
    id: pkg.id,
    name: pkg.name,
    version: pkg.version,
    license,
    requiresAttribution,
    surface: S.surfaceOf(snapshot, pkg.name),
    text: T.resolveNoticeText(ROOT, pkg, license),
  };
}

/** @returns {{ok: true, verdict, subjects, snapshot, fingerprint} | {ok: false, detail: string}} */
function measure() {
  const inventory = I.runLicenseInventory({ cwd: ROOT });
  if (!inventory.packages) {
    return { ok: false, detail: `απογραφή (${inventory.outcome}): ${inventory.detail || inventory.stderr || ''}` };
  }
  const loaded = S.loadSnapshot(ROOT);
  if (!loaded.ok) return { ok: false, detail: loaded.detail };

  const policy = loadPolicyOrThrow();
  const subjects = inventory.packages.map((pkg) => subjectOf(policy, loaded.snapshot, pkg));
  const verdict = G.judge(subjects);
  const byId = new Map(subjects.map((s) => [s.id, s]));
  verdict.rows = verdict.rows.map((row) => ({ ...byId.get(row.id), ...row }));
  return { ok: true, verdict, subjects, snapshot: loaded.snapshot, fingerprint: inputsFingerprint() };
}

/** Κλειστή λογιστική — κάθε κάδος τυπώνεται **και στο μηδέν**. */
function printReport(m) {
  console.log(`📋 ADR-863 — απόδοση αδειών · στοιχεία: ${m.verdict.rows.length} · αποτύπωμα: sha256:${m.fingerprint.slice(0, 12)}…`);
  if (m.snapshot.measured !== true) {
    console.log(`   ⏳ Η ΕΠΙΦΑΝΕΙΑ ΔΕΝ ΕΧΕΙ ΜΕΤΡΗΘΕΙ: το ${S.SNAPSHOT_FILE} περιμένει σπορά από το CI.`);
  }
  for (const state of Object.values(G.STATES)) {
    const mark = G.BLOCKING.includes(state) ? '⛔' : (G.RATCHETED.includes(state) ? '🔴' : '✅');
    console.log(`   ${mark} ${state.padEnd(26)} ${m.verdict.tally[state]}`);
  }
  const total = Object.values(m.verdict.tally).reduce((a, b) => a + b, 0);
  if (total !== m.verdict.rows.length) {
    throw new Error(`ADR-863 — η λογιστική δεν κλείνει: ${total} ≠ ${m.verdict.rows.length}`);
  }
  for (const row of [...m.verdict.blocking, ...m.verdict.ratcheted].slice(0, 20)) {
    console.log(`\n   ${row.state}: ${row.id}\n      ${row.detail}`);
  }
}

function write(m) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const meta = { generatedAt: new Date().toISOString(), fingerprint: m.fingerprint };
  fs.writeFileSync(NOTICES_FILE, R.renderNotices(m.verdict, meta), 'utf8');
  fs.writeFileSync(SBOM_FILE, R.renderSbom(m.verdict, meta), 'utf8');
  console.log(`✅ ${path.relative(ROOT, NOTICES_FILE)} · ${path.relative(ROOT, SBOM_FILE)}`);
  console.log(`   αποδόθηκαν: ${R.attributedCount(m.verdict)} · αποτύπωμα sha256:${m.fingerprint.slice(0, 12)}…`);
}

function main(argv) {
  const m = measure();
  if (!m.ok) {
    console.error(`❌ ADR-863 — αδύνατη η μέτρηση: ${m.detail}`);
    return 1;
  }
  printReport(m);
  if (!argv.includes('--report')) write(m);
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { ROOT, NOTICES_FILE, SBOM_FILE, inputsFingerprint, licenseOf, subjectOf, measure, printReport, main };
