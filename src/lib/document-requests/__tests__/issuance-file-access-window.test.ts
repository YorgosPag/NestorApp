/**
 * ADR-942 Φ2 (Ε4) — το παράθυρο πρόσβασης του μηχανικού **παράγεται** από την ανάθεση. Κάθε `it` ονομάζει τη μετάλλαξη.
 */

import type { IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';
import { issuanceFileAccessWindow } from '../issuance-file-access-window';

let mockStage: IssuanceStage = 'accepted';
jest.mock('@/lib/document-validity/issuance-stage', () => ({
  ...jest.requireActual('@/lib/document-validity/issuance-stage'),
  issuanceStageOf: () => mockStage,
}));

/** Μόνο ό,τι διαβάζει η κρίση: η ημέρα της πρότασης (ολοκλήρωση) — το στάδιο έρχεται από το mock. */
const record = { proposedAt: '2026-11-01T10:00:00.000Z' } as unknown as IssuanceAssignmentRecord;

describe('issuanceFileAccessWindow — Ε4', () => {
  beforeEach(() => { mockStage = 'accepted'; });

  it('αναληφθείσα, χωρίς έκδοση ⇒ ανοιχτό χωρίς ημερομηνία λήξης (μετάλλαξη: κλειστό πριν την έκδοση)', () => {
    expect(issuanceFileAccessWindow(record, null, '2026-11-17')).toEqual({ open: true, lastDay: null });
  });

  it('ακυρωμένη, χωρίς έκδοση ⇒ κλειστό αμέσως (μετάλλαξη: ανοιχτό σε κάθε στάδιο)', () => {
    mockStage = 'cancelled';
    expect(issuanceFileAccessWindow(record, null, '2026-11-17')).toEqual({ open: false, reason: 'closed' });
  });

  it('έκδοση + 30 ημέρες ⇒ ακόμη ανοιχτό την 30ή (μετάλλαξη: `<` αντί `<=`)', () => {
    expect(issuanceFileAccessWindow(record, '2026-11-10', '2026-12-10')).toEqual({ open: true, lastDay: '2026-12-10' });
  });

  it('έκδοση + 31 ημέρες ⇒ έληξε (μετάλλαξη: καμία λήξη μετά την ολοκλήρωση)', () => {
    expect(issuanceFileAccessWindow(record, '2026-11-10', '2026-12-11')).toEqual({ open: false, reason: 'lapsed' });
  });

  it('ολοκληρωμένη μετρά από την ΕΚΔΟΣΗ, όχι από το στάδιο (μετάλλαξη: ακύρωση μετά την έκδοση κόβει τις διορθώσεις)', () => {
    mockStage = 'cancelled';
    expect(issuanceFileAccessWindow(record, '2026-11-10', '2026-11-20')).toEqual({ open: true, lastDay: '2026-12-10' });
  });

  it('παλιό έγγραφο, πριν την πρόταση ⇒ ΔΕΝ είναι ολοκλήρωση (μετάλλαξη: οποιοδήποτε `latestIssuedOn` ανοίγει 30 ημέρες)', () => {
    mockStage = 'cancelled';
    expect(issuanceFileAccessWindow(record, '2025-01-01', '2026-11-17')).toEqual({ open: false, reason: 'closed' });
  });
});
