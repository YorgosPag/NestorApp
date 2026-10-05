/**
 * ⚓ ΑΓΚΥΡΑ: ΜΗΤΡΩΟ ΔΙΑΓΡΑΦΗΣ ↔ ΕΠΙΜΕΤΡΗΣΕΙΣ (ADR-329 §3.9 · ADR-226)
 *
 * Η αστοχία που φυλά είναι **σιωπηλή**: το μητρώο ρωτούσε τις επιμετρήσεις με
 * `linkedPropertyId`, πεδίο που καμία επιμέτρηση δεν έχει. Το ερώτημα επέστρεφε πάντα μηδέν,
 * ο φύλακας απαντούσε «επιτρέπεται», και ακίνητο με επιμετρήσεις στον κάδο θα σβηνόταν
 * οριστικά στην προθεσμία. Κανένα σφάλμα, κανένα κόκκινο log.
 *
 * Γι' αυτό τα ονόματα πεδίων **δένονται στη δήλωση του τύπου**, όχι σε αντίγραφό τους εδώ.
 *
 * @module config/__tests__/deletion-registry-boq.test
 */

import fs from 'fs';
import path from 'path';

import { DELETION_REGISTRY } from '@/config/deletion-registry';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { BOQItem } from '@/types/boq';

/** Τα πεδία με τα οποία μια επιμέτρηση δείχνει σε ακίνητο — δεμένα στον τύπο από τον compiler. */
const PROPERTY_LINK_FIELDS: ReadonlyArray<keyof BOQItem> = ['linkedUnitId', 'linkedUnitIds'];

const BOQ_TYPE_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'src', 'types', 'boq', 'boq.ts'),
  'utf8',
);

const boqDependencies = DELETION_REGISTRY.property.dependencies.filter(
  (dep) => dep.collection === COLLECTIONS.BOQ_ITEMS,
);

describe('μητρώο διαγραφής ↔ επιμετρήσεις (ADR-329 §3.9)', () => {
  it('🔴 ρωτά τις επιμετρήσεις με ΚΑΘΕ πεδίο που δείχνει σε ακίνητο', () => {
    expect(boqDependencies.map((dep) => dep.foreignKey).sort()).toEqual(
      [...PROPERTY_LINK_FIELDS].sort(),
    );
  });

  it('🔴 κάθε πεδίο του μητρώου ΥΠΑΡΧΕΙ στη δήλωση του BOQItem', () => {
    for (const dep of boqDependencies) {
      expect(BOQ_TYPE_SOURCE).toMatch(new RegExp(`^\\s*${dep.foreignKey}\\??:`, 'm'));
    }
  });

  it('το μονό πεδίο ρωτιέται με ισότητα, ο πίνακας με array-contains', () => {
    const queryTypeOf = (field: keyof BOQItem) =>
      boqDependencies.find((dep) => dep.foreignKey === field)?.queryType;

    expect(queryTypeOf('linkedUnitId')).toBe('equals');
    expect(queryTypeOf('linkedUnitIds')).toBe('array-contains');
  });

  it('οι επιμετρήσεις ΜΠΛΟΚΑΡΟΥΝ — δεν σβήνονται μαζί με το ακίνητο', () => {
    const cascaded = (DELETION_REGISTRY.property.cascadeDependencies ?? []).filter(
      (dep) => dep.collection === COLLECTIONS.BOQ_ITEMS,
    );

    expect(cascaded).toEqual([]);
  });
});
