/**
 * @fileoverview Άγκυρα: CHECK 3.91 — δείκτες για τα ερωτήματα **έξω** από το SSoT (ADR-870).
 *
 * 🔴 ΤΙ ΦΥΛΑΕΙ. Μέχρι τις 2026-09-21 κάθε `adminDb.collection(X).where('t','>=',v)` ήταν
 * **αόρατο** σε κάθε πύλη. Μετρήθηκαν **5** ακάλυπτα ερωτήματα με εύρος, **και τα 5**
 * επιβεβαιωμένα ζωντανά με `FAILED_PRECONDITION` — σε cron jobs και API routes, όπου κανένα
 * UI δεν θα το έδειχνε ποτέ.
 *
 * ⚠️ Η άγκυρα **ΕΚΤΕΛΕΙ** τον αναλυτή και τον κριτή σε πραγματικό κώδικα· δεν διαβάζει τα
 * σχόλιά τους. Και η ομάδα 4 **σπάει** επίτηδες τα modules και απαιτεί κόκκινο (CHECK 3.54):
 * μια άγκυρα που δεν μπορεί να κοκκινίσει δεν είναι άγκυρα, είναι σχόλιο (ADR-587 §6.1).
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { withMutation } = require('./_mutate');

const CHAIN_MODULE = path.join(__dirname, '..', '_shared', 'firestore-query-chain.js');
const MATCHER_MODULE = path.join(__dirname, '..', '_shared', 'firestore-index-matcher.js');

const {
  createChainContext, scanFileChains, enumerateBranches, toQueryShape,
} = require(CHAIN_MODULE);
const { requiredIndexFor, findCoveringIndexes } = require(MATCHER_MODULE);
const { judgeSite } = require('../check-firestore-admin-index');

let dir;
beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-idx-')); });
afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); });

/** Γράψε πηγαίο κώδικα σε προσωρινό αρχείο και σάρωσέ τον με τον ΠΡΑΓΜΑΤΙΚΟ αναλυτή. */
function scan(name, source, ctx = createChainContext()) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, source, 'utf8');
  return scanFileChains(file, ctx);
}

/** Όλα τα σχήματα ενός σημείου, ένα ανά συνδυασμό κλάδων. */
function shapesOf(site) {
  const { combos } = enumerateBranches(site.clauses);
  return combos.map((combo) => toQueryShape(site.collectionName, combo));
}

const idx = (collection, ...fields) => ({
  collectionGroup: collection,
  queryScope: 'COLLECTION',
  fields: fields.map((f) => (f.endsWith('↓')
    ? { fieldPath: f.slice(0, -1), order: 'DESCENDING' }
    : { fieldPath: f.replace(/↑$/, ''), order: 'ASCENDING' })),
});

// ---------------------------------------------------------------------------

describe('1. 🔴 Η ΤΕΤΑΡΤΗ ΤΥΦΛΗ ΜΟΡΦΗ — ρίζα δεμένη σε όνομα', () => {
  it('βλέπει τα φίλτρα όταν η συλλογή δέθηκε σε όνομα και τα where μπήκαν ΑΛΛΟΥ', () => {
    // Ο πραγματικός κώδικας του `api/calendar/reminders/route.ts`. Το CHECK 3.35 τον
    // κατατάσσει «χωρίς where() — δεν είναι list query». Είναι list query, και φιλτράρει.
    const [site] = scan('bound-root.ts', `
      export async function run(adminDb) {
        const tasksRef = adminDb.collection('tasks');
        const snapshot = await tasksRef
          .where('reminderDate', '<=', now)
          .where('reminderSent', '!=', true)
          .limit(50)
          .get();
        return snapshot;
      }
    `);
    expect(site).toBeDefined();
    expect(site.collectionName).toBe('tasks');
    const [shape] = shapesOf(site);
    expect(shape.rangeFields.sort()).toEqual(['reminderDate', 'reminderSent']);
  });

  it('ξετυλίγει το `as FirebaseFirestore.Query` — αλλιώς η ρίζα χάνεται σιωπηλά', () => {
    const [site] = scan('as-cast.ts', `
      export async function run(db) {
        let query = db.collection('rfqs').where('companyId', '==', c) as FirebaseFirestore.Query;
        const snap = await query.orderBy('createdAt', 'desc').get();
        return snap;
      }
    `);
    expect(site.collectionName).toBe('rfqs');
    const [shape] = shapesOf(site);
    expect(shape.equalityFields).toEqual(['companyId']);
    expect(shape.orderBy).toEqual([{ field: 'createdAt', direction: 'DESCENDING' }]);
  });

  it('το `count().get()` είναι ΕΝΑ ερώτημα, όχι δύο', () => {
    const sites = scan('count-get.ts', `
      export async function run(db) {
        const q = db.collection('conversations').where('companyId', '==', c);
        const total = await q.count().get();
        return total;
      }
    `);
    expect(sites).toHaveLength(1);
  });
});

