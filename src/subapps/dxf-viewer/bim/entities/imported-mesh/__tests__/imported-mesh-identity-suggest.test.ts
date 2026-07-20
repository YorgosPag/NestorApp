/**
 * ADR-683 Φ3.1β — πρόταση ταυτότητας + gating μονάδων ανά άρθρο (§10.2, μέτρα τριβής 1 + 2).
 *
 * Η αστοχία εδώ είναι **σιωπηλή και ακριβή**: μια πρόταση που ο χρήστης δέχεται χωρίς να την
 * κοιτάξει γίνεται γραμμή προϋπολογισμού. Οι τρόποι να πάει στραβά, και τα tests που τους καρφώνουν:
 *   1. πρόταση μονάδας που το άρθρο ΔΕΝ επιτρέπει → ποσότητα σε λάθος διάσταση·
 *   2. πρόταση από γεωμετρία/σχήμα (απαγορευμένο §3) → σωστό μόνο κατά τύχη·
 *   3. κληρονομιά ομάδας που χάνεται σε υποκατηγορία → σιωπηλή χαλάρωση του gating.
 */

import { assignableBoqUnits, withImportedMeshIdentity } from '../imported-mesh-boq';
import { suggestImportedMeshIdentity } from '../imported-mesh-identity-suggest';
import type { ImportedMeshParams } from '../imported-mesh-types';
import type { BimMaterial } from '../../../types/bim-material-types';

