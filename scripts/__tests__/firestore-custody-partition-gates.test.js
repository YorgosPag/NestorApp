/**
 * @fileoverview Άγκυρα: οι πύλες Firestore ΒΛΕΠΟΥΝ τα διαμερίσματα κατόχου (ADR-866 §2.6.7).
 *
 * 🔴 Ένα σύστημα με δύο διαμερίσματα (εταιρεία · άνθρωπος) διαλέγει συλλογή με `X[kind]`
 * (`AUDIT_LEDGER_COLLECTION[ledger]`, `FILE_COLLECTION[kind]`). Ως τις 2026-09-17 οι CHECK 3.15
 * (δείκτες) και 3.35 (φίλτρο μισθωτή) δέχονταν ΜΟΝΟ literal ⇒ το σημείο γινόταν `unanalyzable`
 * και ΔΕΝ μετρούσε: τα ερωτήματα του προσωπικού βιβλίου ιστορικού δεν ελέγχθηκαν ποτέ. Εδώ
 * αποδεικνύεται ότι το σημείο **διπλασιάζεται** σε έναν κλάδο ανά κάτοχο, και ότι κάθε κλάδος
 * κρίνεται όπως literal — ΚΑΙ στο «πυροδοτεί» ΚΑΙ στο «σιωπά».
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadCustodyPartitions, loadTenantOverrides } = require('../_shared/firestore-ast-loaders');
const { createScanContext, scanFile } = require('../_shared/firestore-tenant-scope-scan');
const { deriveShapes, extractCallSitesFromFile } = require('../check-firestore-index-coverage');

const LEDGER_KEYS = ['ENTITY_AUDIT_TRAIL', 'ENTITY_AUDIT_TRAIL_PERSONAL'];

let tmp;
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'custody-partition-')); });
afterAll(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

/** Γράψε ένα προσωρινό αρχείο και δώσε τη διαδρομή του. */
function write(name, text) {
  const file = path.join(tmp, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

describe('ο κατάλογος διαμερισμάτων', () => {
  it('ανακαλύπτει στο ΠΡΑΓΜΑΤΙΚΟ δέντρο το διαμέρισμα του ιστορικού, με σειρά κλάδων company → personal', () => {
    expect(loadCustodyPartitions().get('AUDIT_LEDGER_COLLECTION')).toEqual(LEDGER_KEYS);
  });

  it('αγνοεί δήλωση χωρίς `satisfies CustodyPartition` ή με κλάδο που λείπει', () => {
    const root = path.join(tmp, 'lib-root');
    write('lib-root/a.ts', "export const A = { company: 'X', personal: 'Y' } as const satisfies CustodyPartition;");
    write('lib-root/b.ts', "export const B = { company: 'X', personal: 'Y' } as const;");
    write('lib-root/c.ts', "export const C = { company: 'X' } as const satisfies CustodyPartition;");
    expect([...loadCustodyPartitions(root).entries()]).toEqual([['A', ['X', 'Y']]]);
  });
});

describe('CHECK 3.15 — ένα σημείο ανά κλάδο', () => {
  const client = (importLine, key) => `
${importLine}
import { firestoreQueryService } from '@/services/firestore';
export function listen(kind) {
  return firestoreQueryService.subscribe(${key}, () => {}, () => {}, {
    constraints: [where('entityType', '==', 't'), orderBy('timestamp', 'desc')],
  });
}`;

  it('`X[kind]` ⇒ ΔΥΟ σημεία, ένα ανά κάτοχο, με τα ίδια φίλτρα', () => {
    const file = write('c1.ts', client("import { AUDIT_LEDGER_COLLECTION } from '@/lib/audit/audit-ledger';", 'AUDIT_LEDGER_COLLECTION[kind]'));
    const sites = extractCallSitesFromFile(file);
    expect(sites.map((s) => s.collectionKey)).toEqual(LEDGER_KEYS);
    for (const s of sites) {
      expect(s.warnings).toEqual([]);
      expect(s.equalityFields).toEqual(['entityType']);
    }
  });

  it('και με ψευδώνυμο εισαγωγής', () => {
    const file = write('c2.ts', client("import { AUDIT_LEDGER_COLLECTION as L } from '@/lib/audit/audit-ledger';", 'L[kind]'));
    expect(extractCallSitesFromFile(file).map((s) => s.collectionKey)).toEqual(LEDGER_KEYS);
  });

  it('✅ άγνωστο δυναμικό κλειδί μένει ΕΝΑ `unanalyzable` — ποτέ εφεύρεση κλάδων', () => {
    const file = write('c3.ts', client('', 'SOMETHING[kind]'));
    const sites = extractCallSitesFromFile(file);
    expect(sites).toHaveLength(1);
    expect(sites[0].warnings.join()).toMatch(/unanalyzable/);
  });

  it('παραλλαγή super_admin ΜΟΝΟ όπου η υπηρεσία μπορεί να αφήσει το φίλτρο (όχι στο `userId`)', () => {
    const collections = new Map([['ENTITY_AUDIT_TRAIL', 'entity_audit_trail'], ['ENTITY_AUDIT_TRAIL_PERSONAL', 'entity_audit_trail_personal']]);
    const site = (collectionKey) => ({
      file: 'x.ts', line: 1, column: 1, methodName: 'subscribe', collectionKey,
      equalityFields: ['entityType'], orderBy: [], arrayContainsField: null, tenantSkipped: false, warnings: [],
    });
    const variants = (key) => deriveShapes(site(key), collections, loadTenantOverrides()).map((s) => s.variant);
    expect(variants('ENTITY_AUDIT_TRAIL')).toEqual(['default', 'super_admin']);
    expect(variants('ENTITY_AUDIT_TRAIL_PERSONAL')).toEqual(['default']);
  });
});

describe('CHECK 3.35 — κάθε κλάδος κρίνεται με το ΔΙΚΟ του πεδίο κατόχου', () => {
  const ctx = createScanContext();
  const statuses = (file) => scanFile(file, ctx)
    .filter((s) => s.rule === 'R2-admin')
    .map((s) => [s.collectionKey, s.status]);

  it('⛔ χωρίς φίλτρο κατόχου ⇒ παράβαση ΚΑΙ στους δύο κλάδους', () => {
    const file = write('s1.ts', `
import { AUDIT_LEDGER_COLLECTION } from '@/lib/audit/audit-ledger';
export const q = (db, kind) => db.collection(COLLECTIONS[AUDIT_LEDGER_COLLECTION[kind]]).where('entityId', '==', 'x');`);
    expect(statuses(file)).toEqual([[LEDGER_KEYS[0], 'violation'], [LEDGER_KEYS[1], 'violation']]);
  });

  it('φίλτρο `userId` σώζει ΜΟΝΟ τον προσωπικό κλάδο — μέσω τοπικής μεταβλητής', () => {
    const file = write('s2.ts', `
import { AUDIT_LEDGER_COLLECTION } from '@/lib/audit/audit-ledger';
export function q(db, kind, uid) {
  const collection = COLLECTIONS[AUDIT_LEDGER_COLLECTION[kind]];
  return db.collection(collection).where('userId', '==', uid);
}`);
    expect(statuses(file)).toEqual([[LEDGER_KEYS[0], 'violation'], [LEDGER_KEYS[1], 'ok']]);
  });
});
