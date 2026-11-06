/**
 * CHECK 3.114 — η πύλη του ενός γραφέα του σταδίου ευκαιρίας (ADR-930).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο, ΜΕ παρονομαστή. Οι υπόλοιπες = κάθε κρίση κοκκινίζει σε δικό της fixture, δίπλα σε
 * δίδυμα που ΔΕΝ πρέπει να κοκκινίσουν (σχόλιο · άλλη συλλογή · read μόνο).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE, RULES_FILE, AI_EXECUTOR } = require('../check-opportunity-stage-authority');
const { MCP_ACCESS_CONTROL } = require('../lib/write-authority/mcp-write-allowlist');

const WRITER = 'src/services/crm/opportunity-stage-transition.server.ts';
const ROUTE = 'src/app/api/opportunities/[id]/stage/route.ts';
const ENFORCER = 'src/services/crm/opportunity-access.server.ts';
const REASON = 'Ο ένας γραφέας: CAS στο αναμενόμενο στάδιο, κανόνας μετάβασης, ίχνος μετά το commit.';
const OWNER_WRITER = 'src/services/crm/opportunity-owner-transfer.server.ts';
const OWNER_ROUTE = 'src/app/api/opportunities/[id]/owner/route.ts';

const READ = `allow read: if isAuthenticated()
                  && (isSuperAdminOnly() || crmInTenant(resource.data));`;
const CLOSED = 'allow create, update, delete: if false;';

/** Το `match /opportunities` με τις δοσμένες δηλώσεις — και ένα σχόλιο που ΜΟΙΑΖΕΙ με ανοιχτή εγγραφή. */
const rulesWith = (...statements) => `service cloud.firestore {
    match /opportunities/{opportunityId} {
      // allow update: if crmWriterIsPrivileged(resource.data);  ← σχόλιο, δεν μετρά
      ${statements.join('\n      ')}
    }

    match /leads/{leadId} {
      allow update: if crmWriterIsPrivileged(resource.data);
    }
}`;

const registry = {
  guards: [
    { kind: 'call', name: 'applyOpportunityStageTransition', owners: { [ROUTE]: REASON } },
    { kind: 'call', name: 'requireOpportunityInTenant', owners: { [ENFORCER]: REASON } },
    { kind: 'call', name: 'applyOpportunityOwnerTransfer', owners: { [OWNER_ROUTE]: REASON } },
    { kind: 'member', name: 'COLLECTIONS.OPPORTUNITIES', owners: { [WRITER]: REASON, [OWNER_WRITER]: REASON } },
  ],
};

const HEALTHY = {
  [WRITER]: `export async function applyOpportunityStageTransition(db) { return db.collection(COLLECTIONS.OPPORTUNITIES).doc('x'); }`,
  [ROUTE]: `export const POST = (db) => applyOpportunityStageTransition(db);`,
  [ENFORCER]: `export const requireOpportunityAccess = (p) => requireOpportunityInTenant(p);`,
  [OWNER_WRITER]: `export async function applyOpportunityOwnerTransfer(db) { return db.collection(COLLECTIONS.OPPORTUNITIES).doc('x'); }`,
  [OWNER_ROUTE]: `export const POST = (db) => applyOpportunityOwnerTransfer(db);`,
  'src/other.ts': `// COLLECTIONS.OPPORTUNITIES — σχόλιο, όχι χρήση\nexport const o = (db) => db.collection(COLLECTIONS.LEADS);`,
  [RULES_FILE]: rulesWith(READ, CLOSED),
  [MCP_ACCESS_CONTROL]: `const WRITE_ALLOWED_COLLECTIONS = new Set([\n  'leads', // 'opportunities' σε σχόλιο δεν μετρά\n]);`,
  [AI_EXECUTOR]: `export const ALLOWED_WRITE_COLLECTIONS = new Set([\n  COLLECTIONS.LEADS,\n]);`,
};

function worldWith(files, reg = registry) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-3-114-'));
  const codeFiles = Object.entries({ ...HEALTHY, ...files })
    .filter(([, text]) => text !== null)
    .map(([rel, text]) => {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
      return abs;
    })
    .filter((abs) => abs.includes(`${path.sep}src${path.sep}`));
  fs.writeFileSync(path.join(root, REGISTRY_FILE), JSON.stringify(reg));
  return { root, codeFiles, registry: reg };
}

const blockers = (result) => result.findings.filter((finding) => BLOCKING.includes(finding.state));
const measured = (files, reg) => measure(worldWith(files, reg));
const rulesBlockers = (...statements) => blockers(measured({ [RULES_FILE]: rulesWith(...statements) }));