describe('2. 🔴 ΚΛΑΔΟΙ — ποτέ ερώτημα που κανείς δεν τρέχει', () => {
  const IF_ELSE = `
    export async function run(db, filters) {
      let query = db.collection('sourcing_events').where('companyId', '==', c);
      if (filters.status) {
        query = query.where('status', '==', filters.status);
      } else {
        query = query.where('status', '!=', 'archived');
      }
      const snap = await query.orderBy('createdAt', 'desc').get();
      return snap;
    }
  `;

  it('το if/else παράγει ΔΥΟ σχήματα — ποτέ ένα με «status== ΚΑΙ status!=»', () => {
    const [site] = scan('if-else.ts', IF_ELSE);
    const shapes = shapesOf(site);
    expect(shapes).toHaveLength(2);
    const both = shapes.find((s) => s.equalityFields.includes('status') && s.rangeFields.includes('status'));
    expect(both).toBeUndefined();
  });

  it('προαιρετικό φίλτρο ⇒ ΚΑΙ ο κλάδος «χωρίς αυτό» κρίνεται', () => {
    const [site] = scan('optional.ts', `
      export async function run(db, filters) {
        let q = db.collection('accounting_audit_log').where('companyId', '==', c);
        if (filters.entityType) q = q.where('entityType', '==', filters.entityType);
        const snap = await q.orderBy('timestamp', 'desc').get();
        return snap;
      }
    `);
    const shapes = shapesOf(site).map((s) => s.equalityFields.slice().sort().join(','));
    expect(shapes.sort()).toEqual(['companyId', 'companyId,entityType']);
  });
});

describe('3. Ο ΒΟΗΘΟΣ ΜΙΣΘΩΤΗ ΕΙΝΑΙ ΡΙΖΑ — και βάζει ΔΥΟ παραλλαγές', () => {
  it('`tenantScopedCollection` ⇒ σχήμα με companyId ΚΑΙ σχήμα χωρίς (super admin)', () => {
    const [site] = scan('tenant-root.ts', `
      import { tenantScopedCollection } from '@/lib/firestore/tenant-scoped-query';
      export async function run(scope) {
        const snapshot = await tenantScopedCollection('properties', scope)
          .where('status', '!=', 'deleted')
          .get();
        return snapshot;
      }
    `);
    expect(site.collectionName).toBe('properties');
    const variants = shapesOf(site).map((s) => s.equalityFields.join(','));
    expect(variants.sort()).toEqual(['', 'companyId']);
  });
});

