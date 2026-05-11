/* eslint-disable no-restricted-syntax */

/**
 * ADR-344 Phase 7.B — text-template.service unit tests.
 *
 * Mocks the Admin SDK collection/doc shape + EntityAuditService so the
 * service's CRUD branches can be exercised without an emulator.
 */

// ── Infrastructure mocks ─────────────────────────────────────────────────────

jest.mock('server-only', () => ({}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@/lib/error-utils', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

jest.mock('@/config/firestore-collections', () => ({
  COLLECTIONS: { TEXT_TEMPLATES: 'text_templates' },
}));

// ── Firestore Admin SDK mock ─────────────────────────────────────────────────

type DocState = Record<string, unknown> | null;

const docs: Map<string, DocState> = new Map();

function makeDocRef(id: string) {
  return {
    id,
    get: jest.fn(async () => {
      const data = docs.get(id);
      return {
        exists: data !== undefined && data !== null,
        data: () => (data ? { ...data } : undefined),
      };
    }),
    set: jest.fn(async (payload: Record<string, unknown>) => {
      docs.set(id, { ...payload });
    }),
    update: jest.fn(async (patch: Record<string, unknown>) => {
      const prev = docs.get(id);
      if (!prev) throw new Error(`update on missing doc ${id}`);
      docs.set(id, { ...prev, ...patch });
    }),
    delete: jest.fn(async () => {
      docs.delete(id);
    }),
  };
}

function makeQueryResult(filterCompanyId?: string) {
  const matched = Array.from(docs.entries())
    .filter(([, data]) => data && (!filterCompanyId || data.companyId === filterCompanyId))
    .map(([id, data]) => ({ data: () => ({ ...(data as Record<string, unknown>) }), id }));
  return { docs: matched };
}

const mockCollection = jest.fn(() => {
  let filterCompanyId: string | undefined;
  const builder = {
    where: jest.fn((field: string, _op: string, value: unknown) => {
      if (field === 'companyId') filterCompanyId = String(value);
      return builder;
    }),
    orderBy: jest.fn(() => builder),
    get: jest.fn(async () => makeQueryResult(filterCompanyId)),
    doc: jest.fn((id: string) => makeDocRef(id)),
  };
  return builder;
});

jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminFirestore: () => ({ collection: mockCollection }),
  FieldValue: { serverTimestamp: () => '<<SERVER_TS>>' },
  Timestamp: class MockTimestamp {},
}));

// ── Enterprise-id + Audit mocks ──────────────────────────────────────────────

let nextId = 1;
jest.mock('@/services/enterprise-id.service', () => ({
  generateTextTemplateId: jest.fn(() => `tpl_text_${String(nextId++).padStart(4, '0')}`),
}));

const recordChange = jest.fn().mockResolvedValue('audit_001');
jest.mock('@/services/entity-audit.service', () => ({
  EntityAuditService: { recordChange: (...args: unknown[]) => recordChange(...args) },
}));

// ── Imports under test ───────────────────────────────────────────────────────

import { TITLE_BLOCK_EL } from '../defaults';
import {
  createTextTemplate,
  deleteTextTemplate,
  getTextTemplateById,
  listTextTemplatesForCompany,
  updateTextTemplate,
} from '../text-template.service';
import {
  TextTemplateCrossTenantError,
  TextTemplateNotFoundError,
  TextTemplateValidationError,
} from '../text-template.types';

const COMPANY_A = 'comp_alpha';
const COMPANY_B = 'comp_beta';
const ACTOR = { userId: 'usr_giorgio', userName: 'Giorgio Pagonis' };
const VALID_CONTENT = TITLE_BLOCK_EL.content;

beforeEach(() => {
  docs.clear();
  recordChange.mockClear();
  nextId = 1;
});

