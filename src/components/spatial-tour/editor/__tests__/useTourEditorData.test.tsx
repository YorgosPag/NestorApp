/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 Φ2ζ ζ3 · §4.15 — **το ρολόι της οθόνης τοποθέτησης δεν «λιμοκτονεί»** (εύρημα της ζωντανής «Εφαρμογής»).
 *
 * - **Ρ** — `poll` όσο εκκρεμεί φόρτωση ⇒ **καμία** νέα: με το «νεότερη κερδίζει», ένα ρολόι γρηγορότερο από τον διακομιστή
 *   πετούσε **κάθε** απάντηση και το «Ετοιμάζεται ξανά» έμενε για πάντα (ο διακομιστής αργεί ακριβώς όσο ψήνει).
 * - **Κ** — `reload` μετά από εντολή **κερδίζει** πάντα: η παλαιότερη απάντηση δεν σβήνει τη νεότερη.
 */

import { act, renderHook } from '@testing-library/react';

import { CAPTURE } from '@/lib/spatial-tour/__tests__/spatial-tour-fixtures';
import { listTourCapturesFromScreen } from '@/services/spatial-tour/spatial-tour.client';
import { openTourViewSessionFromScreen } from '@/services/spatial-tour/spatial-tour-viewing.client';
import type { TourSubject } from '@/types/spatial-tour';

import { useTourEditorData } from '../useTourEditorData';

jest.mock('@/services/spatial-tour/spatial-tour.client', () => ({ listTourCapturesFromScreen: jest.fn() }));
jest.mock('@/services/spatial-tour/spatial-tour-viewing.client', () => ({ openTourViewSessionFromScreen: jest.fn() }));
jest.mock('../../TourViewSurface', () => ({ TOUR_VIEW_RENEW_EVERY_MS: 600_000 }));

type Session = Awaited<ReturnType<typeof openTourViewSessionFromScreen>>;
type Captures = Awaited<ReturnType<typeof listTourCapturesFromScreen>>;

const openSession = openTourViewSessionFromScreen as jest.MockedFunction<typeof openTourViewSessionFromScreen>;
const listCaptures = listTourCapturesFromScreen as jest.MockedFunction<typeof listTourCapturesFromScreen>;
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const SESSION = { kind: 'ok', value: { manifest: { nodes: [], levels: [] } } } as unknown as Session;

/** Μια απάντηση λήψεων που κρατιέται ως να την αφήσει το τεστ. */
function deferredCaptures(captureId: string) {
  let release: () => void = () => undefined;
  const promise = new Promise<Captures>((resolve) => {
    release = () => resolve({ kind: 'ok', value: { captures: [{ ...CAPTURE, id: captureId }] } } as unknown as Captures);
  });
  return { promise, release: () => release() };
}

const loadedIds = (load: ReturnType<typeof useTourEditorData>['load']) => (load.kind === 'loaded' ? load.data.captures.map((c) => c.id) : null);

beforeEach(() => {
  jest.clearAllMocks();
  openSession.mockResolvedValue(SESSION);
});

describe('Ρ — το ρολόι παραλείπει όσο εκκρεμεί φόρτωση', () => {
  it('αργός διακομιστής ⇒ τα χτυπήματα ΔΕΝ ξεκινούν νέες φορτώσεις, και η απάντηση ΦΤΑΝΕΙ στην οθόνη', async () => {
    const slow = deferredCaptures('c_slow');
    listCaptures.mockReturnValueOnce(slow.promise);
    const { result } = renderHook(() => useTourEditorData(SUBJECT));
    expect(listCaptures).toHaveBeenCalledTimes(1);
    act(() => { result.current.poll(); result.current.poll(); result.current.poll(); });
    expect(listCaptures).toHaveBeenCalledTimes(1);
    await act(async () => { slow.release(); await slow.promise; });
    expect(loadedIds(result.current.load)).toEqual(['c_slow']);
  });

  it('χωρίς εκκρεμή φόρτωση ⇒ το χτύπημα φορτώνει', async () => {
    const first = deferredCaptures('c1');
    const second = deferredCaptures('c2');
    listCaptures.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTourEditorData(SUBJECT));
    await act(async () => { first.release(); await first.promise; });
    act(() => result.current.poll());
    expect(listCaptures).toHaveBeenCalledTimes(2);
    await act(async () => { second.release(); await second.promise; });
    expect(loadedIds(result.current.load)).toEqual(['c2']);
  });
});

describe('Κ — η φόρτωση μετά από εντολή κερδίζει', () => {
  it('reload ενώ εκκρεμεί άλλη ⇒ ξεκινά, και η παλαιότερη απάντηση πετιέται', async () => {
    const old = deferredCaptures('c_old');
    const fresh = deferredCaptures('c_fresh');
    listCaptures.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useTourEditorData(SUBJECT));
    let reloading: Promise<void> = Promise.resolve();
    act(() => { reloading = result.current.reload(); });
    expect(listCaptures).toHaveBeenCalledTimes(2);
    await act(async () => { fresh.release(); await reloading; });
    await act(async () => { old.release(); await old.promise; });
    expect(loadedIds(result.current.load)).toEqual(['c_fresh']);
  });
});
