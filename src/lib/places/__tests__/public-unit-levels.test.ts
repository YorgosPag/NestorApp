/**
 * ADR-900 §8 #2 (2β.4) — οι μονάδες ενός κτιρίου ανά στάθμη (πρώτος καταναλωτής του `public_units`).
 *
 * Λ1 σειρά Spitogatos από τη ΜΙΑ διάταξη (υπόγειο < ημιυπόγειο < ισόγειο < 1ος), άγνωστη στάθμη τελευταία ·
 * Λ2 η `historical` (κύκλος UPRN) δεν μετριέται · Λ3 ίδια στάθμη ⇒ μία γραμμή με πλήθος.
 */
import type { FloorRef } from '@/lib/floor/floor-ref';
import type { PublicUnit, PublicUnitStatus } from '@/types/geo/public-place';
import { publicUnitLevels } from '../public-unit-levels';

const AT = '2026-10-03T10:00:00.000Z';

const unit = (id: string, level: FloorRef | null, status: PublicUnitStatus = 'approved'): PublicUnit => ({
  id,
  landId: 'land_1',
  buildingId: 'pbld_1',
  level: level === null ? null : { value: level, source: 'declared', attestedAt: AT },
  existence: { source: 'cadastre', firstAttestedAt: AT, lastAttestedAt: AT },
  status,
  createdAt: AT,
  updatedAt: AT,
});

describe('publicUnitLevels', () => {
  it('Λ1 σειρά Spitogatos — άγνωστη στάθμη τελευταία', () => {
    const { levels } = publicUnitLevels([
      unit('u1', { number: 1, kind: null }),
      unit('u2', null),
      unit('u3', { number: -1, kind: 'semi-basement' }),
      unit('u4', { number: 0, kind: 'ground' }),
      unit('u5', { number: -1, kind: 'basement' }),
    ]);
    expect(levels.map((l) => l.level)).toEqual([
      { number: -1, kind: 'basement' },
      { number: -1, kind: 'semi-basement' },
      { number: 0, kind: 'ground' },
      { number: 1, kind: null },
      null,
    ]);
  });

  it('Λ2 η historical δεν είναι πια μονάδα του κτιρίου · Λ3 ίδια στάθμη ⇒ μία γραμμή', () => {
    const result = publicUnitLevels([
      unit('u1', { number: 2, kind: null }),
      unit('u2', { number: 2, kind: null }),
      unit('u3', { number: 2, kind: null }, 'historical'),
    ]);
    expect(result).toEqual({ total: 2, levels: [{ level: { number: 2, kind: null }, count: 2 }] });
  });
});
