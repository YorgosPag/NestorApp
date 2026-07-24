/**
 * mesh-reveal-fade tests (ADR-693 Φ2 — progressive reveal).
 *
 * Το συμβόλαιο: το πέπλο ενός μόλις-φορτωμένου πλέγματος σβήνει ομαλά, ΤΕΛΕΙΩΝΕΙ πάντα, και δεν
 * αφήνει πίσω του ούτε GPU πόρους ούτε εγγραφές στο μητρώο — ούτε όταν το resync του τραβήξει το
 * χαλί κάτω από τα πόδια στη μέση του fade.
 */

import * as THREE from 'three';
import {
  MESH_REVEAL_DURATION_MS,
  disposeMeshReveal,
  isMeshRevealActive,
  isRevealing,
  registerRevealGhost,
  revealProgress,
  tickMeshReveal,
} from '../mesh-reveal-fade';

function ghostIn(parent: THREE.Object3D | null): {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
} {
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.28 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  parent?.add(mesh);
  return { mesh, material };
}

afterEach(() => {
  disposeMeshReveal();
});

describe('revealProgress / isRevealing — καθαρές συναρτήσεις του χρόνου', () => {
  it('0 στην αρχή, 1 στο τέλος, κλειδωμένο στο 1 μετά', () => {
    expect(revealProgress(0)).toBe(0);
    expect(revealProgress(MESH_REVEAL_DURATION_MS / 2)).toBeCloseTo(0.5, 5);
    expect(revealProgress(MESH_REVEAL_DURATION_MS)).toBe(1);
    expect(revealProgress(MESH_REVEAL_DURATION_MS * 10)).toBe(1);
  });

  it('asset που δεν φορτώθηκε ποτέ σε αυτή τη συνεδρία ΔΕΝ αποκαλύπτεται', () => {
    expect(isRevealing(null)).toBe(false);
  });

  it('asset φορτωμένο εδώ και ώρα δεν ξανα-αποκαλύπτεται σε κάθε resync', () => {
    expect(isRevealing(MESH_REVEAL_DURATION_MS + 1)).toBe(false);
    expect(isRevealing(10)).toBe(true);
  });
});

describe('tickMeshReveal — το πέπλο σβήνει και τελειώνει', () => {
  it('η αδιαφάνεια μειώνεται μονότονα προς το 0', () => {
    const parent = new THREE.Group();
    const { mesh, material } = ghostIn(parent);
    registerRevealGhost(mesh, material, 0);

    const start = performance.now();
    tickMeshReveal(start + MESH_REVEAL_DURATION_MS * 0.25);
    const quarter = material.opacity;
    tickMeshReveal(start + MESH_REVEAL_DURATION_MS * 0.75);
    const threeQuarters = material.opacity;

    expect(quarter).toBeLessThan(0.28);
    expect(threeQuarters).toBeLessThan(quarter);
    expect(threeQuarters).toBeGreaterThanOrEqual(0);
  });

  it('στο τέλος αφαιρεί το πέπλο από τη σκηνή και αδειάζει το μητρώο', () => {
    const parent = new THREE.Group();
    const { mesh, material } = ghostIn(parent);
    registerRevealGhost(mesh, material, 0);
    expect(isMeshRevealActive()).toBe(true);

    tickMeshReveal(performance.now() + MESH_REVEAL_DURATION_MS + 1);

    expect(mesh.parent).toBeNull();
    expect(parent.children).toHaveLength(0);
    expect(isMeshRevealActive()).toBe(false);
  });

  it('ελευθερώνει τους per-instance πόρους (μηδέν GPU leak ανά φόρτωση)', () => {
    const parent = new THREE.Group();
    const { mesh, material } = ghostIn(parent);
    const disposeMat = jest.spyOn(material, 'dispose');
    const disposeGeo = jest.spyOn(mesh.geometry, 'dispose');
    registerRevealGhost(mesh, material, 0);

    tickMeshReveal(performance.now() + MESH_REVEAL_DURATION_MS + 1);

    expect(disposeMat).toHaveBeenCalled();
    expect(disposeGeo).toHaveBeenCalled();
  });

  /**
   * Το resync ξαναχτίζει ΟΛΗ τη σκηνή σε κάθε bump. Ένα πέπλο που αποσυνδέθηκε στη μέση του fade
   * δεν πρέπει να κρατά ζωντανό το μητρώο — αλλιώς το `isMeshRevealActive` θα έμενε `true` για
   * πάντα και η on-demand σκηνή θα render-αρε **κάθε καρέ, για πάντα** (ADR-040 regression).
   */
  it('αυτο-ιάται όταν το resync αποσυνδέσει το πέπλο στη μέση του fade', () => {
    const parent = new THREE.Group();
    const { mesh, material } = ghostIn(parent);
    registerRevealGhost(mesh, material, 0);

    mesh.removeFromParent(); // ← το resync ξαναχτίζει τη σκηνή
    tickMeshReveal(performance.now() + 10);

    expect(isMeshRevealActive()).toBe(false);
  });
});

describe('disposeMeshReveal', () => {
  it('αδειάζει το μητρώο σε αποσύνδεση του viewport', () => {
    const parent = new THREE.Group();
    const { mesh, material } = ghostIn(parent);
    registerRevealGhost(mesh, material, 0);
    expect(isMeshRevealActive()).toBe(true);

    disposeMeshReveal();

    expect(isMeshRevealActive()).toBe(false);
  });
});
