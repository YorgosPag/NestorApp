/**
 * ADR-683 Φ3.1 — ταυτότητα → προμέτρηση (§10.2).
 *
 * Η αστοχία εδώ δεν σπάει τίποτα ορατό: παράγει **λάθος νούμερο στον προϋπολογισμό**. Οι τρεις
 * τρόποι να συμβεί, και τα tests που τους καρφώνουν:
 *   1. λάθος τάξη μεγέθους (mm αντί m) → κοστολόγηση ×1000·
 *   2. προσφορά m³ σε ανοιχτό πλέγμα → όγκος κουτιού, ×25 για κάγκελο·
 *   3. μερική ταυτότητα που περνά → γραμμή χωρίς τίτλο ή με μονάδα που δίνει σιωπηλά μηδέν.
 */

import { resolveImportedMeshMapping, deriveAtoeQuantity } from '../../../config/bim-to-atoe-mapping';
import {
  hasBoqIdentity,
  importedMeshBoqGeometry,
  isBoqUnitSupported,
  supportedBoqUnits,
} from '../imported-mesh-boq';
import { IMPORTED_MESH_BOQ_UNITS, type ImportedMeshParams } from '../imported-mesh-types';

/** Κάγκελο 2 m × 0,1 m × 1 m — **ανοιχτό** πλέγμα, άρα χωρίς μετρήσιμο όγκο. */
const openMesh: ImportedMeshParams = {
  kind: 'imported',
  uploadId: 'imesh_upload',
  nodeName: 'Rail_01',
  storagePath: 'projects/p1/imported-meshes/imesh_upload.glb',
  sourceFileName: 'Ισόγειο.glb',
  position: { x: 0, y: 0, z: 0 },
  rotationDeg: 0,
  measuredWidthMm: 2000,
  measuredDepthMm: 100,
  measuredHeightMm: 1000,
  measuredSurfaceAreaM2: 4,
  measuredVolumeM3: null,
  mountingElevationMm: 0,
};

/** Διακοσμητικός τοίχος — **κλειστό** κέλυφος, άρα με πραγματικό όγκο. */
const solidMesh: ImportedMeshParams = { ...openMesh, nodeName: 'Wall_Deco', measuredVolumeM3: 0.45 };

describe('supportedBoqUnits — τι μπορεί να μετρηθεί τίμια', () => {
  it('ανοιχτό πλέγμα: ΔΕΝ προσφέρει m³/kg (η περίπτωση του κάγκελου)', () => {
    expect(supportedBoqUnits(openMesh)).toEqual(['pcs', 'm', 'm2']);
    expect(isBoqUnitSupported(openMesh, 'm3')).toBe(false);
    expect(isBoqUnitSupported(openMesh, 'kg')).toBe(false);
  });

  it('κλειστό κέλυφος: προσφέρει και m³/kg (ο διακοσμητικός τοίχος τα δικαιούται)', () => {
    expect(isBoqUnitSupported(solidMesh, 'm3')).toBe(true);
    expect(isBoqUnitSupported(solidMesh, 'kg')).toBe(true);
  });

  it('μήκος/επιφάνεια/τεμάχια προσφέρονται ΠΑΝΤΑ — δεν εξαρτώνται από τοπολογία', () => {
    for (const params of [openMesh, solidMesh]) {
      expect(supportedBoqUnits(params)).toEqual(expect.arrayContaining(['pcs', 'm', 'm2']));
    }
  });

  it('το σύνολο των προσφερόμενων μονάδων δεν ξεπερνά ποτέ όσες ξέρει το deriveAtoeQuantity', () => {
    expect(supportedBoqUnits(solidMesh)).toEqual([...IMPORTED_MESH_BOQ_UNITS]);
  });
});

