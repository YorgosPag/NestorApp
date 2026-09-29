/**
 * @fileoverview **ΤΟ ΠΡΟΧΕΙΡΟ ΤΟΥ ΠΙΝΕΛΟΥ** (ADR-884 Φ2ζ ζ3 · §4.15).
 *
 * - **Π** — reducer: νέος/μετακίνηση/μέγεθος/αφαίρεση/επιλογή/απόρριψη· ο ΙΔΙΟΣ κριτής με τον γραφέα (όριο, πόλος) ⇒ ίδιο αντικείμενο.
 * - **Ρ** — rebase: χωρίς εκκρεμότητα ακολουθεί τον διακομιστή· με εκκρεμότητα την κρατά.
 * - **Ο** — προεπισκόπηση (καταστάσεις) · hit-test (ο μικρότερος νικά) · πλήκτρα της λαβής.
 */

import {
  MAX_TOUR_REDACTIONS, TOUR_REDACTION_MAX_RADIUS_RAD, TOUR_REDACTION_MIN_RADIUS_RAD,
} from '@/constants/spatial-tour-vocabulary';
import type { TourRedaction, TourRedactionRegion } from '@/types/spatial-tour';

import {
  draftEdits,
  initialRedactionDraft,
  redactionAt,
  redactionDraftReducer as reduce,
  redactionKeyAction,
  redactionPreviewOf,
  REDACTION_KEY_RESIZE_FACTOR,
  type TourRedactionDraft,
} from '../tour-redaction-draft';

const A: TourRedactionRegion = { yawRad: 0.5, pitchRad: 0.1, radiusRad: 0.2 };
const applied = (id: string, region: TourRedactionRegion = A, source: 'manual' | 'auto' = 'auto'): TourRedaction =>
  ({ id, ...region, source, createdBy: 'system', createdAt: '2026-09-28T10:00:00.000Z' });
