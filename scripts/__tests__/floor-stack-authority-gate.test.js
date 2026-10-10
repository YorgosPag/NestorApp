/**
 * @fileoverview Άγκυρες του CHECK 3.102 — η πύλη της αρχής της στοίβας ορόφων (ADR-910).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να κοκκινίσει είναι σχόλιο
 * (ADR-587 §6.1). Και ο παρονομαστής μετριέται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο: «0 γεννήσεις έξω από το σύνορο» σημαίνει
 * κάτι μόνο αν ο σαρωτής είδε τη γέννηση ΜΕΣΑ σε αυτό.
 */

'use strict';

const path = require('path');

const gate = require('../check-floor-stack-authority');
const { sourceFileOf } = require('../lib/write-authority/ast');

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.findingsIn(sourceFileOf(rel, code), rel).map((f) => f.state);
}

describe('Κ1 — όροφος γεννιέται και σβήνεται ΜΟΝΟ από το σύνορο', () => {
  it("⛔ `createEntity('floor', …)` έξω από τη γέννηση — η διαδρομή του καταργημένου seed-floors", () => {
    expect(findingsOf("await createEntity('floor', { auth, parentId, entitySpecificFields });"))
      .toEqual([gate.STATES.BORN_OUTSIDE]);
  });

  it("✅ `createEntity` για ΑΛΛΗ οντότητα δεν αφορά τη στοίβα", () => {
    expect(findingsOf("await createEntity('parking', { auth, parentId, entitySpecificFields });")).toEqual([]);
  });

  it('⛔ σκέτο `.set()` σε `floors` — και με `batch.set(ref, …)`, και μέσω μεταβλητής, και με client SDK', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.FLOORS).doc(id).set(floor);')).toEqual([gate.STATES.BORN_OUTSIDE]);
    expect(findingsOf('batch.set(db.collection(COLLECTIONS.FLOORS).doc(id), floor);')).toEqual([gate.STATES.BORN_OUTSIDE]);
    expect(findingsOf('const floorRef = db.collection(COLLECTIONS.FLOORS).doc(id);\ntx.create(floorRef, floor);'))
      .toEqual([gate.STATES.BORN_OUTSIDE]);
    expect(findingsOf('await setDoc(doc(db, COLLECTIONS.FLOORS, id), floor);')).toEqual([gate.STATES.BORN_OUTSIDE]);
  });

  it("⛔ `executeDeletion(db, 'floor', …)` και `.delete()` έξω από την αφαίρεση", () => {
    expect(findingsOf("await executeDeletion(db, 'floor', id, uid, companyId);")).toEqual([gate.STATES.REMOVED_OUTSIDE]);
    expect(findingsOf('await db.collection(COLLECTIONS.FLOORS).doc(id).delete();')).toEqual([gate.STATES.REMOVED_OUTSIDE]);
  });

  it('✅ οι δηλωμένοι γραφείς', () => {
    expect(findingsOf("await createEntity('floor', { auth, parentId, entitySpecificFields, commit });", gate.BIRTH))
      .toEqual([gate.STATES.STACK_WRITER]);
    expect(findingsOf("await executeDeletion(db, 'floor', id, uid, companyId, { commit });", gate.REMOVAL))
      .toEqual([gate.STATES.STACK_WRITER]);
  });

  it('✅ ένα ΣΧΟΛΙΟ που ονομάζει την κλήση δεν είναι κώδικας (AST, όχι κείμενο)', () => {
    expect(findingsOf("// createEntity('floor', …) ζει στο floor-birth\nconst x = COLLECTIONS.FLOORS;")).toEqual([]);
  });
});