describe('importedMeshBoqGeometry — η ΜΟΝΗ μετατροπή mm → m', () => {
  it('το εμβαδόν περνά ως έχει (είναι ήδη m² από τη μέτρηση της Φ2)', () => {
    expect(importedMeshBoqGeometry(openMesh).area).toBe(4);
  });

  it('ο όγκος περνά ως έχει σε κλειστό κέλυφος', () => {
    expect(importedMeshBoqGeometry(solidMesh).volume).toBe(0.45);
  });

  it('το μήκος βγαίνει σε ΜΕΤΡΑ — αν έμενε σε mm, η προμέτρηση θα ήταν ×1000', () => {
    // √(2² + 0,1²) ≈ 2,0025 m — όχι 2000.
    expect(importedMeshBoqGeometry(openMesh).lengthM).toBeCloseTo(2.0025, 3);
  });

  it('χρησιμοποιεί τη ΔΙΑΓΩΝΙΟ του ίχνους — αντικείμενο υπό 45° δεν υποτιμάται κατά 30%', () => {
    // Γραμμικό 10 m υπό 45° → bbox 7,07 × 7,07. Η μεγαλύτερη πλευρά θα έδινε 7,07· η διαγώνιος 10.
    const diagonal: ImportedMeshParams = {
      ...openMesh,
      measuredWidthMm: 7071,
      measuredDepthMm: 7071,
    };
    expect(importedMeshBoqGeometry(diagonal).lengthM).toBeCloseTo(10, 2);
  });

  it('ανοιχτό πλέγμα δίνει volume 0 — τιμή που ΔΕΝ διαβάζεται ποτέ (η m³ δεν προσφέρεται)', () => {
    expect(importedMeshBoqGeometry(openMesh).volume).toBe(0);
    expect(isBoqUnitSupported(openMesh, 'm3')).toBe(false);
  });
});

describe('resolveImportedMeshMapping — fail-closed', () => {
  const identity = { categoryCode: 'OIK-12.01', unit: 'm', titleEL: 'Κάγκελο αλουμινίου' };

  it('πλήρης ταυτότητα → mapping', () => {
    expect(resolveImportedMeshMapping(identity)).toEqual(identity);
  });

  it.each([
    ['ανανάθετο', undefined],
    ['null', null],
    ['χωρίς κωδικό', { ...identity, categoryCode: '' }],
    ['χωρίς τίτλο', { ...identity, titleEL: '' }],
    ['μονάδα που δεν παράγει ποσότητα', { ...identity, unit: 'lump' }],
    ['μονάδα λάθος τύπου', { ...identity, unit: 3 }],
  ])('%s → null, άρα ΚΑΜΙΑ γραμμή προμέτρησης', (_label, value) => {
    expect(resolveImportedMeshMapping(value)).toBeNull();
  });
});

describe('η αλυσίδα ταυτότητα → ποσότητα', () => {
  it('«κάγκελο σε τρέχοντα μέτρα» δίνει το μήκος, όχι το εμβαδόν', () => {
    const mapping = resolveImportedMeshMapping({
      categoryCode: 'OIK-12.01',
      unit: 'm',
      titleEL: 'Κάγκελο αλουμινίου',
    });

    expect(deriveAtoeQuantity(mapping!.unit, importedMeshBoqGeometry(openMesh))).toBeCloseTo(2.0025, 3);
  });

  it('«τζάμι σε τετραγωνικά» δίνει το εμβαδόν — ίδια γεωμετρία, άλλη ταυτότητα, άλλο νούμερο', () => {
    const mapping = resolveImportedMeshMapping({
      categoryCode: 'OIK-7.01',
      unit: 'm2',
      titleEL: 'Υαλοπίνακας',
    });

    expect(deriveAtoeQuantity(mapping!.unit, importedMeshBoqGeometry(openMesh))).toBe(4);
  });
});

describe('hasBoqIdentity', () => {
  it('ανανάθετο → false (καμία γραμμή, κατά την απόφαση του §10.2)', () => {
    expect(hasBoqIdentity(openMesh)).toBe(false);
  });

  it('ανατεθειμένο → true', () => {
    expect(
      hasBoqIdentity({
        ...openMesh,
        importedMeshIdentity: { categoryCode: 'OIK-12.01', unit: 'm', titleEL: 'Κάγκελο' },
      }),
    ).toBe(true);
  });
});
