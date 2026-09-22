/**
 * **Ο διακόπτης του `RouteErrorFallback`** — ΕΝΑ σημείο για 60+ `error.tsx` + `global-error.tsx`.
 *
 * 🔴 Γιατί υπάρχει (2026-09-22): ο ανώνυμος επισκέπτης της δημόσιας βιτρίνας `/pro` έβλεπε
 * σε σύντομη βλάβη βάσης το εσωτερικό εργαλείο σφαλμάτων («Ειδοποίηση Admin», email
 * παρόχων). Δηλωμένη αδυναμία backend ⇒ δημόσια οθόνη με αυτόματη επανάληψη· **κάθε άλλο**
 * σφάλμα ⇒ το εργαλείο της εφαρμογής, αμετάβλητο.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';

import { BackendUnavailableError } from '@/lib/errors/backend-unavailable';

import { RouteErrorFallback } from '../RouteErrorFallback';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
  }),
}));

// Ο κλάδος της εφαρμογής ΔΕΝ ελέγχεται εδώ — μόνο ότι είναι ΑΥΤΟΣ που επιλέγεται.
jest.mock('../ErrorFallbackUI', () => ({ ErrorFallbackUI: () => <p>application-error-tool</p> }));
jest.mock('../useErrorActions', () => ({ useErrorActions: () => ({}) }));
jest.mock('../useErrorReporting', () => ({ useErrorReporting: () => ({ reportError: jest.fn() }) }));
jest.mock('@/components/ui/ProductTour', () => ({ useTourSafe: () => ({ startTour: jest.fn(), shouldShowTour: () => false }) }));
jest.mock('@/hooks/useTypography', () => ({ useTypography: () => ({}) }));
jest.mock('@/hooks/useSpacingTokens', () => ({ useSpacingTokens: () => ({}) }));
jest.mock('@/services/enterprise-id.service', () => ({ generateErrorId: () => 'err_test' }));

const reset = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  window.sessionStorage.clear();
});
afterEach(() => jest.useRealTimers());

describe('RouteErrorFallback — διακόπτης αδυναμίας backend', () => {
  it('δηλωμένη αδυναμία backend ⇒ δημόσια οθόνη με αντίστροφη μέτρηση, ΧΩΡΙΣ εργαλείο σφαλμάτων', () => {
    render(<RouteErrorFallback error={new BackendUnavailableError('agency-alias-lookup')} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('backendUnavailable.title');
    expect(screen.getByRole('button', { name: 'backendUnavailable.retryNow' })).toBeEnabled();
    expect(screen.getByText(/backendUnavailable\.retryIn/)).toBeInTheDocument();
    expect(screen.queryByText('application-error-tool')).not.toBeInTheDocument();
  });

  it('η αντίστροφη μέτρηση κατεβαίνει ανά δευτερόλεπτο', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1); // 1η προσπάθεια ⇒ 5″
    render(<RouteErrorFallback error={new BackendUnavailableError('workspace-lookup')} reset={reset} />);
    expect(screen.getByText('backendUnavailable.retryIn:{"seconds":5}')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByText('backendUnavailable.retryIn:{"seconds":4}')).toBeInTheDocument();
    jest.restoreAllMocks();
  });

  it('εξαντλημένο πρόγραμμα ⇒ ανακοίνωση «συνεχίζεται», χωρίς μέτρηση, με χειροκίνητη δοκιμή', () => {
    window.sessionStorage.setItem(`nestor:backend-retry:${window.location.pathname}`, JSON.stringify({ attempt: 5, at: Date.now() }));
    render(<RouteErrorFallback error={new BackendUnavailableError('agency-profile')} reset={reset} />);
    expect(screen.getByRole('status')).toHaveTextContent('backendUnavailable.gaveUp');
    expect(screen.queryByText(/backendUnavailable\.retryIn/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'backendUnavailable.retryNow' })).toBeEnabled();
  });

  it('crash (οποιοδήποτε άλλο digest) ⇒ το εργαλείο σφαλμάτων της εφαρμογής, ΟΧΙ η δημόσια οθόνη', () => {
    const crash = Object.assign(new Error('boom'), { digest: '2849012345' });
    render(<RouteErrorFallback error={crash} reset={reset} />);
    expect(screen.getByText('application-error-tool')).toBeInTheDocument();
    expect(screen.queryByText('backendUnavailable.title')).not.toBeInTheDocument();
  });
});
