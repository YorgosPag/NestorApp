/**
 * =============================================================================
 * SearchInput — ΜΙΑ ΚΑΤΕΥΘΥΝΣΗ ΡΟΗΣ (εύρημα ζωντανής επαλήθευσης ADR-332 D27 Β-ΙΙ, 2026-09-11)
 * =============================================================================
 *
 * Βρέθηκε ζωντανά στη σελίδα επαφών: το πεδίο αναζήτησης ταλαντευόταν «ALF» ↔ «ALFA»
 * για πάντα, με «Maximum update depth exceeded» ~1/s, ώσπου πάγωσε ο renderer.
 *
 * 🔴 Αιτία: ΔΥΟ πηγές αλήθειας (`localValue` + `value`) με ΔΥΟ effects σε αντίθετες
 * κατευθύνσεις — `local → onChange` και `value → local`. Όταν αποκλίνουν στο ΙΔΙΟ
 * commit, κάθε effect αντιγράφει την ΑΛΛΗ τιμή ⇒ ανταλλάσσονται σε κάθε απόδοση.
 * Και επειδή το `onChange` ήταν εξάρτηση effect, κάθε νέα ταυτότητά του (inline
 * handler) ξανάστελνε την τιμή χωρίς καμία πράξη χρήστη.
 *
 * Σ1 = η ΔΟΜΙΚΗ συνθήκη: μια εξωτερική ενημέρωση ήδη στην ουρά όταν φτάνει η
 * πληκτρολόγηση ⇒ και οι δύο αλλάζουν στο ίδιο commit. Ιχνηλατημένο πάνω στον παλιό
 * κώδικα: `value=ALF input=ALFA ↔ value=ALFA input=ALF` + «Maximum update depth» —
 * ΤΑΥΤΟΣΗΜΟ με το ζωντανό αποτύπωμα. (Η πρώτη εκδοχή με `startTransition` ΔΕΝ το
 * αναπαρήγαγε — πέρασε πάνω στον παλιό κώδικα, άρα δεν ήταν άγκυρα· αντικαταστάθηκε.)
 * Το φρένο `RENDER_STORM_LIMIT` μετατρέπει τον ατέρμονο βρόχο σε ΚΟΚΚΙΝΟ αντί για
 * κρέμασμα του jest.
 * =============================================================================
 */

import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import { SearchInput } from '../SearchInput';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const RENDER_STORM_LIMIT = 60;

interface HarnessHandle {
  setExternal: (next: string) => void;
  rerender: () => void;
}

interface HarnessProps {
  debounceMs: number;
  onEmit: (value: string) => void;
  /** true = νέο `onChange` σε ΚΑΘΕ απόδοση (το σχήμα του `TasksPageContent`). */
  inlineHandler?: boolean;
  onClear?: () => void;
}

const Harness = forwardRef<HarnessHandle, HarnessProps>(function Harness(
  { debounceMs, onEmit, inlineHandler = false, onClear },
  ref,
) {
  const [value, setValue] = useState('');
  const [, setTick] = useState(0);
  const renders = useRef(0);
  renders.current += 1;
  if (renders.current > RENDER_STORM_LIMIT) {
    throw new Error(`render storm: ${renders.current} αποδόσεις`);
  }

  useImperativeHandle(ref, () => ({ setExternal: setValue, rerender: () => setTick(t => t + 1) }), []);

  const stableHandler = useCallback((next: string) => {
    onEmit(next);
    setValue(next);
  }, [onEmit]);
  const handler = inlineHandler
    ? (next: string) => { onEmit(next); setValue(next); }
    : stableHandler;

  return (
    <>
      <SearchInput value={value} onChange={handler} debounceMs={debounceMs} onClear={onClear} />
      <output data-testid="parent-value">{value}</output>
    </>
  );
});

function setup(props: Omit<HarnessProps, 'onEmit'>) {
  const ref = React.createRef<HarnessHandle>();
  const onEmit = jest.fn((_value: string) => undefined);
  render(<Harness ref={ref} onEmit={onEmit} {...props} />);
  const handle = (): HarnessHandle => {
    if (!ref.current) throw new Error('harness not mounted');
    return ref.current;
  };
  return {
    input: screen.getByRole('textbox'),
    onEmit,
    handle,
    parentValue: () => screen.getByTestId('parent-value').textContent,
  };
}