describe('createTextTemplate', () => {
  it('persists the doc with derived placeholders and emits a created audit', async () => {
    const created = await createTextTemplate(
      {
        companyId: COMPANY_A,
        name: 'Ταμπέλα Α',
        category: 'title-block',
        content: VALID_CONTENT,
      },
      ACTOR,
    );

    expect(created.id).toMatch(/^tpl_text_/);
    expect(created.companyId).toBe(COMPANY_A);
    expect(created.name).toBe('Ταμπέλα Α');
    expect(created.category).toBe('title-block');
    expect(created.isDefault).toBe(false);
    expect(created.placeholders.length).toBeGreaterThan(0);
    expect(created.createdBy).toBe(ACTOR.userId);
    expect(created.createdByName).toBe(ACTOR.userName);
    expect(created.updatedBy).toBe(ACTOR.userId);

    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'text_template',
        entityId: created.id,
        entityName: 'Ταμπέλα Α',
        action: 'created',
        companyId: COMPANY_A,
        performedBy: ACTOR.userId,
        performedByName: ACTOR.userName,
      }),
    );
  });

  it('rejects an invalid payload with TextTemplateValidationError', async () => {
    await expect(
      createTextTemplate(
        {
          companyId: '',
          name: '',
          category: 'title-block',
          content: VALID_CONTENT,
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(TextTemplateValidationError);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('extracts placeholders from the provided content', async () => {
    const created = await createTextTemplate(
      {
        companyId: COMPANY_A,
        name: 'Ταμπέλα Α',
        category: 'title-block',
        content: VALID_CONTENT,
      },
      ACTOR,
    );
    expect(created.placeholders).toContain('project.name');
    expect(created.placeholders).toContain('company.name');
  });
});

describe('getTextTemplateById', () => {
  it('returns the doc when companyId matches', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    const fetched = await getTextTemplateById(COMPANY_A, created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('throws TextTemplateNotFoundError for missing doc', async () => {
    await expect(getTextTemplateById(COMPANY_A, 'tpl_text_missing')).rejects.toBeInstanceOf(
      TextTemplateNotFoundError,
    );
  });

  it('throws TextTemplateCrossTenantError when companyId mismatches', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    await expect(getTextTemplateById(COMPANY_B, created.id)).rejects.toBeInstanceOf(
      TextTemplateCrossTenantError,
    );
  });
});

describe('listTextTemplatesForCompany', () => {
  it('returns only docs from the requested company', async () => {
    await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    await createTextTemplate(
      { companyId: COMPANY_B, name: 'B', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );

    const onlyA = await listTextTemplatesForCompany(COMPANY_A);
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0]?.companyId).toBe(COMPANY_A);
  });

  it('returns an empty array when no docs match', async () => {
    const out = await listTextTemplatesForCompany(COMPANY_A);
    expect(out).toEqual([]);
  });
});

describe('updateTextTemplate', () => {
  it('updates name and emits an updated audit with the diffed field', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'Old', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    recordChange.mockClear();

    const updated = await updateTextTemplate(
      COMPANY_A,
      created.id,
      { name: 'New' },
      ACTOR,
    );
    expect(updated.name).toBe('New');
    expect(updated.category).toBe('stamp');
    expect(updated.updatedBy).toBe(ACTOR.userId);

    expect(recordChange).toHaveBeenCalledTimes(1);
    const auditPayload = recordChange.mock.calls[0][0];
    expect(auditPayload.action).toBe('updated');
    expect(auditPayload.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'name', oldValue: 'Old', newValue: 'New' }),
      ]),
    );
  });

  it('skips the audit entry when no tracked fields changed', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'Old', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    recordChange.mockClear();

    // Patch without diff — same name. The schema requires a non-empty patch
    // so we send the same name back; the diff produces zero changes.
    await updateTextTemplate(COMPANY_A, created.id, { name: 'Old' }, ACTOR);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('rejects an empty patch with TextTemplateValidationError', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    await expect(
      updateTextTemplate(COMPANY_A, created.id, {}, ACTOR),
    ).rejects.toBeInstanceOf(TextTemplateValidationError);
  });

  it('refuses to update across tenants', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    await expect(
      updateTextTemplate(COMPANY_B, created.id, { name: 'X' }, ACTOR),
    ).rejects.toBeInstanceOf(TextTemplateCrossTenantError);
  });

  it('re-derives placeholders when content is patched', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    const before = created.placeholders.length;
    const trimmed = {
      ...VALID_CONTENT,
      paragraphs: [VALID_CONTENT.paragraphs[0]!],
    };
    const updated = await updateTextTemplate(COMPANY_A, created.id, { content: trimmed }, ACTOR);
    expect(updated.placeholders.length).toBeLessThanOrEqual(before);
  });
});

describe('deleteTextTemplate', () => {
  it('deletes the doc and emits a deleted audit', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    recordChange.mockClear();

    await deleteTextTemplate(COMPANY_A, created.id, ACTOR);

    expect(docs.has(created.id)).toBe(false);
    expect(recordChange).toHaveBeenCalledTimes(1);
    expect(recordChange.mock.calls[0][0]).toMatchObject({
      action: 'deleted',
      entityId: created.id,
      entityType: 'text_template',
    });
  });

  it('throws when deleting a missing doc', async () => {
    await expect(
      deleteTextTemplate(COMPANY_A, 'tpl_text_missing', ACTOR),
    ).rejects.toBeInstanceOf(TextTemplateNotFoundError);
    expect(recordChange).not.toHaveBeenCalled();
  });

  it('refuses to delete across tenants', async () => {
    const created = await createTextTemplate(
      { companyId: COMPANY_A, name: 'A', category: 'stamp', content: VALID_CONTENT },
      ACTOR,
    );
    await expect(deleteTextTemplate(COMPANY_B, created.id, ACTOR)).rejects.toBeInstanceOf(
      TextTemplateCrossTenantError,
    );
  });
});
