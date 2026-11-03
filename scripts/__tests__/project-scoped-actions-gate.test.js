/**
 * @fileoverview Άγκυρες του CHECK 3.111 — η πύλη των πράξεων έργου (ADR-926).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά», και ο παρονομαστής μετριέται στο ΠΡΑΓΜΑΤΙΚΟ δέντρο.
 */

'use strict';

const path = require('path');

const gate = require('../check-project-scoped-actions');
const { sourceFileOf } = require('../lib/write-authority/ast');

const ROOT = path.resolve(__dirname, '..', '..');

const CATALOGUE_TEXT = `export const PROJECT_SCOPED_ACTIONS = [
  'buildings:buildings:create',
  // σχόλιο: 'trash:entities:purge'
  'legal:conveyance:view',
] as const satisfies readonly PermissionId[];`;

const POLICY_TEXT = `export const PROJECT_ROLE_POLICY = {
  'buildings:buildings:create': { operation: 'createBuilding' },
  'legal:conveyance:view': { enforcedBy: 'src/conveyance.ts' },
};`;

const ROUTE_TEXT = `export const POST = withAuth(handler, {
  permissions: 'buildings:buildings:create',
  permissionResource: resolve,
});`;

const PURGE_TEXT = `export const DELETE = withAuth(handler, { permissions: '${gate.PURGE}' });`;

function fakeInput(overrides = {}) {
  const files = {
    [gate.CATALOGUE]: CATALOGUE_TEXT,
    [gate.POLICY]: POLICY_TEXT,
    'src/app/api/buildings/route.ts': ROUTE_TEXT,
    'src/app/api/buildings/building-update.handler.ts': '',
    'src/app/api/buildings/[buildingId]/route.ts': '',
    'src/app/api/floors/route.ts': '',
    'src/conveyance.ts': 'hasPermission(ctx, p, { projectId }, cache)',
    ...Object.fromEntries(gate.PURGE_ROUTES.map((route) => [route, PURGE_TEXT])),
    ...overrides,
  };
  return { read: (rel) => (rel in files ? files[rel] : null) };
}

const blockingOf = (input) =>
  gate.wiringFindings(ROOT, input).map((f) => f.state).filter((state) => gate.BLOCKING.includes(state));

const inFile = (code, rel) => gate.findingsIn(sourceFileOf(rel, code), rel).map((f) => f.state);

describe('το ΑΝΑΛΥΤΗΡΙΟ', () => {
  it('ο κατάλογος διαβάζεται από το AST: σχόλιο δεν μετρά ως πράξη', () => {
    expect(gate.catalogueActions(CATALOGUE_TEXT)).toEqual(['buildings:buildings:create', 'legal:conveyance:view']);
  });

  it('ο πίνακας ξεχωρίζει `operation` από `enforcedBy`', () => {
    expect(gate.policyRows(POLICY_TEXT).get('legal:conveyance:view')).toEqual({ kind: 'enforcedBy', value: 'src/conveyance.ts' });
  });

  it('το υγιές δείγμα δεν έχει ευρήματα', () => {
    expect(blockingOf(fakeInput())).toEqual([]);
  });
});

describe('Κ1 — κατάλογος ⇄ πίνακας', () => {
  it('⛔ πράξη χωρίς γραμμή', () => {
    const text = CATALOGUE_TEXT.replace("'legal:conveyance:view',", "'legal:conveyance:view',\n  'projects:floors:update',");
    expect(blockingOf(fakeInput({ [gate.CATALOGUE]: text }))).toContain(gate.STATES.ROW_MISSING);
  });

  it('⛔ γραμμή χωρίς πράξη', () => {
    const text = CATALOGUE_TEXT.replace("  'legal:conveyance:view',\n", '');
    expect(blockingOf(fakeInput({ [gate.CATALOGUE]: text }))).toContain(gate.STATES.ROW_ORPHAN);
  });
});

describe('Κ2 — σημείο επιβολής', () => {
  it('⛔ διαδρομή με `permissions` αλλά χωρίς `permissionResource`', () => {
    const text = ROUTE_TEXT.replace('  permissionResource: resolve,\n', '');
    expect(blockingOf(fakeInput({ 'src/app/api/buildings/route.ts': text }))).toContain(gate.STATES.UNENFORCED);
  });

  it('⛔ δηλωμένο αρχείο που δεν περνά έργο', () => {
    expect(blockingOf(fakeInput({ 'src/conveyance.ts': 'hasPermission(ctx, p, {}, cache)' }))).toContain(gate.STATES.UNENFORCED);
  });
});

describe('Κ3 — το έργο ΜΟΝΟ από τον πόρο', () => {
  const code = "withAuth(h, { permissions: 'x:y:z', permissionOptions: (r) => ({ projectId: r.nextUrl.searchParams.get('p') }) });";

  it('⛔ `permissionOptions` σε διαδρομή', () => {
    expect(inFile(code, 'src/app/api/x/route.ts')).toEqual([gate.STATES.OPTIONS_FROM_REQUEST]);
  });

  it('✅ το ίδιο όνομα έξω από διαδρομή δεν είναι εύρημα', () => {
    expect(inFile(code, 'src/lib/auth/doc-example.ts')).toEqual([]);
  });
});

describe('Κ4 — κανένα αντίγραφο', () => {
  const code = "const mine = ['buildings:buildings:create', 'buildings:buildings:update', 'projects:floors:create'];";

  it('⛔ πίνακας με τρεις πράξεις', () => {
    expect(inFile(code, 'src/hooks/rogue.ts')).toEqual([gate.STATES.CATALOGUE_COPY]);
  });

  it('✅ ο κατάλογος ρόλων είναι δεδομένα', () => {
    expect(inFile(code, 'src/lib/auth/role-catalogue.ts')).toEqual([]);
  });
});

describe('Κ5 — οριστική διαγραφή', () => {
  for (const action of [gate.PURGE, 'projects:floors:delete']) {
    it(`⛔ \`${action}\` στον κατάλογο`, () => {
      const text = CATALOGUE_TEXT.replace("'legal:conveyance:view',", `'legal:conveyance:view',\n  '${action}',`);
      expect(blockingOf(fakeInput({ [gate.CATALOGUE]: text }))).toContain(gate.STATES.PURGE_SCOPED);
    });
  }

  it.each(gate.PURGE_ROUTES)('⛔ %s χωρίς το δικαίωμα', (route) => {
    const open = 'export const DELETE = withAuth(handler, {});';
    expect(blockingOf(fakeInput({ [route]: open }))).toContain(gate.STATES.PURGE_OPEN);
  });

  it('⛔ χαμένο αρχείο δεν είναι σιωπή', () => {
    expect(blockingOf({ read: () => null })).toContain(gate.STATES.SOURCE_DRIFT);
  });
});

describe('ΠΑΡΟΝΟΜΑΣΤΗΣ — το πραγματικό δέντρο', () => {
  const { findings, tally } = gate.measure();

  it('καμία μπλοκάρουσα παραβίαση', () => {
    expect(findings.filter((f) => gate.BLOCKING.includes(f.state))).toEqual([]);
  });

  // ADR-928 §5.15: +2 (`subcontracts:agreements:manage` · `:assign`, σημείο επιβολής `agreement-resource.server.ts`).
  it('το «0» σημαίνει ότι κοίταξε: και οι 10 πράξεις έχουν αποδεδειγμένο σημείο επιβολής', () => {
    expect(tally[gate.STATES.ENFORCED]).toBe(10);
  });
});
