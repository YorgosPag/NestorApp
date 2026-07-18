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

function activate(
  overrides: Partial<{
    signResolver: () => 1 | -1;
    refGuideId: string;
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
    overrides.refGuideId ?? 'guide_X_001',
    overrides.anchor ?? anchor,
    overrides.onConfirm ?? onConfirm,
    overrides.onCancel ?? onCancel,
  );

  return { signResolver, onConfirm, onCancel, anchor };
}

describe('CanvasNumericInputStore', () => {
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
    it('null όσο ο buffer είναι κενός', () => {
      activate();
      expect(CanvasNumericInputStore.getPendingDistance()).toBeNull();
    });

    it('επιστρέφει την parsed απόλυτη τιμή ενώ πληκτρολογεί', () => {
      activate();
      CanvasNumericInputStore.addChar('5');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(5);

      CanvasNumericInputStore.addChar('.');
      CanvasNumericInputStore.addChar('2');
      expect(CanvasNumericInputStore.getPendingDistance()).toBeCloseTo(5.2, 6);
    });

    it('επιστρέφει την ΑΠΟΛΥΤΗ τιμή ακόμα κι αν ο buffer έχει αρνητικό πρόσημο', () => {
      activate();
      CanvasNumericInputStore.addChar('-');
      CanvasNumericInputStore.addChar('3');
      expect(CanvasNumericInputStore.getPendingDistance()).toBe(3);
    });

    it('null όταν η τιμή είναι ~0 (κάτω από το threshold 0.001)', () => {
      activate();
      CanvasNumericInputStore.addChar('0');
      expect(CanvasNumericInputStore.getPendingDistance()).toBeNull();
    });
  });

  describe('onConfirm payload', () => {
    it('καλείται με (absoluteDistance, sign, refGuideId)', () => {
      const { onConfirm, signResolver } = activate({ refGuideId: 'guide_X_042' });
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
