/**
 * CHECK 12 / ADR-598 G13 — ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΜΗΧΑΝΗΣ ΠΟΛΙΤΙΚΗΣ ΑΔΕΙΩΝ.
 *
 * ⚠️ Κάθε άγκυρα **ΕΚΤΕΛΕΙ** κώδικα — καμία δεν ψάχνει λέξεις στην πηγή. Ένα κειμενικό test μένει
 * πράσινο πάνω σε μετάλλαξη που αφήνει τις λέξεις στη θέση τους (`Μ6` του CHECK 3.8).
 *
 * Ομάδες:
 *   Σ — αναλυτής SPDX (γραμματική, προτεραιότητα, OR/AND)
 *   Κ — κάθε κατάσταση πακέτου/απόφασης, με συνθετικό κόσμο (αλλάζει ΜΙΑ είσοδος)
 *   Π — επικύρωση πολιτικής (οι αποφάσεις Giorgio δεν ανοίγουν με ρύθμιση)
 *   Ε — εκτέλεση του εργαλείου απογραφής (ψεύτικο εργαλείο, παλινδρόμηση `TMP`)
 *   Λ — απόκλιση lockfile
 *   Χ — το CLI ως υποδιεργασία: 0 / 1 / 2
 *   Δ — ο παρονομαστής: το ΠΡΑΓΜΑΤΙΚΟ δέντρο
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const spdx = require('../lib/license-policy/spdx');
const P = require('../lib/license-policy/policy');
const S = require('../lib/license-policy/states');
const I = require('../lib/license-policy/inventory');
const J = require('../lib/license-policy/judge');
const { SPAWN_OUTCOME } = require('../lib/spawn-outcome');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CLI = path.join(REPO_ROOT, 'scripts', 'check-license-policy.js');
const POLICY_PATH = path.join(REPO_ROOT, P.POLICY_FILE_NAME);
const REAL_RAW = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
const NOW = Date.parse('2026-09-16T12:00:00Z');

const clone = (o) => JSON.parse(JSON.stringify(o));
function policyWith(mutate = () => {}) {
  const raw = clone(REAL_RAW);
  mutate(raw);
  const compiled = P.compilePolicy(raw);
  if (!compiled.ok) throw new Error(compiled.error);
  return compiled.policy;
}
const pkg = (name, version, license) => ({ id: `${name}@${version}`, name, version, license, path: null });
const verdictOf = (packages, { policy = policyWith(), lockfileKeys, patched = [], now = NOW } = {}) => J.judge(policy, {
  packages, lockfileKeys: lockfileKeys || packages.map((p) => p.id), patched, now,
});
const stateOf = (verdict, id) => verdict.rows.find((r) => r.id === id).state;
const decisionOf = (verdict, id) => verdict.decisions.find((d) => d.id === id).state;
const categoryOf = (license) => P.categorize(policyWith(), license).category;

let tmpRoot;
beforeAll(() => { tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'license-policy-')); });
afterAll(() => { fs.rmSync(tmpRoot, { recursive: true, force: true }); });

// ─── Σ — ΑΝΑΛΥΤΗΣ SPDX ───────────────────────────────────────────────────────

describe('Σ — αναλυτής SPDX', () => {
  it('Σ1: αναγνωριστικό, «+», «WITH»', () => {
    expect(spdx.parse('MIT').ast).toEqual({ type: 'license', id: 'MIT', plus: false, exception: null });
    expect(spdx.parse('GPL-2.0+').ast).toMatchObject({ id: 'GPL-2.0', plus: true });
    expect(spdx.parse('GPL-2.0-only WITH Classpath-exception-2.0').ast)
      .toMatchObject({ id: 'GPL-2.0-only', exception: 'Classpath-exception-2.0' });
  });

  it('Σ2: προτεραιότητα AND > OR, και οι παρενθέσεις την αλλάζουν', () => {
    expect(spdx.parse('MIT OR Apache-2.0 AND GPL-3.0').ast.type).toBe('or');
    expect(spdx.parse('(MIT OR GPL-3.0) AND Apache-2.0').ast.type).toBe('and');
  });

  it('Σ3: ό,τι δεν είναι SPDX ΑΠΟΤΥΓΧΑΝΕΙ — δεν μαντεύεται', () => {
    for (const bad of ['MIT/X11', 'Public Domain', '(MIT', 'MIT AND', 'MIT and BSD', '', 'WITH MIT', 'MIT WITH']) {
      expect(spdx.parse(bad).ok).toBe(false);
    }
  });

  it('Σ4: κανονική μορφή — η σειρά των τελεσταίων και οι περιττές παρενθέσεις δεν αλλάζουν την άδεια', () => {
    expect(spdx.canonicalText('Apache-2.0 AND LGPL-3.0-or-later')).toBe(spdx.canonicalText('(LGPL-3.0-or-later AND Apache-2.0)'));
    expect(spdx.canonicalText('MIT OR (A AND B)')).toBe('(A AND B) OR MIT');
    expect(spdx.canonicalText('MIT/X11')).toBeNull();
  });

  it('Σ5: OR ⇒ η ΕΥΝΟΪΚΟΤΕΡΗ · AND ⇒ η ΑΥΣΤΗΡΟΤΕΡΗ κατηγορία', () => {
    expect(categoryOf('MIT OR GPL-3.0-or-later')).toBe(S.CATEGORY.NOTICE);
    expect(categoryOf('MIT AND GPL-3.0-or-later')).toBe(S.CATEGORY.RESTRICTED);
    expect(categoryOf('(MPL-2.0 OR Apache-2.0)')).toBe(S.CATEGORY.NOTICE);
    expect(categoryOf('Apache-2.0 AND LGPL-3.0-or-later AND MIT')).toBe(S.CATEGORY.RESTRICTED);
  });

  it('Σ6: το «άγνωστο» ΔΕΝ αραιώνεται από γνωστή άδεια σε AND', () => {
    expect(categoryOf('MIT AND Totally-Made-Up-1.0')).toBe(S.CATEGORY.UNKNOWN);
    expect(categoryOf('MIT OR Totally-Made-Up-1.0')).toBe(S.CATEGORY.NOTICE);
  });

  it('Σ7: -only / -or-later / + λύνονται στο αναγνωριστικό της Google', () => {
    expect(categoryOf('LGPL-3.0-or-later')).toBe(S.CATEGORY.RESTRICTED);
    expect(categoryOf('AGPL-3.0-only')).toBe(S.CATEGORY.FORBIDDEN);
    expect(categoryOf('GPL-2.0+')).toBe(S.CATEGORY.RESTRICTED);
  });
});

// ─── Κ — ΚΑΘΕ ΚΑΤΑΣΤΑΣΗ ─────────────────────────────────────────────────────

describe('Κ — κάθε κατάσταση πακέτου, μία είσοδος τη φορά', () => {
  const cases = [
    ['Κ1 allowed', pkg('left-pad', '1.3.0', 'MIT'), S.PACKAGE_STATE.ALLOWED],
    ['Κ2 forbidden', pkg('evil', '1.0.0', 'AGPL-3.0-only'), S.PACKAGE_STATE.FORBIDDEN],
    ['Κ3 restricted (κάθε άλλο LGPL μπλοκάρει)', pkg('some-lgpl', '1.0.0', 'LGPL-3.0-or-later'), S.PACKAGE_STATE.RESTRICTED],
    ['Κ4 reciprocal χωρίς εξαίρεση', pkg('mpl-lib', '1.0.0', 'MPL-2.0'), S.PACKAGE_STATE.RECIPROCAL_UNEXCEPTED],
    ['Κ5 FSL νέας κυκλοφορίας — η εξαίρεση είναι ανά έκδοση', pkg('@sentry/cli', '2.99.0', 'FSL-1.1-MIT'), S.PACKAGE_STATE.SOURCE_AVAILABLE_UNEXCEPTED],
    ['Κ6 OFL-1.1 σε πακέτο', pkg('some-font', '1.0.0', 'OFL-1.1'), S.PACKAGE_STATE.BY_EXCEPTION_ONLY_UNEXCEPTED],
    ['Κ7 χωρίς άδεια', pkg('mystery', '0.0.1', 'Unknown'), S.PACKAGE_STATE.UNKNOWN_LICENSE],
    ['Κ7β «Public Domain» χωρίς επιμέλεια', pkg('pd-lib', '1.0.0', 'Public Domain'), S.PACKAGE_STATE.UNKNOWN_LICENSE],
    ['Κ8 excepted (sharp/libvips)', pkg('@img/sharp-libvips-linux-x64', '1.3.2', 'LGPL-3.0-or-later'), S.PACKAGE_STATE.EXCEPTED],
    ['Κ9 exception-license-drift', pkg('@sentry/cli', '2.58.5', 'FSL-1.1-ALv2'), S.PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT],
    ['Κ9β drift σε LGPL → GPL', pkg('@img/sharp-libvips-linux-x64', '1.3.2', 'GPL-3.0-or-later'), S.PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT],
    ['Κ10 curation-license-drift', pkg('buffers', '0.1.1', 'ISC'), S.PACKAGE_STATE.CURATION_LICENSE_DRIFT],
    ['Κ11 curated', pkg('buffers', '0.1.1', 'Unknown'), S.PACKAGE_STATE.CURATED],
    ['Κ11β η επιμέλεια ΔΕΝ περνά σε άλλη έκδοση', pkg('buffers', '0.1.2', 'Unknown'), S.PACKAGE_STATE.UNKNOWN_LICENSE],
    ['Κ12 καθολική αντιστοίχιση MIT/X11', pkg('chainsaw', '0.1.0', 'MIT/X11'), S.PACKAGE_STATE.ALLOWED],
    ['Κ13 dev εξαίρεση ΔΕΝ καλύπτει prod', pkg('axe-core', '4.10.0', 'MPL-2.0'), S.PACKAGE_STATE.RECIPROCAL_UNEXCEPTED],
  ];
  it.each(cases)('%s', (_label, p, expected) => {
    expect(stateOf(verdictOf([p]), p.id)).toBe(expected);
  });

  it('Κ14: εξαίρεση που έληξε ⇒ exception-expired', () => {
    const policy = policyWith((raw) => { raw.exceptions.find((e) => e.id === 'resvg-mpl').expiresOn = '2026-01-01'; });
    const p = pkg('@resvg/resvg-js', '2.6.2', 'MPL-2.0');
    expect(stateOf(verdictOf([p], { policy }), p.id)).toBe(S.PACKAGE_STATE.EXCEPTION_EXPIRED);
  });

  it('Κ15: FSL — υπενθύμιση πριν τη μετατροπή, αυτο-λύση μετά', () => {
    const p = pkg('@sentry/cli', '2.58.5', 'FSL-1.1-MIT');
    const today = verdictOf([p]);
    expect(stateOf(today, p.id)).toBe(S.PACKAGE_STATE.EXCEPTED);
    expect(decisionOf(today, 'sentry-cli-fsl')).toBe(S.DECISION_STATE.IN_USE);

    const soon = verdictOf([p], { now: Date.parse('2028-01-01T00:00:00Z') });
    expect(stateOf(soon, p.id)).toBe(S.PACKAGE_STATE.EXCEPTED);
    expect(decisionOf(soon, 'sentry-cli-fsl')).toBe(S.DECISION_STATE.CONVERSION_DUE);

    const after = verdictOf([p], { now: Date.parse('2028-02-23T00:00:00Z') });
    expect(stateOf(after, p.id)).toBe(S.PACKAGE_STATE.CONVERTED);
    expect(decisionOf(after, 'sentry-cli-fsl')).toBe(S.DECISION_STATE.CONVERTED);
    expect(after.blocking).toEqual([]);
  });

  it('Κ16: τοπικό patch σε reciprocal ⇒ modified-copyleft · σε MIT ⇒ τίποτα', () => {
    const mpl = pkg('@resvg/resvg-js', '2.6.2', 'MPL-2.0');
    const mit = pkg('left-pad', '1.3.0', 'MIT');
    const v = verdictOf([mpl, mit], { patched: [mpl.id, mit.id] });
    expect(stateOf(v, mpl.id)).toBe(S.PACKAGE_STATE.MODIFIED_COPYLEFT);
    expect(stateOf(v, mit.id)).toBe(S.PACKAGE_STATE.ALLOWED);
  });

  it('Κ17: εξαίρεση σε forbidden ⇒ ΑΠΟΡΡΙΠΤΕΤΑΙ (καμία ρύθμιση δεν ανοίγει την κατηγορία)', () => {
    const policy = policyWith((raw) => {
      raw.exceptions.push({ ...clone(raw.exceptions[0]), id: 'agpl-attempt', packages: ['evil'], license: 'AGPL-3.0-only', category: 'forbidden' });
    });
    const p = pkg('evil', '1.0.0', 'AGPL-3.0-only');
    const v = verdictOf([p], { policy });
    expect(stateOf(v, p.id)).toBe(S.PACKAGE_STATE.FORBIDDEN_EXCEPTION_REFUSED);
    expect(v.blocking.map((r) => r.id)).toEqual([p.id]);
  });

  it('Κ18: λογιστική αποφάσεων — κλαδεμένη · όχι εδώ · περιττή · dev', () => {
    const sharpLinux = '@img/sharp-libvips-linux-x64@1.3.2';
    const sentry = pkg('@sentry/cli', '2.58.5', 'BSD-3-Clause'); // έγινε επιτρεπτή ⇒ η εξαίρεση περισσεύει
    const v = verdictOf([sentry], { lockfileKeys: [sentry.id, sharpLinux] });
    expect(decisionOf(v, 'web-ifc-mpl')).toBe(S.DECISION_STATE.PRUNED);
    expect(decisionOf(v, 'sharp-libvips')).toBe(S.DECISION_STATE.NOT_INSTALLED_HERE);
    expect(decisionOf(v, 'sentry-cli-fsl')).toBe(S.DECISION_STATE.UNNEEDED);
    expect(decisionOf(v, 'axe-core-dev')).toBe(S.DECISION_STATE.DEV_SCOPE_NOT_EVALUATED);
    expect(decisionOf(v, 'buffers@0.1.1')).toBe(S.DECISION_STATE.PRUNED);
  });

  it('Κ19: κλειστή λογιστική — κάθε γραμμή μία κατάσταση, άγνωστη ⇒ throw ΜΕ ΟΝΟΜΑ', () => {
    const v = verdictOf([pkg('a', '1.0.0', 'MIT'), pkg('b', '1.0.0', 'GPL-3.0-only')]);
    expect(Object.values(v.packageTally).reduce((x, y) => x + y, 0)).toBe(v.rows.length);
    expect(Object.values(v.decisionTally).reduce((x, y) => x + y, 0)).toBe(v.decisions.length);
    expect(() => J.tally([{ state: 'φάντασμα', id: 'x' }], S.PACKAGE_STATE, 'πακέτου')).toThrow(/άγνωστη κατάσταση πακέτου «φάντασμα»/);
  });

  it('Κ20: αντιστοίχιση μοτίβων — ακριβής έκδοση > όνομα > glob, και το glob δεν περνά «/»', () => {
    expect(P.packageMatchScore('@sentry/cli@2.58.5', '@sentry/cli', '2.58.5')).toBe(3);
    expect(P.packageMatchScore('web-ifc', 'web-ifc', '9.9.9')).toBe(2);
    expect(P.packageMatchScore('@img/sharp-libvips-*', '@img/sharp-libvips-linux-x64', '1.3.2')).toBe(1);
    expect(P.packageMatchScore('@sentry/cli-*@2.58.5', '@sentry/cli-linux-x64', '2.58.6')).toBe(0);
    expect(P.globToRegExp('public/fonts/Liberation*.ttf').test('public/fonts/evil/Liberation.ttf')).toBe(false);
  });

  it('Κ21: γραμματοσειρά (CHECK 3.69) — η ΙΔΙΑ απόφαση: OFL μόνο με assetException', () => {
    const policy = policyWith();
    expect(P.isPermitted(P.decideAsset(policy, 'public/fonts/LiberationSans-Regular.ttf', 'OFL-1.1', NOW))).toBe(true);
    expect(P.decideAsset(policy, 'public/fonts/Other.ttf', 'OFL-1.1', NOW).state).toBe(S.PACKAGE_STATE.BY_EXCEPTION_ONLY_UNEXCEPTED);
    expect(P.decideAsset(policy, 'public/fonts/LiberationSans-Regular.ttf', 'GPL-3.0-or-later', NOW).state)
      .toBe(S.PACKAGE_STATE.EXCEPTION_LICENSE_DRIFT);
  });
});

// ─── Π — ΕΠΙΚΥΡΩΣΗ ΠΟΛΙΤΙΚΗΣ ────────────────────────────────────────────────

describe('Π — η πολιτική', () => {
  const invalid = (mutate) => {
    const raw = clone(REAL_RAW);
    mutate(raw);
    return P.compilePolicy(raw);
  };

  it('Π1: η πραγματική πολιτική μεταγλωττίζεται', () => {
    expect(P.compilePolicy(clone(REAL_RAW)).ok).toBe(true);
  });

  it('Π2: forbidden/unknown ΔΕΝ ανοίγουν με ρύθμιση', () => {
    expect(invalid((r) => { r.categories.forbidden.decision = 'exception'; }).error)
      .toMatch(/categories\.forbidden\.decision: «exception» — επιτρέπεται μόνο block/);
    expect(invalid((r) => { r.categories.unknown.decision = 'allow'; }).ok).toBe(false);
    // …και κάθε συνδυασμός χωρίς όνομα κατάστασης απορρίπτεται (αλλιώς η λογιστική δεν κλείνει).
    expect(invalid((r) => { r.categories.notice.decision = 'block'; }).ok).toBe(false);
  });

  it('Π3: sourceAvailable χωρίς έκδοση ή χωρίς ημερομηνία μετατροπής ⇒ άκυρη', () => {
    const noVersion = invalid((r) => { r.exceptions.find((e) => e.id === 'sentry-cli-fsl').packages = ['@sentry/cli']; });
    expect(noVersion.error).toMatch(/κάθε μοτίβο με έκδοση/);
    const noDate = invalid((r) => {
      const e = r.exceptions.find((x) => x.id === 'sentry-cli-fsl');
      delete e.convertsOn; delete e.convertsTo;
    });
    expect(noDate.error).toMatch(/απαιτούνται convertsOn \+ convertsTo/);
  });

  it('Π4: αναγνωριστικό σε δύο κατηγορίες · επιμέλεια χωρίς έκδοση/τεκμήριο ⇒ άκυρη', () => {
    expect(invalid((r) => { r.licenseCategories.notice.push('GPL-3.0'); }).error).toMatch(/«GPL-3\.0» είναι σε/);
    expect(invalid((r) => { r.curations.buffers = r.curations['buffers@0.1.1']; }).error).toMatch(/ακριβές name@version/);
    expect(invalid((r) => { r.curations['buffers@0.1.1'].evidence = []; }).error).toMatch(/απαιτείται τεκμήριο/);
  });

  it('Π5: αρχείο που λείπει ή δεν είναι JSON ⇒ σφάλμα ΜΕ ΟΝΟΜΑ, ποτέ πετάει', () => {
    expect(P.loadPolicy(path.join(tmpRoot, 'nope.json')).error).toMatch(/λείπει το αρχείο πολιτικής/);
    const bad = path.join(tmpRoot, 'bad.json');
    fs.writeFileSync(bad, '{ nope');
    expect(P.loadPolicy(bad).error).toMatch(/μη έγκυρο JSON/);
  });
});

// ─── Ε — ΕΚΤΕΛΕΣΗ ΤΟΥ ΕΡΓΑΛΕΙΟΥ ─────────────────────────────────────────────

const FAKE_TOOL_SOURCE = [
  "const fs = require('node:fs');",
  'const [mode, payloadFile] = process.argv.slice(2);',
  "if (mode === 'ok') { process.stdout.write(fs.readFileSync(payloadFile, 'utf8')); process.exit(0); }",
  "if (mode === 'fail') { process.stderr.write('ERR_BOOM: the store is broken'); process.exit(1); }",
  "if (mode === 'garbage') { process.stdout.write('<<not json>>'); process.exit(0); }",
  'process.exit(0);',
].join('\n');

function fakeTool(mode, report = {}) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'tool-'));
  const tool = path.join(dir, 'fake-pnpm.js');
  const payload = path.join(dir, 'payload.json');
  fs.writeFileSync(tool, FAKE_TOOL_SOURCE);
  fs.writeFileSync(payload, JSON.stringify(report));
  return { file: process.execPath, args: [tool, mode, payload], shell: false };
}
const reportOf = (entries) => entries.reduce((acc, [name, version, license]) => {
  (acc[license] = acc[license] || []).push({ name, versions: [version], paths: [`/x/${name}`], license });
  return acc;
}, {});

describe('Ε — «έτρεξε όντως το εργαλείο;»', () => {
  it('Ε1: βγαίνει 1 με stderr ⇒ exited-nonzero, και το stderr ΔΕΝ χάνεται', () => {
    const r = I.runLicenseInventory({ command: fakeTool('fail') });
    expect(r.outcome).toBe(SPAWN_OUTCOME.EXITED_NONZERO);
    expect(r.stderr).toMatch(/ERR_BOOM/);
  });

  it('Ε2: κενή έξοδος · μη-JSON · {} ⇒ ποτέ «καθαρό»', () => {
    expect(I.runLicenseInventory({ command: fakeTool('empty') }).outcome).toBe(SPAWN_OUTCOME.NO_OUTPUT);
    expect(I.runLicenseInventory({ command: fakeTool('garbage') }).outcome).toBe(SPAWN_OUTCOME.UNPARSEABLE);
    expect(I.runLicenseInventory({ command: fakeTool('ok', {}) }).outcome).toBe(SPAWN_OUTCOME.NO_OUTPUT);
  });

  it('Ε3: το εκτελέσιμο δεν υπάρχει ⇒ spawn-failed', () => {
    const r = I.runLicenseInventory({ command: { file: path.join(tmpRoot, 'no-such-binary-xyz'), args: [], shell: false } });
    expect(r.outcome).toBe(SPAWN_OUTCOME.SPAWN_FAILED);
  });

  it('Ε4: κανονική έξοδος ⇒ ran, μία γραμμή ανά name@version', () => {
    const report = { MIT: [{ name: 'a', versions: ['1.0.0', '2.0.0'], paths: ['/a1', '/a2'], license: 'MIT' }] };
    const r = I.runLicenseInventory({ command: fakeTool('ok', report) });
    expect(r.outcome).toBe(SPAWN_OUTCOME.RAN);
    expect(r.packages.map((p) => [p.id, p.path])).toEqual([['a@1.0.0', '/a1'], ['a@2.0.0', '/a2']]);
    expect(I.normalizeLicenseReport({ MIT: [{ name: 'a' }] }).ok).toBe(false);
  });

  /**
   * 🔴 ΠΑΛΙΝΔΡΟΜΗΣΗ §1 (handoff 2026-09-16): στο Git Bash το `TMP` είναι εξαγόμενη μεταβλητή
   * Windows· ένα script που την έκανε **αρχείο** ⇒ το git.exe έδωσε `TMPDIR=<αρχείο>` ⇒ `mktemp`
   * απέτυχε ⇒ ο παλιός CHECK 12 ανέφερε ψευδώς «license-checker produced no output».
   * Κανένα προσωρινό αρχείο ⇒ ανοσία. Μια μετάλλαξη που ξαναβάζει προσωρινό αρχείο ΚΟΚΚΙΝΙΖΕΙ εδώ.
   */
  /**
   * ⚠️ ΥΠΟΔΙΕΡΓΑΣΙΑ, ΟΧΙ in-process — ΜΕΤΡΗΜΕΝΟ: η πρώτη γραφή άλλαζε το `process.env` μέσα
   * στο jest και έμενε ΠΡΑΣΙΝΗ υπό τη μετάλλαξη «ξαναβάλε `mkdtempSync(os.tmpdir())`» (M1,
   * 2026-09-16). Το `process.env` του sandbox του jest δεν είναι το env που διαβάζει το `os`
   * ⇒ η άγκυρα δεν ασκούσε ποτέ τη ρίζα. Ένα πραγματικό παιδί με πραγματικό env την ασκεί.
   */
  it('Ε5: TMP/TMPDIR/TEMP = ΑΡΧΕΙΟ ⇒ το CLI μετρά κανονικά (υποδιεργασία, πραγματικό env)', () => {
    const notADir = path.join(tmpRoot, 'tmp-is-a-file');
    fs.writeFileSync(notADir, 'x');
    const r = runCli({
      command: fakeTool('ok', reportOf([['left-pad', '1.3.0', 'MIT']])),
      env: { TMP: notADir, TMPDIR: notADir, TEMP: notADir },
    });
    expect(r.out).not.toMatch(/UNKNOWN|εσωτερικό σφάλμα/);
    expect(r.code).toBe(0);
  });
});

