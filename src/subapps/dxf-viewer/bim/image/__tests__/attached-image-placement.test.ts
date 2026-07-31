/**
 * ADR-736 §6 — έλεγχοι της τοποθέτησης εικόνας που ανέβασε ο χρήστης.
 *
 * Δεν ελέγχεται εδώ ο μηχανισμός τοποθέτησης — τον καλύπτει το `place-entourage.test.ts` και
 * είναι ο ΙΔΙΟΣ. Ελέγχεται ό,τι είναι **αποκλειστικά** αυτής της οικογένειας: ότι το μέγεθος
 * έρχεται από την ίδια την επιλογή (δεν υπάρχει catalog να ρωτηθεί), και ότι μια **ξεπερασμένη**
 * επιλογή δεν τοποθετεί ποτέ με λάθος διαστάσεις.
 */

import {
  attachedImageSelection,
  attachedImagePlacer,
  ATTACHED_IMAGE_LAYER_ID,
} from '../attached-image-placement';
import { mmToSceneUnits } from '../../../utils/scene-units';

const URL = 'https://storage.invalid/companies/c1/assets/abc123.jpg';
const SELECTION = {
  id: URL,
  url: URL,
  sizeMm: { widthMm: 30_000, heightMm: 13_500 },
  sourceName: '2.jpg',
} as const;

beforeEach(() => attachedImageSelection.resetForTests());
afterAll(() => attachedImageSelection.resetForTests());

describe('attachedImagePlacer — το μέγεθος ζει στην ΕΠΙΛΟΓΗ, όχι σε catalog', () => {
  it('χωρίς επιλογή δεν υπάρχει μέγεθος ⇒ καμία οντότητα', () => {
    expect(attachedImagePlacer.resolveSceneSize(URL, 'm')).toBeNull();
    expect(
      attachedImagePlacer.buildEntity({ position: { x: 0, y: 0 }, itemId: URL, url: URL }),
    ).toBeNull();
  });

  it('μετατρέπει τα χιλιοστά της επιλογής στις μονάδες της σκηνής', () => {
    attachedImageSelection.set(SELECTION);
    const size = attachedImagePlacer.resolveSceneSize(URL, 'm')!;
    expect(size.width).toBeCloseTo(SELECTION.sizeMm.widthMm * mmToSceneUnits('m'));
    expect(size.height).toBeCloseTo(SELECTION.sizeMm.heightMm * mmToSceneUnits('m'));
  });

  it('🔴 ξεπερασμένο id (η επιλογή άλλαξε πριν το κλικ) ⇒ null, ΠΟΤΕ λάθος διαστάσεις', () => {
    attachedImageSelection.set(SELECTION);
    expect(attachedImagePlacer.resolveSceneSize('https://storage.invalid/other.jpg', 'm')).toBeNull();
  });
});

describe('attachedImagePlacer — τι γράφεται στην οντότητα', () => {
  beforeEach(() => attachedImageSelection.set(SELECTION));

  it('το κλικ είναι το ΚΕΝΤΡΟ· το `position` είναι η κάτω-αριστερή γωνία', () => {
    const entity = attachedImagePlacer.buildEntity({
      position: { x: 100, y: 50 },
      itemId: URL,
      url: URL,
      sceneUnits: 'm',
    })!;
    expect(entity.position.x).toBeCloseTo(100 - entity.width / 2);
    expect(entity.position.y).toBeCloseTo(50 - entity.height / 2);
    expect(entity.layerId).toBe(ATTACHED_IMAGE_LAYER_ID);
  });

  it('🔴 το όνομα αρχείου ταξιδεύει ως `sourceName` — αλλιώς το πάνελ «Πηγή» δείχνει storage path', () => {
    const entity = attachedImagePlacer.buildEntity({
      position: { x: 0, y: 0 },
      itemId: URL,
      url: URL,
      sceneUnits: 'm',
      sourceName: SELECTION.sourceName,
    })!;
    expect(entity.sourceName).toBe('2.jpg');
  });

  it('χωρίς όνομα το πεδίο ΔΕΝ γράφεται καθόλου (καμία τιμή `undefined` προς Firestore)', () => {
    const entity = attachedImagePlacer.buildEntity({
      position: { x: 0, y: 0 },
      itemId: URL,
      url: URL,
      sceneUnits: 'm',
    })!;
    expect('sourceName' in entity).toBe(false);
  });

  it('το ghost έχει σταθερό id και ΤΟ ΙΔΙΟ transform με το commit', () => {
    const params = { position: { x: 7, y: 9 }, itemId: URL, url: URL, sceneUnits: 'm' } as const;
    const ghost = attachedImagePlacer.buildGhost(params)!;
    const entity = attachedImagePlacer.buildEntity(params)!;
    expect(ghost.id).toBe(`${ATTACHED_IMAGE_LAYER_ID}-ghost`);
    expect(ghost.id).not.toBe(entity.id);
    expect(ghost.position).toEqual(entity.position);
    expect(ghost.width).toBeCloseTo(entity.width);
    expect(ghost.height).toBeCloseTo(entity.height);
  });
});
