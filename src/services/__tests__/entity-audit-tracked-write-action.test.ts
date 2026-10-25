jest.mock('server-only', () => ({}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: {} }));

import { trackedWriteAction } from '../entity-audit-tracked-write';
import type { AuditFieldChange } from '@/types/audit-trail';

type Value = AuditFieldChange['newValue'];
const change = (field: string, oldValue: Value, newValue: Value): AuditFieldChange => ({ field, oldValue, newValue, label: field });

describe('trackedWriteAction — η ενέργεια του ιστορικού (ADR-195 · ADR-923 §5.9.2)', () => {
  it('γέννηση ⇒ created', () => {
    expect(trackedWriteAction(null, [change('labels', null, '{}')])).toBe('created');
  });

  it('soft delete ⇒ soft_deleted, όχι «ενημέρωση» (μετρημένο ζωντανά στη Firestore)', () => {
    expect(trackedWriteAction({}, [change('isDeleted', false, true)])).toBe('soft_deleted');
  });

  it('επαναφορά ⇒ restored', () => {
    expect(trackedWriteAction({}, [change('isDeleted', true, false)])).toBe('restored');
  });

  it('μόνο κύκλος ζωής ⇒ status_changed · οτιδήποτε άλλο ⇒ updated', () => {
    expect(trackedWriteAction({}, [change('lifecycle', 'a', 'b')])).toBe('status_changed');
    expect(trackedWriteAction({}, [change('labels', '{}', '{"el":"x"}')])).toBe('updated');
  });
});
