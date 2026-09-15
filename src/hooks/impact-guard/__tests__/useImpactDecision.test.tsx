/**
 * =============================================================================
 * ΑΓΚΥΡΕΣ ΤΟΥ ΠΥΡΗΝΑ ΑΠΟΦΑΣΗΣ — η έκβαση ΜΕΤΑ την πράξη (ADR-664 · ADR-777 §8.69.13)
 * =============================================================================
 *
 * 🔴 Το ελάττωμα: σε `warn` η υπόσχεση λυνόταν `false` **πριν** την απόφαση και η πράξη έτρεχε
 * fire-and-forget. Εδώ αποδεικνύεται ότι λύνεται **μόνο μετά** την πράξη, με **όνομα**, και ότι
 * το κέρδος INP (κλείσιμο πριν την πράξη) **έμεινε**.
 */
import { act, renderHook } from '@testing-library/react';

import {
  GUARD_BLOCKED,
  GUARD_CANCELLED,
  GUARD_COMPLETED,
  outcomeOrThrow,
  type GuardResult,
} from '../guard-result';
import { useImpactDecision, type ImpactPreviewShape } from '../useImpactDecision';

const loggerError = jest.fn();
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ error: (...args: unknown[]) => loggerError(...args), warn: jest.fn(), info: jest.fn() }),
}));
jest.mock('@/lib/api/enterprise-api-client', () => ({
  ApiClientError: { isApiClientError: () => false },
}));

interface Preview extends ImpactPreviewShape {
  readonly label: string;
}

const preview = (mode: Preview['mode']): Preview => ({ mode, label: mode });
const UNAVAILABLE: Preview = { mode: 'block', label: 'unavailable' };

function renderDecision(onBlockDismiss?: () => void) {
  return renderHook(() => useImpactDecision<Preview>('test', { onBlockDismiss }));
}

type Hook = ReturnType<typeof renderDecision>['result'];

/** Ξεκινά τη φύλαξη και αφήνει το preview να απαντήσει — χωρίς να περιμένει την έκβαση. */
async function begin(result: Hook, mode: Preview['mode'] | 'error', action: () => Promise<void>) {
  let settled: GuardResult | null = null;
  let promise!: Promise<GuardResult>;
  await act(async () => {
    promise = result.current.guard({
      fetchPreview: () => (mode === 'error' ? Promise.reject(new Error('down')) : Promise.resolve(preview(mode))),
      unavailablePreview: () => UNAVAILABLE,
      action,
    });
    void promise.then((value) => { settled = value; });
  });
  return { promise, settled: () => settled };
}

