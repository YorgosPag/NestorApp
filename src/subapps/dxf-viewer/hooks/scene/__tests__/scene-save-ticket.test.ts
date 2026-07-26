/**
 * ADR-714 — save-ticket unit tests.
 *
 * Κλειδώνει δύο αμετάβλητα:
 *  1. Το ticket είναι ΠΑΓΩΜΕΝΟ — μια μεταγενέστερη μετάλλαξη (ο τρόπος με τον οποίο θα
 *     ξαναγεννιόταν το bug «ο όροφος Α προγραμματίζει, ο Β εκτελεί») σπάει θορυβωδώς.
 *  2. Ο `isDxfWipe` πυροδοτεί ΜΟΝΟ στο πραγματικό αποτύπωμα της ζημιάς — μηδενισμός της
 *     DXF γεωμετρίας ενώ το BIM επιβιώνει — και ποτέ σε νόμιμη επεξεργασία.
 */

import type { SceneModel } from '../../../types/scene';
import { countDxfEntities, createSceneSaveTicket, isDxfWipe, ticketIdentity } from '../scene-save-ticket';

type SceneEntity = SceneModel['entities'][number];

const entity = (id: string, type: string): SceneEntity =>
  ({ id, type, layerId: 'lyr_1', visible: true }) as unknown as SceneEntity;

const scene = (...entities: SceneEntity[]): SceneModel =>
  ({
    entities,
    layersById: {},
    bounds: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } },
    units: 'mm',
  }) as unknown as SceneModel;

const TICKET_INPUT = {
  levelId: 'lvl_A',
  floorId: 'flr_A',
  companyId: 'comp_1',
  userUid: 'uid_1',
  fileId: 'file_A',
  fileName: 'Ισόγειο 1.dxf',
  canonicalScenePath: 'companies/c/entities/floor/flr_A/…/file_A.scene.json',
  saveContext: null,
  scene: scene(entity('l1', 'line')),
};

describe('createSceneSaveTicket', () => {
  it('παγώνει το ticket — καμία μετάλλαξη μετά το scheduling', () => {
    const ticket = createSceneSaveTicket(TICKET_INPUT);

    expect(Object.isFrozen(ticket)).toBe(true);
    expect(() => {
      (ticket as { fileId: string | null }).fileId = 'file_B';
    }).toThrow();
    expect(ticket.fileId).toBe('file_A');
  });

  it('αντιγράφει την είσοδο — μετάλλαξη του input δεν αγγίζει το ticket', () => {
    const input = { ...TICKET_INPUT };
    const ticket = createSceneSaveTicket(input);

    input.fileId = 'file_B';
    input.floorId = 'flr_B';

    expect(ticket.fileId).toBe('file_A');
    expect(ticket.floorId).toBe('flr_A');
  });
});

describe('ticketIdentity', () => {
  it('αφαιρεί τη σκηνή αλλά κρατά ΟΛΗ την ταυτότητα (logging χωρίς το blob)', () => {
    const identity = ticketIdentity(createSceneSaveTicket(TICKET_INPUT));

    expect(identity).not.toHaveProperty('scene');
    expect(identity).toMatchObject({
      levelId: 'lvl_A',
      floorId: 'flr_A',
      fileId: 'file_A',
      fileName: 'Ισόγειο 1.dxf',
    });
  });
});

