/**
 * @jest-environment node
 *
 * ADR-866 §5.2 σημείο 6 — **το χωνί της γέννησης** για κάτοχο «εταιρεία Ή άνθρωπος».
 *
 * Κάθε ανέβασμα περνά από το `buildPendingFileRecordData`. Αν εδώ ο κλάδος ανθρώπου γράψει
 * `companyId` ή **οποιοδήποτε** πεδίο θεματοφυλακής CDE, ο κανόνας `files_personal` αρνείται **κάθε**
 * προσωπικό ανέβασμα· αν ο εταιρικός χάσει το `cdeReadReach`, ο κανόνας `files` αρνείται **κάθε**
 * εταιρικό. Η λίστα των πεδίων CDE διαβάζεται από το **ίδιο** `firestore.rules` (μέσω του αναγνώστη
 * της CHECK 3.87) — ποτέ δεύτερη λίστα εδώ.
 */

import fs from 'fs';
import path from 'path';

import { buildPendingFileRecordData } from '@/services/file-record/file-record-core';
import type { BuildPendingFileRecordInput } from '@/services/file-record/file-record-core';
import { FILE_HOLD_FIELDS } from '@/lib/files/file-hold';

const { custodyFieldsOf } = require('../../../../scripts/check-cde-authority.js') as {
  custodyFieldsOf: (rulesText: string) => string[];
};

const RULES = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');
const CDE_CUSTODY_FIELDS = custodyFieldsOf(RULES);
/** ADR-864 §21 — η γέννηση ΔΕΝ φέρει δέσμευση (`holdBornAbsent()` στους κανόνες και των δύο διαμερισμάτων). */
const HOLD_FIELDS: readonly string[] = FILE_HOLD_FIELDS;

const COORDINATES = {
  createdBy: 'uid_owner',
  entityType: 'property',
  entityId: 'prop_1',
  domain: 'legal',
  category: 'contracts',
  originalFilename: 'τίτλος.pdf',
  contentType: 'application/pdf',
} as const;

describe('buildPendingFileRecordData — κάτοχος άνθρωπος', () => {
  const { recordBase, storagePath } = buildPendingFileRecordData({ ...COORDINATES, userId: 'uid_owner' });

  test('η λίστα CDE διαβάστηκε πράγματι από τους κανόνες (αλλιώς η άγκυρα θα ήταν κενή)', () => {
    expect(CDE_CUSTODY_FIELDS).toEqual(expect.arrayContaining(['cdeReadReach', 'cdeState', 'supersededByFileId']));
  });

  test('`userId` ⇒ ο κάτοχος · `pending` ⇒ ό,τι ζητά ο κανόνας create', () => {
    expect(recordBase.userId).toBe('uid_owner');
    expect(recordBase.status).toBe('pending');
  });

  test('ΚΑΝΕΝΑ `companyId` και ΚΑΝΕΝΑ πεδίο θεματοφυλακής CDE', () => {
    const keys = Object.keys(recordBase);
    expect(keys).not.toContain('companyId');
    for (const field of CDE_CUSTODY_FIELDS) expect(keys).not.toContain(field);
  });

  test('ΚΑΝΕΝΑ κλειδί δέσμευσης (ADR-864 §21 — αλλιώς ο κανόνας create αρνείται κάθε ανέβασμα)', () => {
    const keys = Object.keys(recordBase);
    for (const field of HOLD_FIELDS) expect(keys).not.toContain(field);
  });

  test('ρίζα Storage του ανθρώπου — `people/{uid}/`, ποτέ `companies/`', () => {
    expect(storagePath.startsWith('people/uid_owner/')).toBe(true);
  });
});

describe('buildPendingFileRecordData — κάτοχος εταιρεία (αμετάβλητο)', () => {
  const { recordBase, storagePath } = buildPendingFileRecordData({ ...COORDINATES, companyId: 'comp_1' });

  test('`companyId` + φράχτης γέννησης `tenant`, κανένα `userId`', () => {
    expect(recordBase.companyId).toBe('comp_1');
    expect(recordBase.cdeReadReach).toBe('tenant');
    expect(Object.keys(recordBase)).not.toContain('userId');
    for (const field of HOLD_FIELDS) expect(Object.keys(recordBase)).not.toContain(field);
    expect(storagePath.startsWith('companies/comp_1/')).toBe(true);
  });
});

describe('buildPendingFileRecordData — όχι ακριβώς ένας κάτοχος ⇒ άρνηση', () => {
  test.each([
    ['κενό userId', { ...COORDINATES, userId: '' }],
    ['κενό companyId', { ...COORDINATES, companyId: '' }],
  ])('%s', (_label, input) => {
    expect(() => buildPendingFileRecordData(input as BuildPendingFileRecordInput)).toThrow('Exactly one owner');
  });

  test('και τα δύο (παράκαμψη τύπου σε χρόνο εκτέλεσης)', () => {
    const both = { ...COORDINATES, companyId: 'comp_1', userId: 'uid_owner' } as unknown as BuildPendingFileRecordInput;
    expect(() => buildPendingFileRecordData(both)).toThrow('Exactly one owner');
  });
});