/** Πράξη που τελειώνει **μόνο** όταν την αφήσουμε — για να φανεί το «μετά». */
function heldAction() {
  let release!: () => void;
  let reject!: (error: Error) => void;
  const action = jest.fn(() => new Promise<void>((resolve, fail) => { release = resolve; reject = fail; }));
  return { action, release: () => release(), fail: (error: Error) => reject(error) };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Ε — οι τέσσερις εκβάσεις', () => {
  it('Ε1 — allow ⇒ `completed`, η πράξη τρέχει αμέσως, κανένας διάλογος', async () => {
    const { result } = renderDecision();
    const action = jest.fn().mockResolvedValue(undefined);

    const { promise } = await begin(result, 'allow', action);

    await expect(promise).resolves.toEqual(GUARD_COMPLETED);
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.dialogProps.open).toBe(false);
  });

  it('🔴 Ε2 — allow με πράξη που σκάει ⇒ `failed` ΜΕ το σφάλμα (ποτέ σιωπηλή απώλεια)', async () => {
    const { result } = renderDecision();
    const boom = new Error('409');

    const { promise } = await begin(result, 'allow', jest.fn().mockRejectedValue(boom));

    await expect(promise).resolves.toEqual({ outcome: 'failed', error: boom });
  });

  it('🔴🔴 Ε3 ΤΟ ΕΛΑΤΤΩΜΑ — warn ⇒ ΚΑΜΙΑ έκβαση πριν την απόφαση· `completed` ΜΟΝΟ ΜΕΤΑ την πράξη', async () => {
    const { result } = renderDecision();
    const held = heldAction();

    const run = await begin(result, 'warn', held.action);
    expect(result.current.dialogProps.open).toBe(true);
    expect(run.settled()).toBeNull();

    act(() => { result.current.dialogProps.onConfirm(); });
    // INP: ο διάλογος έκλεισε ΚΑΙ η πράξη ΔΕΝ έχει ξεκινήσει ακόμη.
    expect(result.current.dialogProps.open).toBe(false);
    expect(held.action).not.toHaveBeenCalled();

    await act(async () => { jest.runAllTimers(); });
    expect(held.action).toHaveBeenCalledTimes(1);
    expect(run.settled()).toBeNull();

    await act(async () => { held.release(); });
    expect(run.settled()).toEqual(GUARD_COMPLETED);
  });

  it('Ε4 — warn → συνέχεια → η πράξη σκάει ⇒ `failed` (ήταν `console.error`, αόρατο)', async () => {
    const { result } = renderDecision();
    const held = heldAction();
    const boom = new Error('permission');

    const run = await begin(result, 'warn', held.action);
    act(() => { result.current.dialogProps.onConfirm(); });
    await act(async () => { jest.runAllTimers(); });
    await act(async () => { held.fail(boom); });

    expect(run.settled()).toEqual({ outcome: 'failed', error: boom });
  });

  it('🔴 Ε5 — warn → ακύρωση ⇒ `cancelled`, η πράξη ΠΟΤΕ', async () => {
    const { result } = renderDecision();
    const action = jest.fn().mockResolvedValue(undefined);

    const run = await begin(result, 'warn', action);
    await act(async () => { result.current.dialogProps.onOpenChange(false); });
    await act(async () => { jest.runAllTimers(); });

    expect(run.settled()).toEqual(GUARD_CANCELLED);
    expect(action).not.toHaveBeenCalled();
  });

  it('Ε6 — Radix: συνέχεια ΚΑΙ μετά κλείσιμο (ίδιο κλικ) ⇒ ΔΕΝ ακυρώνεται η επιβεβαίωση', async () => {
    const { result } = renderDecision();
    const action = jest.fn().mockResolvedValue(undefined);

    const run = await begin(result, 'warn', action);
    act(() => {
      result.current.dialogProps.onConfirm();
      result.current.dialogProps.onOpenChange(false);
    });
    await act(async () => { jest.runAllTimers(); });

    expect(action).toHaveBeenCalledTimes(1);
    expect(run.settled()).toEqual(GUARD_COMPLETED);
  });

  it('🔴 Ε7 — block ⇒ `blocked` στο κλείσιμο, ΚΑΙ με «συνέχεια» — η πράξη ΠΟΤΕ, onBlockDismiss μία φορά', async () => {
    const onBlockDismiss = jest.fn();
    const { result } = renderDecision(onBlockDismiss);
    const action = jest.fn().mockResolvedValue(undefined);

    const run = await begin(result, 'block', action);
    await act(async () => { result.current.dialogProps.onConfirm(); });
    await act(async () => { jest.runAllTimers(); });

    expect(run.settled()).toEqual(GUARD_BLOCKED);
    expect(action).not.toHaveBeenCalled();
    expect(onBlockDismiss).toHaveBeenCalledTimes(1);
  });

  it('Ε8 — preview που αποτυγχάνει ⇒ διάλογος «μη διαθέσιμο» ⇒ `blocked`, καταγεγραμμένο', async () => {
    const { result } = renderDecision();
    const action = jest.fn().mockResolvedValue(undefined);

    const run = await begin(result, 'error', action);
    expect(result.current.dialogProps.preview).toEqual(UNAVAILABLE);
    expect(result.current.checking).toBe(false);
    await act(async () => { result.current.dialogProps.onOpenChange(false); });

    expect(run.settled()).toEqual(GUARD_BLOCKED);
    expect(action).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalled();
  });
});

describe('Κ — καμία κρεμασμένη υπόσχεση', () => {
  it('Κ1 — unmount με εκκρεμή απόφαση ⇒ `cancelled`', async () => {
    const view = renderDecision();
    const run = await begin(view.result, 'warn', jest.fn().mockResolvedValue(undefined));

    await act(async () => { view.unmount(); });

    expect(run.settled()).toEqual(GUARD_CANCELLED);
  });

  it('Κ2 — δεύτερη κλήση ενώ εκκρεμεί ⇒ η πρώτη `cancelled`, η δεύτερη ζωντανή', async () => {
    const { result } = renderDecision();
    const first = jest.fn().mockResolvedValue(undefined);
    const second = jest.fn().mockResolvedValue(undefined);

    const runOne = await begin(result, 'warn', first);
    const runTwo = await begin(result, 'warn', second);
    expect(runOne.settled()).toEqual(GUARD_CANCELLED);

    act(() => { result.current.dialogProps.onConfirm(); });
    await act(async () => { jest.runAllTimers(); });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(runTwo.settled()).toEqual(GUARD_COMPLETED);
  });

  it('Κ3 — reset ⇒ `cancelled`, και σταθερή ταυτότητα με inline options', async () => {
    const { result, rerender } = renderHook(() => useImpactDecision<Preview>('test', { onBlockDismiss: () => {} }));
    const firstReset = result.current.reset;
    rerender();
    expect(result.current.reset).toBe(firstReset);

    const run = await begin(result, 'warn', jest.fn().mockResolvedValue(undefined));
    await act(async () => { result.current.reset(); });

    expect(run.settled()).toEqual(GUARD_CANCELLED);
  });
});

describe('Ρ — outcomeOrThrow', () => {
  it('Ρ1 — `failed` ρίχνει το ΑΡΧΙΚΟ σφάλμα· οι άλλες επιστρέφουν την έκβαση', () => {
    const boom = new Error('x');
    expect(() => outcomeOrThrow({ outcome: 'failed', error: boom })).toThrow(boom);
    expect(outcomeOrThrow(GUARD_COMPLETED)).toBe('completed');
    expect(outcomeOrThrow(GUARD_CANCELLED)).toBe('cancelled');
    expect(outcomeOrThrow(GUARD_BLOCKED)).toBe('blocked');
  });
});
