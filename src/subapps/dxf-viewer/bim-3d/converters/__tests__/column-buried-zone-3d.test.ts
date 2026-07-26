/**
 * ADR-713 — το υλικό όψης ΔΕΝ βάφει το θαμμένο («κοντόστυλο») τμήμα της κολώνας.
 *
 * Το αρχικό σφάλμα (screenshot Giorgio 2026-07-26): κολώνα ισογείου βαμμένη με τούβλο
 * συνέχιζε τούβλινη μέχρι το πέδιλο — δηλαδή επενδυμένη **μέσα στο χώμα**. Εδώ κλειδώνεται
 * ότι η θαμμένη ζώνη γίνεται ΔΙΚΕΣ ΤΗΣ όψεις (`buried:i`) με στεγανωτικό υλικό, ενώ οι
 * εκτεθειμένες (`side:i`) κρατούν την επένδυση — και ότι χωρίς θαμμένη ζώνη τίποτα δεν αλλάζει.
 */

import * as THREE from 'three';
import { columnToMesh } from '../BimToThreeConverter';
import { buildDefaultColumnParams, buildColumnEntity } from '../../../hooks/drawing/column-completion';
import { usePolygonMode3DStore } from '../../stores/PolygonMode3DStore';
import type { ColumnEntity } from '../../../bim/types/column-types';
import { getMaterialColorById } from '../../../bim/materials/material-color-registry';
import { WATERPROOF_BITUMEN_MATERIAL, WATERPROOF_MEMBRANE_MATERIAL } from '../../../bim/finishes/buried-waterproofing';

const BRICK_HEX = '#B05030';

function flatColumn(): ColumnEntity {
  const res = buildColumnEntity(buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), '0');
  if (!res.ok) throw new Error('column fixture invalid');
  return res.entity;
}

/** Κολώνα βαμμένη ΟΛΟΚΛΗΡΗ με τούβλο (base `'*'`) — ακριβώς το σενάριο του screenshot. */
function brickColumn(overrides: Partial<ColumnEntity['params']> = {}): ColumnEntity {
  const c = flatColumn();
  return {
    ...c,
    params: { ...c.params, ...overrides },
    faceAppearance: { '*': { colorHex: BRICK_HEX } },
  } as ColumnEntity;
}

/**
 * Πυρήνας (suppressFinishSkin=true → σκέτο mesh). `effectiveBaseZmm` = άνω παρειά πεδίλου·
 * `gradeAbsMm` = στάθμη τελειωμένου εδάφους (undefined → default: στη nominal βάση).
 */
function coreMesh(column: ColumnEntity, effectiveBaseZmm?: number, gradeAbsMm?: number): THREE.Mesh {
  return columnToMesh(
    column, 0, '0', 0, undefined, undefined, undefined, [], [], true,
    effectiveBaseZmm, undefined, gradeAbsMm,
  ) as THREE.Mesh;
}

function faceKeys(mesh: THREE.Mesh): string[] {
  return (mesh.userData['faceKeyByMaterialIndex'] as string[] | undefined) ?? [];
}

/** Το χρώμα του υλικού που αποδίδεται σε μια όψη, ως hex int. */
function faceColor(mesh: THREE.Mesh, faceKey: string): number {
  const idx = faceKeys(mesh).indexOf(faceKey);
  if (idx < 0) throw new Error(`missing faceKey ${faceKey}`);
  const materials = mesh.material as THREE.MeshStandardMaterial[];
  return materials[idx].color.getHex();
}

afterEach(() => usePolygonMode3DStore.getState().reset());