describe('4. ΚΑΛΥΨΗ — ο κριτής εφαρμόζεται στο ΠΡΑΓΜΑΤΙΚΟ σχήμα', () => {
  it('🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: δείκτες ΧΩΡΙΣ companyId δεν καλύπτουν ερώτημα που ΠΑΝΤΑ το βάζει', () => {
    // Το `accounting_audit_log` είχε ακριβώς αυτούς τους τρεις δείκτες, και το σχόλιο του
    // κώδικα συμφωνούσε μαζί τους. Ο κώδικας πρόσθετε `companyId` σε κάθε κλήση.
    const [site] = scan('audit-real.ts', `
      export async function run(db, tenant, filters) {
        let query = db.collection('accounting_audit_log');
        query = query.where('companyId', '==', tenant.companyId);
        if (filters.eventType) query = query.where('eventType', '==', filters.eventType);
        query = query.orderBy('timestamp', 'desc');
        const snap = await query.get();
        return snap;
      }
    `);
    const stale = new Map([['accounting_audit_log', [
      idx('accounting_audit_log', 'entityType', 'entityId', 'timestamp↓'),
      idx('accounting_audit_log', 'eventType', 'timestamp↓'),
      idx('accounting_audit_log', 'userId', 'timestamp↓'),
    ]]]);
    expect(judgeSite(site, stale).missing.length).toBeGreaterThan(0);

    // 🔑 Η ΘΕΡΑΠΕΙΑ ΤΗΣ ΣΥΓΧΩΝΕΥΣΗΣ: ΕΝΑΣ δείκτης ανά πεδίο, κοινή ουρά ⇒ όλοι οι κλάδοι.
    const fixed = new Map([['accounting_audit_log', [
      ...stale.get('accounting_audit_log'),
      idx('accounting_audit_log', 'companyId', 'timestamp↓'),
    ]]]);
    expect(judgeSite(site, fixed).missing).toHaveLength(0);
  });

  it('η συγχώνευση σταματά εκεί που σταμάτησε και ζωντανά: πεδίο χωρίς δικό του δείκτη', () => {
    const shape = {
      collection: 'audit_logs',
      equalityFields: ['action', 'actorType'],
      orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
      arrayContainsField: null,
      rangeFields: [],
      variant: 'admin',
    };
    const catalog = new Map([['audit_logs', [idx('audit_logs', 'action', 'timestamp↓')]]]);
    expect(findCoveringIndexes(catalog, shape)).toBeNull();
  });
});

