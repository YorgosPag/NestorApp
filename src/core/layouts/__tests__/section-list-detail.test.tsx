/**
 * @fileoverview 🧭 **Λίστα ενοτήτων → ενότητα: «ποια» τη λέει η διεύθυνση, «πόσες στήλες» το CSS** (ADR-946).
 * @related core/layouts/SectionListDetail.tsx · hooks/useUrlTabParam.ts (`useUrlSection`) · lib/url-query-state.ts
 *
 * ⚠️ Το jsdom δεν έχει διάταξη: εδώ αποδεικνύεται **τι** αποδίδεται, **ποια** καταχώριση ιστορικού γράφεται και **τι
 * αναφέρει** η οθόνη (`data-section-pane`) — όχι πώς φαίνεται. Η γεωμετρία ελέγχεται ζωντανά (ADR-946 §επαλήθευση).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { mockViewport } from '@/test-utils/viewport';

import { SectionListDetail } from '../SectionListDetail';

const SECTIONS = [
  { id: 'alpha', label: 'Άλφα', summary: 'πρώτη' },
  { id: 'beta', label: 'Βήτα', count: 2, attention: true },
] as const;

function Page() {
  return (
    <SectionListDetail
      sections={SECTIONS}
      navLabel="ενότητες"
      backLabel="πίσω"
      asideLabel="πλαϊνό"
      aside={<p>aside-content</p>}
    >
      {(activeId) => <p data-testid="section-body">{`body-${activeId}`}</p>}
    </SectionListDetail>
  );
}

const pane = (): string | null => document.querySelector('[data-section-pane]')?.getAttribute('data-section-pane') ?? null;
const navButton = (label: string): HTMLElement => screen.getByRole('button', { name: new RegExp(label) });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('ADR-946 — φαρδιά οθόνη', () => {
  beforeEach(() => mockViewport(false));

  it('Φ1 — χωρίς παράμετρο ⇒ η ΠΡΩΤΗ ενότητα, σε ΕΝΑ αντίτυπο, σημειωμένη στη λίστα', () => {
    render(<Page />);
    expect(screen.getAllByTestId('section-body')).toHaveLength(1);
    expect(screen.getByTestId('section-body')).toHaveTextContent('body-alpha');
    expect(navButton('Άλφα')).toHaveAttribute('aria-current', 'true');
    expect(screen.getAllByText('aside-content')).toHaveLength(1);
  });

  it('Φ2 — επιλογή = `replace` (καμία νέα καταχώριση)· η προεπιλογή ΔΕΝ γράφεται στη διεύθυνση', async () => {
    render(<Page />);
    const entries = window.history.length;

    fireEvent.click(navButton('Βήτα'));
    expect(window.location.search).toBe('?section=beta');
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveTextContent('body-beta'));

    fireEvent.click(navButton('Άλφα'));
    expect(window.location.search).toBe('');
    await waitFor(() => expect(screen.getByTestId('section-body')).toHaveTextContent('body-alpha'));
    expect(window.history.length).toBe(entries);
  });

  it('Φ3 — ο μετρητής φαίνεται, και ζητά προσοχή όταν το λέει η γραμμή', () => {
    render(<Page />);
    expect(navButton('Βήτα')).toHaveTextContent('2');
  });

  it('Φ4 — άγνωστη ενότητα στη διεύθυνση (παλιός σύνδεσμος) ⇒ προεπιλογή, ποτέ κενή σκηνή', () => {
    window.history.replaceState(null, '', '/?section=gone');
    render(<Page />);
    expect(screen.getByTestId('section-body')).toHaveTextContent('body-alpha');
    expect(pane()).toBe('list');
  });
});

describe('ADR-946 — στενή οθόνη (drill-down)', () => {
  beforeEach(() => mockViewport(true));

  it('Σ1 — χωρίς παράμετρο ⇒ η οθόνη είναι η ΛΙΣΤΑ', () => {
    render(<Page />);
    expect(pane()).toBe('list');
  });

  it('🔴 Σ2 — άνοιγμα ενότητας = `push`: το «πίσω» της συσκευής γυρίζει στη λίστα', async () => {
    render(<Page />);
    const entries = window.history.length;

    fireEvent.click(navButton('Βήτα'));
    expect(window.history.length).toBe(entries + 1);
    await waitFor(() => expect(pane()).toBe('section'));

    act(() => window.history.back());
    await waitFor(() => expect(pane()).toBe('list'));
  });

  it('🔴 Σ3 — το «‹ πίσω» της οθόνης ξετυλίγει το ΔΙΚΟ του push (όχι δεύτερη καταχώριση)', async () => {
    render(<Page />);
    fireEvent.click(navButton('Βήτα'));
    const entries = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'πίσω' }));
    await waitFor(() => expect(pane()).toBe('list'));
    expect(window.history.length).toBe(entries);
  });

  it('Σ4 — βαθύς σύνδεσμος (καμία δική μας καταχώριση) ⇒ το «‹ πίσω» σβήνει την παράμετρο, ΔΕΝ φεύγει από τη σελίδα', async () => {
    window.history.replaceState(null, '', '/?section=beta');
    render(<Page />);
    expect(pane()).toBe('section');
    const entries = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'πίσω' }));
    expect(window.location.search).toBe('');
    expect(window.history.length).toBe(entries);
    await waitFor(() => expect(pane()).toBe('list'));
  });
});
