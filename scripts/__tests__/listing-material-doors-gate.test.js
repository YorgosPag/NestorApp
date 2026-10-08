/**
 * ΑΓΚΥΡΕΣ ΤΗΣ CHECK 3.76 Κ5+Κ6 — ΟΙ ΠΟΡΤΕΣ ΑΡΧΕΙΟΥ-ΥΛΙΚΟΥ (ADR-845 §7.17 Α6, κλάση Ο-35)
 *
 * ⛔ **ΚΑΘΕ ΚΡΙΤΗΡΙΟ ΑΣΚΕΙΤΑΙ ΜΕ ΜΕΤΑΛΛΑΞΗ ΣΤΗΝ ΕΙΣΟΔΟ, ΠΟΤΕ ΜΕ «ΕΙΝΑΙ ΠΡΑΣΙΝΟ ΣΗΜΕΡΑ».**
 *
 * Μ0  — βαθμονόμηση: το ΠΡΑΓΜΑΤΙΚΟ δέντρο είναι πράσινο ΚΑΙ έχει πόρτες (ο παρονομαστής)
 * Κ5  — καλών γραφέα εκτός μητρώου ⇒ ΚΟΚΚΙΝΟ · δηλωμένη πόρτα που έπαψε να ξαναπροβάλλει ⇒ ΚΟΚΚΙΝΟ
 * Κ6  — γραφή πεδίου του κατηγορήματος με το χέρι ⇒ ΚΟΚΚΙΝΟ · ένας όρος να λείπει ⇒ σιωπή
 * Κ5′ — εγγραφή που σάπισε / χωρίς λόγο / σύμβολο χωρίς καλούντα ⇒ ΚΟΚΚΙΝΟ
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  DOOR_COVER,
  DOOR_STATES,
  MATERIAL_DOORS,
  PUBLICATION_WRITERS,
  REFRESH_HELPERS,
  REGISTRY_STATES,
} = require('../lib/listing-model-custody/material-doors-contract.js');
const {
  DOOR_BLOCKING,
  auditDoorRegistry,
  classifyDoor,
  sweepDoors,
  writesPredicateByHand,
} = require('../lib/listing-model-custody/material-doors.js');
const { executableLines } = require('../lib/listing-model-custody/lines.js');
const { sweep } = require('../lib/listing-model-custody/gate.js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const TRASH_DOOR = 'src/app/api/files/trash/route.ts';
const STRANGER = 'src/app/api/files/move-to-property/route.ts';
const REASON = 'Λόγος με ουσία, αρκετά μακρύς ώστε να περνά το κατώφλι των σαράντα χαρακτήρων.';

const lines = (...rows) => rows.join('\n');
const states = (findings) => findings.map((f) => f.state);

describe('Μ0 — ΒΑΘΜΟΝΟΜΗΣΗ: το πραγματικό δέντρο έχει πόρτες και είναι πράσινο', () => {
  const result = sweep(REPO_ROOT);

  it('κανένα εύρημα των Κ5/Κ6 στο πραγματικό δέντρο', () => {
    const doorFindings = result.violations.filter((v) => DOOR_BLOCKING.includes(v.state));
    expect(doorFindings).toEqual([]);
    expect(result.registryTally[REGISTRY_STATES.REGISTRY_HEALTHY]).toBe(1);
  });

  // 🔴 Πύλη που δεν βρίσκει ΚΑΜΙΑ πόρτα είναι επίσης «πράσινη».
  it('🔴 και ΒΡΗΚΕ πόρτες, εξαιρέσεις και ορισμούς — το «0 ευρήματα» δεν είναι «0 κοιτάγματα»', () => {
    expect(result.doorTally[DOOR_STATES.DOOR]).toBeGreaterThanOrEqual(8);
    expect(result.doorTally[DOOR_STATES.EXEMPT_DOOR]).toBeGreaterThan(0);
    expect(result.doorTally[DOOR_STATES.DOOR_DEFINER]).toBeGreaterThan(0);
  });

  it('🔴 η ΠΡΑΓΜΑΤΙΚΗ πόρτα του κάδου χωρίς τον σκελετό της ⇒ door-without-refresh', () => {
    const real = fs.readFileSync(path.join(REPO_ROOT, TRASH_DOOR), 'utf8');
    expect(classifyDoor(TRASH_DOOR, real).state).toBe(DOOR_STATES.DOOR);
    const mutated = real.split('runFileBatch(').join('runSomethingElse(');
    expect(classifyDoor(TRASH_DOOR, mutated).state).toBe(DOOR_STATES.DOOR_WITHOUT_REFRESH);
  });

  it('κάθε εγγραφή του μητρώου δείχνει σε αρχείο που υπάρχει', () => {
    const missing = Object.keys(MATERIAL_DOORS).filter((rel) => !fs.existsSync(path.join(REPO_ROOT, rel)));
    expect(missing).toEqual([]);
  });
});

describe('Κ5 — Η ΠΟΡΤΑ ΠΟΥ ΔΕΝ ΤΗΝ ΞΕΡΕΙ ΚΑΝΕΙΣ', () => {
  const newDoor = lines(
    "import { writeFileTrashState } from '@/services/file-record/file-trash.service';",
    'export async function POST(file) {',
    '  return writeFileTrashState(file);',
    '}',
  );

  it('🔴 άγνωστο αρχείο που καλεί γραφέα ⇒ unregistered-door, και λέει ΠΟΙΟΝ', () => {
    const verdict = classifyDoor(STRANGER, newDoor);
    expect(verdict.state).toBe(DOOR_STATES.UNREGISTERED_DOOR);
    expect(verdict.detail).toMatch(/writeFileTrashState/);
  });

  it('🔴 και ο καλών ΜΟΝΟ του βοηθού οφείλει γραμμή — όποιος ξαναπροβάλλει είναι πόρτα', () => {
    const helperOnly = 'await refreshListingAfterMediaChange(db, propertyId, companyId);';
    expect(classifyDoor(STRANGER, helperOnly).state).toBe(DOOR_STATES.UNREGISTERED_DOOR);
  });

  it('το ΙΔΙΟ κείμενο σε δηλωμένη `refresh` πόρτα χωρίς βοηθό ⇒ door-without-refresh', () => {
    expect(classifyDoor(TRASH_DOOR, newDoor).state).toBe(DOOR_STATES.DOOR_WITHOUT_REFRESH);
  });

  it('με τον βοηθό ⇒ door · το πέρασμα από τον σκελετό δέσμης ΜΕΤΡΑ ως κάλυψη', () => {
    const viaHelper = lines(newDoor, 'await refreshListingsAfterFileChanges(db, [file]);');
    const viaBatch = lines(newDoor, 'return runFileBatch({ payload, ctx });');
    expect(classifyDoor(TRASH_DOOR, viaHelper).state).toBe(DOOR_STATES.DOOR);
    expect(classifyDoor(TRASH_DOOR, viaBatch).state).toBe(DOOR_STATES.DOOR);
  });

  it('δηλωμένη εξαίρεση ⇒ exempt-door, χωρίς να της ζητηθεί βοηθός', () => {
    const doors = { [STRANGER]: { cover: DOOR_COVER.EXEMPT, reason: REASON } };
    expect(classifyDoor(STRANGER, newDoor, { doors }).state).toBe(DOOR_STATES.EXEMPT_DOOR);
  });

  it('το αρχείο που ΟΡΙΖΕΙ τον γραφέα ⇒ door-definer · η τεκμηρίωση δεν είναι κλήση', () => {
    const definer = 'export async function writeFileTrashState(params) { return params; }';
    const doc = lines('/**', ' * Δες writeFileTrashState(file) — καλείται αλλού.', ' */', 'export const x = 1;');
    expect(classifyDoor(STRANGER, definer).state).toBe(DOOR_STATES.DOOR_DEFINER);
    expect(classifyDoor(STRANGER, doc).state).toBe(DOOR_STATES.NOT_A_DOOR);
  });
});

