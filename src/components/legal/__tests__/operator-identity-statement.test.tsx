/**
 * @jest-environment jsdom
 *
 * @fileoverview ⚖️ **Η ΤΑΜΠΕΛΑ ΚΑΙ ΟΙ ΝΟΜΙΚΟΙ ΣΥΝΔΕΣΜΟΙ ΣΤΗΝ ΟΘΟΝΗ** (ADR-861 Φ2).
 * @related components/legal/OperatorIdentityStatement.tsx · components/legal/LegalLinksNav.tsx
 *
 * Τα κείμενα λύνονται πάνω στα **ίδια** JSON που φορτώνει η εφαρμογή (el **και** en): ένα κλειδί που
 * λείπει δίνει «⛔ ΑΛΥΤΟ» και η άγκυρα κοκκινίζει.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import elLegal from '@/i18n/locales/el/legal.json';
import enLegal from '@/i18n/locales/en/legal.json';
import elNavigation from '@/i18n/locales/el/navigation.json';
import enNavigation from '@/i18n/locales/en/navigation.json';

const CATALOGUE: Record<string, Record<string, unknown>> = {
  'el:legal': elLegal,
  'en:legal': enLegal,
  'el:navigation': elNavigation,
  'en:navigation': enNavigation,
};
const language = { current: 'el' };

function resolve(ns: string, key: string, params?: Record<string, string>): string {
  let node: unknown = CATALOGUE[`${language.current}:${ns}`];
  for (const step of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[step];
  if (typeof node !== 'string') return `⛔ ΑΛΥΤΟ: ${ns}:${key}`;
  return node.replace(/\{(\w+)\}/g, (_, name: string) => params?.[name] ?? `{${name}}`);
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, params?: Record<string, string>) => resolve(ns, key, params),
    i18n: { language: language.current },
  }),
}));
jest.mock('@/lib/intl-utils', () => ({ getCurrentLocale: () => language.current }));
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import type { OperatorRecord } from '@/constants/platform-operator';
import { LEGAL_ROUTES } from '@/lib/routes/legalRoutes';
import { LegalLinksNav } from '../LegalLinksNav';
import { OperatorIdentityStatement, OperatorMailboxValue } from '../OperatorIdentityStatement';

const NOW = new Date('2026-09-16T10:00:00Z');

function record(overrides: Partial<OperatorRecord> = {}): OperatorRecord {
  return {
    effectiveFrom: '2026-01-01',
    identity: { kind: 'natural-person', fullName: 'Δοκιμαστικό Πρόσωπο', tradeName: null },
    seat: { street: 'Εγνατίας', number: '1', postalCode: '54624', city: 'Θεσσαλονίκη', country: 'GR' },
    vatNumber: '094014201',
    gemiNumber: null,
    contact: { address: 'c@example.gr', receivingConfirmedOn: '2026-01-01' },
    privacy: { address: 'p@example.gr', receivingConfirmedOn: '2026-01-01' },
    ...overrides,
  };
}

afterEach(() => {
  language.current = 'el';
});

describe('Τ — η ταμπέλα του φορέα', () => {
  it('🔑 Τ1 — δηλωμένος: `<address>` με `<dl>`, όλα τα στοιχεία του άρθ. 4, επαφή απορρήτου χωρίς DPO', () => {
    const { container } = render(<OperatorIdentityStatement now={NOW} history={[record()]} />);

    const address = container.querySelector('address');
    expect(address?.querySelector('dl')).not.toBeNull();
    expect(screen.getByText('Δοκιμαστικό Πρόσωπο')).toBeInTheDocument();
    expect(screen.getByText('Εγνατίας 1, 546 24 Θεσσαλονίκη, Ελλάδα')).toBeInTheDocument();
    expect(screen.getByText('094014201')).toBeInTheDocument();
    expect(screen.getByText(resolve('legal', 'operator.noGemi'))).toBeInTheDocument();
    expect(screen.getByText(resolve('legal', 'operator.noDpo'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'p@example.gr' })).toHaveAttribute('href', 'mailto:p@example.gr');
    expect(container.textContent).not.toContain('⛔');
  });

  it('🔴 Τ2 — ανεπιβεβαίωτη διεύθυνση: ΟΥΤΕ σύνδεσμος ΟΥΤΕ κείμενο — «θα αναρτηθεί»', () => {
    const history = [record({ privacy: { address: 'p@example.gr', receivingConfirmedOn: null } })];
    const { container } = render(<OperatorIdentityStatement now={NOW} history={history} />);

    expect(container.textContent).not.toContain('p@example.gr');
    expect(screen.getByText(resolve('legal', 'operator.mailboxPending'))).toBeInTheDocument();
  });

  it('🔴 Τ3 — κανένας φορέας: μόνο «θα αναρτηθούν», κανένα `<address>`', () => {
    const { container } = render(<OperatorIdentityStatement now={NOW} history={[]} />);

    expect(container.querySelector('address')).toBeNull();
    expect(screen.getByText(resolve('legal', 'operator.pending'))).toBeInTheDocument();
  });

  it('Τ4 — η διεύθυνση μέσα σε πρόταση (διαγραφή δεδομένων) ακολουθεί τον ΙΔΙΟ κανόνα', () => {
    const { rerender } = render(<OperatorMailboxValue role="privacy" now={NOW} history={[record()]} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'mailto:p@example.gr');

    rerender(<OperatorMailboxValue role="privacy" now={NOW} history={[]} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('Τ5 — στα αγγλικά: η χώρα από τη γλώσσα, κανένα άλυτο κλειδί', () => {
    language.current = 'en';
    const { container } = render(<OperatorIdentityStatement now={NOW} history={[record()]} />);

    expect(screen.getByText('Εγνατίας 1, 546 24 Θεσσαλονίκη, Greece')).toBeInTheDocument();
    expect(container.textContent).not.toContain('⛔');
  });
});

describe('Σ — οι νομικοί σύνδεσμοι', () => {
  // ⚠️ ΧΩΡΙΣ ΑΡΙΘΜΟ ΣΤΟΝ ΤΙΤΛΟ, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ: έγραφε «τέσσερις σύνδεσμοι» ενώ ο
  //    ισχυρισμός από κάτω είναι `toEqual(Object.values(LEGAL_ROUTES))` — δηλαδή
  //    **όσοι κι αν είναι**. Ο αριθμός πάλιωσε με την πρώτη προσθήκη (ADR-863 Φ3, ο
  //    πέμπτος) χωρίς να κοκκινίσει τίποτα: τίτλος που λέει άλλα από τον ισχυρισμό είναι
  //    τεκμηρίωση που λέει ψέματα — το σχήμα που αυτό το repo μετρά σε τέσσερα σημεία.
  it.each(['el', 'en'])('🔑 Σ1 (%s) — ΟΛΟΙ οι σύνδεσμοι, με τις διαδρομές της ΜΙΑΣ πηγής', (lang) => {
    language.current = lang;
    const { container } = render(<LegalLinksNav variant="standalone" />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(Object.values(LEGAL_ROUTES));
    expect(screen.getByRole('navigation')).toHaveAccessibleName(resolve('navigation', 'legal.legalLinks'));
    expect(container.textContent).not.toContain('⛔');
  });

  it('Σ2 — η τρέχουσα σελίδα σημειώνεται με `aria-current`, δεν κρύβεται', () => {
    render(<LegalLinksNav variant="prose" current="legalNotice" />);

    const current = screen.getByRole('link', { name: resolve('navigation', 'legal.legalNotice') });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1);
  });
});
