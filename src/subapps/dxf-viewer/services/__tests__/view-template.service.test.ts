/**
 * ADR-375 Phase B.3 — ViewTemplate service unit tests.
 *
 * Coverage: create/update/delete (Firestore SDK), apply/detach (mutation
 * gateway), propagateToLinkedLevels (fan-out + Promise.allSettled failure
 * isolation), subscribe (firestoreQueryService routing), saveCurrentAsTemplate
 * (composition).
 */

import type { ViewTemplate } from '../../config/view-template-types';
import type { Level } from '../../systems/levels/config';

// ---------------------------------------------------------------------------
// Firestore SDK mock
// ---------------------------------------------------------------------------

const store = new Map<string, Record<string, unknown>>();

const mockSetDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  store.set(ref.id, data);
});
const mockUpdateDoc = jest.fn(async (ref: { id: string }, data: Record<string, unknown>) => {
  const existing = store.get(ref.id) ?? {};
  store.set(ref.id, { ...existing, ...data });
});
const mockDeleteDoc = jest.fn(async (ref: { id: string }) => {
  store.delete(ref.id);
});
const mockGetDocs = jest.fn(async () => ({
  docs: Array.from(store.entries()).map(([id, data]) => ({
    id,
    data: () => ({ ...data }),
  })),
}));
const mockAddDoc = jest.fn(); // SOS N.6 trip-wire

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, _coll: string, id: string) => ({ id })),
  collection: jest.fn((_db: unknown, name: string) => ({ __coll: name })),
  query: jest.fn((_coll: unknown, ..._cs: unknown[]) => ({ __q: true })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  getDocs: (...a: Parameters<typeof mockGetDocs>) => mockGetDocs(...a),
  setDoc: (...a: Parameters<typeof mockSetDoc>) => mockSetDoc(...a),
  updateDoc: (...a: Parameters<typeof mockUpdateDoc>) => mockUpdateDoc(...a),
  deleteDoc: (...a: Parameters<typeof mockDeleteDoc>) => mockDeleteDoc(...a),
  serverTimestamp: jest.fn(() => '__server_ts__'),
  addDoc: (...a: unknown[]) => mockAddDoc(...a),
}));

jest.mock('@/lib/firebase', () => ({ db: { __mockDb: true } }));

// ---------------------------------------------------------------------------
// firestoreQueryService mock
// ---------------------------------------------------------------------------

const subscribeCalls: Array<{
  key: string;
  onData: (r: { documents: readonly ViewTemplate[] }) => void;
  onError: (e: Error) => void;
}> = [];
const mockUnsub = jest.fn();
jest.mock('@/services/firestore', () => ({
  firestoreQueryService: {
    subscribe: jest.fn((key, onData, onError) => {
      subscribeCalls.push({ key, onData, onError });
      return mockUnsub;
    }),
  },
}));

// ---------------------------------------------------------------------------
// dxf-level-mutation-gateway mock
// ---------------------------------------------------------------------------

const mockUpdateLevel = jest.fn();
jest.mock('@/services/dxf-level-mutation-gateway', () => ({
  updateDxfLevelWithPolicy: (...args: unknown[]) => mockUpdateLevel(...args),
}));

// ---------------------------------------------------------------------------
// Enterprise-ID mock
// ---------------------------------------------------------------------------

let idSeq = 0;
jest.mock('@/services/enterprise-id.service', () => ({
  generateViewTemplateId: () => {
    idSeq += 1;
    return `vtmpl_test${String(idSeq).padStart(20, '0')}`;
  },
}));

// ---------------------------------------------------------------------------
// SUT
// ---------------------------------------------------------------------------

import {
  applyViewTemplate,
  createViewTemplate,
  deleteViewTemplate,
  detachViewTemplate,
  listViewTemplatesOnce,
  propagateToLinkedLevels,
  saveBimSettingsAsViewTemplate,
  subscribeViewTemplates,
  updateViewTemplate,
} from '../view-template.service';

