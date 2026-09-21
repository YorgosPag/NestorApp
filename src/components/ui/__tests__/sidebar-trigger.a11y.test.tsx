/**
 * @file ADR-598 G11 · ADR-871 §10.3 Υ2 — το κουμπί ☰ της στήλης.
 *
 * Τι κλειδώνει:
 * - Α1: κανένα εύρημα axe — το κουμπί είναι μόνο εικονίδιο, άρα το όνομα ΠΡΕΠΕΙ να έρθει
 *   από το `sr-only` κείμενο (αλλιώς `button-name`).
 * - Α2: το όνομα είναι το i18n κλειδί `buttons.toggleSidebar` — όχι ωμό κείμενο (N.11).
 * - Σ1: το πάτημα εναλλάσσει τη στήλη ΚΑΙ καλεί το `onClick` του καταναλωτή (δεν το καταπίνει).
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

jest.mock('@/hooks/useMobile', () => ({ useIsMobile: () => false }));
// Ο hook του ΕΡΓΟΥ (αυτόν εισάγει το component) — όχι το `react-i18next`: αλλιώς τρέχει ο
// πραγματικός loader namespaces μέσα στο test και ενημερώνει state εκτός `act(...)`.
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () =>
    jest
      .requireActual<typeof import('@/test-utils/i18n-mock')>('@/test-utils/i18n-mock')
      .keyEchoTranslation(),
}));

import { expectNoA11yViolations } from '@/test-utils/a11y';
import { SidebarProvider, useOptionalSidebar } from '../sidebar-context';
import { SidebarTrigger } from '../sidebar-trigger';

const TRIGGER_NAME = 'buttons.toggleSidebar';

function StateProbe(): React.JSX.Element {
  const sidebar = useOptionalSidebar();
  return <output data-testid="state">{sidebar?.state}</output>;
}

describe('SidebarTrigger — προσβασιμότητα', () => {
  it('Α1: κανένα εύρημα axe', async () => {
    await expectNoA11yViolations(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
  });

  it('Α2: το προσβάσιμο όνομα έρχεται από το i18n κλειδί', () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>,
    );
    expect(screen.getByRole('button', { name: TRIGGER_NAME })).toBeInTheDocument();
  });
});

describe('SidebarTrigger — συμπεριφορά', () => {
  afterEach(() => {
    document.cookie = 'sidebar_state=; path=/; max-age=0';
  });

  it('Σ1: εναλλάσσει τη στήλη και καλεί το onClick του καταναλωτή', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(
      <SidebarProvider>
        <SidebarTrigger onClick={onClick} />
        <StateProbe />
      </SidebarProvider>,
    );

    expect(screen.getByTestId('state').textContent).toBe('expanded');
    await user.click(screen.getByRole('button', { name: TRIGGER_NAME }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('state').textContent).toBe('collapsed');
  });
});
