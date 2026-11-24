/**
 * @fileoverview Άγκυρες του CHECK 3.118 — ο ένας γραφέας της επαφής του χώρου (ADR-951).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να κοκκινίσει είναι σχόλιο
 * (ADR-587 §6.1). Και η καλωδίωση μετριέται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο.
 */

'use strict';

const gate = require('../check-self-contact-authority');
const { sourceFileOf } = require('../lib/write-authority/ast');

function findingsOf(code, rel = 'src/services/rogue.ts') {
  return gate.findingsIn(sourceFileOf(rel, code), rel).map((f) => f.state);
}

/** Είσοδος στη μνήμη για την καλωδίωση: διαδρομή → κείμενο. */
function memoryInput(files) {
  return {
    read: (rel) => (rel in files ? files[rel] : null),
    exists: (rel) => rel in files,
  };
}

const CLOSED_RULES = `
    match /companies/{companyId} {
      allow read: if isAuthenticated();
      // allow write: if true;  ← σχόλιο, όχι κανόνας
      allow write: if false;
      match /workspace_members/{memberUid} {
        allow create: if isAuthenticated();
      }
    }`;
const MCP = "const WRITE_ALLOWED_COLLECTIONS = new Set([\n  'contacts',\n  // 'companies' σε σχόλιο\n]);";
const AI = 'export const ALLOWED_WRITE_COLLECTIONS = new Set([\n  COLLECTIONS.CONTACTS,\n]);';
const HEALTHY_TREE = {
  [gate.WRITER]: 'await db.runTransaction(async (tx) => {});',
  [gate.REFERENCE]: 'export function selfContactOf(data) {}',
  [gate.RULES_FILE]: CLOSED_RULES,
  'mcp-server/src/security/access-control.ts': MCP,
  [gate.AI_EXECUTOR]: AI,
};
const wiringOf = (overrides) => gate.wiringFindings('/', memoryInput({ ...HEALTHY_TREE, ...overrides })).map((f) => f.state);

describe('Κ1 — το όνομα του πεδίου ΜΟΝΟ στους κατόχους', () => {
  it('⛔ `[SELF_CONTACT_FIELD]` σε εγγραφή έξω από τον γραφέα', () => {
    expect(findingsOf('await ref.update({ [SELF_CONTACT_FIELD]: link });')).toEqual([gate.STATES.FIELD_OUTSIDE]);
  });

  it('⛔ και ως ανάγνωση: ο ΕΝΑΣ αναγνώστης είναι το `selfContactOf`', () => {
    expect(findingsOf('const raw = data[SELF_CONTACT_FIELD];')).toEqual([gate.STATES.FIELD_OUTSIDE]);
  });

  it('✅ ο γραφέας και ο αναγνώστης', () => {
    expect(findingsOf('tx.update(ref, { [SELF_CONTACT_FIELD]: link });', gate.WRITER)).toEqual([gate.STATES.OWNER]);
    expect(findingsOf('const raw = data?.[SELF_CONTACT_FIELD];', gate.REFERENCE)).toEqual([gate.STATES.OWNER]);
  });

  it('✅ εισαγωγή χωρίς χρήση και ΣΧΟΛΙΟ δεν είναι χρήση (AST, όχι κείμενο)', () => {
    expect(findingsOf("import { SELF_CONTACT_FIELD } from '@/lib/company/self-contact-ref';")).toEqual([]);
    expect(findingsOf('// SELF_CONTACT_FIELD γράφεται μόνο στο store\nconst x = 1;')).toEqual([]);
  });
});

