/**
 * CanvasNumericInputStore — pins the pub/sub contract used by
 * `useCanvasNumericAnchor` / `useCanvasNumericPendingDistance` (ADR-040
 * micro-leaf pattern) and the sign-resolver timing fix (2026-07-17).
 *
 * Module-level singleton: κάθε test καθαρίζει την κατάσταση με `cancel()`
 * στο `afterEach` ώστε να μην «διαρρεύσει» ενεργό buffer/anchor στο επόμενο.
 */

import { CanvasNumericInputStore } from '../CanvasNumericInputStore';
import type { Point2D } from '../../../rendering/types/Types';
import type { Guide } from '../../guides/guide-types';
// ADR-677 — ο πληκτρολογημένος αριθμός περνά πλέον από fromDisplay(τιμή, μονάδα εμφάνισης)
// πριν γίνει scene units. Χωρίς ρητό setUnit() το store πέφτει στο DEFAULT_DISPLAY_UNIT
// ('m' — ADR-677 Φ1), οπότε κάθε test που ελέγχει συγκεκριμένο αριθμό πρέπει να δηλώνει
// ρητά τη μονάδα (μη-ντετερμινιστικό αλλιώς: το default μπορεί να αλλάξει ξανά στο μέλλον).
import { displayUnitState } from '../../../config/display-unit-state';
// Sole writer: useDxfSceneConversion σε production· εδώ κλειδώνουμε 1 (1 scene unit = 1 mm)
// ώστε η μετατροπή display→scene να είναι ΜΟΝΟ fromDisplay, χωρίς δεύτερο άγνωστο συντελεστή.
import { immediateSceneScale } from '../../cursor/ImmediateSceneScaleStore';

function makeGuide(id: string, overrides: Partial<Guide> = {}): Guide {
  return {
    id,
    axis: 'X',
    offset: 100,
    label: null,
    style: null,
    visible: true,
    locked: false,
    createdAt: '2026-07-18T00:00:00.000Z',
    parentId: null,
    groupId: null,
    ...overrides,
  };
}

function activate(
  overrides: Partial<{
    signResolver: () => 1 | -1;
    refGuide: Guide;
    anchor: Point2D;
    onConfirm: (distance: number, sign: 1 | -1, refGuideId: string) => void;
    onCancel: () => void;
  }> = {},
): {
  signResolver: jest.Mock<1 | -1, []>;
  onConfirm: jest.Mock<void, [number, 1 | -1, string]>;
  onCancel: jest.Mock<void, []>;
  anchor: Point2D;
} {
  const signResolver = jest.fn<1 | -1, []>(() => 1);
  const onConfirm = jest.fn<void, [number, 1 | -1, string]>();
  const onCancel = jest.fn<void, []>();
  const anchor: Point2D = { x: 1, y: 2 };

  CanvasNumericInputStore.activate(
    overrides.signResolver ?? signResolver,
    overrides.refGuide ?? makeGuide('guide_X_001'),
    overrides.anchor ?? anchor,
    overrides.onConfirm ?? onConfirm,
    overrides.onCancel ?? onCancel,
  );

  return { signResolver, onConfirm, onCancel, anchor };
}

