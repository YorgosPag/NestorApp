import { renderHook, waitFor } from '@testing-library/react';
import { useContactNames } from '../useContactNames';
import { ContactsService } from '@/services/contacts.service';
import type { ContactRelationship } from '@/types/contacts/relationships';

jest.mock('@/services/contacts.service', () => ({
  ContactsService: { getContact: jest.fn() },
}));

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const mockGetContact = ContactsService.getContact as jest.Mock;

function makeRel(sourceId: string, targetId: string): ContactRelationship {
  return {
    id: `rel_${sourceId}_${targetId}`,
    sourceContactId: sourceId,
    targetContactId: targetId,
    relationshipType: 'business_contact' as ContactRelationship['relationshipType'],
    status: 'active' as ContactRelationship['status'],
  } as unknown as ContactRelationship;
}

describe('useContactNames — orphanContactIds', () => {
  const CURRENT = 'cont_current';
  const TARGET = 'cont_target';
  const ORPHAN = 'cont_orphan';

  beforeEach(() => jest.clearAllMocks());

  it('returns empty orphanContactIds when all contacts found', async () => {
    mockGetContact.mockResolvedValue({ name: 'Target Contact' });
    // Stable reference outside renderHook callback to prevent infinite re-render loop
    const rels = [makeRel(CURRENT, TARGET)];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orphanContactIds).toHaveLength(0);
    expect(result.current.contactNames[TARGET]).toBe('Target Contact');
  });

  it('adds to orphanContactIds when contact returns null', async () => {
    mockGetContact.mockResolvedValue(null);
    const rels = [makeRel(CURRENT, ORPHAN)];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orphanContactIds).toContain(ORPHAN);
    expect(result.current.contactNames[ORPHAN]).toBeUndefined();
  });

  it('returns empty arrays when relationships is empty', async () => {
    const rels: ContactRelationship[] = [];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orphanContactIds).toHaveLength(0);
    expect(result.current.contactNames).toEqual({});
    expect(mockGetContact).not.toHaveBeenCalled();
  });

  it('does NOT add to orphanContactIds on fetch error', async () => {
    mockGetContact.mockRejectedValue(new Error('Firestore error'));
    const rels = [makeRel(CURRENT, TARGET)];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.orphanContactIds).toHaveLength(0);
    expect(result.current.contactNames[TARGET]).toBeDefined();
  });

  it('resolves otherId correctly when current contact is the target', async () => {
    mockGetContact.mockResolvedValue({ name: 'Source Contact' });
    // current=CURRENT is the TARGET of this rel, so other side is TARGET (the source)
    const rels = [makeRel(TARGET, CURRENT)];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetContact).toHaveBeenCalledWith(TARGET);
    expect(result.current.contactNames[TARGET]).toBe('Source Contact');
  });

  it('separates orphans from found contacts in mixed batch', async () => {
    mockGetContact
      .mockResolvedValueOnce({ name: 'Found Contact' })
      .mockResolvedValueOnce(null);
    const rels = [makeRel(CURRENT, TARGET), makeRel(CURRENT, ORPHAN)];
    const { result } = renderHook(() => useContactNames(rels, CURRENT));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.contactNames[TARGET]).toBe('Found Contact');
    expect(result.current.orphanContactIds).toContain(ORPHAN);
    expect(result.current.orphanContactIds).not.toContain(TARGET);
  });
});