describe('ADR-713 — η επένδυση σταματά στη στάθμη εδάφους', () => {
  it('ΤΟ ΣΦΑΛΜΑ: με έδραση σε πέδιλο, οι θαμμένες όψεις ΔΕΝ παίρνουν το τούβλο', () => {
    const mesh = coreMesh(brickColumn(), -1000); // πέδιλο 1m κάτω από τη nominal βάση
    const keys = faceKeys(mesh);
    expect(keys).toContain('buried:0');

    const brickInt = new THREE.Color(BRICK_HEX).getHex();
    expect(faceColor(mesh, 'side:0')).toBe(brickInt);          // ανωδομή → τούβλο
    expect(faceColor(mesh, 'buried:0')).not.toBe(brickInt);    // θαμμένο → ΟΧΙ τούβλο
  });

  it('η θαμμένη όψη παίρνει το ΣΤΕΓΑΝΩΤΙΚΟ υλικό (αυτόματα, χωρίς ρύθμιση)', () => {
    const mesh = coreMesh(brickColumn(), -1000);
    const expected = getMaterialColorById(WATERPROOF_BITUMEN_MATERIAL);
    expect(expected).not.toBeNull();
    expect(faceColor(mesh, 'buried:0')).toBe(new THREE.Color(expected!).getHex());
  });

  it('ρητό υλικό στεγάνωσης (μεμβράνη) υπερισχύει του default', () => {
    const column = brickColumn({
      buriedWaterproofing: { materialId: WATERPROOF_MEMBRANE_MATERIAL },
    } as Partial<ColumnEntity['params']>);
    const mesh = coreMesh(column, -1000);
    const expected = getMaterialColorById(WATERPROOF_MEMBRANE_MATERIAL);
    expect(faceColor(mesh, 'buried:0')).toBe(new THREE.Color(expected!).getHex());
  });

  it('στεγάνωση κλειστή → γυμνό σκυρόδεμα, ΑΛΛΑ ποτέ το τούβλο', () => {
    const column = brickColumn({
      buriedWaterproofing: { enabled: false },
    } as Partial<ColumnEntity['params']>);
    const mesh = coreMesh(column, -1000);
    // Το κρίσιμο: το ρητό κενό `{}` εμποδίζει τον cascade να πέσει στο base `'*'` (τούβλο).
    expect(faceColor(mesh, 'buried:0')).not.toBe(new THREE.Color(BRICK_HEX).getHex());
  });

  it('ΑΒΑΦΗ κολώνα με έδραση → faced ΕΠΙΒΑΛΛΕΤΑΙ, ώστε η στεγάνωση να φαίνεται', () => {
    // Χωρίς αυτό, το legacy single-material extrude δεν μπορεί να δείξει δύο υλικά καθ' ύψος.
    const mesh = coreMesh(flatColumn(), -1000);
    expect(Array.isArray(mesh.material)).toBe(true);
    expect(faceKeys(mesh)).toContain('buried:0');
  });
});

describe('ADR-713 — μηδέν παλινδρόμηση χωρίς θαμμένη ζώνη', () => {
  it('κολώνα ορόφου (καμία έδραση) → ΚΑΜΙΑ `buried:` όψη, legacy αρίθμηση', () => {
    const mesh = coreMesh(brickColumn());
    const keys = faceKeys(mesh);
    expect(keys.some((k) => k.startsWith('buried:'))).toBe(false);
    expect(keys.slice(0, 2)).toEqual(['bottom', 'top']);
    expect(keys[2]).toBe('side:0'); // ADR-539 συμβόλαιο: materialIndex 2+i = side:i
  });

  it('άβαφη κολώνα χωρίς έδραση → legacy single-material (byte-for-byte)', () => {
    expect(Array.isArray(coreMesh(flatColumn()).material)).toBe(false);
  });

  it('το datum (position.y) δεν μετακινείται από το σπάσιμο ζωνών', () => {
    const withZone = coreMesh(brickColumn(), -1000);
    const noZone = coreMesh(brickColumn(), -1000, -1000); // στάθμη ΣΤΟ πέδιλο → μηδενική ζώνη
    expect(withZone.position.y).toBeCloseTo(noZone.position.y, 9);
    expect(faceKeys(noZone).some((k) => k.startsWith('buried:'))).toBe(false);
  });
});

