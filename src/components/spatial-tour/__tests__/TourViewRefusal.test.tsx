/**
 * @jest-environment jsdom
 */
/**
 * ADR-884 §9.1 Α5 — η άρνηση θέασης έχει **γιατί + τι να κάνω**.
 *
 * Μεταλλάξεις (2026-09-26): (α) `renderRefusal` αγνοείται στο `TourViewSurface` ⇒ κοκκινίζει το Α5.1·
 * (β) χωρίς `whenHidden` ⇒ κοκκινίζει το Α5.3· (γ) χωρίς «αλλαγή λογαριασμού» ⇒ κοκκινίζει το Α5.4.
 */

import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, isNamespaceReady: true }),
}));

let cardHidden = false;
jest.mock('../TourAccessCard', () => ({
  __esModule: true,
  default: ({ whenHidden }: { whenHidden?: ReactNode }) =>
    (cardHidden ? <>{whenHidden}</> : <form data-testid="request-card" />),
}));

let signedInEmail: string | null = null;
jest.mock('@/auth', () => ({
  useAuthOptional: () => ({ user: signedInEmail === null ? null : { email: signedInEmail } }),
}));
jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
jest.mock('@/components/workspace-invite/SwitchAccount', () => ({
  SwitchAccountButton: ({ href }: { href: string }) => <a data-testid="switch-account" href={href}>switch</a>,
}));
jest.mock('@/services/spatial-tour/spatial-tour-viewing.client', () => ({
  openTourViewSessionFromScreen: async () => ({ kind: 'refused', reason: 'not-viewable' }),
}));

import { TourViewRefusal } from '../TourViewRefusal';
import { TourViewSurface } from '../TourViewSurface';

const props = { reason: 'not-viewable', listingId: 'lst_1', returnPath: '/listing/lst_1/tour' } as const;

describe('TourViewRefusal — άρνηση με δρόμο', () => {
  beforeEach(() => { cardHidden = false; signedInEmail = null; });

  it('Α5.1 — η επιφάνεια θέασης παραδίδει την άρνηση στη σελίδα (renderRefusal), όχι γενικό μήνυμα', async () => {
    render(<TourViewSurface subject={{ kind: 'property', id: 'prop_1' }} shareId={null}
      renderRefusal={(reason) => <p data-testid="page-refusal">{reason}</p>} />);
    await waitFor(() => expect(screen.getByTestId('page-refusal').textContent).toBe('not-viewable'));
  });

  it('Α5.2 — η κάρτα αιτήματος είναι η απάντηση (ζητήστε ξανά / συνδεθείτε / εκκρεμεί)', () => {
    render(<TourViewRefusal {...props} />);
    expect(screen.getByTestId('request-card')).toBeTruthy();
  });

  it('Α5.3 — κάρτα αόρατη ⇒ το ονομασμένο μήνυμα της άρνησης, ποτέ κενό', () => {
    cardHidden = true;
    render(<TourViewRefusal {...props} />);
    expect(screen.getByRole('alert').textContent).toBe('spatial-tour:refusal.notViewable');
  });

  it('Α5.4 — συνδεδεμένος ⇒ «συνδεδεμένοι ως» + αλλαγή λογαριασμού με επιστροφή εδώ· ανώνυμος ⇒ τίποτα', () => {
    const { unmount } = render(<TourViewRefusal {...props} />);
    expect(screen.queryByTestId('switch-account')).toBeNull();
    unmount();
    signedInEmail = 'maria@example.com';
    render(<TourViewRefusal {...props} />);
    expect(screen.getByText('spatial-tour:viewer.signedInAs')).toBeTruthy();
    expect(screen.getByTestId('switch-account').getAttribute('href')).toContain(encodeURIComponent('/listing/lst_1/tour'));
  });
});
