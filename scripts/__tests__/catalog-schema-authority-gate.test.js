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

describe('Κ1 + Κ2 — τα ΔΕΔΟΜΕΝΑ του καταλόγου (Φάση 2β, ADR-923 §5.10)', () => {
  it('⛔ εγγραφή σε κάθε συλλογή δεδομένων έξω από τη μηχανή', () => {
    for (const key of ['CATALOG_PRODUCT_MODELS', 'CATALOG_PRODUCTS', 'CATALOG_ASSETS', 'CATALOG_SETTINGS', 'CATALOG_UNIQUE_VALUES']) {
      expect(findingsOf(`await db.collection(COLLECTIONS.${key}).doc(id).set(data);`)).toEqual([gate.STATES.WRITE_OUTSIDE]);
    }
  });

  it('⛔ `uniqueValueRef(` έξω από μηχανή/σχεδιαστή κρατήσεων — ✅ στον σχεδιαστή (μόνο ανάγνωση)', () => {
    expect(findingsOf('tx.delete(uniqueValueRef(db, id));')).toEqual([gate.STATES.DOC_REF_OUTSIDE]);
    expect(findingsOf('await tx.getAll(uniqueValueRef(db, id));', 'src/server/catalog/unique-reservations.server.ts')).toEqual([]);
  });
});

describe('Κ6 — ο δρόμος των παραγώγων γράφει ΜΟΝΟ `derived` και τον καλεί ΜΟΝΟ η μηχανή του συνόλου', () => {
  const STORE_WITH = (body) => `export function stageDerived(scope, kind, current, derived) {\n${body}\n}`;

  it('⛔ (β) `stageDerived(` σε γραφέα — ✅ στη μηχανή του συνόλου', () => {
    expect(findingsOf("stageDerived(scope, 'product', current, derived);", 'src/server/catalog/product-writer.server.ts'))
      .toEqual([gate.STATES.DERIVED_OUTSIDE]);
    expect(findingsOf("stageDerived(scope, 'product', current, derived);", gate.AGGREGATE)).toEqual([]);
  });

  it('⛔ (α) σώμα που ανεβάζει αναθεώρηση ή γράφει ίχνος — ✅ σώμα που γράφει μόνο `derived`', () => {
    const states = (body) => gate.derivedPathFindings(STORE_WITH(body)).map((f) => f.state);
    expect(states('scope.tx.update(ref, { derived, revision: current.revision + 1 });')).toEqual([gate.STATES.DERIVED_TRACKED]);
    expect(states('scope.tx.update(ref, { derived });\nscope.changes.push({ kind, before: current, after: current });'))
      .toEqual([gate.STATES.DERIVED_TRACKED]);
    expect(states('scope.tx.update(ref, { derived });\nreturn { ...current, derived };')).toEqual([]);
  });

  it('✅ (α) ένα ΣΧΟΛΙΟ μέσα στο σώμα που ονομάζει την «revision» δεν είναι κώδικας', () => {
    expect(gate.derivedPathFindings(STORE_WITH('// καμία revision εδώ\nscope.tx.update(ref, { derived });'))).toEqual([]);
  });

  it('⛔ (α) μηχανή ΧΩΡΙΣ `stageDerived` κοκκινίζει — ο δρόμος δεν μπορεί να εξαφανιστεί σιωπηλά', () => {
    expect(gate.derivedPathFindings('export function stageReplace() {}').map((f) => f.state)).toEqual([gate.STATES.STORE_UNASKED]);
  });
});

describe('Κ1 + Κ2 + Κ6 — η ΤΙΜΟΛΟΓΗΣΗ (Φάση 3β, ADR-923 §5.11)', () => {
  const PRICING = [
    'CATALOG_PRICE_LISTS', 'CATALOG_PRICE_LIST_VERSIONS', 'CATALOG_PRICE_LIST_LINES', 'CATALOG_DISCOUNT_GROUPS',
    'CATALOG_CUSTOMER_GROUPS', 'CATALOG_CUSTOMER_ASSIGNMENTS', 'CATALOG_DISCOUNT_CONDITIONS', 'CATALOG_PRICING_SLOTS',
  ];

  it('⛔ εγγραφή σε κάθε συλλογή τιμολόγησης έξω από τη μηχανή', () => {
    for (const key of PRICING) {
      expect(findingsOf(`await db.collection(COLLECTIONS.${key}).doc(id).set(data);`)).toEqual([gate.STATES.WRITE_OUTSIDE]);
    }
  });

  it('⛔ `stageCopied(` (σπορά ΧΩΡΙΣ ίχνος) σε γραφέα — ✅ στη μηχανή συνόλου της έκδοσης', () => {
    const copy = "stageCopied(scope, 'priceListLine', target, line);";
    expect(findingsOf(copy, 'src/server/catalog/price-line-writer.server.ts')).toEqual([gate.STATES.DERIVED_OUTSIDE]);
    expect(findingsOf(copy, gate.AGGREGATE)).toEqual([gate.STATES.DERIVED_OUTSIDE]);
    expect(findingsOf(copy, gate.PRICE_AGGREGATE)).toEqual([]);
  });

  it('⛔ `stageDerived(` στον γραφέα γραμμών — ✅ στη μηχανή συνόλου της έκδοσης', () => {
    const touch = "stageDerived(scope, 'priceListVersion', version, derived);";
    expect(findingsOf(touch, 'src/server/catalog/price-line-writer.server.ts')).toEqual([gate.STATES.DERIVED_OUTSIDE]);
    expect(findingsOf(touch, gate.PRICE_AGGREGATE)).toEqual([]);
  });

  it('⛔ `pricingSlotRef(` έξω από μηχανή/σχεδιαστή υποδοχών — ✅ στον σχεδιαστή (μόνο ανάγνωση)', () => {
    expect(findingsOf('tx.delete(pricingSlotRef(db, id));')).toEqual([gate.STATES.DOC_REF_OUTSIDE]);
    expect(findingsOf('await tx.get(pricingSlotRef(db, id));', gate.PRICING_SLOTS)).toEqual([]);
  });

  it('⛔ `pricingViewSignalRef(` έξω από τον ΕΝΑ γραφέα σημάτων (ADR-923 «3δ» Ζ) — ✅ μόνο εκεί', () => {
    expect(findingsOf('tx.set(pricingViewSignalRef(db, cid, view), { revision: 0 });')).toEqual([gate.STATES.DOC_REF_OUTSIDE]);
    expect(findingsOf('tx.set(pricingViewSignalRef(db, cid, view), patch, { merge: true });', gate.PRICING_VIEW_SIGNALS)).toEqual([]);
  });

  it('⛔ ωμή γραφή στη συλλογή σημάτων έξω από τη μηχανή', () => {
    expect(findingsOf('db.collection(COLLECTIONS.CATALOG_PRICING_VIEW_SIGNALS).doc(id).set({ revision: 1 });'))
      .toEqual([gate.STATES.WRITE_OUTSIDE]);
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