// ─── Λ — ΑΠΟΚΛΙΣΗ LOCKFILE ─────────────────────────────────────────────────

const LOCK_TEXT = [
  "lockfileVersion: '9.0'", '', 'packages:', '',
  "  '@scope/pkg@1.0.0':", '    resolution: {integrity: sha512-a}', '',
  '  left-pad@1.3.0:', '    resolution: {integrity: sha512-b}', '',
  'snapshots:', '', '  left-pad@1.3.0: {}', '',
].join('\n');

function fixtureRepo({ lock = LOCK_TEXT, installed = LOCK_TEXT, patched = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'fx', pnpm: { patchedDependencies: patched } }));
  fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), lock);
  if (installed !== null) {
    fs.mkdirSync(path.join(dir, 'node_modules', '.pnpm'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', '.pnpm', 'lock.yaml'), installed);
  }
  return dir;
}
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });

describe('Λ — «μέτρησα τον κόσμο που θα γίνει commit;»', () => {
  it('Λ1: ίδιο ⇒ in-sync (και οι αλλαγές γραμμής CRLF/LF δεν μετρούν)', () => {
    expect(I.checkLockfileDrift({ repoRoot: fixtureRepo({ installed: LOCK_TEXT.replace(/\n/g, '\r\n') }) }).state).toBe('in-sync');
  });

  it('Λ2: διαφορετικό ⇒ drift · λείπει εγκατάσταση ⇒ unmeasurable', () => {
    expect(I.checkLockfileDrift({ repoRoot: fixtureRepo({ installed: `${LOCK_TEXT}# άλλο\n` }) }).state).toBe('drift');
    expect(I.checkLockfileDrift({ repoRoot: fixtureRepo({ installed: null }) }).state).toBe('unmeasurable');
  });

  it('Λ3: staged — κρίνεται το blob του ΕΥΡΕΤΗΡΙΟΥ, όχι ο δίσκος', () => {
    const dir = fixtureRepo();
    expect(git(dir, 'init', '-q').status).toBe(0);
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), `${LOCK_TEXT}# staged-άλλο\n`);
    expect(git(dir, 'add', 'pnpm-lock.yaml').status).toBe(0);
    fs.writeFileSync(path.join(dir, 'pnpm-lock.yaml'), LOCK_TEXT); // ο δίσκος συμφωνεί με το εγκατεστημένο
    expect(I.checkLockfileDrift({ repoRoot: dir, source: 'worktree' }).state).toBe('in-sync');
    expect(I.checkLockfileDrift({ repoRoot: dir, source: 'staged' }).state).toBe('drift');
  });

  it('Λ4: κλειδιά packages: — με και χωρίς εισαγωγικά, ΟΧΙ από snapshots:', () => {
    expect(I.lockfilePackageKeys(LOCK_TEXT)).toEqual(['@scope/pkg@1.0.0', 'left-pad@1.3.0']);
  });
});

