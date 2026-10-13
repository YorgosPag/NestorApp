/**
 * CHECK 3.104 — η πύλη του ενός δρόμου της παρουσίας περιήγησης (ADR-884 · ADR-777 §8.88).
 *
 * Μ0 = πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο. Μ1–Μ8 = κάθε κριτήριο κοκκινίζει σε δικό του fixture, δίπλα σε fixture-δίδυμα
 * που ΔΕΝ πρέπει να κοκκινίσουν (σχόλιο που ονομάζει κλήση · `Map.set` · ανάγνωση του `tourRef`).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { measure, STATES, BLOCKING, REGISTRY_FILE } = require('../check-tour-presence-authority');

const REFRESHER = 'src/services/listings/tour-refresh.ts';
const BINDER = 'src/services/listings/facts.ts';
const SETTINGS = 'src/server/tour/settings.ts';
const GENESIS = 'src/server/tour/genesis.ts';
const REASON = 'Γεννά την περιήγηση πάντα ως πρόχειρη — ο κριτής απαντά «καμία» πριν και μετά.';

const registryWith = (over = {}) => ({
  refresher: REFRESHER,
  refreshFunctions: ['refreshListingAfterTourChange', 'refreshListingOfTour'],
  binder: BINDER,
  binderFunctions: ['listedTourFromPresence', 'listedTourOf'],
  presenceWriters: { [SETTINGS]: { min: 1, why: 'ορατότητα + κύκλος ζωής' } },
  exemptWriters: { [GENESIS]: REASON },
  ...over,
});

const HEALTHY = {
  [REFRESHER]: `export async function refreshListingAfterTourChange(db, subject) { return listedTourFromPresence(await read(db, subject)); }
export async function refreshListingOfTour(db, tourRef) { const snap = await tourRef.get(); return refreshListingAfterTourChange(db, snap.data().subject); }`,
  [BINDER]: `export const listedTourFromPresence = (p) => (p === null ? null : { visibility: p.visibility });
export async function listedTourOf(db, id) { return listedTourFromPresence(await read(db, id)); }`,
  [SETTINGS]: `export async function update(db, input) {
  await db.runTransaction(async (tx) => { tx.update(tourRef, { visibility: 'public' }); });
  await refreshListingAfterTourChange(db, input.subject);
}`,
  [GENESIS]: `export async function ensure(db, tourRef) { await db.runTransaction(async (tx) => { tx.create(tourRef, doc); }); }`,
  // Δίδυμα που ΔΕΝ είναι εγγραφή σε περιήγηση: σχόλιο, ανάγνωση, και `Map.set` με άσχετο κλειδί.
  'src/server/tour/reader.ts': `// tx.update(tourRef, …) αναφέρεται σε σχόλιο — δεν είναι κλήση
export async function read(tourRef) { const seen = new Map(); seen.set('k', 1); return (await tourRef.get()).data(); }`,
};

function world(overrides = {}, registry = registryWith()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tpa-'));
  const codeFiles = [];
  for (const [rel, text] of Object.entries({ ...HEALTHY, ...overrides })) {
    if (text === null) continue;
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
    codeFiles.push(abs);
  }
  return measure({ root, codeFiles, registry });
}

const blockingStates = (result) => result.findings.filter((f) => BLOCKING.includes(f.state)).map((f) => f.state).sort();

describe('Μ0 — πράσινη στο ΠΡΑΓΜΑΤΙΚΟ δέντρο', () => {
  it('καμία μπλοκάρουσα παραβίαση · κάθε δηλωμένος γραφέας και κάθε εξαίρεση μετρήθηκε', () => {
    const result = measure();
    expect(blockingStates(result)).toEqual([]);
    const registry = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', REGISTRY_FILE), 'utf8'));
    expect(result.tally[STATES.PRESENCE_WRITER]).toBe(Object.keys(registry.presenceWriters).length);
    expect(result.tally[STATES.EXEMPT]).toBe(Object.keys(registry.exemptWriters).length);
    // Το μητρώο δεν είναι άδειο κέλυφος: χωρίς γραφείς, το «πράσινο» θα σήμαινε «δεν κοίταξα».
    expect(result.tally[STATES.PRESENCE_WRITER]).toBeGreaterThanOrEqual(3);
  });
});

describe('fixtures', () => {
  it('υγιής κόσμος ⇒ πράσινο (σχόλιο · ανάγνωση · `Map.set` δεν είναι εγγραφή σε περιήγηση)', () => {
    const result = world();
    expect(blockingStates(result)).toEqual([]);
    expect(result.tally[STATES.PRESENCE_WRITER]).toBe(1);
    expect(result.tally[STATES.EXEMPT]).toBe(1);
  });

  it('Μ1 Κ1 — αδήλωτο αρχείο γράφει σε `captureRef` μέσω συναλλαγής ⇒ ⛔', () => {
    const result = world({ 'src/server/tour/rogue.ts': `export const f = (tx, captureRef) => tx.update(captureRef, { nodeId: null });` });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_WRITER]);
  });

  it('Μ2 Κ1 — …και απευθείας πάνω στην αναφορά, μέσα από αντικείμενο (`ctx.tourRef.update`) ⇒ ⛔', () => {
    const result = world({ 'src/services/other/rogue.ts': `export const f = (ctx) => ctx.tourRef.update({ lifecycle: 'withdrawn' });` });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_WRITER]);
  });

  it('Μ3 Κ2 — δηλωμένος γραφέας που «ξέχασε» τον δρόμο ⇒ ⛔', () => {
    const result = world({ [SETTINGS]: `export async function update(db) { await db.runTransaction(async (tx) => { tx.update(tourRef, { visibility: 'public' }); }); }` });
    expect(blockingStates(result)).toEqual([STATES.MISSING_REFRESH]);
  });

  it('Μ4 Κ2 — δηλωμένος γραφέας που δεν περνά καν το προφίλτρο ⇒ ⛔, όχι σιωπή', () => {
    expect(blockingStates(world({ [SETTINGS]: 'export const nothing = 1;' }))).toEqual([STATES.MISSING_REFRESH]);
  });

  it('Μ5 Κ2 — αδήλωτος καλών του δρόμου ⇒ ⛔ (το μητρώο ξέρει ΚΑΘΕ γραφέα παρουσίας)', () => {
    const result = world({ 'src/server/tour/new-writer.ts': `export async function f(db, s) { await refreshListingAfterTourChange(db, s); }` });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_CALLER]);
  });

  it('Μ6 Κ3 — τρίτο αρχείο φτιάχνει το `tour` της αγγελίας ⇒ ⛔', () => {
    const result = world({ 'src/components/card.ts': `export const tourOf = (presence) => listedTourFromPresence(presence);` });
    expect(blockingStates(result)).toEqual([STATES.SECOND_BINDER]);
  });

  it('Μ7 Κ4 — εξαίρεση χωρίς πραγματικό λόγο ⇒ ⛔', () => {
    expect(blockingStates(world({}, registryWith({ exemptWriters: { [GENESIS]: 'δεν πειράζει' } })))).toEqual([STATES.EXEMPT_NO_REASON]);
  });

  it('Μ8 Κ4 — εξαίρεση για αρχείο που δεν γράφει πια ⇒ ⛔ νεκρή γραμμή', () => {
    expect(blockingStates(world({ [GENESIS]: 'export const nothing = 1;' }))).toEqual([STATES.STALE_EXEMPTION]);
  });

  it('Μ9 — δηλωμένο αρχείο που δεν υπάρχει ⇒ ⛔ source-drift', () => {
    expect(blockingStates(world({ [SETTINGS]: null }))).toEqual([STATES.SOURCE_DRIFT]);
  });

  it('η εξαίρεση ΔΕΝ απαλλάσσει από το Κ2: εξαιρούμενο αρχείο που καλεί τον δρόμο είναι αδήλωτος καλών', () => {
    const result = world({ [GENESIS]: `export async function ensure(db, tourRef, s) { await tourRef.create(doc); await refreshListingAfterTourChange(db, s); }` });
    expect(blockingStates(result)).toEqual([STATES.UNDECLARED_CALLER]);
  });
});
