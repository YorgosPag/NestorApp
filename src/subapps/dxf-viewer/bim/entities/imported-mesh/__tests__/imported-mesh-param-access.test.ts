/**
 * ADR-683 Φ3.1γ (A1) — `imported-mesh-param-access` read/patch SSoT.
 *
 * Η αστοχία εδώ δεν σπάει τίποτα ορατό αμέσως: ο ribbon bridge και το Properties palette θα
 * διάβαζαν/έγραφαν τιμές μέσα από αυτό το ΕΝΑ σημείο — ένα λάθος εδώ διαφθείρει και τα δύο ταυτόχρονα
 * (ο ADR-449 bug class). Τα tests καρφώνουν: read-only keys ΠΟΤΕ δεν γράφονται (§3 — μετρημένη
 * γεωμετρία, όχι authored), immutability (καμία μετάλλαξη του αρχικού `params`), και `null`-means-
 * absent για τα προαιρετικά πεδία (ποτέ κενό string σαν να υπάρχει τιμή).
 */

import { readImportedMeshField, patchImportedMeshField } from '../imported-mesh-param-access';
import {
  IMPORTED_MESH_NUMBER_KEYS as N,
  IMPORTED_MESH_READONLY_KEYS as R,
  IMPORTED_MESH_STRING_KEYS as S,
  isImportedMeshRibbonKey,
  isImportedMeshRibbonStringKey,
  isAnyImportedMeshRibbonKey,
} from '../imported-mesh-param-keys';
import type { ImportedMeshParams } from '../imported-mesh-types';

/** Κάγκελο εισαγόμενο — ανοιχτό πλέγμα, χωρίς BOQ ταυτότητα, χωρίς slots. */
const baseParams: ImportedMeshParams = {
  kind: 'imported',
  uploadId: 'imesh_upload',
  nodeName: 'Rail_01',
  storagePath: 'projects/p1/imported-meshes/imesh_upload.glb',
  sourceFileName: 'Συνεργάτης.glb',
  position: { x: 100, y: 250, z: 0 },
  rotationDeg: 45,
  measuredWidthMm: 2000.4,
  measuredDepthMm: 100.6,
  measuredHeightMm: 1000,
  measuredSurfaceAreaM2: 4,
  measuredVolumeM3: null,
  mountingElevationMm: 300,
};

/** Ίδιο πλέγμα, πλήρως ανατεθειμένο + πολλαπλά υλικά — καλύπτει τα «παρόντα optional» μονοπάτια. */
const assignedParams: ImportedMeshParams = {
  ...baseParams,
  storeyId: 'floor_1',
  sourceMaterialName: 'Inox_304',
  materialSlots: ['Inox_304', 'Wood_Oak'],
  importedMeshIdentity: {
    categoryCode: 'OIK-3.1',
    unit: 'm',
    titleEL: 'Κάγκελο inox',
  },
};

describe('readImportedMeshField — writable numeric fields', () => {
  it('διαβάζει position.x / position.y / rotationDeg / mountingElevationMm ως string', () => {
    expect(readImportedMeshField(N.posX, baseParams)).toBe('100');
    expect(readImportedMeshField(N.posY, baseParams)).toBe('250');
    expect(readImportedMeshField(N.rotation, baseParams)).toBe('45');
    expect(readImportedMeshField(N.elevation, baseParams)).toBe('300');
  });
});