describe('countDxfEntities', () => {
  it('μετρά μόνο τις μη-BIM οντότητες', () => {
    const mixed = scene(
      entity('l1', 'line'),
      entity('l2', 'line'),
      entity('t1', 'text'),
      entity('c1', 'column'),
      entity('w1', 'wall'),
      entity('m1', 'imported-mesh'),
    );

    expect(countDxfEntities(mixed)).toBe(3);
  });

  it('είναι null/undefined safe', () => {
    expect(countDxfEntities(null)).toBe(0);
    expect(countDxfEntities(undefined)).toBe(0);
    expect(countDxfEntities(scene())).toBe(0);
  });

  // 🛡️ ADR-714 — Η ΚΟΙΝΗ ΣΥΜΒΑΣΗ ΔΥΟ ΚΑΤΑΝΑΛΩΤΩΝ. Το `countDxfEntities` δεν είναι μόνο του
  // φρουρού: το ΙΔΙΟ ερώτημα ρωτά και ο `useLevelSceneLoader` για να αποφασίσει αν η in-memory
  // σκηνή είναι «φορτωμένη» ή αν πρέπει να κατεβάσει το DXF από το Storage. Αυτή η μία υπόθεση
  // είναι η ΑΙΤΙΑ που ο φρουρός χτυπούσε: μια μόνο-BIM σκηνή έχει `entities.length > 0` (φαίνεται
  // φορτωμένη) αλλά ΜΗΔΕΝ DXF. Αν κάποιος «απλοποιήσει» οποιαδήποτε από τις δύο πλευρές σε
  // `entities.length`, το κενό ξανανοίγει — γι' αυτό η απόκλιση καρφώνεται εδώ ρητά.
  it('μόνο-BIM σκηνή: entities.length > 0 ΑΛΛΑ μηδέν DXF (η αιτία του ADR-714)', () => {
    // Ό,τι αφήνουν στη μνήμη τα per-entity BIM subscriptions πριν φτάσει το DXF από το Storage.
    const bimOnly = scene(
      entity('col_1', 'column'),
      entity('col_2', 'column'),
      entity('w_1', 'wall'),
    );

    // Το ΠΑΛΙΟ ερώτημα («έχει κάτι;») → «φορτωμένη» → το DXF δεν κατέβαινε ΠΟΤΕ.
    expect(bimOnly.entities.length).toBeGreaterThan(0);
    // Το ΣΩΣΤΟ ερώτημα («έχει DXF;») → χρειάζεται φόρτωση, και ο φρουρός τη βλέπει ως wipe.
    expect(countDxfEntities(bimOnly)).toBe(0);
    expect(isDxfWipe(bimOnly, 537)).toBe(true);
  });

  it('σκηνή με DXF: και οι δύο καταναλωτές τη δέχονται ως φορτωμένη', () => {
    const withDxf = scene(entity('l1', 'line'), entity('col_1', 'column'));

    expect(countDxfEntities(withDxf)).toBe(1);
    expect(isDxfWipe(withDxf, 537)).toBe(false);
  });
});

describe('isDxfWipe', () => {
  it('ΤΟ ΠΡΑΓΜΑΤΙΚΟ ΣΕΝΑΡΙΟ (2026-07-26): 1169 DXF → 0, με BIM να επιβιώνει', () => {
    // Ό,τι ακριβώς έγραψε ο 1ος Όροφος πάνω στο blob του Ισογείου: μόνο κολόνες.
    const wipedScene = scene(...Array.from({ length: 12 }, (_, i) => entity(`col_${i}`, 'column')));

    expect(isDxfWipe(wipedScene, 1169)).toBe(true);
    // Ο ΠΑΛΙΟΣ φρουρός θα το άφηνε να περάσει — 12 entities, άρα «όχι κενό».
    expect(wipedScene.entities.length).toBeGreaterThan(0);
  });

  it('επιτρέπει νόμιμη μείωση DXF όσο μένει έστω μία οντότητα', () => {
    expect(isDxfWipe(scene(entity('l1', 'line')), 1169)).toBe(false);
  });

  it('επιτρέπει διαγραφή ΜΟΝΟ BIM (η DXF γεωμετρία ανέπαφη)', () => {
    expect(isDxfWipe(scene(entity('l1', 'line'), entity('l2', 'line')), 2)).toBe(false);
  });

  it('fail-safe: με άγνωστο baseline δεν μπλοκάρει ποτέ (γνήσιο πρώτο save)', () => {
    expect(isDxfWipe(scene(), 0)).toBe(false);
    expect(isDxfWipe(scene(entity('c1', 'column')), 0)).toBe(false);
    expect(isDxfWipe(scene(), -1)).toBe(false);
  });

  it('πιάνει και την τελείως κενή σκηνή πάνω από γεμάτο προορισμό', () => {
    expect(isDxfWipe(scene(), 500)).toBe(true);
    expect(isDxfWipe(null, 500)).toBe(true);
  });
});
