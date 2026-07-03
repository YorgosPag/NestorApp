/**
 * ADR-419 §gap-close — gap-close confirm store (Promise-handshake).
 */

import {
  requestGapCloseConfirm,
  resolveGapCloseConfirm,
  getGapCloseConfirmState,
} from '../gap-close-confirm-store';

const A = { x: 0, y: 0 };
const B = { x: 0, y: 30 };

describe('gap-close-confirm-store', () => {
  it('starts closed', () => {
    expect(getGapCloseConfirmState().open).toBe(false);
  });

  it('request opens with the two endpoints and resolves to the action', async () => {
    const p = requestGapCloseConfirm(A, B);
    const s = getGapCloseConfirmState();
    expect(s.open).toBe(true);
    expect(s.start).toEqual(A);
    expect(s.end).toEqual(B);
    resolveGapCloseConfirm('close');
    await expect(p).resolves.toBe('close');
    expect(getGapCloseConfirmState().open).toBe(false); // back to closed
  });

  it('cancel resolves to cancel and closes', async () => {
    const p = requestGapCloseConfirm(A, B);
    resolveGapCloseConfirm('cancel');
    await expect(p).resolves.toBe('cancel');
    expect(getGapCloseConfirmState().open).toBe(false);
  });
});
