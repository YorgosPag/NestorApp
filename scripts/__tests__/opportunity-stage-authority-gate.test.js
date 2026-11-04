/**
 * CHECK 3.114 — η πύλη του ενός γραφέα του σταδίου ευκαιρίας (ADR-930).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο, ΜΕ παρονομαστή. Οι υπόλοιπες = κάθε κρίση κοκκινίζει σε δικό της fixture, δίπλα σε
 * δίδυμα που ΔΕΝ πρέπει να κοκκινίσουν (σχόλιο · άλλη συλλογή).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE, RULES_FILE, STAGE_FIELDS_SOURCE, AI_EXECUTOR } = require('../check-opportunity-stage-authority');
const { MCP_ACCESS_CONTROL } = require('../lib/write-authority/mcp-write-allowlist');

const WRITER = 'src/services/crm/opportunity-stage-transition.server.ts';
const ROUTE = 'src/app/api/opportunities/[id]/stage/route.ts';
const REASON = 'Ο ένας γραφέας: CAS στο αναμενόμενο στάδιο, κανόνας μετάβασης, ίχνος μετά το commit.';
const FIELDS = `'stage', 'status', 'closedAt'`;

const rulesWith = (fields) => `service cloud.firestore {
    match /opportunities/{opportunityId} {
      allow update: if ok()
                    && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
                         ${fields}
                       ]);
    }
}`;

const registry = {
  guards: [
    { kind: 'call', name: 'applyOpportunityStageTransition', owners: { [ROUTE]: REASON } },
    { kind: 'member', name: 'COLLECTIONS.OPPORTUNITIES', owners: { [WRITER]: REASON } },
  ],
};

const HEALTHY = {
  [WRITER]: `export async function applyOpportunityStageTransition(db) { return db.collection(COLLECTIONS.OPPORTUNITIES).doc('x'); }`,
  [ROUTE]: `export const POST = (db) => applyOpportunityStageTransition(db);`,
  'src/other.ts': `// COLLECTIONS.OPPORTUNITIES — σχόλιο, όχι χρήση\nexport const o = (db) => db.collection(COLLECTIONS.LEADS);`,
  [STAGE_FIELDS_SOURCE]: `export const STAGE_OWNED_FIELDS = [\n  ${FIELDS},\n] as const;`,
  [RULES_FILE]: rulesWith(FIELDS),
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

describe('CHECK 3.114', () => {
  it('Μ0: πράσινη στο πραγματικό δέντρο — και ο σαρωτής ΕΙΔΕ τους κατόχους', () => {
    const result = measure({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBeGreaterThanOrEqual(12);
  });

  it('υγιής κόσμος: σχόλιο και άλλη συλλογή δεν είναι χρήση', () => {
    const result = measured({});
    expect(blockers(result)).toEqual([]);
    expect(result.tally[STATES.OWNER]).toBe(2);
  });

  it('Κ1: δεύτερος γραφέας στον server (αδήλωτο αρχείο που ονομάζει τη συλλογή)', () => {
    const rogue = { 'src/server/rogue.ts': `export const r = (db) => db.collection(COLLECTIONS.OPPORTUNITIES).doc('x').update({ stage: 'closed_won' });` };
    expect(blockers(measured(rogue))).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: 'src/server/rogue.ts', line: 1 })]);
  });

  it('Κ1: δεύτερη πόρτα που καλεί τον γραφέα χωρίς δήλωση', () => {
    const rogue = { 'src/app/api/other/route.ts': `export const POST = (db) => applyOpportunityStageTransition(db);` };
    expect(blockers(measured(rogue)).map((finding) => finding.state)).toEqual([STATES.OUTSIDE]);
  });

  it('Κ2: οι κανόνες κλειδώνουν ΛΙΓΟΤΕΡΑ πεδία από όσα δηλώνει ο κώδικας', () => {
    const result = measured({ [RULES_FILE]: rulesWith(`'stage', 'status'`) });
    expect(blockers(result)).toEqual([expect.objectContaining({ state: STATES.OUTSIDE, file: RULES_FILE })]);
  });

  it('Κ2: χωρίς λίστα κλειδώματος στους κανόνες η πύλη ΑΡΝΕΙΤΑΙ', () => {
    const result = measured({ [RULES_FILE]: 'service cloud.firestore { match /opportunities/{id} {\n      allow update: if ok();\n    }\n}' });
    expect(blockers(result).map((finding) => finding.state)).toEqual([STATES.SOURCE_DRIFT]);
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
