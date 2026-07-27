/**
 * ADR-344 Φ-3D — η προβολή του άγκυρου του text editor στο 3D.
 *
 * Καρφώνει τα τρία σημεία όπου μια αγκύρωση αποτυγχάνει **σιωπηλά** — ο editor εμφανίζεται,
 * απλώς σε λάθος pixel, και κανένα σφάλμα δεν πέφτει πουθενά:
 *   1. **Υψόμετρο ορόφου** — κείμενο σε όροφο ≠ 0 πρέπει να προβάλλεται στο δικό του Y.
 *      Χωρίς αυτό, με «Όλοι οι όροφοι» όλα τα κείμενα αγκυρώνονται στο έδαφος.
 *   2. **Μονάδες σκηνής** — ο projector είναι mm-based, οι οντότητες φέρουν native μονάδες
 *      DXF (ADR-537 γ). Ξεχασμένος συντελεστής σε σκηνή μέτρων = σφάλμα ×1000.
 *   3. **Πίσω από την κάμερα** → `null`, ώστε το layer να κρατήσει την τελευταία έγκυρη θέση
 *      αντί να πετάξει το κουτί στο άπειρο.
 */

import * as THREE from 'three';
import { projectTextCentreToScreen } from '../text-edit-anchor-3d';

const findDxfEntityInScope = jest.fn();
jest.mock('../../scene/dxf-3d-floor-scope', () => ({
  findDxfEntityInScope: (id: string) => findDxfEntityInScope(id),
}));

/** Κάμερα που κοιτά προς τα κάτω στην αρχή των αξόνων, από 10 m ύψος. */
function topDownCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
  cam.position.set(0, 10, 0);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

/** Canvas 800×600 στην πάνω-αριστερή γωνία του παραθύρου. */
function fakeCanvas(): HTMLElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    clientHeight: 600,
    clientWidth: 800,
  } as unknown as HTMLElement;
}

function textEntity(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    type: 'text',
    position: { x: 0, y: 0 },
    text: 'A',
    height: 100,
    ...overrides,
  };
}

function source(camera: THREE.Camera | null, canvas: HTMLElement | null = fakeCanvas()) {
  return { getCamera: () => camera, getCanvas: () => canvas };
}

