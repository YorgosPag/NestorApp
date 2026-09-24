/**
 * @fileoverview Άγκυρες της λωρίδας «Οι χώροι μου» και της ζώνης «Για επαγγελματίες»
 * στην αρχική (ADR-820 §5.4).
 *
 * 🔑 Τρεις ταυτότητες, τρεις οθόνες — και η φόρτωση ως τέταρτη:
 * - **επισκέπτης** → καμία λωρίδα· η ζώνη επαγγελματιών **ναι**
 * - **συνδεδεμένος χωρίς γραφείο** → προσωπικός · «Άνοιξε γραφείο» · μηνύματα
 * - **συνδεδεμένος με γραφείο** → προσωπικός · γραφείο (`/home`) · μηνύματα
 * - **φόρτωση** → τίποτα από τα δύο (όχι ψευδής «χωρίς γραφείο»)
 *
 * ⚠️ Οι άγκυρες διαβάζουν το **`href` που αποδόθηκε**, όχι το αν εισάγεται ένα σύμβολο
 * (ADR-820 §6 #7: μετάλλαξη προορισμού επιβίωσε όταν η άγκυρα κοίταζε το import).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import { LandingMySpaces } from '@/components/search/LandingMySpaces';
import { LandingProBand } from '@/components/search/LandingProBand';
import { PRIVATE_SPACE_HOME } from '@/lib/routes/landing';
import { MY_MESSAGES_ROUTE } from '@/lib/network-messaging/network-messaging-routes';
import { CREATE_WORKSPACE_ROUTE, HOME_REDIRECT_ROUTE } from '@/lib/workspace/workspace-routes';

interface AuthState {
  readonly user: { readonly uid: string; readonly companyId?: string | null } | null;
  readonly loading: boolean;
}

let auth: AuthState | null;

jest.mock('@/auth', () => ({ useAuthOptional: () => auth }));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'el' } }),
}));

/** Το σήμα έχει δική του σουίτα (`menu-count-badge.test.tsx`)· εδώ μετράμε ότι **μπαίνει**. */
jest.mock('@/components/sidebar/menu-count-badge', () => ({
  MenuCountBadge: ({ source }: { source: string }) => <span data-testid={`badge-${source}`} />,
}));

const PERSONAL = 'common-account:userMenu.spaces.personal';
const ORGANIZATION = 'common-account:userMenu.spaces.organization';
const CREATE = 'navigation:personal.items.createWorkspace';
const MESSAGES = 'navigation:personal.items.myMessages';
const PRO_CTA = 'property-market:proBand.cta';

const hrefOf = (label: string): string | null =>
  screen.getByText(label).closest('a')?.getAttribute('href') ?? null;

describe('LandingMySpaces — η λωρίδα «Οι χώροι μου»', () => {
  it('Λ1 επισκέπτης: δεν αποδίδεται τίποτα — η `/` μένει βιτρίνα', () => {
    auth = { user: null, loading: false };
    const { container } = render(<LandingMySpaces />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Λ1β χωρίς πάροχο ταυτότητας: τίποτα, όχι σφάλμα', () => {
    auth = null;
    const { container } = render(<LandingMySpaces />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Λ2 φόρτωση ταυτότητας: τίποτα — όχι ψευδής «χωρίς γραφείο»', () => {
    auth = { user: { uid: 'usr_1', companyId: 'comp_1' }, loading: true };
    const { container } = render(<LandingMySpaces />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Λ3 χωρίς γραφείο: προσωπικός + «Άνοιξε γραφείο» (/workspace/new) + μηνύματα', () => {
    auth = { user: { uid: 'usr_1', companyId: null }, loading: false };
    render(<LandingMySpaces />);
    expect(hrefOf(PERSONAL)).toBe(PRIVATE_SPACE_HOME);
    expect(hrefOf(CREATE)).toBe(CREATE_WORKSPACE_ROUTE);
    expect(hrefOf(MESSAGES)).toBe(MY_MESSAGES_ROUTE);
    expect(screen.queryByText(ORGANIZATION)).toBeNull();
  });

  it('Λ4 κενή συμβολοσειρά companyId = ΧΩΡΙΣ γραφείο (κριτής `hasOrganization`)', () => {
    auth = { user: { uid: 'usr_1', companyId: '' }, loading: false };
    render(<LandingMySpaces />);
    expect(screen.queryByText(ORGANIZATION)).toBeNull();
    expect(hrefOf(CREATE)).toBe(CREATE_WORKSPACE_ROUTE);
  });

  it('Λ5 με γραφείο: ο εταιρικός δείχνει στο `/home` — ποτέ κατασκευασμένο `/o/…` (Λ2 ADR-787)', () => {
    auth = { user: { uid: 'usr_1', companyId: 'comp_1' }, loading: false };
    render(<LandingMySpaces />);
    expect(hrefOf(PERSONAL)).toBe(PRIVATE_SPACE_HOME);
    expect(hrefOf(ORGANIZATION)).toBe(HOME_REDIRECT_ROUTE);
    expect(screen.queryByText(CREATE)).toBeNull();
  });

  it('Λ6 ο προσωπικός είναι ΠΡΩΤΟΣ, και το σήμα αδιάβαστων μπαίνει στα μηνύματα', () => {
    auth = { user: { uid: 'usr_1', companyId: 'comp_1' }, loading: false };
    render(<LandingMySpaces />);
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(links).toEqual([PRIVATE_SPACE_HOME, HOME_REDIRECT_ROUTE, MY_MESSAGES_ROUTE]);
    const messages = screen.getByText(MESSAGES).closest('a');
    expect(messages?.querySelector('[data-testid="badge-network-unread"]')).not.toBeNull();
  });

  it('Λ7 σημασιολογία: `nav` με ονομασμένη επικεφαλίδα', () => {
    auth = { user: { uid: 'usr_1', companyId: null }, loading: false };
    render(<LandingMySpaces />);
    expect(screen.getByRole('navigation', { name: 'common-account:userMenu.spaces.label' })).toBeTruthy();
  });
});

describe('LandingProBand — η ζώνη «Για επαγγελματίες»', () => {
  it('Ζ1 επισκέπτης: η ζώνη οδηγεί στο `/workspace/new`', () => {
    auth = { user: null, loading: false };
    render(<LandingProBand />);
    expect(hrefOf(PRO_CTA)).toBe(CREATE_WORKSPACE_ROUTE);
    expect(screen.getByRole('region', { name: 'property-market:proBand.title' })).toBeTruthy();
  });

  it('Ζ2 συνδεδεμένος: καμία ζώνη — η πρόσκληση ζει ήδη στη λωρίδα', () => {
    auth = { user: { uid: 'usr_1', companyId: null }, loading: false };
    const { container } = render(<LandingProBand />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Ζ4 χωρίς πάροχο ταυτότητας: επισκέπτης — η ζώνη αποδίδεται', () => {
    auth = null;
    render(<LandingProBand />);
    expect(hrefOf(PRO_CTA)).toBe(CREATE_WORKSPACE_ROUTE);
  });

  it('Ζ3 φόρτωση ταυτότητας: τίποτα — όχι αναλαμπή σε ήδη συνδεδεμένο', () => {
    auth = { user: null, loading: true };
    const { container } = render(<LandingProBand />);
    expect(container).toBeEmptyDOMElement();
  });
});