describe('Κ6 — Η ΓΡΑΦΗ ΜΕ ΤΟ ΧΕΡΙ (το περιστατικό `DELETE /api/cad-files`)', () => {
  // 🔴 Το πραγματικό κείμενο της πόρτας που αφαιρέθηκε στην Α6: έσβηνε εγγραφή της `files` με
  //    τιμή εκτός λεξιλογίου, χωρίς κρίση δημοσίευσης, χωρίς ίχνος, χωρίς επαναπροβολή.
  const handWrite = lines(
    'const docRef = adminDb.collection(COLLECTIONS.FILES).doc(fileId);',
    'await docRef.update({',
    '  isDeleted: true,',
    "  lifecycleState: 'deleted',",
    '});',
  );

  it('🔴 κυριολεκτικό πεδίο + δρόμος προς τη `files` + ρήμα γραφής ⇒ unregistered-writer', () => {
    expect(classifyDoor(STRANGER, handWrite).state).toBe(DOOR_STATES.UNREGISTERED_WRITER);
  });

  it.each([
    ['χωρίς το πεδίο', handWrite.replace("lifecycleState: 'deleted',", "note: 'x',")],
    ['χωρίς δρόμο προς τη `files`', handWrite.replace('COLLECTIONS.FILES', 'COLLECTIONS.CONTACTS')],
    ['χωρίς ρήμα γραφής', handWrite.replace('docRef.update(', 'describe(')],
  ])('ένας όρος να λείπει ⇒ σιωπή (%s)', (_label, source) => {
    expect(writesPredicateByHand(executableLines(source))).toBe(false);
    expect(classifyDoor(STRANGER, source).state).toBe(DOOR_STATES.NOT_A_DOOR);
  });

  it('τύπος με `classification?:` δεν είναι γραφή — το προαιρετικό πεδίο δεν πιάνεται', () => {
    const typed = lines('interface X extends FileRecord {', '  classification?: string;', '}', 'map.set(a, b);');
    expect(writesPredicateByHand(executableLines(typed))).toBe(false);
  });

  it('δηλωμένος γραφέας με λόγο ⇒ exempt-door', () => {
    const doors = { [STRANGER]: { cover: DOOR_COVER.EXEMPT, reason: REASON } };
    expect(classifyDoor(STRANGER, handWrite, { doors }).state).toBe(DOOR_STATES.EXEMPT_DOOR);
  });
});

