/**
 * ⚓ ADR-461 / ADR-903 §6 — η ΑΡΝΗΣΗ του κανόνα μοναδικότητας: ετυμηγορία → `409` με `errorCode`.
 * Ο κανόνας ο ίδιος δοκιμάζεται στο `lib/floor/__tests__/floor-stack-integrity.test.ts`· η ατομικότητά του απέναντι
 * σε ταυτόχρονα αιτήματα στο `floor-stack-authority.test.ts`.
 */

import { assertFloorSlotFree } from '../floor-slot';
import type { FloorSlotRow } from '@/lib/floor/floor-stack-integrity';

const building: FloorSlotRow[] = [
  { id: 'f0', number: 0, name: 'Ισόγειο', kind: 'ground' },
  { id: 'f1', number: 1, name: '1ος Όροφος', kind: 'standard' },
  { id: 'fr', number: 5, name: 'Δώμα', kind: 'roof' },
];

interface Refusal { statusCode?: number; errorCode?: string; details?: { conflictingFloorId?: string } }

function refusalOf(run: () => void): Refusal | undefined {
  try { run(); return undefined; } catch (e) { return e as Refusal; }
}

describe('assertFloorSlotFree', () => {
  it('επεξεργασία: ο όροφος ΔΕΝ συγκρούεται με τον εαυτό του', () => {
    expect(refusalOf(() => assertFloorSlotFree(building, { number: 1, kind: 'standard', name: '1ος Όροφος' }, 'b', undefined, 'f1'))).toBeUndefined();
  });
  it('🔴 αριθμός που έχει άλλος μετρούμενος όροφος ⇒ 409 FLOOR_NUMBER_TAKEN, με ποιον', () => {
    const refusal = refusalOf(() => assertFloorSlotFree(building, { number: 0, kind: 'standard', name: 'Νέος' }, 'b', undefined, 'f1'));
    expect(refusal?.statusCode).toBe(409);
    expect(refusal?.errorCode).toBe('FLOOR_NUMBER_TAKEN');
    expect(refusal?.details?.conflictingFloorId).toBe('f0');
  });
  it('δεύτερη ειδική στάθμη ίδιου είδους ⇒ 409 FLOOR_KIND_TAKEN', () => {
    expect(refusalOf(() => assertFloorSlotFree(building, { number: 6, kind: 'roof', name: 'Δώμα Β' }, 'b'))?.errorCode).toBe('FLOOR_KIND_TAKEN');
  });
  it('🔴 όνομα που έχει άλλος όροφος ⇒ 409 FLOOR_NAME_TAKEN', () => {
    expect(refusalOf(() => assertFloorSlotFree(building, { number: 2, kind: 'standard', name: 'ισογειο' }, 'b'))?.errorCode).toBe('FLOOR_NAME_TAKEN');
  });
  it('ειδική στάθμη μοιράζεται αριθμό με μετρούμενο όροφο (θεμελίωση −1 / υπόγειο −1)', () => {
    expect(refusalOf(() => assertFloorSlotFree(building, { number: 0, kind: 'foundation', name: 'F' }, 'b'))).toBeUndefined();
  });
});