describe('projectTextCentreToScreen', () => {
  beforeEach(() => findDxfEntityInScope.mockReset());

  it('κείμενο με στοίχιση MC στην αρχή των αξόνων → κέντρο του καμβά', () => {
    findDxfEntityInScope.mockReturnValue({
      entity: textEntity({ textStyle: { textAlign: 'center', textBaseline: 'middle' } }),
      floorElevationMm: 0,
      scene: { units: 'mm' },
    });
    const p = projectTextCentreToScreen('t1', source(topDownCamera()));
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(400, 0);
    expect(p!.y).toBeCloseTo(300, 0);
  });

  /**
   * Η ΑΠΟΦΑΣΗ του ADR-344 Φ-3D: το άγκυρο είναι το **κέντρο των γραμμένων γραμμάτων**
   * (`resolveTextEmBox`), όχι το `position` — που είναι το σημείο προσάρτησης του πλέγματος
   * 9 σημείων και μπορεί να βρίσκεται σε οποιαδήποτε γωνία του κειμένου. Αν κάποιος το
   * αλλάξει σε `position`, ο editor θα κρέμεται δίπλα στα γράμματα σε κάθε στοίχιση εκτός MC.
   */
  it('το άγκυρο ακολουθεί τη ΣΤΟΙΧΙΣΗ, όχι το σημείο εισαγωγής', () => {
    const cam = topDownCamera();
    findDxfEntityInScope.mockReturnValue({
      entity: textEntity({ textStyle: { textAlign: 'center', textBaseline: 'middle' } }),
      floorElevationMm: 0, scene: { units: 'mm' },
    });
    const centred = projectTextCentreToScreen('t1', source(cam))!;

    findDxfEntityInScope.mockReturnValue({
      entity: textEntity({ textStyle: { textAlign: 'left', textBaseline: 'top' } }),
      floorElevationMm: 0, scene: { units: 'mm' },
    });
    const topLeft = projectTextCentreToScreen('t1', source(cam))!;

    // Ίδιο `position`, άλλη στοίχιση → το κέντρο των γραμμάτων μετακινείται δεξιά + κάτω.
    expect(topLeft.x).toBeGreaterThan(centred.x);
    expect(topLeft.y).toBeGreaterThan(centred.y);
  });

  it('id εκτός ενεργού εύρους ορόφων → null', () => {
    findDxfEntityInScope.mockReturnValue(null);
    expect(projectTextCentreToScreen('ghost', source(topDownCamera()))).toBeNull();
  });

  it('οντότητα που δεν είναι κείμενο → null', () => {
    findDxfEntityInScope.mockReturnValue({
      entity: { id: 'l1', type: 'line' }, floorElevationMm: 0, scene: { units: 'mm' },
    });
    expect(projectTextCentreToScreen('l1', source(topDownCamera()))).toBeNull();
  });

  it('χωρίς κάμερα ή καμβά → null (η σκηνή δεν έχει προσαρτηθεί ακόμη)', () => {
    findDxfEntityInScope.mockReturnValue({
      entity: textEntity(), floorElevationMm: 0, scene: { units: 'mm' },
    });
    expect(projectTextCentreToScreen('t1', source(null))).toBeNull();
    expect(projectTextCentreToScreen('t1', source(topDownCamera(), null))).toBeNull();
  });

  it('πίσω από την κάμερα → null', () => {
    findDxfEntityInScope.mockReturnValue({
      entity: textEntity(), floorElevationMm: 0, scene: { units: 'mm' },
    });
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(0, 10, 0);
    cam.lookAt(0, 20, 0); // κοιτά ΑΝΤΙΘΕΤΑ από το κείμενο
    cam.updateMatrixWorld(true);
    expect(projectTextCentreToScreen('t1', source(cam))).toBeNull();
  });

  it('υψόμετρο ορόφου: το ίδιο κείμενο σε ψηλότερο όροφο προβάλλεται αλλού', () => {
    const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    cam.position.set(20, 5, 20); // πλάγια λήψη — αλλιώς το ύψος δεν αλλάζει pixel σε κάτοψη
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);

    findDxfEntityInScope.mockReturnValue({
      entity: textEntity(), floorElevationMm: 0, scene: { units: 'mm' },
    });
    const ground = projectTextCentreToScreen('t1', source(cam))!;

    findDxfEntityInScope.mockReturnValue({
      entity: textEntity(), floorElevationMm: 3000, scene: { units: 'mm' },
    });
    const upstairs = projectTextCentreToScreen('t1', source(cam))!;

    // Ο 2ος όροφος είναι ΨΗΛΟΤΕΡΑ → μικρότερο screen-Y (ο άξονας οθόνης κοιτά κάτω).
    expect(upstairs.y).toBeLessThan(ground.y);
  });

  it('μονάδες σκηνής: 5 μέτρα ≡ 5000 mm — ο συντελεστής εφαρμόζεται', () => {
    const cam = topDownCamera();
    findDxfEntityInScope.mockReturnValue({
      entity: textEntity({ position: { x: 5, y: 0 }, height: 0.25 }),
      floorElevationMm: 0,
      scene: { units: 'm' },
    });
    const metres = projectTextCentreToScreen('t1', source(cam))!;

    findDxfEntityInScope.mockReturnValue({
      entity: textEntity({ position: { x: 5000, y: 0 }, height: 250 }),
      floorElevationMm: 0,
      scene: { units: 'mm' },
    });
    const millimetres = projectTextCentreToScreen('t1', source(cam))!;

    expect(metres.x).toBeCloseTo(millimetres.x, 3);
    expect(metres.y).toBeCloseTo(millimetres.y, 3);
  });
});