describe('Κ5′ — ΤΟ ΜΗΤΡΩΟ ΣΑΠΙΖΕΙ', () => {
  const everySymbol = new Map(
    [...Object.keys(PUBLICATION_WRITERS), ...Object.keys(REFRESH_HELPERS)].map((s) => [s, 1]),
  );
  const everyDoor = new Set(Object.keys(MATERIAL_DOORS));

  it('ζωντανές πόρτες, λόγοι, καλούντες ⇒ κανένα εύρημα', () => {
    expect(auditDoorRegistry(everyDoor, everySymbol)).toEqual([]);
  });

  it('🔴 εγγραφή που δεν αγγίζει πια το κατηγόρημα ⇒ orphan-door, μία ανά εγγραφή', () => {
    const findings = auditDoorRegistry(new Set(), everySymbol);
    expect(findings.filter((f) => f.state === REGISTRY_STATES.ORPHAN_DOOR)).toHaveLength(
      Object.keys(MATERIAL_DOORS).length,
    );
  });

  it.each([
    ['λόγος-βιτρίνα', { cover: DOOR_COVER.EXEMPT, reason: 'γιατί ναι' }],
    ['άγνωστη κάλυψη', { cover: 'maybe', reason: REASON }],
    ['χωρίς λόγο', { cover: DOOR_COVER.REFRESH }],
  ])('🔴 %s ⇒ reasonless-door', (_label, entry) => {
    const doors = { 'x/y.ts': entry };
    expect(states(auditDoorRegistry(new Set(['x/y.ts']), everySymbol, { doors }))).toEqual([
      REGISTRY_STATES.REASONLESS_DOOR,
    ]);
  });

  it('🔴 γραφέας ή βοηθός χωρίς καλούντα ⇒ orphan-door-symbol, και εξηγεί ΓΙΑΤΙ', () => {
    const findings = auditDoorRegistry(everyDoor, new Map());
    expect(findings).toHaveLength(everySymbol.size);
    expect(findings.every((f) => f.state === REGISTRY_STATES.ORPHAN_DOOR_SYMBOL)).toBe(true);
    expect(findings[0].detail).toMatch(/ΝΕΚΡΟΣ/);
  });

  it('το `sweepDoors` ενώνει αρχεία και μητρώο — και κάθε κόκκινη κατάσταση ΜΠΛΟΚΑΡΕΙ', () => {
    const report = sweepDoors([{ rel: STRANGER, source: 'await writeFileArchiveState(file);' }], { doors: {} });
    expect(states(report.violations)).toContain(DOOR_STATES.UNREGISTERED_DOOR);
    expect(report.registryTally[REGISTRY_STATES.REGISTRY_HEALTHY]).toBe(0);
    expect(report.violations.every((v) => DOOR_BLOCKING.includes(v.state))).toBe(true);
  });
});