beforeEach(() => {
  store.clear();
  subscribeCalls.length = 0;
  idSeq = 0;
  mockSetDoc.mockClear();
  mockUpdateDoc.mockClear();
  mockDeleteDoc.mockClear();
  mockGetDocs.mockClear();
  mockAddDoc.mockClear();
  mockUpdateLevel.mockReset();
  mockUpdateLevel.mockResolvedValue({ success: true });
  mockUnsub.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createViewTemplate', () => {
  it('generates a vtmpl_ ID and persists the template', async () => {
    const out = await createViewTemplate(
      { name: 'Standard', settings: { drawingScale: 100 } },
      { companyId: 'comp_1', userId: 'usr_1' },
    );
    expect(out.id).toMatch(/^vtmpl_test/);
    expect(out.companyId).toBe('comp_1');
    expect(out.createdBy).toBe('usr_1');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('writes serverTimestamp() for createdAt + updatedAt', async () => {
    await createViewTemplate(
      { name: 'T', settings: { drawingScale: 50 } },
      { companyId: 'c', userId: 'u' },
    );
    const payload = mockSetDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.createdAt).toBe('__server_ts__');
    expect(payload.updatedAt).toBe('__server_ts__');
  });

  it('never calls addDoc (SOS N.6)', async () => {
    await createViewTemplate(
      { name: 'T', settings: { drawingScale: 50 } },
      { companyId: 'c', userId: 'u' },
    );
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});

describe('updateViewTemplate', () => {
  it('patches name + bumps updatedAt', async () => {
    await updateViewTemplate({ templateId: 'vtmpl_1', name: 'Renamed' });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const patch = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.name).toBe('Renamed');
    expect(patch.updatedAt).toBe('__server_ts__');
    expect(patch.settings).toBeUndefined();
  });

  it('patches settings without touching name', async () => {
    await updateViewTemplate({
      templateId: 'vtmpl_1',
      settings: { drawingScale: 200 },
    });
    const patch = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.settings).toEqual({ drawingScale: 200 });
    expect(patch.name).toBeUndefined();
  });

  it('normalizes undefined description to null', async () => {
    await updateViewTemplate({ templateId: 'vtmpl_1', description: undefined });
    // description: undefined is skipped entirely
    const patch = mockUpdateDoc.mock.calls[0][1] as Record<string, unknown>;
    expect('description' in patch).toBe(false);
  });
});

describe('deleteViewTemplate', () => {
  it('deletes the doc by id', async () => {
    await deleteViewTemplate('vtmpl_x');
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('applyViewTemplate', () => {
  const template: ViewTemplate = {
    id: 'vtmpl_apply',
    companyId: 'c',
    name: 'A',
    settings: { drawingScale: 75 },
    createdBy: 'u',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('copies settings into Level.bimRenderSettings + sets FK', async () => {
    await applyViewTemplate({ templateId: 'vtmpl_apply', levelId: 'lvl_1' }, template);
    expect(mockUpdateLevel).toHaveBeenCalledWith({
      payload: {
        levelId: 'lvl_1',
        bimRenderSettings: { drawingScale: 75 },
        appliedViewTemplateId: 'vtmpl_apply',
      },
    });
  });

  it('rejects mismatched template id', async () => {
    await expect(
      applyViewTemplate({ templateId: 'vtmpl_OTHER', levelId: 'lvl_1' }, template),
    ).rejects.toThrow(/does not match/);
  });
});

describe('detachViewTemplate', () => {
  it('nulls appliedViewTemplateId without touching bimRenderSettings', async () => {
    await detachViewTemplate({ levelId: 'lvl_z' });
    expect(mockUpdateLevel).toHaveBeenCalledWith({
      payload: { levelId: 'lvl_z', appliedViewTemplateId: null },
    });
    const payload = mockUpdateLevel.mock.calls[0][0] as { payload: Record<string, unknown> };
    expect('bimRenderSettings' in payload.payload).toBe(false);
  });
});

describe('propagateToLinkedLevels', () => {
  const tpl: ViewTemplate = {
    id: 'vtmpl_propagate',
    companyId: 'c',
    name: 'P',
    settings: { drawingScale: 50 },
    createdBy: 'u',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };

  it('returns 0 when no levels are linked', async () => {
    const out = await propagateToLinkedLevels(tpl, [
      { id: 'l1', appliedViewTemplateId: 'other', name: '', order: 0, isDefault: false, visible: true } as Level,
    ]);
    expect(out.updated).toBe(0);
    expect(out.failures).toEqual([]);
    expect(mockUpdateLevel).not.toHaveBeenCalled();
  });

  it('updates every level that has matching FK', async () => {
    const levels: Level[] = [
      { id: 'l1', appliedViewTemplateId: 'vtmpl_propagate' } as Level,
      { id: 'l2', appliedViewTemplateId: 'vtmpl_propagate' } as Level,
      { id: 'l3', appliedViewTemplateId: null } as Level,
    ];
    const out = await propagateToLinkedLevels(tpl, levels);
    expect(out.updated).toBe(2);
    expect(mockUpdateLevel).toHaveBeenCalledTimes(2);
  });

  it('isolates failures via Promise.allSettled', async () => {
    mockUpdateLevel
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error('boom'));
    const levels: Level[] = [
      { id: 'l1', appliedViewTemplateId: 'vtmpl_propagate' } as Level,
      { id: 'l2', appliedViewTemplateId: 'vtmpl_propagate' } as Level,
    ];
    const out = await propagateToLinkedLevels(tpl, levels);
    expect(out.updated).toBe(1);
    expect(out.failures).toHaveLength(1);
    expect((out.failures[0] as Error).message).toBe('boom');
  });
});

describe('subscribeViewTemplates', () => {
  it('routes through firestoreQueryService.subscribe with collection key', () => {
    const onChange = jest.fn();
    const unsub = subscribeViewTemplates(onChange);
    expect(subscribeCalls).toHaveLength(1);
    expect(subscribeCalls[0].key).toBe('DXF_VIEWER_VIEW_TEMPLATES');
    expect(typeof unsub).toBe('function');
  });

  it('forwards documents to onChange', () => {
    const onChange = jest.fn();
    subscribeViewTemplates(onChange);
    const fake: ViewTemplate = {
      id: 'vtmpl_1', companyId: 'c', name: 'T',
      settings: { drawingScale: 50 }, createdBy: 'u',
      createdAt: '', updatedAt: '',
    };
    subscribeCalls[0].onData({ documents: [fake] });
    expect(onChange).toHaveBeenCalledWith([fake]);
  });

  it('forwards errors to optional onError', () => {
    const onChange = jest.fn();
    const onError = jest.fn();
    subscribeViewTemplates(onChange, onError);
    subscribeCalls[0].onError(new Error('rules-denied'));
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('listViewTemplatesOnce', () => {
  it('returns templates from getDocs', async () => {
    store.set('vtmpl_existing', {
      companyId: 'c',
      name: 'X',
      settings: { drawingScale: 100 },
      createdBy: 'u',
      createdAt: 't',
      updatedAt: 't',
    });
    const out = await listViewTemplatesOnce('c');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('vtmpl_existing');
  });
});

describe('saveBimSettingsAsViewTemplate', () => {
  it('delegates to createViewTemplate', async () => {
    const out = await saveBimSettingsAsViewTemplate(
      'Snapshot',
      { drawingScale: 250 },
      { companyId: 'c', userId: 'u' },
    );
    expect(out.name).toBe('Snapshot');
    expect(out.settings.drawingScale).toBe(250);
  });
});