describe('ADR-713 — η στάθμη εδάφους οδηγεί το ύψος της ζώνης', () => {
  /** Ελάχιστο/μέγιστο Y των vertices ενός material group (τοπικές συντεταγμένες mesh). */
  function groupYRange(mesh: THREE.Mesh, faceKey: string): { min: number; max: number } {
    const idx = faceKeys(mesh).indexOf(faceKey);
    const group = mesh.geometry.groups.find((g) => g.materialIndex === idx)!;
    const pos = mesh.geometry.getAttribute('position');
    let min = Infinity;
    let max = -Infinity;
    for (let i = group.start; i < group.start + group.count; i++) {
      const y = pos.getY(i);
      if (y < min) min = y;
      if (y > max) max = y;
    }
    return { min, max };
  }

  it('στάθμη ΨΗΛΟΤΕΡΑ από τη βάση θάβει λιγότερο (επικλινές: κατάντη κολώνα)', () => {
    // Πέδιλο στα −1000· έδαφος στα −300 → θαμμένη ζώνη 700mm από το πέδιλο.
    const mesh = coreMesh(brickColumn(), -1000, -300);
    const buried = groupYRange(mesh, 'buried:0');
    expect(buried.min).toBeCloseTo(0, 6);      // κάτω παρειά = πέδιλο (local 0)
    expect(buried.max).toBeCloseTo(0.7, 6);    // 700mm σε μέτρα
  });

  it('στάθμη ΠΑΝΩ από το FFL θάβει και τμήμα ανωδομής (ανάντη κολώνα)', () => {
    const mesh = coreMesh(brickColumn(), -1000, 500);
    const buried = groupYRange(mesh, 'buried:0');
    expect(buried.max).toBeCloseTo(1.5, 6); // 1000 κοντόστυλο + 500 ανωδομής
  });

  it('οι δύο ζώνες είναι ΣΥΝΕΧΟΜΕΝΕΣ — καμία λωρίδα δεν χάνεται', () => {
    const mesh = coreMesh(brickColumn(), -1000, -300);
    const buried = groupYRange(mesh, 'buried:0');
    const exposed = groupYRange(mesh, 'side:0');
    expect(exposed.min).toBeCloseTo(buried.max, 9);
  });
});

/**
 * ADR-714 §2.4 — ΠΟΙΟΣ ΚΕΡΔΙΖΕΙ στη θαμμένη όψη: το αυτόματο στεγανωτικό ή η ρητή βαφή του χρήστη;
 *
 * Το ADR-713 έβαζε το αυτόματο `buriedFaceAppearance(...)` **ΜΕΤΑ** το `faceAppearance` του χρήστη,
 * οπότε το default σκέπαζε κάθε ρητή per-face επιλογή. Δεν φάνηκε τότε γιατί **δεν υπήρχε τρόπος**
 * να φτάσει κλειδί `buried:i` στο `faceAppearance` — μόλις ανοίγει η επιλογή θαμμένης όψης, γίνεται
 * σιωπηλή απώλεια δουλειάς: ο μηχανικός βάφει, η οθόνη δεν αλλάζει, και **η επιμέτρηση** λέει
 * ασφαλτικό ενώ η πρόθεση ήταν μεμβράνη.
 *
 * Το σωστό μοντέλο (Revit «Paint» > type material· C4D texture tag > base tag): **αυτόματο =
 * baseline, ρητή βαφή = νικητής**. Και ταυτόχρονα η δικλείδα του ADR-713 μένει ακέραιη — το
 * επικίνδυνο base `'*'` (τούβλο) ΔΕΝ φτάνει ποτέ στα `buried:i`.
 */
