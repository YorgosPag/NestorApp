/**
 * ADR-923 §5.6.1 αποφάσεις 40 και 43 — η έκδοση τιμών **επιζεί** μέσα σε πραγματική φόρμα, με το πραγματικό Radix Select.
 *
 * 🔴 Μετρημένο στην παραγωγή 2026-11-01: το `defaultVersionOf` έδινε σωστή τιμή και το πεδίο έμενε κενό. Μέσα σε `<form>` το Radix
 * βάζει κρυφό native `<select>`· όταν τιμή και επιλογές αλλάζουν στο ίδιο render, γράφει την τιμή πριν υπάρξει η επιλογή της,
 * παίρνει `''` και το στέλνει πίσω ως αλλαγή. Γι' αυτό το test τρέχει μέσα σε `<form>` και χωρίς mock του Select.
 */
import React, { useState } from 'react';
import { act, fireEvent, render } from '@testing-library/react';

import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { emptyRecipe } from '../publication-draft';
import { PublicationPricingFields } from '../PublicationPricingFields';

jest.setTimeout(60_000);

const mockVersion = (id: string, number: number, status: string, validFrom: string) => ({ id, number, status, validFrom, priceListId: 'pl_a' });
const mockView = {
  asOf: '2026-11-01T12:00:00.000Z',
  lists: [{ id: 'pl_a', code: 'mfp_retail', kind: 'sales', labels: {} }],
  versions: [
    mockVersion('v1', 1, 'superseded', '2026-10-29T00:00:00.000Z'),
    mockVersion('v2', 2, 'superseded', '2026-11-02T00:00:00.000Z'),
    mockVersion('v3', 3, 'published', '2026-11-16T00:00:00.000Z'),
  ],
};

let mockListsState: { state: string; view?: typeof mockView } = { state: 'ready', view: mockView };

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));
jest.mock('@/hooks/catalog/usePriceListViews', () => ({
  usePriceListsView: () => ({ current: mockListsState }),
  useDiscountsView: () => ({ current: { state: 'ready', view: { customerGroups: [] } } }),
}));

const priced = (priceListId = '', priceListVersionId = ''): PublicationRecipeDefinition => ({
  ...emptyRecipe('el'),
  pricing: { kind: 'priced', priceListId, priceListVersionId, audience: { kind: 'anonymous' } },
});

interface HarnessProps {
  readonly onDraft: (draft: PublicationRecipeDefinition) => void;
  readonly initial?: PublicationRecipeDefinition;
}

function Harness({ onDraft, initial }: HarnessProps) {
  const [draft, setDraft] = useState(() => initial ?? priced());
  onDraft(draft);
  return <form><PublicationPricingFields draft={draft} onChange={setDraft} issues={[]} disabled={false} /></form>;
}

function nativeSelectWith(container: HTMLElement, value: string): HTMLSelectElement {
  const select = [...container.querySelectorAll('select')].find((candidate) => [...candidate.options].some((option) => option.value === value));
  if (!select) throw new Error(`no native select offers ${value}`);
  return select;
}

describe('PublicationPricingFields — προεπιλογή έκδοσης μέσα σε φόρμα', () => {
  beforeEach(() => { mockListsState = { state: 'ready', view: mockView }; });

  it('🔴 αποθηκευμένη συνταγή: οι τιμοκατάλογοι που φτάνουν μετά δεν αδειάζουν το πρόχειρο', async () => {
    const saved = priced('pl_a', 'v1');
    let latest = saved;
    mockListsState = { state: 'loading' };
    const { rerender } = render(<Harness initial={saved} onDraft={(draft) => { latest = draft; }} />);
    await act(async () => { await Promise.resolve(); });
    mockListsState = { state: 'ready', view: mockView };
    rerender(<Harness initial={saved} onDraft={(draft) => { latest = draft; }} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(latest.pricing).toMatchObject({ priceListId: 'pl_a', priceListVersionId: 'v1' });
  });

  it('🔴 η επιλογή τιμοκαταλόγου αφήνει γεμάτη την έκδοση που ισχύει', async () => {
    let latest = priced();
    const { container } = render(<Harness onDraft={(draft) => { latest = draft; }} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(nativeSelectWith(container, 'pl_a'), { target: { value: 'pl_a' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(latest.pricing).toMatchObject({ kind: 'priced', priceListId: 'pl_a', priceListVersionId: 'v1' });
  });

  it('η μελλοντική έκδοση μένει επιλέξιμη', async () => {
    let latest = priced();
    const { container } = render(<Harness onDraft={(draft) => { latest = draft; }} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(nativeSelectWith(container, 'pl_a'), { target: { value: 'pl_a' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    fireEvent.change(nativeSelectWith(container, 'v3'), { target: { value: 'v3' } });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(latest.pricing).toMatchObject({ priceListVersionId: 'v3' });
  });
});
