/**
 * @fileoverview Ζωντανές ειδοποιήσεις RFQ — η ΣΥΜΠΕΡΙΦΟΡΑ που βλέπει ο άνθρωπος (ADR-328 §5.J.5).
 *
 * Ζ1 αλλαγή άλλου ⇒ toast με **όνομα** (SSoT `resolveUserDisplayName`), ποτέ ωμό uid · «Δες» ⇒ η προσφορά ·
 * Ζ2 όνομα άγνωστο ⇒ απρόσωπη διατύπωση (`rfqs.live.unattributed.*`), ποτέ uid ·
 * Ζ3 δική μου αλλαγή ⇒ σιωπή · πρώτη εικόνα = βάση, όχι αλλαγή ·
 * Ζ4 κρυφή καρτέλα ⇒ τίποτα αθέατο· στην επιστροφή ΕΝΑ συγκεντρωτικό.
 *
 * ⚠️ Μετάλλαξη που ΠΡΕΠΕΙ να κοκκινίζει: `actor` = `plan.event.actorId` αντί για `names.get(…)` ⇒ Ζ1+Ζ2.
 */

import { renderHook, act } from '@testing-library/react';
import type { Quote, QuoteStatus } from '../../types/quote';
import { useLiveChangeToasts } from '../useLiveChangeToasts';

const toastInfo = jest.fn();
jest.mock('sonner', () => ({ toast: { info: (...args: unknown[]) => toastInfo(...args) } }));

const t = (key: string, params?: Record<string, unknown>) => {
  const { defaultValue: _ignored, ...rest } = params ?? {};
  return Object.keys(rest).length ? `${key}|${JSON.stringify(rest)}` : key;
};
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t }) }));
jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => ({ user: { uid: 'uid_me' } }) }));
jest.mock('@/hooks/useUserDisplayNames', () => ({
  resolveUserDisplayName: async (uid: string) => (uid === 'uid_maria' ? 'Μαρία Π.' : ''),
}));

const NOW = 1_800_000_000_000;

function quote(id: string, status: QuoteStatus, updatedBy: string): Quote {
  return {
    id,
    displayNumber: `QT-${id}`,
    status,
    vendorContactId: '',
    vendorSnapshot: { name: `Vendor ${id}`, email: null, inviteId: 'vi_1' },
    extractedData: null,
    totals: { total: 100 },
    createdBy: 'uid_me',
    updatedBy,
    updatedAt: { toMillis: () => NOW - 500 },
  } as unknown as Quote;
}

let hidden = false;
beforeAll(() => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  toastInfo.mockClear();
  hidden = false;
});
afterEach(() => jest.useRealTimers());

async function settle(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(1_300);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

function mount(onView = jest.fn()) {
  const base = [quote('1', 'submitted', 'uid_me'), quote('2', 'submitted', 'uid_me'), quote('3', 'submitted', 'uid_me')];
  const hook = renderHook(
    ({ quotes }: { quotes: Quote[] }) => useLiveChangeToasts({ rfqId: 'rfq_1', quotes, ready: true, onView }),
    { initialProps: { quotes: base } },
  );
  return { ...hook, base, onView };
}

it('Ζ1 — αλλαγή άλλου ⇒ toast με όνομα· «Δες» ανοίγει την προσφορά', async () => {
  const { rerender, base, onView } = mount();
  rerender({ quotes: [quote('1', 'rejected', 'uid_maria'), base[1], base[2]] });
  await settle();
  expect(toastInfo).toHaveBeenCalledTimes(1);
  const [message, options] = toastInfo.mock.calls[0] as [string, { action: { onClick: () => void } }];
  expect(message).toContain('rfqs.live.quoteRejected');
  expect(message).toContain('Μαρία Π.');
  expect(message).not.toContain('uid_maria');
  options.action.onClick();
  expect(onView).toHaveBeenCalledWith('1');
});

it('Ζ2 — όνομα άγνωστο ⇒ απρόσωπη διατύπωση, ποτέ uid', async () => {
  const { rerender, base } = mount();
  rerender({ quotes: [quote('1', 'under_review', 'uid_ghost'), base[1], base[2]] });
  await settle();
  const [message] = toastInfo.mock.calls[0] as [string];
  expect(message).toContain('rfqs.live.unattributed.quoteConfirmed');
  expect(message).not.toContain('uid_ghost');
});

it('Ζ3 — δική μου αλλαγή / πρώτη εικόνα ⇒ σιωπή', async () => {
  const { rerender, base } = mount();
  await settle();
  rerender({ quotes: [quote('1', 'rejected', 'uid_me'), base[1], base[2]] });
  await settle();
  expect(toastInfo).not.toHaveBeenCalled();
});

it('Ζ4 — κρυφή καρτέλα ⇒ τίποτα αθέατο· στην επιστροφή ΕΝΑ συγκεντρωτικό', async () => {
  const { rerender } = mount();
  hidden = true;
  rerender({
    quotes: [quote('1', 'rejected', 'uid_maria'), quote('2', 'rejected', 'uid_maria'), quote('3', 'under_review', 'uid_maria')],
  });
  await settle();
  expect(toastInfo).not.toHaveBeenCalled();
  hidden = false;
  act(() => { document.dispatchEvent(new Event('visibilitychange')); });
  await settle();
  expect(toastInfo).toHaveBeenCalledTimes(1);
  expect(toastInfo.mock.calls[0][0]).toBe('rfqs.live.aggregated|{"actor":"Μαρία Π.","count":3}');
});