/** Κάγκελο — **ανοιχτό** πλέγμα (χωρίς μετρήσιμο όγκο), όπως κάθε πραγματικό κάγκελο. */
const railing: ImportedMeshParams = {
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

/** Κλειστό κέλυφος — δικαιούται m³/kg. */
const solid: ImportedMeshParams = { ...railing, nodeName: 'Deco_Block', measuredVolumeM3: 0.45 };

const inox: BimMaterial = {
  id: 'bmat_inox304',
  scope: 'company',
  nameEl: 'Ανοξείδωτο 304',
  nameEn: 'Stainless steel 304',
  category: 'metal',
  density: 7900,
  defaultThickness: null,
  fireRating: 'A1',
  atoeCategory: 'OIK-12.3',
  atoeArticle: null,
  defaultUnitCost: 42,
  defaultUnit: 'kg',
  brand: null,
  brandModel: null,
  notes: null,
  thumbnailUrl: null,
  pbrTextures: null,
  builtin: false,
} as BimMaterial;

const resolveInox = (name: string): string | null =>
  name.trim().toLowerCase() === 'inox_304' ? inox.id : null;

// ─── assignableBoqUnits — η τομή των τριών περιορισμών ────────────────────────

describe('assignableBoqUnits — τι επιτρέπει ΚΑΙ η γεωμετρία ΚΑΙ το άρθρο', () => {
  it('κάγκελο (ανοιχτό) σε OIK-12 «Μεταλλικά»: kg εκτός — το άρθρο το επιτρέπει, η γεωμετρία όχι', () => {
    const units = assignableBoqUnits(railing, 'OIK-12.1');
    expect(units).toEqual(expect.arrayContaining(['pcs', 'm', 'm2']));
    expect(units).not.toContain('kg');
    expect(units).not.toContain('m3');
  });

  it('κλειστό κέλυφος στο ΙΔΙΟ άρθρο: το kg επιστρέφει — άλλαξε μόνο η τοπολογία', () => {
    expect(assignableBoqUnits(solid, 'OIK-12.1')).toContain('kg');
  });

  it('m³ ΠΟΤΕ σε OIK-12: το άρθρο δεν το επιτρέπει, ακόμη κι όταν ο όγκος μετριέται', () => {
    // Η ασυμμετρία ΕΙΝΑΙ η απόδειξη ότι μετρούν δύο ανεξάρτητοι περιορισμοί, όχι ένας.
    expect(assignableBoqUnits(solid, 'OIK-12.1')).not.toContain('m3');
    expect(assignableBoqUnits(solid, 'OIK-2.1')).toContain('m3');
  });

  it('υποκατηγορία ΚΛΗΡΟΝΟΜΕΙ τις μονάδες της ομάδας της (OIK-12.1 ≡ OIK-12)', () => {
    // Χωρίς τη μετάβαση σε ομάδα, το `getAllowedUnits('OIK-12.1')` πέφτει στο γενικό fallback
    // και το gating χαλαρώνει ΣΙΩΠΗΛΑ — η υποκατηγορία θα επέτρεπε ό,τι η ομάδα απαγορεύει.
    expect(assignableBoqUnits(solid, 'OIK-12.1')).toEqual(assignableBoqUnits(solid, 'OIK-12'));
  });

  it('άγνωστος κωδικός → πέφτει στο fallback, ΔΕΝ σκάει', () => {
    expect(() => assignableBoqUnits(railing, 'ΑΝΥΠΑΡΚΤΟ')).not.toThrow();
  });

  it('ανοιχτό πλέγμα σε άρθρο σκυροδέματος: ΚΕΝΗ τομή — έγκυρη απάντηση, όχι σφάλμα', () => {
    // OIK-1 «Χωματουργικά» επιτρέπει μόνο m3/ton· ανοιχτό πλέγμα δεν μετρά όγκο.
    expect(assignableBoqUnits(railing, 'OIK-1.1')).toEqual([]);
  });
});

// ─── suggestImportedMeshIdentity ─────────────────────────────────────────────

describe('suggestImportedMeshIdentity — πρόταση από όνομα', () => {
  it('«Rail_01» → κάγκελα μπαλκονιού σε τρέχοντα μέτρα', () => {
    const s = suggestImportedMeshIdentity({ params: railing });
    expect(s).toMatchObject({ categoryCode: 'OIK-12.1', unit: 'm', source: 'name' });
    expect(s?.titleEL).toBe('Κάγκελα μπαλκονιού');
  });

  it('ο τίτλος έρχεται από τον κατάλογο ΑΤΟΕ — δεν είναι γραμμένος στον κανόνα', () => {
    // Αν κάποιος μετονομάσει την υποκατηγορία, η πρόταση ακολουθεί χωρίς αλλαγή κώδικα.
    const s = suggestImportedMeshIdentity({ params: { ...railing, nodeName: 'STAIR_RAIL_A' } });
    expect(s).toMatchObject({ categoryCode: 'OIK-12.2', titleEL: 'Κάγκελα σκάλας' });
  });

  it('ειδικότερος κανόνας πρώτα: «stair_rail» ΔΕΝ πέφτει στο γενικό «rail»', () => {
    expect(suggestImportedMeshIdentity({ params: { ...railing, nodeName: 'stair_rail' } }))
      .toMatchObject({ categoryCode: 'OIK-12.2' });
  });

  it('ελληνικά ονόματα και πεζά/κεφαλαία δουλεύουν εξίσου', () => {
    for (const nodeName of ['ΚΑΓΚΕΛΟ-2', 'κάγκελο_αριστερά', 'Railing_B', 'HANDRAIL']) {
      expect(suggestImportedMeshIdentity({ params: { ...railing, nodeName } })?.categoryCode)
        .toBe('OIK-12.1');
    }
  });

  it('άγνωστο όνομα χωρίς υλικό → null (ΚΑΜΙΑ μαντεψιά από γεωμετρία, §3)', () => {
    expect(suggestImportedMeshIdentity({ params: { ...railing, nodeName: 'Object_042' } })).toBeNull();
  });

  it('βλάστηση δεν έχει άρθρο ΑΤΟΕ → null, ΠΟΤΕ ψεύτικη αντιστοίχιση', () => {
    // Ένα δέντρο δεν είναι οικοδομική εργασία· μια πρόταση θα το χρέωνε στον εργολάβο.
    expect(suggestImportedMeshIdentity({ params: { ...railing, nodeName: 'Tree_Olive_01' } })).toBeNull();
  });
});

describe('suggestImportedMeshIdentity — πρόταση από υλικό', () => {
  const withMaterial = (nodeName: string): ImportedMeshParams => ({
    ...railing, nodeName, sourceMaterialName: 'Inox_304',
  });

  it('μόνο υλικό: δίνει το άρθρο ΤΟΥ ΥΛΙΚΟΥ + το όνομά του ως τίτλο', () => {
    const s = suggestImportedMeshIdentity({
      params: withMaterial('Object_042'), resolveMaterialId: resolveInox, materials: [inox],
    });
    expect(s).toMatchObject({
      categoryCode: 'OIK-12.3', titleEL: 'Ανοξείδωτο 304', materialId: 'bmat_inox304', source: 'material',
    });
  });

  it('όνομα + υλικό: το ΑΡΘΡΟ από το όνομα, το materialId (και η τιμή του) από το υλικό', () => {
    // Αυτό είναι το κέρδος του συνδυασμού: καμία πηγή μόνη της δεν ήξερε και τα δύο.
    const s = suggestImportedMeshIdentity({
      params: withMaterial('Rail_01'), resolveMaterialId: resolveInox, materials: [inox],
    });
    expect(s).toMatchObject({
      categoryCode: 'OIK-12.1', titleEL: 'Κάγκελα μπαλκονιού', materialId: 'bmat_inox304', source: 'name+material',
    });
  });

  it('η μονάδα του ΟΝΟΜΑΤΟΣ υπερισχύει της μονάδας του υλικού όταν επιτρέπεται', () => {
    // Το inox έχει defaultUnit 'kg'· το κάγκελο μετριέται σε τρέχοντα μέτρα.
    expect(suggestImportedMeshIdentity({
      params: withMaterial('Rail_01'), resolveMaterialId: resolveInox, materials: [inox],
    })?.unit).toBe('m');
  });

  it('άγνωστο όνομα υλικού → αγνοείται σιωπηλά, το όνομα κόμβου κρατά την πρόταση', () => {
    const s = suggestImportedMeshIdentity({
      params: { ...railing, sourceMaterialName: 'ΆγνωστοΥλικό' },
      resolveMaterialId: resolveInox, materials: [inox],
    });
    expect(s).toMatchObject({ source: 'name' });
    expect(s?.materialId).toBeUndefined();
  });

  it('χωρίς αποθηκευμένο όνομα υλικού η διαδρομή του υλικού δεν ενεργοποιείται καθόλου', () => {
    const s = suggestImportedMeshIdentity({
      params: railing, resolveMaterialId: resolveInox, materials: [inox],
    });
    expect(s?.materialId).toBeUndefined();
  });
});

describe('suggestImportedMeshIdentity — η πρόταση υπόκειται ΠΑΝΤΑ στο gating', () => {
  it('προτεινόμενη μονάδα που το άρθρο δεν επιτρέπει αντικαθίσταται από επιτρεπτή', () => {
    // Υλικό με defaultUnit 'kg' σε ΑΝΟΙΧΤΟ πλέγμα: το kg απαιτεί όγκο που δεν μετριέται.
    const s = suggestImportedMeshIdentity({
      params: { ...railing, nodeName: 'Object_042', sourceMaterialName: 'Inox_304' },
      resolveMaterialId: resolveInox, materials: [inox],
    });
    expect(s?.unit).not.toBe('kg');
    expect(assignableBoqUnits(railing, s?.categoryCode ?? '')).toContain(s?.unit);
  });

  it('όταν ΚΑΜΙΑ μονάδα δεν είναι τίμια, δεν προτείνεται τίποτα', () => {
    const concreteMaterial = { ...inox, id: 'bmat_c25', atoeCategory: 'OIK-1.1', defaultUnit: 'm3' } as BimMaterial;
    const s = suggestImportedMeshIdentity({
      params: { ...railing, nodeName: 'Object_042', sourceMaterialName: 'Beton' },
      resolveMaterialId: (n) => (n.toLowerCase() === 'beton' ? concreteMaterial.id : null),
      materials: [concreteMaterial],
    });
    expect(s).toBeNull();
  });
});

// ─── withImportedMeshIdentity — η μία μετάλλαξη ───────────────────────────────

describe('withImportedMeshIdentity', () => {
  const identity = { categoryCode: 'OIK-12.1', unit: 'm', titleEL: 'Κάγκελα μπαλκονιού' } as const;

  it('ανάθεση: γράφει την ταυτότητα χωρίς να αγγίξει τα μετρημένα μεγέθη', () => {
    const next = withImportedMeshIdentity(railing, identity);
    expect(next.importedMeshIdentity).toEqual(identity);
    expect(next.measuredSurfaceAreaM2).toBe(railing.measuredSurfaceAreaM2);
    expect(next.measuredVolumeM3).toBeNull();
  });

  it('αφαίρεση: ΣΒΗΝΕΙ το κλειδί — δεν το αφήνει undefined', () => {
    // Το Firestore απορρίπτει `undefined`, και ένα undefined κλειδί θα περνούσε κάθε `in` έλεγχο:
    // η ανάθεση θα «αφαιρούνταν» στην οθόνη και θα επέστρεφε στο επόμενο reload.
    const assigned = withImportedMeshIdentity(railing, identity);
    const cleared = withImportedMeshIdentity(assigned, undefined);
    expect('importedMeshIdentity' in cleared).toBe(false);
  });

  it('δεν μεταλλάσσει την είσοδο (τα params είναι readonly SSoT)', () => {
    withImportedMeshIdentity(railing, identity);
    expect(railing.importedMeshIdentity).toBeUndefined();
  });

  it('αφαίρεση σε ανανάθετο = no-op, χωρίς σφάλμα (ιδεμποτεντικό)', () => {
    expect(withImportedMeshIdentity(railing, undefined)).toEqual(railing);
  });
});
