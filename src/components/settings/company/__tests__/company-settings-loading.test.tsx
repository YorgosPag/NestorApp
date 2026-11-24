/**
 * @jest-environment jsdom
 */

/**
 * ⚓ Η σελίδα «Ρυθμίσεις Εταιρείας» (ADR-ACC-018 §17.4 · ADR-929 §1 εύρημα).
 *
 * Καρφώνει:
 * - τίτλος = η σελίδα, όχι η καρτέλα «Δομή Οργανισμού»·
 * - η καρτέλα ζει στο `?tab=` (άγνωστη τιμή ⇒ «Στοιχεία»)·
 * - το οργανόγραμμα φορτώνεται **μόνο** για τις καρτέλες που το χρειάζονται, **μία** φορά·
 * - με `useAuth().user === null` η φόρτωση **κλείνει** (το `@/hooks/useAuth` μοκάρεται έτσι επίτηδες: αν ξαναμπεί
 *   ο έλεγχος `if (!user) return;`, κοκκινίζουν)·
 * - αποτυχία ανάγνωσης ⇒ ο επεξεργαστής **δεν** δείχνεται (αλλιώς «Αποθήκευση» θα έγραφε κενή δομή).
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const get = jest.fn();

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), put: jest.fn(), patch: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, loading: false }) }));
jest.mock('@/i18n/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../CompanyInfoTab', () => ({ CompanyInfoTab: () => <p>info-tab</p> }));
jest.mock('../TaxSettingsTab', () => ({ TaxSettingsTab: () => null }));
jest.mock('../OrgStructureTab', () => ({ OrgStructureTab: () => <p>org-editor</p> }));
jest.mock('../RoutingEventsTab', () => ({ RoutingEventsTab: () => <p>routing-editor</p> }));
jest.mock('../AiProcessingTab', () => ({ AiProcessingTab: () => null }));

import { CompanySettingsPageContent } from '../CompanySettingsPageContent';
import { BOQCategoriesTab } from '../BOQCategoriesTab';

function startAt(url: string): void {
  window.history.replaceState(null, '', url);
}

beforeEach(() => {
  jest.clearAllMocks();
  startAt('/settings/company');
});

describe('CompanySettingsPageContent — τίτλος και καρτέλα στη διεύθυνση', () => {
  it('ανοίγει στα «Στοιχεία» με τίτλο τη σελίδα — και ΔΕΝ διαβάζει το οργανόγραμμα', async () => {
    render(<CompanySettingsPageContent />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('companySettings.title');
    expect(screen.getByText('info-tab')).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(get).not.toHaveBeenCalled();
  });

  it('άγνωστη καρτέλα στη διεύθυνση ⇒ «Στοιχεία», και η διεύθυνση διορθώνεται', async () => {
    startAt('/settings/company?tab=xyz');
    render(<CompanySettingsPageContent />);
    expect(screen.getByText('info-tab')).toBeTruthy();
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('`?tab=org` ⇒ ΜΙΑ ανάγνωση, και η φόρτωση κλείνει ακόμη κι αν το useAuth λέει user=null', async () => {
    startAt('/settings/company?tab=org');
    get.mockResolvedValue({ orgStructure: null });
    render(<CompanySettingsPageContent />);
    await waitFor(() => expect(screen.getByText('org-editor')).toBeTruthy());
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('Δομή → Routing ⇒ ΚΑΜΙΑ δεύτερη ανάγνωση', async () => {
    startAt('/settings/company?tab=org');
    get.mockResolvedValue({ orgStructure: null });
    render(<CompanySettingsPageContent />);
    await waitFor(() => expect(screen.getByText('org-editor')).toBeTruthy());
    const routing = screen.getByRole('tab', { name: 'orgStructure.tabs.routing' });
    fireEvent.mouseDown(routing);
    fireEvent.click(routing);
    await waitFor(() => expect(screen.getByText('routing-editor')).toBeTruthy());
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('routing');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('🔴 αποσυνδεδεμένος (401) ⇒ η φόρτωση ΚΛΕΙΝΕΙ, το σφάλμα φαίνεται, ο επεξεργαστής ΔΕΝ δείχνεται', async () => {
    startAt('/settings/company?tab=org');
    get.mockRejectedValue(new Error('User not authenticated'));
    render(<CompanySettingsPageContent />);
    await waitFor(() => expect(screen.getByText('User not authenticated')).toBeTruthy());
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('org-editor')).toBeNull();
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