describe('ADR-714 — ρητή βαφή θαμμένης όψης VS αυτόματη στεγάνωση', () => {
  /** Πράσινο-επαλειφόμενο, σκόπιμα ΑΣΧΕΤΟ με τούβλο και με τα 3 στεγανωτικά του καταλόγου. */
  const USER_COATING_HEX = '#00A86B';
  const brickInt = () => new THREE.Color(BRICK_HEX).getHex();
  const userInt = () => new THREE.Color(USER_COATING_HEX).getHex();
  const bitumenInt = () => new THREE.Color(getMaterialColorById(WATERPROOF_BITUMEN_MATERIAL)!).getHex();

  /** Κολώνα με τούβλο σε ΟΛΟ το σώμα + ρητή βαφή χρήστη ΜΟΝΟ στη θαμμένη όψη `buried:0`. */
  function paintedBuriedColumn(): ColumnEntity {
    const c = brickColumn();
    return {
      ...c,
      faceAppearance: { ...c.faceAppearance, 'buried:0': { colorHex: USER_COATING_HEX } },
    } as ColumnEntity;
  }

  it('Η ΡΗΤΗ ΒΑΦΗ ΚΕΡΔΙΖΕΙ: η επιλογή του χρήστη ΔΕΝ σκεπάζεται από το αυτόματο ασφαλτικό', () => {
    const mesh = coreMesh(paintedBuriedColumn(), -1000);
    expect(faceColor(mesh, 'buried:0')).toBe(userInt());
    expect(faceColor(mesh, 'buried:0')).not.toBe(bitumenInt());
  });

  it('το base `\'*\'` (τούβλο) ΔΕΝ ξανακερδίζει: οι ΑΒΑΦΕΣ θαμμένες όψεις κρατούν το στεγανωτικό', () => {
    // Ο πραγματικός κίνδυνος της αντιστροφής: αν το `fa` σκέπαζε ΟΛΟ το baseline, το `'*'` θα
    // ξαναγινόταν ενεργό στα υπόλοιπα `buried:i`. Τα ρητά κλειδιά το εμποδίζουν — κλειδώνεται εδώ.
    const mesh = coreMesh(paintedBuriedColumn(), -1000);
    for (const key of faceKeys(mesh).filter((k) => k.startsWith('buried:') && k !== 'buried:0')) {
      expect(faceColor(mesh, key)).toBe(bitumenInt());
      expect(faceColor(mesh, key)).not.toBe(brickInt());
    }
  });

  it('η βαφή είναι per-face: η εκτεθειμένη όψη κρατά την επένδυση, ανέπαφη', () => {
    const mesh = coreMesh(paintedBuriedColumn(), -1000);
    expect(faceColor(mesh, 'side:0')).toBe(brickInt());
  });

  it('ρητό υλικό καταλόγου σε θαμμένη όψη κερδίζει επίσης (materialId, όχι μόνο colorHex)', () => {
    const c = brickColumn();
    const column = {
      ...c,
      faceAppearance: { ...c.faceAppearance, 'buried:1': { materialId: WATERPROOF_MEMBRANE_MATERIAL } },
    } as ColumnEntity;
    const mesh = coreMesh(column, -1000);
    const membraneInt = new THREE.Color(getMaterialColorById(WATERPROOF_MEMBRANE_MATERIAL)!).getHex();
    expect(faceColor(mesh, 'buried:1')).toBe(membraneInt);
    expect(faceColor(mesh, 'buried:0')).toBe(bitumenInt()); // η γειτονική μένει στο default
  });

  it('ρητή βαφή θαμμένης όψης δουλεύει ΚΑΙ με κλειστή στεγάνωση (γυμνό ≠ αδύνατο να βαφτεί)', () => {
    // `enabled:false` δίνει baseline κενό `{}` ανά θαμμένη όψη. Το κενό ΔΕΝ πρέπει να μπλοκάρει
    // ρητή βαφή — αλλιώς ο μηχανικός που έκλεισε την αυτόματη στεγάνωση δεν θα μπορούσε ποτέ
    // να βάψει χειροκίνητα, που είναι ακριβώς ο λόγος που την έκλεισε.
    const c = brickColumn({ buriedWaterproofing: { enabled: false } } as Partial<ColumnEntity['params']>);
    const column = {
      ...c,
      faceAppearance: { ...c.faceAppearance, 'buried:0': { colorHex: USER_COATING_HEX } },
    } as ColumnEntity;
    const mesh = coreMesh(column, -1000);
    expect(faceColor(mesh, 'buried:0')).toBe(userInt());
  });
});
