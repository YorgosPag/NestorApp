/**
 * @jest-environment jsdom
 */

/**
 * ADR-315 §5 · Α11/Α13 — η πλευρά του browser στη διαχείριση συνδέσμων.
 *
 *   Α · `draftToUpdate` στέλνει **μόνο ό,τι άλλαξε** (κενό = καμία αλλαγή, όχι 400)· κωδικός
 *       τριαδικός: νέος / αφαίρεση / αμετάβλητος.
 *   Β · `useLinkMint`: δύο κλικ σε πτήση = **ένας** σύνδεσμος· το `preSubmit` τρέχει μία φορά.
 *   Γ · `useShareLinks`: αισιόδοξη ανάκληση, και σε αποτυχία **ξαναδιάβασμα** της αλήθειας.
 */

jest.mock('@/services/sharing/unified-sharing.service', () => ({
  UnifiedSharingService: {
    createShare: jest.fn(),
    listActive: jest.fn(),
    revoke: jest.fn(),
    revokeAll: jest.fn(),
    update: jest.fn(),
  },
}));

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  draftToCreatePolicy,
  draftToUpdate,
  LINK_EXPIRY_UNCHANGED,
  summaryToDraft,
} from '@/components/ui/sharing/panels/link-token/draft-mapping';
import { INITIAL_LINK_TOKEN_DRAFT } from '@/components/ui/sharing/panels/link-token/types';
import { UnifiedSharingService } from '@/services/sharing/unified-sharing.service';
import type { ShareLinkSummary } from '@/types/sharing';
import { useLinkMint } from '../useLinkMint';
import { useShareLinks } from '../useShareLinks';

const service = UnifiedSharingService as jest.Mocked<typeof UnifiedSharingService>;

const LINK: ShareLinkSummary = {
  shareId: 'sh_1',
  label: 'Λογιστής',
  note: null,
  createdAt: '2026-09-20T10:00:00.000Z',
  createdBy: { uid: 'usr_1', name: 'Γιώργος' },
  expiresAt: '2026-10-01T00:00:00.000Z',
  requiresPassword: true,
  maxAccesses: 5,
  accessCount: 2,
  lastAccessedAt: null,
  lockedUntil: null,
  state: 'active',
};

beforeEach(() => jest.clearAllMocks());

describe('Α · draft mapping', () => {
  it('an untouched edit draft is «no change» — never an empty PATCH', () => {
    expect(draftToUpdate(summaryToDraft(LINK), LINK)).toBeNull();
    expect(summaryToDraft(LINK).expiresInHours).toBe(LINK_EXPIRY_UNCHANGED);
  });

  it('sends only what changed', () => {
    const draft = { ...summaryToDraft(LINK), label: '', maxDownloads: '10' };

    expect(draftToUpdate(draft, LINK)).toEqual({ label: null, maxAccesses: 10 });
  });

  it('password is tri-state: new · remove · unchanged', () => {
    const base = summaryToDraft(LINK);

    expect(draftToUpdate({ ...base, password: ' νέος ' }, LINK)).toEqual({ password: 'νέος' });
    expect(draftToUpdate({ ...base, removePassword: true }, LINK)).toEqual({ password: null });
    expect(draftToUpdate({ ...base, removePassword: true }, { ...LINK, requiresPassword: false })).toBeNull();
  });

  it('create policy: blanks become «absent», not empty strings', () => {
    expect(draftToCreatePolicy(INITIAL_LINK_TOKEN_DRAFT)).toEqual({
      expiresInHours: 72, password: undefined, maxAccesses: 0, note: undefined, label: undefined,
    });
  });
});

describe('Β · useLinkMint', () => {
  it('two clicks while in flight mint ONE link; preSubmit runs once per dialog', async () => {
    let resolve: (value: { shareId: string; token: string; expiresAt: string }) => void = () => undefined;
    service.createShare.mockImplementation(() => new Promise((res) => { resolve = res; }));
    const preSubmit = jest.fn(async () => ({}));
    const { result } = renderHook(() => useLinkMint({ entityType: 'file', entityId: 'f_1', preSubmit }));

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mint(INITIAL_LINK_TOKEN_DRAFT);
      second = result.current.mint(INITIAL_LINK_TOKEN_DRAFT);
    });
    await waitFor(() => expect(service.createShare).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolve({ shareId: 'sh_9', token: 't'.repeat(43), expiresAt: 'x' });
      await Promise.all([first, second]);
    });

    expect(first).toBe(second);
    expect(result.current.minted?.shareId).toBe('sh_9');
    expect(result.current.minted?.url).toMatch(/\/shared\/t{43}$/);

    service.createShare.mockResolvedValueOnce({ shareId: 'sh_10', token: 'u'.repeat(43), expiresAt: 'x' });
    await act(async () => { await result.current.mint(INITIAL_LINK_TOKEN_DRAFT); });
    expect(preSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('Γ · useShareLinks', () => {
  it('removes the row at once, and re-reads the truth when the server refuses', async () => {
    service.listActive.mockResolvedValue({ links: [LINK], hasMore: false });
    const { result } = renderHook(() => useShareLinks({ entityType: 'file', entityId: 'f_1', enabled: true }));
    await waitFor(() => expect(result.current.links).toHaveLength(1));

    service.revoke.mockRejectedValueOnce(new Error('offline'));
    let failure: unknown = null;
    await act(async () => {
      await result.current.revoke('sh_1').catch((error: unknown) => { failure = error; });
    });

    expect(failure).toBeInstanceOf(Error);
    await waitFor(() => expect(result.current.links).toHaveLength(1));
    expect(service.listActive).toHaveBeenCalledTimes(2);
  });

  it('does not read while disabled', () => {
    renderHook(() => useShareLinks({ entityType: 'file', entityId: 'f_1', enabled: false }));

    expect(service.listActive).not.toHaveBeenCalled();
  });
});
