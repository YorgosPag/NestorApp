/**
 * @jest-environment jsdom
 */

/**
 * ⚓ ADR-929 §1 εύρημα (2026-11-05) — **η σελίδα Ρυθμίσεων εταιρείας δεν κολλά στη φόρτωση**.
 *
 * Παλιά: αρχική κατάσταση `loading: true` + `if (!user) return;` στη φόρτωση ⇒ με
 * `useAuth().user === null` η φόρτωση δεν έκλεινε ΠΟΤΕ («Τμήματα και υπεύθυνοι…» για πάντα).
 * Η αναμονή ταυτότητας ανήκει στον `apiClient`. Το `@/hooks/useAuth` μοκάρεται εδώ με
 * `user: null` **επίτηδες**: αν ο έλεγχος ξαναμπεί, αυτά τα tests κοκκινίζουν.
 */

import { render, screen, waitFor } from '@testing-library/react';

const get = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), put: jest.fn(), patch: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../CompanyInfoTab', () => ({ CompanyInfoTab: () => null }));
jest.mock('../TaxSettingsTab', () => ({ TaxSettingsTab: () => null }));
jest.mock('../OrgStructureTab', () => ({ OrgStructureTab: () => null }));
jest.mock('../RoutingEventsTab', () => ({ RoutingEventsTab: () => null }));
jest.mock('../AiProcessingTab', () => ({ AiProcessingTab: () => null }));

import { CompanySettingsPageContent } from '../CompanySettingsPageContent';
import { BOQCategoriesTab } from '../BOQCategoriesTab';

beforeEach(() => jest.clearAllMocks());

describe('CompanySettingsPageContent — φόρτωση χωρίς εξάρτηση από το useAuth', () => {
  it('φορτώνει το οργανόγραμμα ακόμη κι αν το useAuth λέει user=null', async () => {
    get.mockResolvedValue({ orgStructure: null });
    render(<CompanySettingsPageContent />);
    await waitFor(() => expect(screen.getByText('orgStructure.title')).toBeTruthy());
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('🔴 αποσυνδεδεμένος (401) ⇒ η φόρτωση ΚΛΕΙΝΕΙ και το σφάλμα φαίνεται', async () => {
    get.mockRejectedValue(new Error('User not authenticated'));
    render(<CompanySettingsPageContent />);
    await waitFor(() => expect(screen.getByText('User not authenticated')).toBeTruthy());
    expect(screen.queryByText('orgStructure.subtitle…')).toBeNull();
  });
});

describe('BOQCategoriesTab — ίδια παγίδα, ίδια θεραπεία', () => {
  it('🔴 αποτυχία ⇒ ο δείκτης φόρτωσης φεύγει και φαίνεται το σφάλμα', async () => {
    get.mockRejectedValue(new Error('User not authenticated'));
    render(<BOQCategoriesTab />);
    await waitFor(() => expect(screen.getByText('User not authenticated')).toBeTruthy());
    expect(get).toHaveBeenCalledTimes(1);
  });
});