describe('CanvasNumericInputStore', () => {
  beforeEach(() => {
    // Ντετερμινιστική κλίμακα: 1 scene unit = 1 mm — επαληθεύτηκε πως χωρίς αυτό το
    // module-level default είναι ήδη 1 (κανένα άλλο test σε αυτό το αρχείο το αλλάζει),
    // αλλά το δηλώνουμε ρητά ώστε τα νούμερα να μη βασίζονται σε σιωπηρή προϋπόθεση.
    immediateSceneScale.set(1);
  });

  afterEach(() => {
    // Καθαρισμός module-singleton state — αλλιώς «διαρρέει» σε επόμενο test.
    CanvasNumericInputStore.cancel();
  });

  describe('activate() anchor cloning', () => {
    it('κλωνοποιεί το anchor — μετέπειτα mutation του caller object ΔΕΝ αλλάζει το getAnchor()', () => {
      const callerAnchor: Point2D = { x: 10, y: 20 };
      const { onConfirm, signResolver } = activate({ anchor: callerAnchor });
      void onConfirm;
      void signResolver;

      callerAnchor.x = 999;
      callerAnchor.y = 999;

      expect(CanvasNumericInputStore.getAnchor()).toEqual({ x: 10, y: 20 });
    });
  });

  describe('getRefGuide() — παγωμένο αντίγραφο του οδηγού αναφοράς', () => {
    it('κλωνοποιεί τον οδηγό — μετέπειτα mutation του caller ΔΕΝ αλλάζει το getRefGuide()', () => {
      const callerGuide = makeGuide('guide_X_007', { offset: 100 });
      activate({ refGuide: callerGuide });

      callerGuide.offset = 999;
      callerGuide.visible = false;

      expect(CanvasNumericInputStore.getRefGuide()?.offset).toBe(100);
      expect(CanvasNumericInputStore.getRefGuide()?.visible).toBe(true);
    });

    it('κλωνοποιεί και τα άκρα ενός διαγώνιου (XZ) οδηγού', () => {
      const start: Point2D = { x: 0, y: 0 };
      const callerGuide = makeGuide('guide_XZ_001', {
        axis: 'XZ', offset: 0, startPoint: start, endPoint: { x: 10, y: 10 },
      });
      activate({ refGuide: callerGuide });

      start.x = 999;

      expect(CanvasNumericInputStore.getRefGuide()?.startPoint).toEqual({ x: 0, y: 0 });
    });

    it('επιστρέφει ΤΗΝ ΙΔΙΑ αναφορά πριν/μετά από addChar (useSyncExternalStore contract)', () => {
      activate();
      const before = CanvasNumericInputStore.getRefGuide();
      CanvasNumericInputStore.addChar('5');

      expect(before).not.toBeNull();
      expect(CanvasNumericInputStore.getRefGuide()).toBe(before);
    });

    it('null μετά από confirm() και μετά από cancel()', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.confirm();
      expect(CanvasNumericInputStore.getRefGuide()).toBeNull();

      activate();
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.cancel();
      expect(CanvasNumericInputStore.getRefGuide()).toBeNull();
    });
  });

  describe('getAnchor() reference stability (useSyncExternalStore contract)', () => {
    it('επιστρέφει ΤΗΝ ΙΔΙΑ αναφορά πριν/μετά από addChar — ένα νέο literal θα προκαλούσε ατέρμονο re-render', () => {
      activate();
      const before = CanvasNumericInputStore.getAnchor();
      CanvasNumericInputStore.addChar('5');
      const after = CanvasNumericInputStore.getAnchor();

      expect(before).not.toBeNull();
      expect(after).toBe(before);
    });

    it('επιστρέφει ΤΗΝ ΙΔΙΑ αναφορά πριν/μετά από backspace', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      const before = CanvasNumericInputStore.getAnchor();
      CanvasNumericInputStore.backspace();
      const after = CanvasNumericInputStore.getAnchor();

      expect(after).toBe(before);
    });
  });

  describe('getAnchor() null after confirm/cancel', () => {
    it('επιστρέφει null μετά από confirm() με μη-κενό buffer', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      const confirmed = CanvasNumericInputStore.confirm();

      expect(confirmed).toBe(true);
      expect(CanvasNumericInputStore.getAnchor()).toBeNull();
    });

    it('επιστρέφει null μετά από cancel()', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.cancel();

      expect(CanvasNumericInputStore.getAnchor()).toBeNull();
    });
  });

  describe('getPendingDistance()', () => {
    // Μονάδα εμφάνισης = 'mm' ⇒ fromDisplay(τιμή, 'mm') = τιμή (ταυτοτική μετατροπή,
    // βλ. mmToSceneUnits('mm') = 1 στο scene-units.ts) — έτσι αυτά τα tests συνεχίζουν
    // να ελέγχουν «η τιμή περνά αυτούσια», ΟΧΙ ένα νέο νόημα. Αν ο χρήστης είχε 'm'
    // επιλεγμένο (DEFAULT_DISPLAY_UNIT, ADR-677 Φ1) οι ίδιες πληκτρολογήσεις θα έδιναν
    // ×1000 — αυτό το καλύπτει το νέο describe «μονάδα εμφάνισης» παρακάτω.
    const originalUnit = displayUnitState.getUnit();
    beforeEach(() => { displayUnitState.setUnit('mm'); });
    afterEach(() => { displayUnitState.setUnit(originalUnit); });

    it('null όσο ο buffer είναι κενός', () => {
      activate();
      expect(CanvasNumericInputStore.getPendingDistance()).toBeNull();
    });

    it('επιστρέφει την parsed απόλυτη τιμή ενώ πληκτρολογεί (μονάδα mm — ταυτοτική)', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(5);

      CanvasNumericInputStore.addChar('.');
      CanvasNumericInputStore.addChar('2');
      expect(CanvasNumericInputStore.getPendingDistance()).toBeCloseTo(5.2, 6);
    });

    it('επιστρέφει την ΑΠΟΛΥΤΗ τιμή ακόμα κι αν ο buffer έχει αρνητικό πρόσημο (μονάδα mm — ταυτοτική)', () => {
      activate();
      CanvasNumericInputStore.addChar('-');
      CanvasNumericInputStore.addChar('3');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(3);
    });

    it('null όταν η τιμή είναι ~0 (κάτω από το threshold 0.001, μετά τη μετατροπή)', () => {
      activate();
      CanvasNumericInputStore.addChar('0');
      expect(CanvasNumericInputStore.getPendingDistance()).toBeNull();
    });
  });

  describe('μονάδα εμφάνισης (ADR-677) — η πληκτρολογημένη τιμή ερμηνεύεται display → mm → scene', () => {
    const originalUnit = displayUnitState.getUnit();
    afterEach(() => { displayUnitState.setUnit(originalUnit); });

    it('mm: 150 πληκτρολογημένα = 150 scene units (ταυτοτική)', () => {
      displayUnitState.setUnit('mm');
      activate();
      CanvasNumericInputStore.addChar('1');
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.addChar('0');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(150);
    });

    it('m: 150 πληκτρολογημένα μέτρα = 150000 scene units (mm)', () => {
      displayUnitState.setUnit('m');
      activate();
      CanvasNumericInputStore.addChar('1');
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.addChar('0');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(150000);
    });

    it('cm: 150 πληκτρολογημένα εκατοστά = 1500 scene units (mm)', () => {
      displayUnitState.setUnit('cm');
      activate();
      CanvasNumericInputStore.addChar('1');
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.addChar('0');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(1500);
    });

    it('confirm() δίνει στο onConfirm ΤΗΝ ΙΔΙΑ μετατραπείσα τιμή που έβλεπε το φάντασμα (WYSIWYG)', () => {
      displayUnitState.setUnit('m');
      const { onConfirm } = activate();
      CanvasNumericInputStore.addChar('2');
      const ghostValue = CanvasNumericInputStore.getPendingDistance();

      CanvasNumericInputStore.confirm();

      expect(ghostValue).toBe(2000);
      expect(onConfirm).toHaveBeenCalledWith(2000, expect.any(Number), expect.any(String));
    });

    it('το κατώφλι ελέγχεται ΜΕΤΑ τη μετατροπή: "0.0005" σε m (=0,5mm) ΔΕΝ είναι null', () => {
      displayUnitState.setUnit('m');
      activate();
      '0.0005'.split('').forEach(ch => CanvasNumericInputStore.addChar(ch));
      expect(CanvasNumericInputStore.getPendingDistance()).toBeCloseTo(0.5, 6);
    });

    it('το ίδιο πληκτρολογημένο "0.0005" σε mm ΕΙΝΑΙ null (κάτω από το threshold)', () => {
      displayUnitState.setUnit('mm');
      activate();
      '0.0005'.split('').forEach(ch => CanvasNumericInputStore.addChar(ch));
      expect(CanvasNumericInputStore.getPendingDistance()).toBeNull();
    });
  });

  describe('onConfirm payload', () => {
    // Μονάδα mm — ταυτοτική μετατροπή, βλ. σχόλιο στο describe getPendingDistance().
    const originalUnit = displayUnitState.getUnit();
    beforeEach(() => { displayUnitState.setUnit('mm'); });
    afterEach(() => { displayUnitState.setUnit(originalUnit); });

    it('καλείται με (absoluteDistance, sign, refGuideId) (μονάδα mm — ταυτοτική)', () => {
      const { onConfirm, signResolver } = activate({ refGuide: makeGuide('guide_X_042') });
      signResolver.mockReturnValue(-1);

      CanvasNumericInputStore.addChar('7');
      CanvasNumericInputStore.addChar('.');
      CanvasNumericInputStore.addChar('5');
      CanvasNumericInputStore.confirm();

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(7.5, -1, 'guide_X_042');
    });
  });

  describe('signResolver timing — καλείται στο confirm(), ΟΧΙ στο activate() (fix 2026-07-17)', () => {
    it('0 κλήσεις αμέσως μετά το activate, 1 κλήση μετά το confirm', () => {
      const { signResolver } = activate();

      expect(signResolver).toHaveBeenCalledTimes(0);

      CanvasNumericInputStore.addChar('4');
      expect(signResolver).toHaveBeenCalledTimes(0);

      CanvasNumericInputStore.confirm();
      expect(signResolver).toHaveBeenCalledTimes(1);
    });

    it('ΔΕΝ καλείται καθόλου αν ο χρήστης κάνει cancel() αντί για confirm()', () => {
      const { signResolver } = activate();
      CanvasNumericInputStore.addChar('4');
      CanvasNumericInputStore.cancel();

      expect(signResolver).toHaveBeenCalledTimes(0);
    });
  });

  describe('subscribe()', () => {
    it('ειδοποιεί τους listeners σε activate / addChar / confirm', () => {
      const listener = jest.fn();
      const unsubscribe = CanvasNumericInputStore.subscribe(listener);

      activate();
      expect(listener).toHaveBeenCalledTimes(1);

      CanvasNumericInputStore.addChar('9');
      expect(listener).toHaveBeenCalledTimes(2);

      CanvasNumericInputStore.confirm();
      expect(listener).toHaveBeenCalledTimes(3);

      unsubscribe();
    });

    it('ειδοποιεί τους listeners σε cancel', () => {
      activate();
      const listener = jest.fn();
      const unsubscribe = CanvasNumericInputStore.subscribe(listener);

      CanvasNumericInputStore.cancel();
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it('unsubscribe σταματά τις ειδοποιήσεις', () => {
      const listener = jest.fn();
      const unsubscribe = CanvasNumericInputStore.subscribe(listener);
      unsubscribe();

      activate();
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