describe('Κ2 — το όνομα γραμμένο με το χέρι', () => {
  it("⛔ κλειδί `selfContact` σε εγγραφή — ο δεύτερος γραφέας που «περνά και το selfContact»", () => {
    expect(findingsOf('await ref.update({ name, selfContact: body.selfContact });')).toEqual([gate.STATES.LITERAL_FIELD]);
    expect(findingsOf('batch.set(ref, { selfContact: link }, { merge: true });')).toEqual([gate.STATES.LITERAL_FIELD]);
  });

  it("⛔ string `'selfContact'` / `'selfContact.contactId'` (διαδρομή πεδίου, `FieldPath`)", () => {
    expect(findingsOf("await ref.update('selfContact.contactId', id);")).toEqual([gate.STATES.LITERAL_FIELD]);
    expect(findingsOf("const path = new FieldPath('selfContact');")).toEqual([gate.STATES.LITERAL_FIELD]);
  });

  it('✅ κλειδί μεταφράσεων και κλειδί σε απάντηση (όχι εγγραφή) δεν είναι πεδίο της βάσης', () => {
    expect(findingsOf("const title = t('selfContact.title');")).toEqual([]);
    expect(findingsOf('return { kind: "linked", selfContact };')).toEqual([]);
  });

  it('✅ η ΜΙΑ δήλωση του ονόματος', () => {
    expect(findingsOf("export const SELF_CONTACT_FIELD = 'selfContact';", gate.REFERENCE)).toEqual([]);
  });
});

describe('Κ3 — εξαίρεση ΜΟΝΟ με λόγο', () => {
  const write = 'await ref.update({ selfContact: null });';
  it('✅ με λόγο · ⛔ χωρίς', () => {
    expect(findingsOf(`// self-contact-authority-exempt: μετανάστευση μίας χρήσης\n${write}`)).toEqual([gate.STATES.EXEMPT]);
    expect(findingsOf(`// self-contact-authority-exempt:\n${write}`)).toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ4 + Κ5 — καλωδίωση και πόρτες', () => {
  it('✅ υγιές δέντρο ⇒ κανένα εύρημα (σχόλια δεν ανοίγουν πόρτα)', () => {
    expect(wiringOf({})).toEqual([]);
  });

  it('⛔ γραφέας χωρίς συναλλαγή · δηλωμένο αρχείο που λείπει', () => {
    expect(wiringOf({ [gate.WRITER]: 'await ref.update({});' })).toEqual([gate.STATES.OWNER_UNPROVEN]);
    const missing = { ...HEALTHY_TREE };
    delete missing[gate.REFERENCE];
    expect(gate.wiringFindings('/', memoryInput(missing)).map((f) => f.state)).toEqual([gate.STATES.SOURCE_DRIFT]);
  });

  it('⛔ κανόνες: ο browser γράφει τον χώρο · ✅ εμφωλευμένο `match` δεν μετρά', () => {
    const open = CLOSED_RULES.replace('allow write: if false;', 'allow update: if isCompanyAdmin();');
    expect(wiringOf({ [gate.RULES_FILE]: open })).toEqual([gate.STATES.OUTSIDE]);
  });

  it('⛔ κανόνες χωρίς ρητό κλείσιμο ή χωρίς μπλοκ ⇒ δεν κρίνει στα τυφλά', () => {
    const silent = CLOSED_RULES.replace('allow write: if false;', '');
    expect(wiringOf({ [gate.RULES_FILE]: silent })).toEqual([gate.STATES.SOURCE_DRIFT]);
    expect(wiringOf({ [gate.RULES_FILE]: 'match /other/{id} {}' })).toEqual([gate.STATES.SOURCE_DRIFT]);
  });

  it('⛔ MCP και AI γράφουν τον χώρο απευθείας', () => {
    expect(wiringOf({ 'mcp-server/src/security/access-control.ts': MCP.replace("'contacts',", "'contacts',\n  'companies',") }))
      .toEqual([gate.STATES.OUTSIDE]);
    expect(wiringOf({ [gate.AI_EXECUTOR]: AI.replace('COLLECTIONS.CONTACTS,', 'COLLECTIONS.CONTACTS,\n  COLLECTIONS.COMPANIES,') }))
      .toEqual([gate.STATES.OUTSIDE]);
  });
});

describe('Το ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('πράσινο — και ο σαρωτής ΕΙΔΕ τους κατόχους (αλλιώς το «0» σημαίνει «δεν κοίταξα»)', () => {
    const { findings, tally } = gate.measure();
    expect(findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
    expect(new Set(findings.filter((f) => f.state === gate.STATES.OWNER).map((f) => f.file)))
      .toEqual(new Set([gate.WRITER, gate.REFERENCE]));
    expect(tally[gate.STATES.OWNER]).toBeGreaterThanOrEqual(4);
  });
});