describe('5. 🧬 MUTATION TESTING — σπάμε τα modules και απαιτούμε κόκκινο', () => {
  /**
   * 🔴 ΔΥΟ ΠΑΓΙΔΕΣ ΠΟΥ ΠΑΡΑΓΟΥΝ ΨΕΥΤΙΚΑ «ΣΚΟΤΩΜΕΝΕΣ»:
   *  1. Ο στόχος δεν ταιριάζει (CRLF, ασάφεια) ⇒ το `_mutate` ουρλιάζει με όνομα.
   *  2. Το Jest έχει **δικό του** module registry — `resetModules` + `isolateModules`.
   */
  function withBroken(targetFile, from, to, run) {
    let result;
    try {
      withMutation(targetFile, from, to, (mutated) => {
        jest.resetModules();
        jest.isolateModules(() => {
          expect(fs.readFileSync(targetFile, 'utf8')).toBe(mutated);
          result = run({
            chain: require(CHAIN_MODULE),
            matcher: require(MATCHER_MODULE),
          });
        });
      });
    } finally {
      jest.resetModules();
    }
    return result;
  }

  const rescan = (chain, name, source) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source, 'utf8');
    return chain.scanFileChains(file, chain.createChainContext());
  };

  it('Μ0 (μετα-έλεγχος): η μετάλλαξη ΟΝΤΩΣ φτάνει στη μνήμη', () => {
    // Αν ΑΥΤΟ περάσει χωρίς να δούμε την ετικέτα, όλες οι μεταλλάξεις είναι διακοσμητικές.
    const variant = withBroken(CHAIN_MODULE, "variant = 'admin'", "variant = 'ΜΕΤΑΛΛΑΓΜΕΝΟ'",
      ({ chain }) => chain.toQueryShape('x', []).variant);
    expect(variant).toBe('ΜΕΤΑΛΛΑΓΜΕΝΟ');
  });

  it('Μ1: αν το `get` πάψει να είναι τερματικό, ΚΑΝΕΝΑ ερώτημα δεν βρίσκεται', () => {
    const sites = withBroken(CHAIN_MODULE,
      "const TERMINALS = new Set(['get', 'stream', 'onSnapshot']);",
      "const TERMINALS = new Set(['stream', 'onSnapshot']);",
      ({ chain }) => rescan(chain, 'mut-terminal.ts', `
        export async function run(db) {
          const s = await db.collection('tasks').where('a', '<=', 1).get();
          return s;
        }
      `));
    expect(sites).toHaveLength(0);              // ⇐ η πύλη θα τύφλωνε ολοκληρωτικά
  });

  it('Μ2: αν οι κλάδοι συγχωνευθούν, παράγεται ερώτημα που ΚΑΝΕΙΣ δεν τρέχει', () => {
    const shapes = withBroken(CHAIN_MODULE,
      'const options = g.hasElse && g.else.length > 0 ? [g.then, g.else] : [g.then, []];',
      'const options = [[...g.then, ...g.else]];',
      ({ chain }) => {
        const [site] = rescan(chain, 'mut-branch.ts', `
          export async function run(db, filters) {
            let q = db.collection('sourcing_events').where('companyId', '==', c);
            if (filters.status) { q = q.where('status', '==', filters.status); }
            else { q = q.where('status', '!=', 'archived'); }
            const s = await q.get();
            return s;
          }
        `);
        const { combos } = chain.enumerateBranches(site.clauses);
        return combos.map((combo) => chain.toQueryShape(site.collectionName, combo));
      });
    expect(shapes).toHaveLength(1);
    expect(shapes[0].equalityFields).toContain('status');
    expect(shapes[0].rangeFields).toContain('status');   // ⇐ αδύνατο ερώτημα
  });

  it('Μ3: αν το πεδίο εύρους πάψει να μπαίνει στον δείκτη, ζητείται ΛΑΘΟΣ δείκτης', () => {
    const required = withBroken(MATCHER_MODULE,
      "    tail.push({ fieldPath: rangeField, order: lastDirection });",
      "    void lastDirection;",
      ({ matcher }) => matcher.requiredIndexFor({
        collection: 'files',
        equalityFields: ['isDeleted'],
        orderBy: [],
        arrayContainsField: null,
        rangeFields: ['purgeAt'],
        variant: 'admin',
      }));
    // Ακριβώς η βλάβη του ADR-869: κρίνεται η ΠΡΟΒΟΛΗ ΙΣΟΤΗΤΩΝ ενός άλλου ερωτήματος.
    expect(required.status).toBe('free');
  });

  it('Μ4: αν η συγχώνευση δεχτεί όποιον δείκτη βρει, «καλύπτεται» ό,τι ΣΚΑΕΙ ζωντανά', () => {
    const cover = withBroken(MATCHER_MODULE,
      '    const hit = list.find((idx) => indexStartsWithFields(idx, want, required));',
      '    const hit = list[0];',
      ({ matcher }) => matcher.findCoveringIndexes(
        new Map([['audit_logs', [idx('audit_logs', 'action', 'timestamp↓')]]]),
        {
          collection: 'audit_logs',
          equalityFields: ['action', 'actorType'],
          orderBy: [{ field: 'timestamp', direction: 'DESCENDING' }],
          arrayContainsField: null,
          rangeFields: [],
          variant: 'admin',
        },
      ));
    expect(cover).not.toBeNull();               // ⇐ ψευδές πράσινο· ζωντανά FAILED_PRECONDITION
    expect(cover.mode).toBe('merge');
  });

  it('ΜΕΤΑ ΤΙΣ ΜΕΤΑΛΛΑΞΕΙΣ: τα modules επανήλθαν και η κρίση ξαναλειτουργεί', () => {
    const required = requiredIndexFor({
      collection: 'files',
      equalityFields: ['isDeleted'],
      orderBy: [],
      arrayContainsField: null,
      rangeFields: ['purgeAt'],
      variant: 'admin',
    });
    expect(required.status).toBe('required');
    expect(required.fields.map((f) => f.fieldPath)).toEqual(['isDeleted', 'purgeAt']);
    expect(scan('after-mutations.ts', `
      export async function run(db) {
        const s = await db.collection('tasks').where('a', '<=', 1).get();
        return s;
      }
    `)).toHaveLength(1);
  });
});
