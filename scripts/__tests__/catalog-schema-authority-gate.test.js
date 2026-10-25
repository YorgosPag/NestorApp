/**
 * @fileoverview Άγκυρες του CHECK 3.106 — ο ένας γραφέας του σχήματος καταλόγου (ADR-923 §5.9).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να κοκκινίσει είναι σχόλιο
 * (ADR-587 §6.1). Ο παρονομαστής μετριέται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο: «0 εγγραφές έξω από τη μηχανή» σημαίνει κάτι
 * μόνο αν ο σαρωτής είδε τη μηχανή.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const gate = require('../check-catalog-schema-authority');
const { sourceFileOf } = require('../lib/write-authority/ast');

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.findingsIn(sourceFileOf(rel, code), rel).map((f) => f.state);
}

describe('Κ1 — σχήμα καταλόγου γράφεται ΜΟΝΟ από τη μηχανή', () => {
  it('⛔ κάθε μορφή εγγραφής σε κάθε συλλογή καταλόγου', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.CATALOG_FAMILIES).doc(id).set(family);'))
      .toEqual([gate.STATES.WRITE_OUTSIDE]);
    expect(findingsOf('batch.update(db.collection(COLLECTIONS.CATALOG_ATTRIBUTES).doc(id), { type: "text" });'))
      .toEqual([gate.STATES.WRITE_OUTSIDE]);
    expect(findingsOf('const ref = db.collection(COLLECTIONS.CATALOG_CATEGORIES).doc(id);\ntx.set(ref, { ancestorIds: [] });'))
      .toEqual([gate.STATES.WRITE_OUTSIDE]);
    expect(findingsOf('await deleteDoc(doc(db, COLLECTIONS.CATALOG_ATTRIBUTE_GROUPS, id));')).toEqual([gate.STATES.WRITE_OUTSIDE]);
    expect(findingsOf('await db.collection(COLLECTIONS.CATALOG_MEASUREMENT_FAMILIES).doc(id).delete();'))
      .toEqual([gate.STATES.WRITE_OUTSIDE]);
  });

  it('✅ ΑΝΑΓΝΩΣΗ συλλογής καταλόγου δεν είναι εγγραφή', () => {
    expect(findingsOf("const snap = await db.collection(COLLECTIONS.CATALOG_FAMILIES).where('companyId', '==', c).get();")).toEqual([]);
  });

  it('✅ εγγραφή σε ΑΛΛΗ συλλογή δεν αφορά τον κατάλογο', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.MATERIALS).doc(id).set(material);')).toEqual([]);
  });

  it('✅ η μηχανή είναι ο δηλωμένος γραφέας', () => {
    expect(findingsOf('scope.tx.set(catalogDocRef(scope.db, kind, id), record);', gate.STORE)).toEqual([gate.STATES.STORE]);
  });

  it('✅ ένα ΣΧΟΛΙΟ που ονομάζει την εγγραφή δεν είναι κώδικας (AST, όχι κείμενο)', () => {
    expect(findingsOf('// db.collection(COLLECTIONS.CATALOG_FAMILIES).doc(id).set(x) — μόνο η μηχανή\nconst x = 1;')).toEqual([]);
  });
});

describe('Κ2 — η αναφορά εγγράφου της μηχανής δεν βγαίνει έξω', () => {
  it('⛔ `catalogDocRef(` σε αδήλωτο αρχείο — ✅ στις αναγνώσεις της βιβλιοθήκης', () => {
    expect(findingsOf("tx.set(catalogDocRef(db, 'family', id), data);")).toEqual([gate.STATES.DOC_REF_OUTSIDE]);
    expect(findingsOf("await tx.getAll(catalogDocRef(db, 'attribute', id));", 'src/server/catalog/catalog-library-reads.server.ts'))
      .toEqual([]);
  });
});

describe('Κ3 — εξαίρεση ΜΟΝΟ με λόγο', () => {
  const write = 'batch.set(db.collection(COLLECTIONS.CATALOG_FAMILIES).doc(id), family);';

  it('🔓 με λόγο ⇒ δεκτή· χωρίς λόγο ⇒ εύρημα', () => {
    expect(findingsOf(`// catalog-schema-authority-exempt: μετανάστευση μίας χρήσης, ADR-923 §5.9\n${write}`))
      .toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf(`// catalog-schema-authority-exempt:\n${write}`)).toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ5 — η πόρτα απευθείας εγγραφής μένει κλειστή', () => {
  it("⛔ `catalog_*` στο σύνολο εγγραφής του MCP — ✅ όταν λείπει, ✅ όταν το ονομάζει μόνο σχόλιο", () => {
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set(['tasks', 'catalog_families']);")).toBe(true);
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set(['tasks']);")).toBe(false);
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set([\n  // `catalog_families` is NOT writable\n  'tasks',\n]);"))
      .toBe(false);
  });
});

describe('Κ4 + παρονομαστής — στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const result = gate.measure();
  const root = path.resolve(__dirname, '..', '..');

  it('ο σαρωτής ΕΙΔΕ τη μηχανή', () => {
    expect(result.findings.filter((f) => f.state === gate.STATES.STORE).map((f) => f.file)).toEqual([gate.STORE]);
  });

  it('κανένα μπλοκάρον εύρημα σήμερα', () => {
    expect(result.findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
  });

  it('η μηχανή και κάθε γραφέας περνούν όντως από τη συναλλαγή, και η πόρτα του MCP είναι κλειστή', () => {
    expect(gate.wiringFindings(root)).toEqual([]);
  });

  it('⛔ δηλωμένο αρχείο που ΔΕΝ υπάρχει κοκκινίζει (ρίζα χωρίς τα αρχεία)', () => {
    const states = gate.wiringFindings(path.join(root, 'scripts', '__tests__')).map((f) => f.state);
    expect(states.filter((s) => s === gate.STATES.SOURCE_DRIFT)).toHaveLength(Object.keys(gate.WIRING).length + 1);
  });

  it('⛔ γραφέας που ΠΑΡΑΚΑΜΠΤΕΙ τη συναλλαγή κοκκινίζει (μετάλλαξη σε αντίγραφο της ρίζας)', () => {
    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'catalog-gate-'));
    for (const rel of [...Object.keys(gate.WIRING), gate.DIRECT_WRITE_DOOR]) {
      const target = path.join(sandbox, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, rel), target);
    }
    const writer = path.join(sandbox, 'src/server/catalog/family-writer.server.ts');
    fs.writeFileSync(writer, fs.readFileSync(writer, 'utf8').split('runCatalogTransaction(').join('runOutsideTransaction('));
    const states = gate.wiringFindings(sandbox).map((f) => f.state);
    fs.rmSync(sandbox, { recursive: true, force: true });
    expect(states).toEqual([gate.STATES.STORE_UNASKED]);
  });
});