describe('CHECK 3.114', () => {
  it('Μ0: πράσινη στο πραγματικό δέντρο — και ο σαρωτής ΕΙΔΕ τους κατόχους', () => {
    const result = measure({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBeGreaterThanOrEqual(13);
  });

  it('υγιής κόσμος: σχόλιο, άλλη συλλογή και ανοιχτό `update` ΑΛΛΗΣ συλλογής δεν μετρούν', () => {
    const result = measured({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBe(5);
  });

  it('Κ1: route που καλεί τον φράχτη ΜΟΝΟ του — παρακάμπτει τον κριτή κατόχου', () => {
    const rogue = { 'src/app/api/opportunities/[id]/notes/route.ts': `export const PATCH = (p) => requireOpportunityInTenant(p);` };
    expect(blockers(measured(rogue))).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/app/api/opportunities/[id]/notes/route.ts' })]);
  });

  it('Κ1: δεύτερος γραφέας στον server (αδήλωτο αρχείο που ονομάζει τη συλλογή)', () => {
    const rogue = { 'src/server/rogue.ts': `export const r = (db) => db.collection(COLLECTIONS.OPPORTUNITIES).doc('x').update({ stage: 'closed_won' });` };
    expect(blockers(measured(rogue))).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/server/rogue.ts', line: 1 })]);
  });

  it('Κ1: δεύτερη πόρτα που καλεί τον γραφέα σταδίου χωρίς δήλωση', () => {
    const rogue = { 'src/app/api/other/route.ts': `export const POST = (db) => applyOpportunityStageTransition(db);` };
    expect(blockers(measured(rogue)).map((finding) => finding.state)).toEqual([STATES.OUTSIDE]);
  });

  it('Κ1 (πρώην Κ7): δεύτερη πόρτα μεταβίβασης που καλεί τον γραφέα κατόχου χωρίς δήλωση', () => {
    const rogue = { 'src/app/api/opportunities/[id]/assign/route.ts': `export const POST = (db) => applyOpportunityOwnerTransfer(db);` };
    expect(blockers(measured(rogue))).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/app/api/opportunities/[id]/assign/route.ts' })]);
  });

  it('Κ2: ο κανόνας του Βήματος Α (update με λίστα κλειδώματος) ⇒ ΚΟΚΚΙΝΟ — ο browser γράφει τα υπόλοιπα πεδία', () => {
    const update = `allow update: if crmWriterIsPrivileged(resource.data)
                    && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['stage', 'assignedTo']);`;
    expect(rulesBlockers(READ, 'allow create, delete: if false;', update)).toEqual([
      expect.objectContaining({ state: STATES.OUTSIDE, file: RULES_FILE, detail: expect.stringContaining('allow update') }),
    ]);
  });

  it('Κ2: `allow write: if true` ⇒ ΚΟΚΚΙΝΟ, ακόμη κι αν υπάρχει και η κλειστή δήλωση (οι κανόνες ΕΝΩΝΟΝΤΑΙ)', () => {
    expect(rulesBlockers(READ, CLOSED, 'allow write: if true;')).toEqual([
      expect.objectContaining({ state: STATES.OUTSIDE, file: RULES_FILE, detail: expect.stringContaining('allow write') }),
    ]);
  });

  it('Κ2: εγγραφή κρυμμένη μαζί με την ανάγνωση (`allow read, create`) ⇒ ΚΟΚΚΙΝΟ', () => {
    expect(rulesBlockers('allow read, create: if isAuthenticated();', CLOSED)).toEqual([
      expect.objectContaining({ state: STATES.OUTSIDE, file: RULES_FILE, detail: expect.stringContaining('read, create') }),
    ]);
  });

  it('Κ2: το `delete` δεν δηλώνεται κλειστό ⇒ η πύλη ΑΡΝΕΙΤΑΙ (η σιωπή δεν είναι δήλωση)', () => {
    expect(rulesBlockers(READ, 'allow create, update: if false;')).toEqual([
      expect.objectContaining({ state: STATES.SOURCE_DRIFT, file: RULES_FILE, detail: expect.stringContaining('delete') }),
    ]);
  });

  it('Κ2: `allow write: if false` καλύπτει και τις τρεις πράξεις ⇒ πράσινο', () => {
    expect(rulesBlockers(READ, 'allow write: if false;')).toEqual([]);
  });

  it('Κ2: χωρίς το μπλοκ `match /opportunities` η πύλη ΑΡΝΕΙΤΑΙ (δεν κρίνει στα τυφλά)', () => {
    const result = measured({ [RULES_FILE]: 'service cloud.firestore {\n}' });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.SOURCE_DRIFT, file: RULES_FILE })]);
  });

  it('Κ3: οι ευκαιρίες στη λίστα απευθείας εγγραφής του MCP', () => {
    const result = measured({ [MCP_ACCESS_CONTROL]: `const WRITE_ALLOWED_COLLECTIONS = new Set([\n  'leads',\n  'opportunities',\n]);` });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: MCP_ACCESS_CONTROL })]);
  });

  it('Κ4: οι ευκαιρίες στη λίστα εγγραφής του AI', () => {
    const result = measured({ [AI_EXECUTOR]: `export const ALLOWED_WRITE_COLLECTIONS = new Set([\n  COLLECTIONS.OPPORTUNITIES,\n]);` });
    // Δύο ευρήματα, και τα δύο σωστά: η Κ1 (αδήλωτη χρήση της συλλογής) και η Κ4 (λίστα εγγραφής). Ελέγχεται το ΔΙΚΟ της.
    expect(blockers(result)).toContainEqual(expect.objectContaining({ state: STATES.OUTSIDE, file: AI_EXECUTOR, detail: expect.stringContaining('λίστα εγγραφής του AI') }));
  });

  it('δήλωση χωρίς λόγο', () => {
    const noReason = { guards: [{ kind: 'member', name: 'COLLECTIONS.OPPORTUNITIES', owners: { [WRITER]: 'γιατί' } }] };
    expect(blockers(measured({}, noReason)).map((finding) => finding.state)).toContain(STATES.NO_REASON);
  });
});
