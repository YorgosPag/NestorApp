/**
 * @fileoverview Άγκυρες του CHECK 3.100 — η πύλη της εγγραφής σε αποσυρμένο ακίνητο (ADR-281 · ADR-329 §3.9).
 *
 * Κάθε κριτήριο δοκιμάζεται ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά» — πύλη που δεν μπορεί να
 * κοκκινίσει είναι σχόλιο (ADR-587 §6.1). Οι δοκιμές ΕΚΤΕΛΟΥΝ την ανάλυση σε προσωρινά δέντρα
 * (όχι σε μοκ), και μία τρέχει στο ΠΡΑΓΜΑΤΙΚΟ δέντρο: «0 παραβιάσεις» σημαίνει κάτι μόνο αν η
 * σάρωση είδε τα route.ts των ακινήτων.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const gate = require('../check-retired-property-write');

const ROUTE_DIR = 'src/app/api/properties/[id]';
const ROUTE = `${ROUTE_DIR}/foo/route.ts`;
const GATE_FILE = `${ROUTE_DIR}/showcase/generate/helpers.ts`;

const guard = (intent) => `await requirePropertyInTenantScope({ ctx, propertyId: id, path: '/x', ${intent} });`;

function statesOfCalls(code, rel = 'src/lib/x.ts') {
  return gate.guardCallFindings(gate.sourceFileOf(rel, code), rel).map((f) => f.state);
}

function statesOfRoute(code, declared = {}) {
  const facts = gate.routeFacts(gate.sourceFileOf(ROUTE, code));
  return gate.routeFindings(ROUTE, facts, declared).map((f) => f.state);
}

describe('Κ1 — κάθε κλήση του φρουρού δηλώνει intent', () => {
  it('⛔ λείπει το intent', () => {
    expect(statesOfCalls(guard("ignored: 1"))).toEqual([gate.STATES.INTENT_MISSING]);
  });

  it('⛔ όρισμα που δεν είναι αντικείμενο, ή μόνο spread', () => {
    expect(statesOfCalls('await requirePropertyInTenantScope(args);')).toEqual([gate.STATES.INTENT_MISSING]);
    expect(statesOfCalls('await requirePropertyInTenantScope({ ...base });')).toEqual([gate.STATES.INTENT_MISSING]);
  });

  it('⛔ κυριολεκτικό εκτός των τεσσάρων, ή υπολογισμένη έκφραση', () => {
    expect(statesOfCalls(guard("intent: 'delete'"))).toEqual([gate.STATES.INTENT_INVALID]);
    expect(statesOfCalls(guard("intent: ok ? 'read' : 'write'"))).toEqual([gate.STATES.INTENT_INVALID]);
  });

  it('✅ τα τέσσερα κυριολεκτικά και η προώθηση (μεταβλητή, shorthand, property access)', () => {
    for (const i of ['read', 'write', 'lifecycle', 'withdraw']) expect(statesOfCalls(guard(`intent: '${i}'`))).toEqual([]);
    expect(statesOfCalls(guard('intent'))).toEqual([]);
    expect(statesOfCalls(guard('intent: params.intent'))).toEqual([]);
  });

  it('✅ ΣΧΟΛΙΟ που ονομάζει τον φρουρό δεν είναι κλήση (AST, όχι κείμενο)', () => {
    expect(statesOfCalls('// requirePropertyInTenantScope({ })\nconst x = 1;')).toEqual([]);
  });
});

describe('Κ2 — μεταλλακτικό route.ts με φρουρό που γράφει', () => {
  it('⛔ μεταλλακτικός handler με ΜΟΝΟ φρουρό `read`', () => {
    const code = `export const PATCH = h(async () => { ${guard("intent: 'read'")} });`;
    expect(statesOfRoute(code)).toEqual([gate.STATES.READ_ONLY]);
  });

  it('✅ `write` / `lifecycle` / `withdraw` σε `export const` και σε `export async function`', () => {
    expect(statesOfRoute(`export const POST = h(async () => { ${guard("intent: 'write'")} });`)).toEqual([gate.STATES.GUARDED]);
    expect(statesOfRoute(`export async function DELETE() { ${guard("intent: 'lifecycle'")} }`)).toEqual([gate.STATES.GUARDED]);
    expect(statesOfRoute(`export const PUT = h(async () => { ${guard("intent: 'withdraw'")} });`)).toEqual([gate.STATES.GUARDED]);
  });

  it('✅ προωθημένο intent μέσω τοπικού βοηθού (`helper(…, \'write\')`)', () => {
    const code = `async function inScope(db, id, ctx, intent) { ${guard('intent')} }
export const PATCH = h(async () => { await inScope(db, id, ctx, 'write'); });`;
    expect(statesOfRoute(code)).toEqual([gate.STATES.GUARDED]);
  });

  it('⛔ ο τοπικός βοηθός καλείται ΜΟΝΟ με `read` — δεν μετρά', () => {
    const code = `async function inScope(db, id, ctx, intent) { ${guard('intent')} }
export const PATCH = h(async () => { await inScope(db, id, ctx, 'read'); });`;
    expect(statesOfRoute(code)).toEqual([gate.STATES.READ_ONLY]);
  });

  it('✅ το κέλυφος `propertyRoute({ intent })` μετρά ως φρουρός — και κρίνεται όπως αυτός', () => {
    const shell = (intent) => `withRate(propertyRoute<{ id: string }>({ path: '/x', ${intent}, handle }))`;
    expect(statesOfRoute(`export const POST = ${shell("intent: 'write'")};`)).toEqual([gate.STATES.GUARDED]);
    expect(statesOfRoute(`export const POST = ${shell("intent: 'read'")};`)).toEqual([gate.STATES.READ_ONLY]);
    expect(statesOfCalls(`export const POST = ${shell('failure: 1')};`)).toEqual([gate.STATES.INTENT_MISSING]);
  });

  it('✅ `assertNotRetired(` χωρίς φρουρό', () => {
    expect(statesOfRoute("export async function POST() { assertNotRetired('property', data); }")).toEqual([gate.STATES.GUARDED]);
  });

  it('✅ route με ΜΟΝΟ GET και φρουρό `read` δεν είναι μεταλλακτικό', () => {
    expect(statesOfRoute(`export const GET = h(async () => { ${guard("intent: 'read'")} });`)).toEqual([]);
  });

  it('🔓 εξαίρεση ΜΟΝΟ με λόγο', () => {
    const body = 'export async function POST() { return 1; }';
    expect(statesOfRoute(`// retired-write-exempt: προεπισκόπηση, δεν γράφει\n${body}`)).toEqual([gate.STATES.EXEMPT]);
    expect(statesOfRoute(`// retired-write-exempt:\n${body}`)).toEqual([gate.STATES.EXEMPT_NO_REASON]);
  });
});

describe('Κ3 — αδήλωτο μεταλλακτικό route, και κλειστό σύνολο χωρίς μπαγιάτικα', () => {
  const body = 'export async function POST() { return 1; }';

  it('⛔ μεταλλακτικό route χωρίς φρουρό και χωρίς δήλωση', () => {
    expect(statesOfRoute(body)).toEqual([gate.STATES.UNGUARDED]);
  });

  it('✅ το ίδιο route, δηλωμένο στο σύνολο', () => {
    expect(statesOfRoute(body, { [ROUTE]: { reason: 'δοκιμή', via: null } })).toEqual([gate.STATES.DECLARED]);
  });

  describe('πάνω σε προσωρινό δέντρο', () => {
    let root;
    const write = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), text);
    };
    const run = (declared) => gate.measure({
      root, declared, codeFiles: [ROUTE, GATE_FILE].map((r) => path.join(root, r)).filter((p) => fs.existsSync(p)),
    });
    const stateList = (declared) => run(declared).findings.map((f) => f.state);
    const viaRoute = "import { loadShowcaseSources } from './h';\nexport async function POST() { await loadShowcaseSources(id, c); }";
    const helpers = (inner) => `export async function loadShowcaseSources(p, c) { ${inner} }`;
    const declared = { [ROUTE]: { reason: 'δοκιμή', via: 'loadShowcaseSources' } };

    beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-3100-')); });
    afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

    it('✅ δηλωμένο route που φτάνει στο `loadShowcaseSources` με `assertNotRetired`', () => {
      write(ROUTE, viaRoute);
      write(GATE_FILE, helpers("assertNotRetired('property', property);"));
      expect(stateList(declared)).toEqual([gate.STATES.DECLARED]);
    });

    it('⛔ το `loadShowcaseSources` ΔΕΝ καλεί `assertNotRetired` — ο ισχυρισμός διαψεύδεται', () => {
      write(ROUTE, viaRoute);
      write(GATE_FILE, helpers('return 1;'));
      expect(stateList(declared)).toEqual([gate.STATES.DECLARED, gate.STATES.CLAIM_FALSE]);
    });

    it('⛔ το δηλωμένο route ΔΕΝ καλεί πια το `loadShowcaseSources`', () => {
      write(ROUTE, 'export async function POST() { return 1; }');
      write(GATE_FILE, helpers("assertNotRetired('property', property);"));
      expect(stateList(declared)).toEqual([gate.STATES.DECLARED, gate.STATES.CLAIM_FALSE]);
    });

    it('⛔ μπαγιάτικη εγγραφή: το αρχείο απέκτησε φρουρό', () => {
      write(ROUTE, `export async function POST() { ${guard("intent: 'write'")} }`);
      expect(stateList({ [ROUTE]: { reason: 'δοκιμή', via: null } })).toEqual([gate.STATES.GUARDED, gate.STATES.STALE]);
    });

    it('⛔ μπαγιάτικη εγγραφή: το αρχείο ΔΕΝ ΥΠΑΡΧΕΙ', () => {
      expect(stateList({ 'src/app/api/properties/[id]/gone/route.ts': { reason: 'δοκιμή', via: null } }))
        .toEqual([gate.STATES.STALE]);
    });
  });
});

describe('Το ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('✅ μηδέν μπλοκάρουσες παραβιάσεις — και η σάρωση ΕΙΔΕ τα route.ts των ακινήτων', () => {
    const result = gate.measure();
    const blocking = result.findings.filter((f) => gate.BLOCKING.includes(f.state));
    expect(blocking).toEqual([]);
    expect(result.routes).toBeGreaterThanOrEqual(20);
    expect(result.tally[gate.STATES.GUARDED]).toBeGreaterThan(0);
    expect(result.tally[gate.STATES.DECLARED]).toBe(Object.keys(gate.UNGUARDED_ROUTES).length);
  });
});