// ─── Χ — ΤΟ CLI ΩΣ ΥΠΟΔΙΕΡΓΑΣΙΑ ─────────────────────────────────────────────

function runCli({ repoRoot = fixtureRepo(), command, policyFile = POLICY_PATH, args = [], env = {} }) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      LICENSE_POLICY_REPO_ROOT: repoRoot,
      LICENSE_POLICY_FILE: policyFile,
      LICENSE_POLICY_INVENTORY_COMMAND: JSON.stringify(command),
      LICENSE_POLICY_NOW: '2026-09-16',
      ...env,
    },
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

describe('Χ — έξοδοι 0 / 1 / 2, με ΔΙΑΦΟΡΕΤΙΚΟ μήνυμα', () => {
  it('Χ0: καθαρό ⇒ 0', () => {
    const r = runCli({ command: fakeTool('ok', reportOf([['left-pad', '1.3.0', 'MIT']])) });
    expect(r.code).toBe(0);
  });

  it('Χ1: GPL ⇒ 1 «ΠΑΡΑΒΑΣΗ ΠΟΛΙΤΙΚΗΣ», όχι UNKNOWN', () => {
    const r = runCli({ command: fakeTool('ok', reportOf([['left-pad', '1.3.0', 'MIT'], ['gpl-thing', '1.0.0', 'GPL-3.0-only']])) });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/ΠΑΡΑΒΑΣΗ ΠΟΛΙΤΙΚΗΣ/);
    expect(r.out).toMatch(/gpl-thing@1\.0\.0/);
    expect(r.out).not.toMatch(/UNKNOWN/);
  });

  it('Χ2: χαλασμένο εργαλείο ⇒ 2 «UNKNOWN», με το stderr του εργαλείου στο μήνυμα', () => {
    const r = runCli({ command: fakeTool('fail') });
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/UNKNOWN/);
    expect(r.out).toMatch(/exited-nonzero/);
    expect(r.out).toMatch(/ERR_BOOM: the store is broken/);
    expect(r.out).not.toMatch(/ΠΑΡΑΒΑΣΗ ΠΟΛΙΤΙΚΗΣ/);
  });

  it('Χ3: απόκλιση lockfile ⇒ 2, και το εργαλείο ΔΕΝ κρίνει άλλο δέντρο', () => {
    const r = runCli({ repoRoot: fixtureRepo({ installed: `${LOCK_TEXT}# άλλο\n` }),
      command: fakeTool('ok', reportOf([['gpl-thing', '1.0.0', 'GPL-3.0-only']])) });
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/lockfile-drift/);
    expect(r.out).not.toMatch(/gpl-thing/);
  });

  it('Χ4: άκυρη πολιτική ⇒ 2 «policy-invalid»', () => {
    const bad = path.join(tmpRoot, 'bad-policy.json');
    fs.writeFileSync(bad, '{}');
    const r = runCli({ policyFile: bad, command: fakeTool('ok', reportOf([['left-pad', '1.3.0', 'MIT']])) });
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/policy-invalid/);
  });

  it('Χ5: patched reciprocal μέσω package.json ⇒ 1', () => {
    const repoRoot = fixtureRepo({ patched: { '@resvg/resvg-js@2.6.2': 'patches/x.patch' } });
    const r = runCli({ repoRoot, command: fakeTool('ok', reportOf([['@resvg/resvg-js', '2.6.2', 'MPL-2.0']])) });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/modified-copyleft/);
  });
});

