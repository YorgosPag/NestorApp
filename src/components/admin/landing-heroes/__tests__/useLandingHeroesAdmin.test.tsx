/**
 * @jest-environment jsdom
 */

/**
 * ⚓ ADR-881 §5.1 · N.7 — **αισιόδοξη δημοσίευση με επαναφορά σε άρνηση**.
 */

import { act, renderHook, waitFor } from '@testing-library/react';

const get = jest.fn();
const post = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
}));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'uid-1', companyId: 'comp_owner' } }) }));
jest.mock('../hero-upload-prepare', () => ({ normaliseForUpload: jest.fn(), uploadHeroOriginal: jest.fn() }));

import { ApiClientError } from '@/lib/api/api-client-types';
import { EMPTY_LANDING_HERO_POINTER } from '@/lib/landing/landing-hero-document';

import { useLandingHeroesAdmin } from '../useLandingHeroesAdmin';

const POINTERS = { home: EMPTY_LANDING_HERO_POINTER, pros: EMPTY_LANDING_HERO_POINTER, stay: EMPTY_LANDING_HERO_POINTER };

async function ready() {
  get.mockResolvedValue({ pointers: POINTERS, revisions: [] });
  const hook = renderHook(() => useLandingHeroesAdmin());
  await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
  return hook;
}

function pointerOf(hook: Awaited<ReturnType<typeof ready>>, page: 'home') {
  const { state } = hook.result.current;
  if (state.status !== 'ready') throw new Error('not ready');
  return state.pointers[page].publishedRevisionId;
}

beforeEach(() => jest.clearAllMocks());

it('ο δείκτης αλλάζει ΑΜΕΣΩΣ, πριν απαντήσει ο διακομιστής', async () => {
  const hook = await ready();
  let resolve: (value: unknown) => void = () => undefined;
  post.mockReturnValue(new Promise((r) => { resolve = r; }));

  let pending: Promise<boolean> = Promise.resolve(false);
  act(() => { pending = hook.result.current.publish('home', 'lhrev_a-1'); });
  expect(pointerOf(hook, 'home')).toBe('lhrev_a-1');
  expect(hook.result.current.busy).toBe('publishing');

  await act(async () => { resolve({ previous: null }); await pending; });
  expect(pointerOf(hook, 'home')).toBe('lhrev_a-1');
  expect(hook.result.current.busy).toBeNull();
});

it('🔴 άρνηση ⇒ ο δείκτης ΕΠΙΣΤΡΕΦΕΙ και το σφάλμα λέγεται με το όνομά του', async () => {
  const hook = await ready();
  post.mockRejectedValue(Object.assign(new ApiClientError('conflict', 409), { errorBody: { error: 'invalid-target' } }));

  await act(async () => { await hook.result.current.publish('home', 'lhrev_a-1'); });
  expect(pointerOf(hook, 'home')).toBeNull();
  expect(hook.result.current.error).toBe('invalid-target');
});
