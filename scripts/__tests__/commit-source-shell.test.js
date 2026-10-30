/**
 * ADR-924 Φ3 — η ΕΙΣΟΔΟΣ των πυλών bash (`scripts/lib/commit-source.sh`): με `--index` κρίνεται ό,τι ΘΑ ΔΕΣΜΕΥΤΕΙ.
 *
 * Άγκυρα δίσκος ≠ ευρετήριο για τις CHECK 3.9 (ICU) και 3.10 (companyId) — το ίδιο ιδίωμα με την 3.6
 * (`check-ui-hardcoded-strings.test.js`): προσωρινό repo μέσω `GIT_DIR`/`GIT_WORK_TREE`, το cwd μένει στη ρίζα,
 * το ευρετήριο του repo δεν αγγίζεται ποτέ. Σε κάθε περίπτωση το σταδιοποιημένο ΔΙΑΦΕΡΕΙ από τον δίσκο — αλλιώς
 * η άγκυρα δεν θα ξεχώριζε ποια πηγή διαβάστηκε.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

let tmp;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-source-')); });
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** Σταδιοποίησε `staged` (ή τίποτα, με `null`), γράψε `disk` στον δίσκο, τρέξε την πύλη με `--index`. */
function runIndexGate(gate, rel, { staged, disk }) {
  const git = (...args) => spawnSync('git', ['-C', tmp, ...args], { encoding: 'utf8' });
  git('init', '-q');
  const file = path.join(tmp, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (staged !== null) {
    fs.writeFileSync(file, staged, 'utf8');
    git('add', rel);
  }
  fs.writeFileSync(file, disk, 'utf8');
  const env = { ...process.env, GIT_DIR: path.join(tmp, '.git'), GIT_WORK_TREE: tmp };
  const r = spawnSync('bash', [gate, '--index', rel], { cwd: ROOT, encoding: 'utf8', env });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('CHECK 3.9 — ICU: --index κρίνει το COMMIT, ποτέ τον δίσκο', () => {
  const GATE = 'scripts/check-icu-interpolation.sh';
  const REL = 'src/i18n/locales/el/probe.json';
  const CLEAN = '{ "a": "Γεια {name}" }\n';
  const DIRTY = '{ "a": "Γεια {{name}}" }\n';
  const PLURAL = '{ "items_one": "ένα" }\n';

  test('καθαρό ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ + ξένη βρώμικη δουλειά στον δίσκο ⇒ ΠΕΡΝΑ', () => {
    expect(runIndexGate(GATE, REL, { staged: CLEAN, disk: DIRTY }).code).toBe(0);
  });

  test('βρώμικο ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ + καθαρός δίσκος ⇒ ΜΠΛΟΚ ({{var}})', () => {
    const r = runIndexGate(GATE, REL, { staged: DIRTY, disk: CLEAN });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/NEW FILE with \{\{var\}\}/);
  });

  test('Κανόνας 2 (επίθημα πληθυντικού) ΚΙ ΑΥΤΟΣ από το ευρετήριο — ο κόμβος node παίρνει το --index', () => {
    const r = runIndexGate(GATE, REL, { staged: PLURAL, disk: CLEAN });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/items_one/);
    expect(runIndexGate(GATE, REL, { staged: CLEAN, disk: PLURAL }).code).toBe(0);
  });

  test('αρχείο ΕΚΤΟΣ ευρετηρίου (untracked) ⇒ δεν κρίνεται — δεν είναι στο commit', () => {
    expect(runIndexGate(GATE, REL, { staged: null, disk: DIRTY }).code).toBe(0);
  });
});

describe('CHECK 3.10 — companyId: --index κρίνει το COMMIT, ποτέ τον δίσκο', () => {
  const GATE = 'scripts/check-firestore-companyid.sh';
  const REL = 'src/probe.ts';
  const SCOPED = "export const q = query(\n  collection(db, COLLECTIONS.CONTACTS),\n  where('companyId', '==', id),\n);\n";
  const UNSCOPED = "export const q = query(\n  collection(db, COLLECTIONS.CONTACTS),\n  where('status', '==', 'a'),\n);\n";

  test('φιλτραρισμένο ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ + αφιλτράριστη ξένη δουλειά στον δίσκο ⇒ ΠΕΡΝΑ', () => {
    expect(runIndexGate(GATE, REL, { staged: SCOPED, disk: UNSCOPED }).code).toBe(0);
  });

  test('αφιλτράριστο ΣΤΑΔΙΟΠΟΙΗΜΕΝΟ + φιλτραρισμένος δίσκος ⇒ ΜΠΛΟΚ', () => {
    expect(runIndexGate(GATE, REL, { staged: UNSCOPED, disk: SCOPED }).code).toBe(1);
  });

  test('αρχείο ΕΚΤΟΣ ευρετηρίου (untracked) ⇒ δεν κρίνεται', () => {
    expect(runIndexGate(GATE, REL, { staged: null, disk: UNSCOPED }).code).toBe(0);
  });
});

describe('CHECK 3.5 + κανόνες έργου (φάσεις του hook, Φ5) — --index κρίνει το COMMIT', () => {
  const REL = 'src/probe.ts';
  const HARDCODED = "export const L = t('k', { defaultValue: 'Αποθήκευση' });\n";
  const CLEAN = "export const L = t('k');\n";
  const ADD_DOC = 'export const x = () => addDoc(ref, data);\n';

  test('3.5 — καθαρό σταδιοποιημένο + ξένο hardcoded στον δίσκο ⇒ ΠΕΡΝΑ · ανάποδα ⇒ ΜΠΛΟΚ', () => {
    const GATE = 'scripts/check-hardcoded-strings.sh';
    expect(runIndexGate(GATE, REL, { staged: CLEAN, disk: HARDCODED }).code).toBe(0);
    expect(runIndexGate(GATE, REL, { staged: HARDCODED, disk: CLEAN }).code).toBe(1);
  });

  test('κανόνες έργου — addDoc σταδιοποιημένο ⇒ ΜΠΛΟΚ · μόνο στον δίσκο ⇒ ΠΕΡΝΑ', () => {
    const GATE = 'scripts/validate-project-rules.sh';
    expect(runIndexGate(GATE, REL, { staged: ADD_DOC, disk: CLEAN }).code).toBe(1);
    expect(runIndexGate(GATE, REL, { staged: CLEAN, disk: ADD_DOC }).code).toBe(0);
  });
});
