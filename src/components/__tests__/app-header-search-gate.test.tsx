/**
 * ΑΓΚΥΡΑ — **η μπάρα αναζήτησης λέει ό,τι και ο διακομιστής** (ADR-829 §7).
 *
 * Ο πραγματικός `AppHeader` πάνω στον πραγματικό PEP και τον πραγματικό κατάλογο ρόλων, με την ίδια
 * δήλωση πολιτικής που κρίνει το `search-role-matrix.route.test.ts`. Έτσι η μπάρα δεν μπορεί να
 * ξεφύγει από τον διακομιστή χωρίς να κοκκινίσει μία από τις δύο σουίτες.
 */

import { render, screen } from '@testing-library/react';

import { SEARCH_ROLE_POLICY } from '@/app/api/search/__tests__/search-role-policy.fixture';
import { GLOBAL_ROLES } from '@/lib/auth/types';
import { AppHeader } from '../app-header';

interface FakeAuth {
  user: { globalRole: string; permissions: string[] | null } | null;
  loading: boolean;
}

let mockAuthState: FakeAuth = { user: null, loading: false };

jest.mock('@/auth/hooks/useAuth', () => ({ useAuth: () => mockAuthState }));
jest.mock('next/dynamic', () => () => function SearchDialogStub() {
  return <aside data-testid="search-dialog" />;
});
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({ bg: { primary: '' }, text: { muted: '' } }),
}));
jest.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => null }));
jest.mock('@/core/containers/ShellUtilities', () => ({ ShellUtilities: () => null }));
jest.mock('@/components/header/help-button', () => ({ HelpButton: () => null }));
jest.mock('@/components/header/voice-assistant-button', () => ({ VoiceAssistantButton: () => null }));
jest.mock('@/components/header/CompanySwitcher', () => ({ CompanySwitcher: () => null }));
jest.mock('@/components/header/JobSwitch', () => ({ JobSwitch: () => null }));
jest.mock('@/components/header/SaveStatusIndicator', () => ({ SaveStatusIndicator: () => null }));

function headerFor(auth: FakeAuth): void {
  mockAuthState = auth;
  render(<AppHeader />);
}

describe('ADR-829 §7 — η μπάρα ακολουθεί τη δήλωση πολιτικής', () => {
  for (const role of GLOBAL_ROLES) {
    const shown = SEARCH_ROLE_POLICY[role] !== null;

    it(`${role} ⇒ ${shown ? 'φαίνεται' : 'κρύβεται'}`, () => {
      headerFor({ user: { globalRole: role, permissions: null }, loading: false });
      expect(screen.queryAllByRole('button').length > 0).toBe(shown);
      expect(screen.queryByTestId('search-dialog') !== null).toBe(shown);
    });
  }

  it('όσο φορτώνει η ταυτότητα: τίποτα, ούτε για τον διαχειριστή', () => {
    headerFor({ user: { globalRole: 'company_admin', permissions: null }, loading: true });
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByTestId('search-dialog')).toBeNull();
  });

  it('ρητή παραχώρηση στο claim ανοίγει την μπάρα', () => {
    headerFor({ user: { globalRole: 'external_user', permissions: ['search:global:execute'] }, loading: false });
    expect(screen.queryByTestId('search-dialog')).not.toBeNull();
  });
});