const id = (n: number) => `tred_00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('Π — reducer', () => {
  it('νέος κύκλος ⇒ επιλεγμένος, χειροκίνητος, στη δέσμη ως create', () => {
    const d = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: A });
    expect(d.selectedId).toBe(id(1));
    expect(d.working).toEqual([{ id: id(1), ...A, source: 'manual' }]);
    expect(draftEdits(d)).toEqual([{ op: 'redact', redactionId: id(1), mode: 'create', region: A }]);
  });

  it('η ακτίνα κόβεται στα όρια (ποτέ εξαφάνιση)· μετακίνηση κανονικοποιεί το yaw', () => {
    let d = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: { ...A, radiusRad: 10 } });
    expect(d.working[0]?.radiusRad).toBe(TOUR_REDACTION_MAX_RADIUS_RAD);
    d = reduce(d, { kind: 'resize', id: id(1), radiusRad: 0 });
    expect(d.working[0]?.radiusRad).toBe(TOUR_REDACTION_MIN_RADIUS_RAD);
    d = reduce(d, { kind: 'move', id: id(1), yawRad: 2 * Math.PI + 0.25, pitchRad: 0 });
    expect(d.working[0]?.yawRad).toBeCloseTo(0.25, 12);
  });

  it('ο κριτής του γραφέα: πάνω από τον πόλο ή πάνω από το όριο ⇒ ΙΔΙΟ αντικείμενο', () => {
    const d = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: A });
    expect(reduce(d, { kind: 'move', id: id(1), yawRad: 0, pitchRad: 2 })).toBe(d);
    const full = initialRedactionDraft(Array.from({ length: MAX_TOUR_REDACTIONS }, (_, i) => applied(id(i + 10))));
    expect(reduce(full, { kind: 'add', id: id(1), region: A })).toBe(full);
    expect(reduce(d, { kind: 'add', id: id(1), region: A })).toBe(d);
  });

  it('αφαίρεση εφαρμοσμένου ⇒ unredact στη δέσμη · απόρριψη ⇒ πίσω στα εφαρμοσμένα', () => {
    const start = initialRedactionDraft([applied(id(1))]);
    const d = reduce(start, { kind: 'remove', id: id(1) });
    expect(draftEdits(d)).toEqual([{ op: 'unredact', redactionId: id(1) }]);
    expect(draftEdits(reduce(d, { kind: 'discard' }))).toEqual([]);
  });

  it('επιλογή: ανύπαρκτου ⇒ καμία αλλαγή · αφαίρεση του επιλεγμένου ⇒ αποεπιλογή', () => {
    const d = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: A });
    expect(reduce(d, { kind: 'select', id: id(9) })).toBe(d);
    expect(reduce(d, { kind: 'remove', id: id(1) }).selectedId).toBeNull();
  });
});

describe('Ρ — rebase', () => {
  it('χωρίς εκκρεμότητα ακολουθεί τον διακομιστή, κρατώντας την επιλογή που επιβιώνει', () => {
    const d: TourRedactionDraft = reduce(initialRedactionDraft([applied(id(1))]), { kind: 'select', id: id(1) });
    const next = reduce(d, { kind: 'rebase', applied: [applied(id(1)), applied(id(2))] });
    expect(next.working.map((r) => r.id)).toEqual([id(1), id(2)]);
    expect(next.selectedId).toBe(id(1));
  });

  it('με εκκρεμότητα την κρατά — η δέσμη μετρά από τη ΝΕΑ αλήθεια', () => {
    const d = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: A });
    const next = reduce(d, { kind: 'rebase', applied: [applied(id(2))] });
    expect(next.working.map((r) => r.id)).toEqual([id(1)]);
    expect(draftEdits(next)).toEqual([
      { op: 'unredact', redactionId: id(2) },
      { op: 'redact', redactionId: id(1), mode: 'create', region: A },
    ]);
  });
});

describe('Ο — προεπισκόπηση · hit-test · πλήκτρα', () => {
  it('καταστάσεις: εφαρμοσμένος · πρόχειρος · επιλεγμένος · υπό αφαίρεση', () => {
    let d = initialRedactionDraft([applied(id(1)), applied(id(2), { ...A, yawRad: -1 })]);
    d = reduce(d, { kind: 'remove', id: id(2) });
    d = reduce(d, { kind: 'add', id: id(3), region: { ...A, yawRad: 2 } });
    d = reduce(d, { kind: 'add', id: id(4), region: { ...A, yawRad: 3 } });
    expect(redactionPreviewOf(d).map((p) => p.state)).toEqual(['applied', 'draft', 'selected', 'removing']);
  });

  it('hit-test: ο ΜΙΚΡΟΤΕΡΟΣ κύκλος που περιέχει το σημείο · έξω ⇒ null', () => {
    const d = initialRedactionDraft([applied(id(1), { yawRad: 0, pitchRad: 0, radiusRad: 0.5 }), applied(id(2), { yawRad: 0.1, pitchRad: 0, radiusRad: 0.1 })]);
    expect(redactionAt(d.working, 0.1, 0)).toBe(id(2));
    expect(redactionAt(d.working, -0.3, 0)).toBe(id(1));
    expect(redactionAt(d.working, 2, 0)).toBeNull();
  });

  it('πλήκτρα λαβής ⇒ ΣΧΕΤΙΚΕΣ ενέργειες: βελάκια ⇒ nudge ανάλογο του FOV · +/− ⇒ scale · Delete ⇒ αφαίρεση · Tab ⇒ δεν ανήκει', () => {
    expect(redactionKeyAction('ArrowRight', id(1), 0.8)).toEqual({ kind: 'nudge', id: id(1), dYawRad: expect.closeTo(0.02, 12), dPitchRad: 0 });
    expect(redactionKeyAction('ArrowUp', id(1), 0.8)).toEqual({ kind: 'nudge', id: id(1), dYawRad: 0, dPitchRad: expect.closeTo(0.02, 12) });
    expect(redactionKeyAction('+', id(1), 0.8)).toEqual({ kind: 'scale', id: id(1), factor: REDACTION_KEY_RESIZE_FACTOR });
    expect(redactionKeyAction('-', id(1), 0.8)).toEqual({ kind: 'scale', id: id(1), factor: 1 / REDACTION_KEY_RESIZE_FACTOR });
    expect(redactionKeyAction('Delete', id(1), 0.8)).toEqual({ kind: 'remove', id: id(1) });
    expect(redactionKeyAction('Tab', id(1), 0.8)).toBeNull();
  });

  it('RACE: δύο πατήματα υπολογισμένα από το ΙΔΙΟ render εφαρμόζονται ΚΑΙ τα δύο (ζωντανά: «−» ×2 έδινε ένα)', () => {
    const start = reduce(initialRedactionDraft([]), { kind: 'add', id: id(1), region: A });
    const minus = redactionKeyAction('-', id(1), 0.8);
    const right = redactionKeyAction('ArrowRight', id(1), 0.8);
    if (minus === null || right === null) throw new Error('key actions');
    const twice = reduce(reduce(reduce(reduce(start, minus), minus), right), right);
    expect(twice.working[0]?.radiusRad).toBeCloseTo(A.radiusRad / REDACTION_KEY_RESIZE_FACTOR ** 2, 12);
    expect(twice.working[0]?.yawRad).toBeCloseTo(A.yawRad + 0.04, 12);
  });
});
