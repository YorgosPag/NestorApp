/**
 * loading-placeholder-material tests (ADR-693 Άξονας Β).
 *
 * Το συμβόλαιο που φυλάνε: ένα «φορτώνει» ghost πρέπει να ΦΑΙΝΕΤΑΙ σαν κατάσταση φόρτωσης —
 * ημιδιάφανο, ουδέτερο, χωρίς υφή, χωρίς σκιά — και ΠΟΤΕ σαν αληθοφανές υλικό. Η παλινδρόμηση που
 * αποτρέπουν είναι πραγματική: πριν το ADR-693 τα κουτιά φόρτωσης ενός εισαγόμενου `.glb`
 * ζωγραφίζονταν με τη ΦΩΤΟΓΡΑΦΙΑ ΣΚΥΡΟΔΕΜΑΤΟΣ, με σκιές (Giorgio, browser 2026-07-24).
 */

import * as THREE from 'three';
import {
  BIM_LOADING_GHOST_FLAG,
  buildLoadingGhostBox,
  disposeLoadingPlaceholderMaterials,
  isLoadingGhost,
} from '../loading-placeholder-material';

afterEach(() => {
  disposeLoadingPlaceholderMaterials();
});

describe('buildLoadingGhostBox — γεωμετρία στις ΠΡΑΓΜΑΤΙΚΕΣ διαστάσεις', () => {
  it('χτίζει κουτί ακριβώς στα μέτρα που του δόθηκαν (πλάτος/ύψος/βάθος)', () => {
    const ghost = buildLoadingGhostBox(0.3, 0.4, 0.5);
    const params = (ghost.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBeCloseTo(0.3, 6);
    expect(params.height).toBeCloseTo(0.4, 6);
    expect(params.depth).toBeCloseTo(0.5, 6);
  });
});

describe('buildLoadingGhostBox — διαβάζεται ως ΦΟΡΤΩΣΗ, όχι ως υλικό', () => {
  it('είναι ημιδιάφανο και δεν γράφει βάθος (δεν κρύβει ό,τι φορτώνει πίσω του)', () => {
    const mat = buildLoadingGhostBox(1, 1, 1).material as THREE.MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.5);
    expect(mat.opacity).toBeGreaterThan(0);
    expect(mat.depthWrite).toBe(false);
  });

  it('είναι διπλής όψης — ένα ημιδιάφανο κουτί πρέπει να δείχνει τα πίσω τοιχώματά του', () => {
    const mat = buildLoadingGhostBox(1, 1, 1).material as THREE.MeshStandardMaterial;
    expect(mat.side).toBe(THREE.DoubleSide);
  });

  it('ΚΑΜΙΑ υφή — ένα ghost δεν φοράει ποτέ φωτογραφία υλικού (η ρίζα του ADR-693)', () => {
    const mat = buildLoadingGhostBox(1, 1, 1).material as THREE.MeshStandardMaterial;
    expect(mat.map).toBeNull();
    expect(mat.normalMap).toBeNull();
    expect(mat.roughnessMap).toBeNull();
    expect(mat.aoMap).toBeNull();
  });

  it('ΚΑΜΙΑ σκιά — ένα ghost που ρίχνει σκιά διαβάζεται ως πραγματικός όγκος', () => {
    const ghost = buildLoadingGhostBox(1, 1, 1);
    expect(ghost.castShadow).toBe(false);
    expect(ghost.receiveShadow).toBe(false);
  });

  it('σημαδεύεται στο userData ώστε το downstream tagging να μην το «διορθώσει»', () => {
    const ghost = buildLoadingGhostBox(1, 1, 1);
    expect(ghost.userData[BIM_LOADING_GHOST_FLAG]).toBe(true);
    expect(isLoadingGhost(ghost)).toBe(true);
    expect(isLoadingGhost(new THREE.Mesh())).toBe(false);
  });
});

describe('buildLoadingGhostBox — περίγραμμα (ArchiCAD Hotlink / C4D proxy)', () => {
  function outlineOf(ghost: THREE.Mesh): THREE.LineSegments {
    const found = ghost.children.find((c): c is THREE.LineSegments => c instanceof THREE.LineSegments);
    if (!found) throw new Error('το ghost δεν έχει περίγραμμα');
    return found;
  }

  it('προσθέτει περίγραμμα ακμών ως παιδί', () => {
    const outline = outlineOf(buildLoadingGhostBox(1, 1, 1));
    expect(outline.geometry).toBeInstanceOf(THREE.EdgesGeometry);
  });

  it('το περίγραμμα ΔΕΝ είναι επιλέξιμο (ούτε click, ούτε 3Δ marquee)', () => {
    const outline = outlineOf(buildLoadingGhostBox(1, 1, 1));
    const raycaster = new THREE.Raycaster();
    const hits: THREE.Intersection[] = [];
    outline.raycast(raycaster, hits);
    expect(hits).toEqual([]);
  });
});

describe('cache + teardown', () => {
  it('μοιράζεται ΕΝΑ υλικό σε όλα τα ghosts (μηδέν per-instance allocation)', () => {
    expect(buildLoadingGhostBox(1, 1, 1).material).toBe(buildLoadingGhostBox(2, 2, 2).material);
  });

  it('μετά το dispose χτίζεται φρέσκο υλικό αντί να επιστραφεί το πεταμένο', () => {
    const before = buildLoadingGhostBox(1, 1, 1).material;
    disposeLoadingPlaceholderMaterials();
    expect(buildLoadingGhostBox(1, 1, 1).material).not.toBe(before);
  });
});
