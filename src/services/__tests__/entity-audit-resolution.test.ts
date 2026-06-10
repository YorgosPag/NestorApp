/**
 * Unit tests for `EntityAuditService.diffFieldsWithResolution`.
 *
 * ADR-195 enterprise FK policy: foreign-key fields keep the canonical document
 * id in `oldValue`/`newValue` and carry the resolved display name in
 * `oldValueLabel`/`newValueLabel` (id-in-value + name-in-label). This guards
 * the regression where the resolver used to *overwrite* the value with the
 * name and silently drop the canonical id.
 *
 * @module services/__tests__/entity-audit-resolution
 * @enterprise ADR-195 — Entity Audit Trail
 */

// The service imports the Firebase Admin SDK at module load; the diff method
// under test never touches Firestore, so a bare mock keeps the import clean.
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => null,
  FieldValue: { serverTimestamp: () => 'ts' },
}));

import { EntityAuditService } from '@/services/entity-audit.service';
import type { TrackedFieldDef } from '@/lib/audit/audit-diff';

const TRACKED: Record<string, TrackedFieldDef> = {
  linkedCompanyId: { kind: 'scalar', label: 'Εταιρεία' },
  name: { kind: 'scalar', label: 'Όνομα' },
};

describe('EntityAuditService.diffFieldsWithResolution', () => {
  it('keeps the canonical id in newValue and puts the resolved name in newValueLabel', async () => {
    const changes = await EntityAuditService.diffFieldsWithResolution(
      {},
      { linkedCompanyId: 'comp_abc123' },
      TRACKED,
      { linkedCompanyId: async () => 'ΠΑΓΩΝΗΣ Α.Ε.' },
    );

    const change = changes.find((c) => c.field === 'linkedCompanyId');
    expect(change).toBeDefined();
    expect(change?.newValue).toBe('comp_abc123'); // id stays canonical
    expect(change?.newValueLabel).toBe('ΠΑΓΩΝΗΣ Α.Ε.'); // name denormalized
  });

  it('resolves both old and new values into their labels on update', async () => {
    const changes = await EntityAuditService.diffFieldsWithResolution(
      { linkedCompanyId: 'comp_old' },
      { linkedCompanyId: 'comp_new' },
      TRACKED,
      {
        linkedCompanyId: async (id) =>
          id === 'comp_old' ? 'Παλιά Εταιρεία' : 'Νέα Εταιρεία',
      },
    );

    const change = changes.find((c) => c.field === 'linkedCompanyId');
    expect(change?.oldValue).toBe('comp_old');
    expect(change?.newValue).toBe('comp_new');
    expect(change?.oldValueLabel).toBe('Παλιά Εταιρεία');
    expect(change?.newValueLabel).toBe('Νέα Εταιρεία');
  });

  it('omits the label when the resolver returns null (UI falls back to raw value)', async () => {
    const changes = await EntityAuditService.diffFieldsWithResolution(
      {},
      { linkedCompanyId: 'comp_missing' },
      TRACKED,
      { linkedCompanyId: async () => null },
    );

    const change = changes.find((c) => c.field === 'linkedCompanyId');
    expect(change?.newValue).toBe('comp_missing');
    expect(change?.newValueLabel).toBeUndefined();
  });

  it('omits the label when the resolver throws (catch → null → no label)', async () => {
    const changes = await EntityAuditService.diffFieldsWithResolution(
      {},
      { linkedCompanyId: 'comp_err' },
      TRACKED,
      {
        linkedCompanyId: async () => {
          throw new Error('boom');
        },
      },
    );

    const change = changes.find((c) => c.field === 'linkedCompanyId');
    expect(change?.newValue).toBe('comp_err');
    expect(change?.newValueLabel).toBeUndefined();
  });

  it('leaves fields without a resolver untouched (no label added)', async () => {
    const changes = await EntityAuditService.diffFieldsWithResolution(
      {},
      { name: 'ΕΡΓΟ 1' },
      TRACKED,
      { linkedCompanyId: async () => 'irrelevant' },
    );

    const change = changes.find((c) => c.field === 'name');
    expect(change?.newValue).toBe('ΕΡΓΟ 1');
    expect(change?.newValueLabel).toBeUndefined();
    expect(change?.oldValueLabel).toBeUndefined();
  });
});
