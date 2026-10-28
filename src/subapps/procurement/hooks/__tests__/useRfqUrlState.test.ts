/**
 * @fileoverview Η κατάσταση της σελίδας RFQ αλλάζει ΧΩΡΙΣ πλοήγηση (ADR-327, 2026-10-28).
 *
 * 🔴 Το περιστατικό: κάθε κλικ καρτέλας ήταν `router.push('?tab=…')` ⇒ γύρος RSC της σελίδας (3,5 s μετρημένα στον dev·
 *    σε απασχολημένο server η καρτέλα «πάγωνε»). Ο router εδώ **πετά αν κληθεί** — η άγκυρα κοκκινίζει αν ξαναμπεί.
 *
 * Τ1 αλλαγή καρτέλας ⇒ διεύθυνση + `activeTab` ενημερώνονται, ΜΙΑ νέα καταχώριση ιστορικού, το `?status=` φεύγει ·
 * Τ2 επιλογή προσφοράς (desktop) ⇒ replace (καμία νέα καταχώριση) ·
 * Τ3 «άνοιξε προσφορά» από τη σύγκριση ⇒ ΕΝΑ push με `tab=quotes` + `quote` ·
 * Τ4 άσχετα κλειδιά και το `pathname` μένουν ανέγγιχτα.
 */

import { act, renderHook } from '@testing-library/react';
import type { Quote } from '../../types/quote';
import { useRfqUrlState } from '../useRfqUrlState';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
jest.mock('@/lib/workspace/navigation', () => ({
  useRouter: () => {
    throw new Error('useRfqUrlState must not navigate (ADR-327)');
  },
}));
jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));

const PATH = '/o/ws/projects/p1/procurement/rfq/rfq_1';
const QUOTES = [
  { id: 'qt_a', status: 'submitted', submittedAt: null },
  { id: 'qt_b', status: 'submitted', submittedAt: null },
] as unknown as Quote[];

async function flushUrlNotifications(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

function setup(query: string) {
  window.history.replaceState(null, '', `${PATH}${query}`);
  return renderHook(() => useRfqUrlState({ quotes: QUOTES, quotesLoading: false }));
}

describe('useRfqUrlState — χωρίς πλοήγηση', () => {
  it('Τ1+Τ4: καρτέλα ⇒ διεύθυνση + activeTab, ένα push, το status φεύγει, τα άσχετα μένουν', async () => {
    const { result } = setup('?tab=history&quote=qt_a&status=submitted&keep=1');
    expect(result.current.activeTab).toBe('history');
    const before = window.history.length;

    act(() => result.current.handleTabChange('comparison'));
    await flushUrlNotifications();

    expect(window.location.pathname).toBe(PATH);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('tab')).toBe('comparison');
    expect(params.get('status')).toBeNull();
    expect(params.get('keep')).toBe('1');
    expect(params.get('quote')).toBe('qt_a');
    expect(window.history.length).toBe(before + 1);
    expect(result.current.activeTab).toBe('comparison');
  });

  it('Τ2: επιλογή προσφοράς στο desktop = replace', async () => {
    const { result } = setup('?tab=quotes&quote=qt_a');
    const before = window.history.length;

    act(() => result.current.handleSelectQuote(QUOTES[1]));
    await flushUrlNotifications();

    expect(new URLSearchParams(window.location.search).get('quote')).toBe('qt_b');
    expect(window.history.length).toBe(before);
    expect(result.current.selectedQuote?.id).toBe('qt_b');
  });

  it('Τ3: «άνοιξε προσφορά» από τη σύγκριση = ΕΝΑ push με tab + quote', async () => {
    const { result } = setup('?tab=comparison&quote=qt_a&status=accepted');
    const before = window.history.length;

    act(() => result.current.handleComparisonDrillDown('qt_b'));
    await flushUrlNotifications();

    const params = new URLSearchParams(window.location.search);
    expect([params.get('tab'), params.get('quote'), params.get('status')]).toEqual(['quotes', 'qt_b', null]);
    expect(window.history.length).toBe(before + 1);
    expect(result.current.activeTab).toBe('quotes');
  });
});