describe('Κ2 — πεδία ΘΕΣΗΣ γράφονται ΜΟΝΟ από το σύνορο', () => {
  it('⛔ `number` σε όροφο — η βλάβη της επανατοποθέτησης ειδικών σταθμών', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.FLOORS).doc(id).update({ number: 3, elevation: 9 });'))
      .toEqual([gate.STATES.SLOT_WRITE]);
  });

  it('⛔ `kind` · `name` · `buildingId`, και με `tx.update(ref, …)` / `set` με `merge`', () => {
    const ref = 'const floorRef = db.collection(COLLECTIONS.FLOORS).doc(id);\n';
    expect(findingsOf(`${ref}tx.update(floorRef, { kind: 'roof' });`)).toEqual([gate.STATES.SLOT_WRITE]);
    expect(findingsOf(`${ref}await floorRef.update({ name });`)).toEqual([gate.STATES.SLOT_WRITE]);
    expect(findingsOf(`${ref}await floorRef.set({ buildingId }, { merge: true });`)).toEqual([gate.STATES.SLOT_WRITE]);
  });

  it('✅ πεδία που ΔΕΝ ορίζουν θέση (υψόμετρο, ύψος, μετρητής ακινήτων) περνούν ελεύθερα', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.FLOORS).doc(id).update({ elevation: 3, height: 3, updatedBy });')).toEqual([]);
    expect(findingsOf('batch.update(db.collection(COLLECTIONS.FLOORS).doc(id), { units: 4 });')).toEqual([]);
  });

  it('⛔ αδιαφανής εγγραφή σε όροφο (όχι object literal) — η πύλη δεν μπορεί να ξέρει τι γράφει', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.FLOORS).doc(id).update(updates);')).toEqual([gate.STATES.OPAQUE_WRITE]);
  });

  it('✅ η ΜΙΑ σφραγίδα έκδοσης διαβάζεται: `versionedWrite(before, { …πεδία }, uid).data`', () => {
    const ref = 'const ref = db.collection(COLLECTIONS.FLOORS).doc(id);\n';
    expect(findingsOf(`${ref}tx.update(ref, versionedWrite(floor, { [PLATE_FIELD]: after }, uid).data);`)).toEqual([]);
    expect(findingsOf(`${ref}tx.update(ref, versionedWrite(floor, { number: 2 }, uid).data);`)).toEqual([gate.STATES.SLOT_WRITE]);
  });

  it('⛔ `withVersionCheck` σε ορόφους ΧΩΡΙΣ συνοδό — ✅ με συνοδό, ✅ σε άλλη συλλογή', () => {
    expect(findingsOf('await withVersionCheck({ db, collection: COLLECTIONS.FLOORS, docId, updates, userId });'))
      .toEqual([gate.STATES.NO_COMPANION]);
    expect(findingsOf('await withVersionCheck({ db, collection: COLLECTIONS.FLOORS, docId, updates, userId, companion });')).toEqual([]);
    expect(findingsOf('await withVersionCheck({ db, collection: COLLECTIONS.BUILDINGS, docId, updates, userId });')).toEqual([]);
  });

  it('✅ εγγραφή `number` σε ΑΛΛΗ συλλογή δεν αφορά τη στοίβα', () => {
    expect(findingsOf('await db.collection(COLLECTIONS.PROPERTIES).doc(id).update({ number: 3 });')).toEqual([]);
  });
});

describe('Κ3 — εξαίρεση ΜΟΝΟ με λόγο', () => {
  const write = 'batch.set(db.collection(COLLECTIONS.FLOORS).doc(id), floor);';

  it('🔓 με λόγο ⇒ δεκτή· χωρίς λόγο ⇒ εύρημα', () => {
    expect(findingsOf(`// floor-stack-authority-exempt: ιστορική μετανάστευση μίας χρήσης\n${write}`)).toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf(`// floor-stack-authority-exempt:\n${write}`)).toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ5 — η πόρτα απευθείας εγγραφής μένει κλειστή', () => {
  it("⛔ `'floors'` στο σύνολο εγγραφής του MCP — ✅ όταν λείπει, ✅ όταν το ονομάζει μόνο σχόλιο", () => {
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set(['properties', 'floors', 'tasks']);")).toBe(true);
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set(['properties', 'tasks']);")).toBe(false);
    expect(gate.directDoorOpen("const WRITE_ALLOWED_COLLECTIONS = new Set([\n  // `floors` is NOT writable\n  'tasks',\n]);")).toBe(false);
  });

  it("✅ `'floors'` σε ΑΛΛΟ σύνολο (ανάγνωσης) δεν ανοίγει την πόρτα", () => {
    expect(gate.directDoorOpen("const READ = new Set(['floors']);\nconst WRITE_ALLOWED_COLLECTIONS = new Set(['tasks']);")).toBe(false);
  });
});

describe('Κ4 + παρονομαστής — στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  const result = gate.measure();
  const root = path.resolve(__dirname, '..', '..');

  it('ο σαρωτής ΕΙΔΕ τη γέννηση και την αφαίρεση μέσα στο σύνορο', () => {
    const seen = result.findings.filter((f) => f.state === gate.STATES.STACK_WRITER).map((f) => f.file);
    expect(seen).toEqual(expect.arrayContaining([gate.BIRTH, gate.REMOVAL]));
  });

  it('κανένα μπλοκάρον εύρημα σήμερα', () => {
    expect(result.findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
  });

  it('κάθε δηλωμένος γραφέας ρωτά όντως το σύνορο, και η πόρτα του MCP είναι κλειστή', () => {
    expect(gate.wiringFindings(root)).toEqual([]);
  });

  it('⛔ δηλωμένος γραφέας που ΔΕΝ υπάρχει ή ΔΕΝ ρωτά το σύνορο κοκκινίζει (ρίζα χωρίς τα αρχεία)', () => {
    const states = gate.wiringFindings(path.join(root, 'scripts', '__tests__')).map((f) => f.state);
    expect(states.filter((s) => s === gate.STATES.SOURCE_DRIFT)).toHaveLength(Object.keys(gate.STACK_WRITERS).length + 1);
  });
});
