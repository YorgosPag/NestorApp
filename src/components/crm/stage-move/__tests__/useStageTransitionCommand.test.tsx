/**
 * ADR-929 — η ΜΙΑ εντολή μετακίνησης: διάλογοι, αισιόδοξη εικόνα, πόρτα, σύγκρουση, αναίρεση, κάρτα σε πτήση.
 */

import { act, renderHook } from '@testing-library/react';

import type { Opportunity } from '@/types/crm';
import type { StageMoveResult } from '../stage-move-api';
import { useStageTransitionCommand } from '../useStageTransitionCommand';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const notifications = { notify: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn() };
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => notifications }));

const mockPost = jest.fn<Promise<StageMoveResult>, [string, unknown]>();
jest.mock('../stage-move-api', () => ({ postStageTransition: (id: string, body: unknown) => mockPost(id, body) }));

const OK = (stage: string): StageMoveResult => ({ kind: 'ok', response: { outcome: 'applied', stage, previousStage: 'viewing', reopened: false } } as StageMoveResult);

function opp(stage: Opportunity['stage'], extra: Partial<Opportunity> = {}): Opportunity {
  return { id: 'o1', title: 'Δοκιμή', contactId: '', assignedTo: '', status: 'active', stage, createdAt: new Date(0), updatedAt: new Date(0), ...extra };
}

function setup() {
  const onOptimistic = jest.fn();
  const onRevert = jest.fn();
  const view = renderHook(() => useStageTransitionCommand({ onOptimistic, onRevert }));
  return { ...view, onOptimistic, onRevert };
}

beforeEach(() => jest.clearAllMocks());

it('ανοιχτό → ανοιχτό: αισιόδοξα, CAS με το στάδιο που είδε ο άνθρωπος, μήνυμα με Αναίρεση που γυρίζει πίσω με CAS', async () => {
  mockPost.mockResolvedValue(OK('proposal'));
  const { result, onOptimistic } = setup();
  await act(async () => { await result.current.requestMove(opp('viewing'), 'proposal'); });

  expect(onOptimistic).toHaveBeenCalledWith('o1', 'proposal');
  expect(mockPost).toHaveBeenCalledWith('o1', { expectedStage: 'viewing', request: { kind: 'open', target: 'proposal' } });
  const [, options] = notifications.notify.mock.calls[0];
  mockPost.mockResolvedValue(OK('viewing'));
  await act(async () => { options.actions[0].onClick(); });
  expect(mockPost).toHaveBeenLastCalledWith('o1', { expectedStage: 'proposal', request: { kind: 'open', target: 'viewing' } });
});

it('σύγκρουση: η εικόνα επιστρέφει και λέμε πού βρίσκεται πραγματικά', async () => {
  mockPost.mockResolvedValue({ kind: 'conflict', currentStage: 'contract' });
  const { result, onRevert } = setup();
  let moved = true;
  await act(async () => { moved = await result.current.requestMove(opp('viewing'), 'proposal'); });
  expect(moved).toBe(false);
  expect(onRevert).toHaveBeenCalledWith('o1');
  expect(notifications.warning).toHaveBeenCalledWith('pipeline.move.conflict');
});

it('κλείσιμο: τίποτα δεν φεύγει πριν απαντήσει ο διάλογος· Άκυρο ⇒ καμία κλήση', async () => {
  const { result } = setup();
  let pending: Promise<boolean> = Promise.resolve(false);
  act(() => { pending = result.current.requestMove(opp('contract', { estimatedValue: 5 }), 'closed_won'); });
  expect(result.current.dialogs.state.kind).toBe('close');
  expect(mockPost).not.toHaveBeenCalled();
  await act(async () => { result.current.dialogs.answer(null); await pending; });
  expect(mockPost).not.toHaveBeenCalled();
});

it('κλείσιμο ως επιτυχία: στέλνει το αίτημα του διαλόγου, χωρίς Αναίρεση (ήταν συνειδητή πράξη)', async () => {
  mockPost.mockResolvedValue(OK('closed_won'));
  const { result } = setup();
  let pending: Promise<boolean> = Promise.resolve(false);
  act(() => { pending = result.current.requestMove(opp('contract'), 'closed_won'); });
  await act(async () => { result.current.dialogs.answer({ kind: 'won', finalValue: 180000, closedOn: '2026-11-04' }); await pending; });
  expect(mockPost).toHaveBeenCalledWith('o1', { expectedStage: 'contract', request: { kind: 'won', finalValue: 180000, closedOn: '2026-11-04' } });
  expect(notifications.success).toHaveBeenCalled();
  expect(notifications.notify).not.toHaveBeenCalled();
});

it('επανάνοιγμα: ζητά επιβεβαίωση πριν φύγει το αίτημα', async () => {
  mockPost.mockResolvedValue(OK('negotiation'));
  const { result } = setup();
  let pending: Promise<boolean> = Promise.resolve(false);
  act(() => { pending = result.current.requestMove(opp('closed_lost'), 'negotiation'); });
  expect(result.current.dialogs.state.kind).toBe('reopen');
  await act(async () => { result.current.dialogs.answer(true); await pending; });
  expect(mockPost).toHaveBeenCalledWith('o1', { expectedStage: 'closed_lost', request: { kind: 'open', target: 'negotiation' } });
});

it('μία μετακίνηση ανά κάρτα τη φορά: η δεύτερη όσο πετά η πρώτη απορρίπτεται τοπικά', async () => {
  let release: (r: StageMoveResult) => void = () => undefined;
  mockPost.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const { result } = setup();
  let first: Promise<boolean> = Promise.resolve(false);
  act(() => { first = result.current.requestMove(opp('viewing'), 'proposal'); });
  expect(result.current.isMoving('o1')).toBe(true);
  let second = true;
  await act(async () => { second = await result.current.requestMove(opp('viewing'), 'contract'); });
  expect(second).toBe(false);
  expect(mockPost).toHaveBeenCalledTimes(1);
  await act(async () => { release(OK('proposal')); await first; });
  expect(result.current.isMoving('o1')).toBe(false);
});
