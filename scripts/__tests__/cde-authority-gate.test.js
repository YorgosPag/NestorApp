/**
 * @fileoverview Άγκυρες του CHECK 3.87 — η πύλη της αρχής της κατάστασης CDE (ADR-862 Φ0 Β12).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — μια πύλη που δεν μπορεί να
 * κοκκινίσει είναι σχόλιο (ADR-587 §6.1). Και οι παρονομαστές μετρώνται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο:
 * «0 δεύτεροι γραφείς» σημαίνει κάτι μόνο αν ο σαρωτής είδε τον ΠΡΩΤΟ.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const gate = require('../check-cde-authority');

const ROOT = path.resolve(__dirname, '..', '..');
const FIELDS = gate.custodyFieldsOf(fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'));

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.custodyFindingsIn(gate.sourceFileOf(rel, code), rel, FIELDS).map((f) => f.state);
}

describe('Κ1 — δεύτερος γραφέας', () => {
  it('τα πεδία φύλαξης διαβάζονται από το firestore.rules (ΜΙΑ πηγή) — και φέρουν τον φράχτη', () => {
    expect(FIELDS).toEqual(expect.arrayContaining(['cdeState', 'cdeSeal', 'supersededByFileId', 'cdeReadReach']));
  });

  it('⛔ άμεση γραφή κατάστασης εκτός γραφέα', () => {
    expect(findingsOf("await db.collection(COLLECTIONS.FILES).doc(id).update({ cdeState: 'PUBLISHED' });"))
      .toEqual([gate.STATES.SECOND_WRITER]);
  });

  it('⛔ γραφή ΜΕΣΩ μεταβλητής — η παράκαμψη που θα έκρυβε σαρωτής ορισμάτων', () => {
    expect(findingsOf('const patch = { cdeSeal: act }; await ref.set(patch, { merge: true });'))
      .toEqual([gate.STATES.SECOND_WRITER]);
  });

  it('✅ αίτημα ΠΡΟΣ τον γραφέα και ωφέλιμο φορτίο γεγονότος ΔΕΝ είναι γραφή', () => {
    expect(findingsOf("await transitionContainer({ act: 'supersede', supersededByFileId: id });")).toEqual([]);
    expect(findingsOf("RealtimeService.dispatch('FILE_SUPERSEDED', { fileId, supersededByFileId });")).toEqual([]);
  });

  it('✅ ο ΕΝΑΣ γραφέας και οι γραφείς γέννησης (μόνο για τον φράχτη)', () => {
    expect(findingsOf("tx.update(ref, { cdeState: s });", gate.STATE_WRITER)).toEqual([gate.STATES.WRITER]);
    const birth = gate.BIRTH_WRITERS.cdeReadReach[2];
    expect(findingsOf("ref.set({ cdeReadReach: BIRTH_READ_REACH });", birth)).toEqual([gate.STATES.BIRTH]);
    expect(findingsOf("ref.set({ cdeState: 'WIP' });", birth)).toEqual([gate.STATES.SECOND_WRITER]);
  });

  it('🔎 σχετικό αρχείο ΚΑΙ όταν αναφέρει μόνο το προσωπικό διαμέρισμα (ADR-866 §2.6.7)', () => {
    for (const text of [
      'db.collection(COLLECTIONS.FILES_PERSONAL).doc(id)',
      "firestoreQueryService.getAll('FILES_PERSONAL', {})",
      'db.collection(COLLECTIONS[FILE_COLLECTION[kind]])',
      'db.collection(COLLECTIONS.FILES)',
    ]) {
      expect(gate.FILES_REFERENCE.test(text)).toBe(true);
    }
    expect(gate.FILES_REFERENCE.test('db.collection(COLLECTIONS.FILE_AUDIT_LOG)')).toBe(false);
  });

  it('🔓 εξαίρεση ΜΟΝΟ με λόγο', () => {
    expect(findingsOf("ref.update({\n  // cde-authority-exempt: μετανάστευση Χ\n  cdeState: s,\n});")).toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf("ref.update({\n  // cde-authority-exempt:\n  cdeState: s,\n});")).toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ3 — δεύτερη σημαία έγκρισης', () => {
  it('⛔ σημαία «για κατασκευή» δίπλα στην κατάσταση', () => {
    expect(findingsOf('interface X { isForConstruction?: boolean }', 'src/types/file-record.ts'))
      .toEqual([gate.STATES.SECOND_FLAG]);
  });
});

describe('Κ5 — client λίστα files χωρίς φράχτη', () => {
  const list = "import { db } from '@/lib/firebase';\nconst s = await getDocs(query(collection(db, COLLECTIONS.FILES), where('x','==',1)));";

  it('⛔ χωρίς τον παραγωγό ορατότητας', () => {
    expect(gate.unscopedListIn(list, 'src/x.ts')).toMatchObject({ state: gate.STATES.UNSCOPED_LIST });
  });

  it('✅ με τον παραγωγό · ✅ ο διακομιστής (Admin SDK) εκτός εμβέλειας', () => {
    const scoped = `import { fileListReadPaths } from '@/lib/files/file-visibility-scope';\n${list}`;
    expect(gate.unscopedListIn(scoped, 'src/x.ts')).toMatchObject({ state: gate.STATES.SCOPED_LISTS });
    expect(gate.unscopedListIn(`import 'server-only';\n${list}`, 'src/x.ts')).toBeNull();
  });

  it('⛔ και μέσω διαμερίσματος κατόχου: ο εταιρικός κλάδος θέλει φράχτη (ADR-866 §2.6.7)', () => {
    const partitioned = "const s = await getDocs(query(collection(db, COLLECTIONS[FILE_COLLECTION[kind]]), where('x','==',1)));";
    expect(gate.unscopedListIn(partitioned, 'src/x.ts')).toMatchObject({ state: gate.STATES.UNSCOPED_LIST });
  });
});

describe('Κ4 — κάθε κατάσταση έχει γραμμή', () => {
  it('στο πραγματικό δέντρο: μηδέν κενά', () => {
    expect(gate.tableGaps(ROOT)).toEqual([]);
  });

  it('⛔ κατάσταση χωρίς γραμμή στον φράχτη ανάγνωσης', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cde-gate-'));
    for (const rel of ['src/config/iso19650-constants.ts', 'src/lib/auth/container-access.ts', 'src/lib/auth/container-read-reach.ts']) {
      fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel));
    }
    const reach = path.join(tmp, 'src/lib/auth/container-read-reach.ts');
    fs.writeFileSync(reach, fs.readFileSync(reach, 'utf8').replace("  WIP: 'author',\n", ''));
    try {
      expect(gate.tableGaps(tmp).map((f) => f.state)).toEqual([gate.STATES.TABLE_GAP]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('Παρονομαστές — στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const result = gate.measure();

  it('πράσινο ΚΑΙ ο σαρωτής είδε τον γραφέα, τη γέννηση, τους καταναλωτές και τις λίστες', () => {
    const blocking = result.findings.filter((f) => gate.BLOCKING.includes(f.state));
    expect(blocking).toEqual([]);
    expect(result.tally[gate.STATES.WRITER]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.BIRTH]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.JUDGE_CONSUMERS]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.SCOPED_LISTS]).toBeGreaterThan(0);
  });
});