describe('readImportedMeshField — read-only measured/identity fields', () => {
  it('στρογγυλεύει τις μετρημένες διαστάσεις (mm) για εμφάνιση', () => {
    expect(readImportedMeshField(R.width, baseParams)).toBe('2000');
    expect(readImportedMeshField(R.depth, baseParams)).toBe('101');
    expect(readImportedMeshField(R.height, baseParams)).toBe('1000');
  });

  it('name = nodeName (ταυτότητα κόμβου .glb, όχι επεξεργάσιμη ετικέτα)', () => {
    expect(readImportedMeshField(R.name, baseParams)).toBe('Rail_01');
  });

  it('προαιρετικά πεδία ΑΠΟΝΤΑ → null, ΠΟΤΕ κενό string', () => {
    expect(readImportedMeshField(R.level, baseParams)).toBeNull();
    expect(readImportedMeshField(R.currentMaterial, baseParams)).toBeNull();
    expect(readImportedMeshField(R.materialSlots, baseParams)).toBeNull();
    expect(readImportedMeshField(R.boqCategoryCode, baseParams)).toBeNull();
    expect(readImportedMeshField(R.boqTitle, baseParams)).toBeNull();
    expect(readImportedMeshField(R.boqUnit, baseParams)).toBeNull();
  });

  it('προαιρετικά πεδία ΠΑΡΟΝΤΑ → η πραγματική τιμή (level/material/slots/boq)', () => {
    expect(readImportedMeshField(R.level, assignedParams)).toBe('floor_1');
    expect(readImportedMeshField(R.currentMaterial, assignedParams)).toBe('Inox_304');
    expect(readImportedMeshField(R.materialSlots, assignedParams)).toBe('Inox_304, Wood_Oak');
    expect(readImportedMeshField(R.boqCategoryCode, assignedParams)).toBe('OIK-3.1');
    expect(readImportedMeshField(R.boqTitle, assignedParams)).toBe('Κάγκελο inox');
    expect(readImportedMeshField(R.boqUnit, assignedParams)).toBe('m');
  });
});

describe('readImportedMeshField — displayName (ADR-683 Φ3.1γ follow-up)', () => {
  it('χωρίς label → fallback στο nodeName', () => {
    expect(readImportedMeshField(S.displayName, baseParams)).toBe('Rail_01');
  });

  it('με label → η επεξεργάσιμη ετικέτα, όχι το nodeName', () => {
    const named: ImportedMeshParams = { ...baseParams, label: 'Κάγκελο βεράντας' };
    expect(readImportedMeshField(S.displayName, named)).toBe('Κάγκελο βεράντας');
  });
});

describe('readImportedMeshField — άγνωστο κλειδί', () => {
  it('επιστρέφει null για key εκτός σχήματος', () => {
    expect(readImportedMeshField('not-a-real-key', baseParams)).toBeNull();
  });
});

describe('patchImportedMeshField — writable numeric keys', () => {
  it('posX/posY γράφουν μέσα στο position, χωρίς να αγγίζουν το z', () => {
    const next = patchImportedMeshField(N.posX, baseParams, '500');
    expect(next.position).toEqual({ x: 500, y: 250, z: 0 });
    expect(next).not.toBe(baseParams);
  });

  it('rotation γράφει το rotationDeg', () => {
    const next = patchImportedMeshField(N.rotation, baseParams, '90');
    expect(next.rotationDeg).toBe(90);
  });

  it('elevation γράφει το mountingElevationMm — ΔΕΝ αγγίζει position.z (βλ. σχόλιο SSoT)', () => {
    const next = patchImportedMeshField(N.elevation, baseParams, '750');
    expect(next.mountingElevationMm).toBe(750);
    expect(next.position.z).toBe(baseParams.position.z);
  });

  it('μη πεπερασμένη τιμή αγνοείται — επιστρέφει ΤΗΝ ΙΔΙΑ αναφορά', () => {
    expect(patchImportedMeshField(N.posX, baseParams, 'not-a-number')).toBe(baseParams);
    expect(patchImportedMeshField(N.rotation, baseParams, '')).toBe(baseParams);
  });

  it('ΠΟΤΕ δεν μεταλλάσσει το αρχικό params (immutability)', () => {
    const snapshot = { ...baseParams, position: { ...baseParams.position } };
    patchImportedMeshField(N.posY, baseParams, '999');
    expect(baseParams).toEqual(snapshot);
  });
});

