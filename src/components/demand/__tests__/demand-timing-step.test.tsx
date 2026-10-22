/**
 * @fileoverview Άγκυρες — **ΤΟ ΠΡΩΤΟ ΒΗΜΑ ΤΗΣ ΖΗΤΗΣΗΣ: «Πότε το θέλεις;»** (ADR-777 §8.98).
 *
 * | # | Κανόνας | Μετάλλαξη που πιάνει |
 * |---|---|---|
 * | Β1 | χωρίς `?when=` ⇒ επιλογέας, **όχι** φόρμα | η φόρμα ανοίγει κατευθείαν με προεπιλογή «Τώρα» |
 * | Β2 | άγνωστο `?when=` ⇒ επιλογέας | ο parser δέχεται οτιδήποτε |
 * | Β3 | έγκυρο `?when=` ⇒ φόρμα με **αυτό** το «πότε» | η απάντηση χάνεται στο δεύτερο βήμα |
 * | Β4 | το `from` του χάρτη (ADR-888) περνά από τον επιλογέα **και** φτάνει στη φόρμα | ο επιλογέας σβήνει την αναζήτηση |
 * | Β5 | τρεις κάρτες, με τη σειρά του SSoT· το πάτημα κάνει `push` (το «πίσω» γυρίζει) | `replace` · λάθος σειρά |
 */

import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

const push = jest.fn();
const replace = jest.fn();
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

const gateProps = jest.fn();
jest.mock('@/components/demand/DemandCreationGate', () => ({
  DemandCreationGate: (props: unknown) => {
    gateProps(props);
    return null;
  },
}));

import NewDemandPage from '@/app/(me)/demands/new/page';
import { DemandTimingChooser } from '../DemandTimingChooser';
import { NEW_DEMAND_ROUTE, newDemandWithTimingHref } from '@/lib/demand/demand-routes';
import { DEMAND_TIMING_KINDS, isDemandTimingKind } from '@/types/property-demand';

type GateCall = { timingChooserQuery?: string; initialValues?: { timingKind: string; seeks?: unknown } };

async function renderPage(params: Record<string, string>): Promise<GateCall> {
  gateProps.mockClear();
  render(await NewDemandPage({ searchParams: Promise.resolve(params) }));
  return gateProps.mock.calls[0][0] as GateCall;
}

beforeEach(() => {
  push.mockClear();
  replace.mockClear();
});

describe('Β1–Β4 — η σελίδα διαλέγει βήμα από τον σύνδεσμο', () => {
  it('Β1: χωρίς `when` ⇒ επιλογέας με κενό query', async () => {
    const call = await renderPage({});
    expect(call).toEqual({ timingChooserQuery: '' });
  });

  it('Β2: άγνωστο `when` ⇒ επιλογέας', async () => {
    expect((await renderPage({ when: 'tomorrow' })).timingChooserQuery).toBe('');
    expect(isDemandTimingKind('tomorrow')).toBe(false);
    expect(isDemandTimingKind(undefined)).toBe(false);
  });

  it.each(DEMAND_TIMING_KINDS)('Β3: `when=%s` ⇒ φόρμα με αυτό το «πότε»', async (kind) => {
    const call = await renderPage({ when: kind });
    expect(call.timingChooserQuery).toBeUndefined();
    expect(call.initialValues?.timingKind).toBe(kind);
  });

  it('Β4: το `from` κρατιέται στον επιλογέα και φτάνει στη φόρμα', async () => {
    const from = 'transaction=rent';
    const chooser = await renderPage({ from });
    expect(new URLSearchParams(chooser.timingChooserQuery).get('from')).toBe(from);

    const next = String(newDemandWithTimingHref('whenever', chooser.timingChooserQuery ?? ''));
    const query = new URLSearchParams(next.slice(next.indexOf('?') + 1));
    expect(query.get('from')).toBe(from);
    expect(query.get('when')).toBe('whenever');

    const form = await renderPage({ from, when: 'whenever' });
    expect(form.initialValues?.timingKind).toBe('whenever');
  });
});

describe('Β5 — ο επιλογέας', () => {
  it('τρεις κάρτες με τη σειρά του SSoT, και το πάτημα κάνει push', () => {
    render(<DemandTimingChooser currentQuery="from=a%3Db" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(
      DEMAND_TIMING_KINDS.map(
        (kind) => `property-market:demand.form.timing.${kind}property-market:demand.form.timing.chooser.${kind}`,
      ),
    );

    fireEvent.click(buttons[2]);
    expect(replace).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith(`${NEW_DEMAND_ROUTE}?from=a%3Db&when=whenever`);
  });
});
