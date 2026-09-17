/**
 * @fileoverview Άγκυρα: η πύλη κάλυψης δεικτών (CHECK 3.15) ξέρει τους ΔΡΟΜΟΥΣ ανάγνωσης
 * (ADR-862 Φ0 Β11).
 *
 * 🔴 Το `firestoreQueryService` τρέχει ΕΝΑ ερώτημα ανά δρόμο (`cdeReadReach ==` ή
 * `createdBy ==`). Αν η πύλη αγνοούσε τους δρόμους, ερώτημα `files` με `orderBy` θα περνούσε
 * πράσινο ενώ στην παραγωγή θα έπεφτε σε `FAILED_PRECONDITION` — «0 = κανείς δεν κοίταξε».
 */

'use strict';

const { loadReadPathFields, loadTenantOverrides } = require('../_shared/firestore-ast-loaders');
const { deriveShapes } = require('../check-firestore-index-coverage');

/** Σημείο κλήσης όπως το εξάγει η πύλη — εδώ του `useFloorplanFiles`. */
function site(collectionKey) {
  return {
    file: 'x.ts',
    line: 1,
    column: 1,
    methodName: 'subscribe',
    collectionKey,
    equalityFields: ['entityType', 'entityId'],
    orderBy: [{ field: 'createdAt', direction: 'DESCENDING' }],
    arrayContainsField: null,
    tenantSkipped: false,
    warnings: [],
  };
}

const COLLECTIONS = new Map([
  ['FILES', 'files'],
  ['PROJECTS', 'projects'],
]);

describe('CHECK 3.15 × δρόμοι ανάγνωσης', () => {
  it('ο loader διαβάζει τα πεδία από το ΠΡΑΓΜΑΤΙΚΟ read-scope-config', () => {
    expect(loadReadPathFields().get('FILES')).toEqual(['cdeReadReach', 'createdBy']);
  });

  it('files: κάθε παραλλαγή μισθωτή × κάθε δρόμος ⇒ 4 σχήματα, ΚΑΘΕ ένα με το πεδίο του δρόμου', () => {
    const shapes = deriveShapes(site('FILES'), COLLECTIONS, loadTenantOverrides(), loadReadPathFields());
    expect(shapes.map((s) => s.variant)).toEqual([
      'default+cdeReadReach',
      'default+createdBy',
      'super_admin+cdeReadReach',
      'super_admin+createdBy',
    ]);
    for (const shape of shapes) {
      expect(shape.equalityFields[0]).toBe(shape.variant.split('+')[1]);
    }
  });

  it('συλλογή χωρίς δρόμους: οι δύο παραλλαγές μισθωτή, όπως πριν', () => {
    const shapes = deriveShapes(site('PROJECTS'), COLLECTIONS, loadTenantOverrides(), loadReadPathFields());
    expect(shapes.map((s) => s.variant)).toEqual(['default', 'super_admin']);
  });
});