// ─── Δ — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΔΕΝΤΡΟ ───────────────────────────────

describe('Δ — το πραγματικό δέντρο', () => {
  let real;
  beforeAll(() => { real = I.runLicenseInventory(); }, 120000);

  it('Δ1: η πραγματική απογραφή βλέπει ΟΛΟ τον γράφο (το license-checker έβλεπε 126)', () => {
    expect(real.outcome).toBe(SPAWN_OUTCOME.RAN);
    expect(real.packages.length).toBeGreaterThan(900);
  });

  it('Δ2: με την πραγματική πολιτική ⇒ 0 παραβάσεις · χωρίς τις εξαιρέσεις sharp ⇒ restricted', () => {
    const lockfileKeys = I.lockfilePackageKeys(fs.readFileSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'), 'utf8'));
    const input = { packages: real.packages, lockfileKeys, patched: I.patchedDependencies(REPO_ROOT), now: NOW };
    expect(J.judge(policyWith(), input).blocking).toEqual([]);

    const noSharp = policyWith((raw) => { raw.exceptions = raw.exceptions.filter((e) => !e.id.startsWith('sharp-')); });
    const flagged = J.judge(noSharp, input).blocking;
    expect(flagged.some((r) => r.state === S.PACKAGE_STATE.RESTRICTED && r.name.startsWith('@img/sharp-'))).toBe(true);
  });

  /** Ολόκληρη η ροή — πραγματικό pnpm, πραγματικό lockfile — με TMP = αρχείο (§1). Καμία έγχυση. */
  it('Δ3: το CLI στο πραγματικό δέντρο, με TMP/TMPDIR/TEMP = ΑΡΧΕΙΟ ⇒ 0', () => {
    const notADir = path.join(tmpRoot, 'tmp-file-real');
    fs.writeFileSync(notADir, 'x');
    const env = { ...process.env, TMP: notADir, TMPDIR: notADir, TEMP: notADir };
    for (const k of ['LICENSE_POLICY_REPO_ROOT', 'LICENSE_POLICY_FILE', 'LICENSE_POLICY_INVENTORY_COMMAND', 'LICENSE_POLICY_NOW']) delete env[k];
    const r = spawnSync(process.execPath, [CLI], { encoding: 'utf8', env });
    expect(`${r.stdout}${r.stderr}`).not.toMatch(/δοκιμαστική έγχυση/);
    expect(r.status).toBe(0);
  }, 120000);

  it('Δ4: οι εγχύσεις ΑΓΝΟΟΥΝΤΑΙ εκτός jest (αλλιώς θα ήταν σιωπηλή παράκαμψη της πύλης)', () => {
    const cli = require('../check-license-policy.js');
    expect(cli.testInjections({ LICENSE_POLICY_INVENTORY_COMMAND: '{"file":"x","args":[]}' })).toEqual({});
    expect(Object.keys(cli.testInjections({ JEST_WORKER_ID: '1', LICENSE_POLICY_NOW: '2026-01-01' }))).toEqual(['now']);
  });
});