describe('patchImportedMeshField — displayName (the ONE writable string key)', () => {
  it('γράφει το label (trim), αφήνει το nodeName άθικτο', () => {
    const next = patchImportedMeshField(S.displayName, baseParams, '  Κάγκελο βεράντας  ');
    expect(next.label).toBe('Κάγκελο βεράντας');
    expect(next.nodeName).toBe(baseParams.nodeName);
    expect(next).not.toBe(baseParams);
  });

  it('κενό/whitespace ΚΑΘΑΡΙΖΕΙ το label — το κλειδί ΛΕΙΠΕΙ, ΔΕΝ γίνεται undefined (Firestore-safe)', () => {
    const named: ImportedMeshParams = { ...baseParams, label: 'Παλιό όνομα' };
    const cleared = patchImportedMeshField(S.displayName, named, '   ');
    expect('label' in cleared).toBe(false);
  });

  it('καθάρισμα σε ήδη-ανώνυμο = no-op, ίδια αναφορά (ιδεμποτεντικό)', () => {
    expect(patchImportedMeshField(S.displayName, baseParams, '')).toBe(baseParams);
  });

  it('ίδια τιμή με το τρέχον label = no-op, ίδια αναφορά', () => {
    const named: ImportedMeshParams = { ...baseParams, label: 'Ίδιο' };
    expect(patchImportedMeshField(S.displayName, named, 'Ίδιο')).toBe(named);
  });

  it('ΠΟΤΕ δεν μεταλλάσσει το αρχικό params (immutability)', () => {
    const snapshot = { ...baseParams };
    patchImportedMeshField(S.displayName, baseParams, 'Νέο όνομα');
    expect(baseParams).toEqual(snapshot);
  });
});

describe('patchImportedMeshField — read-only keys are a no-op (§3: measured, not authored)', () => {
  it.each([
    ['name', R.name, 'Renamed_Node'],
    ['width', R.width, '9999'],
    ['depth', R.depth, '9999'],
    ['height', R.height, '9999'],
    ['level', R.level, 'floor_9'],
    ['currentMaterial', R.currentMaterial, 'Gold'],
    ['materialSlots', R.materialSlots, 'Gold, Silver'],
    ['boqCategoryCode', R.boqCategoryCode, 'OIK-9'],
    ['boqTitle', R.boqTitle, 'Hack'],
    ['boqUnit', R.boqUnit, 'kg'],
  ])('%s: επιστρέφει την ΙΔΙΑ αναφορά, καμία αλλαγή', (_label, key, value) => {
    expect(patchImportedMeshField(key, baseParams, value)).toBe(baseParams);
  });

  it('άγνωστο κλειδί: no-op, ίδια αναφορά', () => {
    expect(patchImportedMeshField('not-a-real-key', baseParams, '1')).toBe(baseParams);
  });
});

describe('guards — isImportedMeshRibbonKey / isImportedMeshRibbonStringKey / isAnyImportedMeshRibbonKey', () => {
  it('numeric writable keys περνούν ΜΟΝΟ το πρώτο guard', () => {
    for (const key of Object.values(N)) {
      expect(isImportedMeshRibbonKey(key)).toBe(true);
      expect(isImportedMeshRibbonStringKey(key)).toBe(false);
      expect(isAnyImportedMeshRibbonKey(key)).toBe(true);
    }
  });

  it('read-only keys περνούν ΜΟΝΟ το δεύτερο guard', () => {
    for (const key of Object.values(R)) {
      expect(isImportedMeshRibbonKey(key)).toBe(false);
      expect(isImportedMeshRibbonStringKey(key)).toBe(true);
      expect(isAnyImportedMeshRibbonKey(key)).toBe(true);
    }
  });

  it('displayName (writable string key) περνά ΜΟΝΟ το δεύτερο guard — ίδιο σχήμα με τα read-only', () => {
    expect(isImportedMeshRibbonKey(S.displayName)).toBe(false);
    expect(isImportedMeshRibbonStringKey(S.displayName)).toBe(true);
    expect(isAnyImportedMeshRibbonKey(S.displayName)).toBe(true);
  });

  it('άγνωστο κλειδί δεν περνά κανένα guard', () => {
    expect(isAnyImportedMeshRibbonKey('not-a-real-key')).toBe(false);
  });
});
