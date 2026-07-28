/**
 * ADR-718 §Β — τα κατηγορήματα «τι επιτρέπεται» του `PEDIT Close / Open`, καρφωμένα.
 *
 * ── Γιατί έχουν δικό τους αρχείο ────────────────────────────────────────────────────────────
 * Επειδή είναι το **μοναδικό** σημείο όπου αποφασίζεται τι θα δει ο χρήστης — και το είδαμε να
 * μένει ακάλυπτο: μια χαλάρωση του `canOpenPolyline` σε «κάθε πολυγραμμή» πέρασε από **150
 * πράσινα tests** χωρίς να κοκκινίσει τίποτα (mutation check, 2026-07-28). Το μενού θα
 * πρόσφερε «Άνοιγμα» σε ήδη ανοιχτή γραμμή, ο command θα το αρνιόταν, και ο χρήστης θα έβλεπε
 * μια εντολή που **δεν κάνει τίποτα** — ακριβώς η «νεκρή λαβή» του ADR-654.
 *
 * Τα δύο κατηγορήματα είναι **αμοιβαία αποκλειόμενα και εξαντλητικά** πάνω στις έγκυρες
 * πολυγραμμές: αυτό είναι που επιτρέπει στο μενού να δείχνει **μία** γραμμή αντί για ζευγάρι με
 * το ένα απενεργοποιημένο (AutoCAD parity). Ελέγχεται ρητά παρακάτω.
 *
 * @see ../polyline-closure-ops
 */

import type { Entity } from '../../../types/entities';
import { canClosePolyline, canOpenPolyline, buildPolylineClosureCommand } from '../polyline-closure-ops';
import { createMockSceneManager } from '../../../core/commands/__tests__/mock-scene-manager';
import type { SceneEntity } from '../../../core/commands/interfaces';

const TRIANGLE = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

function entity(over: Partial<{ type: string; closed: boolean; vertices: { x: number; y: number }[] }> = {}): Entity {
  return {
    id: 'ent-1',
    type: over.type ?? 'polyline',
    layerId: 'lyr',
    vertices: over.vertices ?? TRIANGLE,
    closed: over.closed ?? false,
  } as unknown as Entity;
}

describe('canClosePolyline / canOpenPolyline', () => {
  it.each([
    ['ανοιχτή polyline ≥3 κορυφές', entity({ closed: false }), true, false],
    ['κλειστή polyline ≥3 κορυφές', entity({ closed: true }), false, true],
    ['ανοιχτή lwpolyline', entity({ type: 'lwpolyline', closed: false }), true, false],
    ['κλειστή lwpolyline', entity({ type: 'lwpolyline', closed: true }), false, true],
    ['2 κορυφές (δεν γίνεται δακτύλιος)', entity({ vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), false, false],
    ['γραμμή', entity({ type: 'line' }), false, false],
    ['γραμμοσκίαση', entity({ type: 'hatch', closed: true }), false, false],
  ])('%s', (_label, e, expectClose, expectOpen) => {
    expect(canClosePolyline(e)).toBe(expectClose);
    expect(canOpenPolyline(e)).toBe(expectOpen);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('%s ⇒ καμία πράξη (καμία εξαίρεση)', (_label, e) => {
    expect(canClosePolyline(e)).toBe(false);
    expect(canOpenPolyline(e)).toBe(false);
  });

  it('ΠΟΤΕ και τα δύο μαζί — γι΄ αυτό το μενού δείχνει ΜΙΑ γραμμή, όχι ζευγάρι', () => {
    for (const closed of [true, false]) {
      const e = entity({ closed });
      expect(canClosePolyline(e) && canOpenPolyline(e)).toBe(false);
      // …και πάντα ακριβώς μία, σε κάθε έγκυρη πολυγραμμή.
      expect(canClosePolyline(e) || canOpenPolyline(e)).toBe(true);
    }
  });
});

describe('buildPolylineClosureCommand — το μενού δεν μπορεί να παραγγείλει ό,τι ο command αρνείται', () => {
  const sceneWith = (e: Entity) => createMockSceneManager([e as unknown as SceneEntity]);

  it.each([
    ['close σε ήδη κλειστή', entity({ closed: true }), { kind: 'close' as const }],
    ['open σε ήδη ανοιχτή', entity({ closed: false }), { kind: 'open' as const }],
    ['open-at-edge σε ανοιχτή', entity({ closed: false }), { kind: 'open-at-edge' as const, edgeIndex: 0 }],
    ['open σε γραμμή', entity({ type: 'line', closed: true }), { kind: 'open' as const }],
  ])('%s ⇒ null', (_label, e, op) => {
    expect(buildPolylineClosureCommand('ent-1', op, sceneWith(e))).toBeNull();
  });

  it.each([
    ['close σε ανοιχτή', entity({ closed: false }), { kind: 'close' as const }],
    ['open σε κλειστή', entity({ closed: true }), { kind: 'open' as const }],
    ['open-at-edge σε κλειστή', entity({ closed: true }), { kind: 'open-at-edge' as const, edgeIndex: 2 }],
  ])('%s ⇒ εντολή', (_label, e, op) => {
    expect(buildPolylineClosureCommand('ent-1', op, sceneWith(e))).not.toBeNull();
  });

  it('άγνωστο id ⇒ null (καμία εντολή σε φάντασμα)', () => {
    expect(
      buildPolylineClosureCommand('ent-missing', { kind: 'open' }, sceneWith(entity({ closed: true }))),
    ).toBeNull();
  });
});
