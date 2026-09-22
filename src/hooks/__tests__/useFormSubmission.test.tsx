/**
 * @file ADR-598 §3 procurement — το συμβόλαιο του `useFormSubmission`.
 *
 * - Σ1: δύο υποβολές στο ΙΔΙΟ tick ⇒ ΜΙΑ εργασία (κλείδωμα `ref`, όχι state).
 * - Σ2: `canSubmit=false` ⇒ καμία εργασία, από ΟΠΟΙΟΝ δρόμο κι αν έρθει.
 * - Σ3: σφάλμα με μήνυμα ⇒ το μήνυμα· χωρίς μήνυμα ⇒ το `errorFallback`.
 * - Σ4: επιτυχία ⇒ `onSuccess(result)`, και το κλείδωμα ανοίγει ξανά.
 * - Σ5: το `preventDefault` του γεγονότος καλείται (αλλιώς ο φυλλομετρητής πλοηγείται).
 */

import { act, renderHook } from '@testing-library/react';

import { useFormSubmission, type UseFormSubmissionOptions } from '../useFormSubmission';

function setup<R>(overrides: Partial<UseFormSubmissionOptions<R>> & Pick<UseFormSubmissionOptions<R>, 'submit'>) {
  return renderHook((props: UseFormSubmissionOptions<R>) => useFormSubmission(props), {
    initialProps: { canSubmit: true, errorFallback: 'fallback', ...overrides },
  });
}

function deferred(): { promise: Promise<string>; resolve: (v: string) => void } {
  let resolve: (v: string) => void = () => undefined;
  const promise = new Promise<string>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('useFormSubmission', () => {
  it('Σ1: δύο υποβολές στο ίδιο tick ⇒ ΜΙΑ εργασία', async () => {
    const gate = deferred();
    const submit = jest.fn(() => gate.promise);
    const { result } = setup({ submit });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.handleSubmit();
      void result.current.handleSubmit();
    });
    expect(submit).toHaveBeenCalledTimes(1);
    expect(result.current.submitting).toBe(true);

    await act(async () => { gate.resolve('ok'); await first; });
    expect(result.current.submitting).toBe(false);
  });

  it('Σ2: canSubmit=false ⇒ καμία εργασία', async () => {
    const submit = jest.fn(async () => 'ok');
    const { result } = setup({ submit, canSubmit: false });
    await act(() => result.current.handleSubmit());
    expect(submit).not.toHaveBeenCalled();
  });

  it.each([
    ['Error με μήνυμα', new Error('Ο αριθμός υπάρχει ήδη'), 'Ο αριθμός υπάρχει ήδη'],
    ['τιμή χωρίς μήνυμα', 42, 'fallback'],
  ])('Σ3: %s ⇒ «%s»', async (_case, thrown, expected) => {
    const { result } = setup({ submit: async () => { throw thrown; } });
    await act(() => result.current.handleSubmit());
    expect(result.current.error).toBe(expected);
    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });

  it('Σ4: επιτυχία ⇒ onSuccess(result) και το κλείδωμα ανοίγει ξανά', async () => {
    const onSuccess = jest.fn();
    const submit = jest.fn(async () => 'id-1');
    const { result } = setup({ submit, onSuccess });
    await act(() => result.current.handleSubmit());
    await act(() => result.current.handleSubmit());
    expect(onSuccess).toHaveBeenCalledWith('id-1');
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('Σ5: preventDefault στο γεγονός της φόρμας', async () => {
    const preventDefault = jest.fn();
    const { result } = setup({ submit: async () => 'ok' });
    await act(() => result.current.handleSubmit({ preventDefault }));
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});
