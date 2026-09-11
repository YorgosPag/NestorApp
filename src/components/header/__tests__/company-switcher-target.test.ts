/**
 * @fileoverview **ΑΓΚΥΡΕΣ: μέσα σε χώρο, ο επιλογέας ΠΛΟΗΓΕΙ** (ADR-849 Β1 — Linear · Vercel · Slack).
 * @related components/header/CompanySwitcher
 */

jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/contexts/SuperAdminCompanyContext', () => ({ useSuperAdminCompany: jest.fn() }));
jest.mock('@/lib/workspace/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useWorkspaceAlias: jest.fn(),
}));

import { switchTarget } from '../CompanySwitcher';

describe('switchTarget', () => {
  it('Ε1 🔴 μέσα σε χώρο ⇒ νέα ΔΙΕΥΘΥΝΣΗ, όχι κρυφή κατάσταση', () => {
    expect(switchTarget('comp_a', '/properties', 'comp_b')).toEqual({
      kind: 'navigate',
      href: '/o/comp_b/properties',
    });
  });

  it('Ε2: η ταυτότητα της οντότητας ΠΕΦΤΕΙ — ανήκει στην παλιά εταιρεία', () => {
    expect(switchTarget('comp_a', '/properties/prop_x', 'comp_b')).toEqual({
      kind: 'navigate',
      href: '/o/comp_b/properties',
    });
  });

  it('Ε3: από τον ιδιωτικό χώρο ή την αρχική ⇒ η αρχική της εταιρείας', () => {
    expect(switchTarget('me', '/', 'comp_b')).toEqual({ kind: 'navigate', href: '/o/comp_b' });
  });

  it('Ε4: εκτός χώρου (σελίδες διαχείρισης) ⇒ επιλογή, όπως πάντα', () => {
    expect(switchTarget(null, '/admin/users', 'comp_b')).toEqual({ kind: 'select' });
  });
});