describe('SearchInput — μία κατεύθυνση ροής', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('Σ1: εξωτερική ενημέρωση στην ουρά + πληκτρολόγηση στο ΙΔΙΟ commit ⇒ καμία ατέρμονη ανταλλαγή', () => {
    const { input, parentValue, handle } = setup({ debounceMs: 0 });

    act(() => {
      handle().setExternal('ALF');
      fireEvent.change(input, { target: { value: 'ALFA' } });
    });
    act(() => { jest.advanceTimersByTime(1000); });

    expect(input).toHaveValue(parentValue());
    const settled = (input as HTMLInputElement).value;
    act(() => { jest.advanceTimersByTime(1000); });
    expect(input).toHaveValue(settled);
  });

  it.each([0, 200])('Σ2 (debounce %i): καμία εκπομπή χωρίς πράξη χρήστη — ούτε στο mount, ούτε σε νέα ταυτότητα onChange', (debounceMs) => {
    const { onEmit, handle } = setup({ debounceMs, inlineHandler: true });

    for (let i = 0; i < 5; i += 1) act(() => { handle().rerender(); });
    act(() => { jest.advanceTimersByTime(2000); });

    expect(onEmit).not.toHaveBeenCalled();
  });

  it('Σ3: με debounce, γρήγορη πληκτρολόγηση ⇒ ΜΙΑ εκπομπή, η τελευταία τιμή', () => {
    const { input, onEmit, parentValue } = setup({ debounceMs: 300 });

    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => { jest.advanceTimersByTime(299); });
    expect(onEmit).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1); });
    expect(onEmit.mock.calls).toEqual([['abc']]);
    expect(parentValue()).toBe('abc');
    expect(input).toHaveValue('abc');
  });

  it('Σ4: εξωτερική αλλαγή ΑΚΥΡΩΝΕΙ την εκκρεμή εκπομπή — δεν την ξαναγράφει μπαγιάτικη', () => {
    const { input, onEmit, parentValue, handle } = setup({ debounceMs: 300 });

    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => { handle().setExternal('xyz'); });
    act(() => { jest.advanceTimersByTime(1000); });

    expect(onEmit).not.toHaveBeenCalledWith('abc');
    expect(parentValue()).toBe('xyz');
    expect(input).toHaveValue('xyz');
  });

  it('Σ5: ο «καθαρισμός» εκπέμπει ΑΜΕΣΩΣ, και με debounce — είναι ρητή πράξη, όχι πληκτρολόγηση', () => {
    const onClear = jest.fn();
    const { input, onEmit, parentValue } = setup({ debounceMs: 300, onClear });

    fireEvent.change(input, { target: { value: 'abc' } });
    act(() => { jest.advanceTimersByTime(300); });
    fireEvent.click(screen.getByRole('button', { name: 'labels.clearSearch' }));

    expect(onEmit).toHaveBeenLastCalledWith('');
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(parentValue()).toBe('');
    expect(input).toHaveValue('');
  });

  it('Σ6: χωρίς debounce, κάθε πληκτρολόγηση εκπέμπεται ΣΥΓΧΡΟΝΑ, από το ίδιο το συμβάν', () => {
    const { input, onEmit, parentValue } = setup({ debounceMs: 0 });

    fireEvent.change(input, { target: { value: 'A' } });
    fireEvent.change(input, { target: { value: 'AL' } });

    expect(onEmit.mock.calls).toEqual([['A'], ['AL']]);
    expect(parentValue()).toBe('AL');
  });

  it('Σ7: η εξωτερική τιμή υιοθετείται ΧΩΡΙΣ ηχώ προς τα πίσω', () => {
    const { input, onEmit, handle } = setup({ debounceMs: 0 });

    act(() => { handle().setExternal('xyz'); });

    expect(input).toHaveValue('xyz');
    expect(onEmit).not.toHaveBeenCalled();
  });

  it('Σ8: αποπροσάρτηση με εκκρεμή εκπομπή ⇒ καμία εκπομπή μετά', () => {
    const ref = React.createRef<HarnessHandle>();
    const onEmit = jest.fn((_value: string) => undefined);
    const { unmount } = render(<Harness ref={ref} onEmit={onEmit} debounceMs={300} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } });
    unmount();
    act(() => { jest.advanceTimersByTime(1000); });

    expect(onEmit).not.toHaveBeenCalled();
  });

  it('Σ9: η ηχώ ΤΗΣ ΔΙΚΗΣ ΜΑΣ εκπομπής που φτάνει αργά ΔΕΝ τρώει το γράμμα που μόλις γράφτηκε', () => {
    const { input, onEmit, parentValue } = setup({ debounceMs: 300 });

    fireEvent.change(input, { target: { value: 'ab' } });
    // Ο χρονοδιακόπτης εκπέμπει «ab», αλλά ο γονέας αποδίδεται ΜΕΤΑ την επόμενη πληκτρολόγηση.
    act(() => {
      jest.advanceTimersByTime(300);
      fireEvent.change(input, { target: { value: 'abc' } });
    });
    expect(input).toHaveValue('abc');

    act(() => { jest.advanceTimersByTime(300); });
    expect(onEmit.mock.calls).toEqual([['ab'], ['abc']]);
    expect(parentValue()).toBe('abc');
    expect(input).toHaveValue('abc');
  });
});
