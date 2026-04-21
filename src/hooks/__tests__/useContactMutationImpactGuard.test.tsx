import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useContactMutationImpactGuard } from '../useContactMutationImpactGuard';
import { initialFormData, type ContactFormData } from '@/types/ContactFormTypes';
import type { CompanyContact, Contact, IndividualContact, ServiceContact } from '@/types/contacts';
import type { ContactIdentityImpactPreview } from '@/types/contact-identity-impact';
import { apiClient } from '@/lib/api/enterprise-api-client';

jest.mock('@/lib/api/enterprise-api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
  ApiClientError: {
    isApiClientError: (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error),
  },
}));

jest.mock('@/components/contacts/dialogs/ContactIdentityImpactDialog', () => ({
  ContactIdentityImpactDialog: ({
    open,
    preview,
    onConfirm,
  }: {
    open: boolean;
    preview: ContactIdentityImpactPreview | null;
    onConfirm: () => void;
  }) => open ? (
    <div data-testid="identity-impact-dialog" data-mode={preview?.mode ?? 'none'}>
      <span>{preview?.messageKey ?? 'no-message'}</span>
      <button type="button" onClick={() => { void onConfirm(); }}>confirm-identity</button>
    </div>
  ) : null,
}));

const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;
const NOW = new Date('2026-04-02T00:00:00.000Z');

function makeBaseFields() {
  return {
    isFavorite: false,
    status: 'active' as const,
    createdAt: NOW,
    updatedAt: NOW,
    customFields: {},
  };
}

function makeIndividualContact(overrides: Partial<IndividualContact> = {}): IndividualContact {
  return {
    ...makeBaseFields(),
    id: 'ind_001',
    type: 'individual',
    firstName: 'Maria',
    lastName: 'Papadopoulou',
    fatherName: 'Giorgos',
    motherName: 'Eleni',
    birthDate: '1990-05-10',
    birthCountry: 'GR',
    gender: 'female',
    amka: '12345678901',
    documentType: 'identity_card',
    documentIssuer: 'Athens Police',
    documentNumber: 'AB123456',
    documentIssueDate: '2015-01-01',
    documentExpiryDate: '2030-01-01',
    vatNumber: '012345678',
    taxOffice: 'Athens',
    ...overrides,
  };
}

function makeCompanyContact(overrides: Partial<CompanyContact> = {}): CompanyContact {
  return {
    ...makeBaseFields(),
    id: 'cmp_001',
    type: 'company',
    companyName: 'Acme SA',
    vatNumber: '099999999',
    registrationNumber: '123456789000',
    taxOffice: 'Athens FAE',
    legalForm: 'ΑΕ',
    tradeName: 'Acme',
    customFields: { gemiStatus: 'active' },
    ...overrides,
  };
}

function makeServiceContact(overrides: Partial<ServiceContact> = {}): ServiceContact {
  return {
    ...makeBaseFields(),
    id: 'srv_001',
    type: 'service',
    serviceName: 'KEP Athens',
    serviceType: 'municipality',
    serviceCode: 'KEP-01',
    responsibleMinistry: 'Interior',
    customFields: { legalStatus: 'Public Law', category: 'Citizen Service', shortName: 'KEP', serviceCode: 'KEP-01' },
    ...overrides,
  };
}

function makeFormData(overrides: Partial<ContactFormData> = {}): ContactFormData {
  return {
    ...initialFormData,
    ...overrides,
  };
}

interface MutationResult {
  completed: boolean;
  blockedUnsafeClear: boolean;
}

interface HarnessProps {
  contact: Contact;
  formData: ContactFormData;
  action: jest.MockedFunction<() => Promise<void>>;
  onResult: (result: MutationResult) => void;
}

function Harness({ contact, formData, action, onResult }: HarnessProps) {
  const { previewBeforeMutate, ImpactDialogs } = useContactMutationImpactGuard(contact);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void previewBeforeMutate(formData, action).then(onResult);
        }}
      >
        run-preview
      </button>
      {ImpactDialogs}
    </div>
  );
}

describe('useContactMutationImpactGuard', () => {
  beforeEach(() => {
    mockedApiClient.get.mockReset();
    mockedApiClient.post.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('executes immediately when individual data has no guarded changes', async () => {
    const action = jest.fn<Promise<void>, []>(async () => undefined);
    const onResult = jest.fn();
    const contact = makeIndividualContact();
    const formData = makeFormData({
      type: 'individual',
      firstName: 'Maria',
      lastName: 'Papadopoulou',
      fatherName: 'Giorgos',
      motherName: 'Eleni',
      birthDate: '1990-05-10',
      birthCountry: 'GR',
      gender: 'female',
      amka: '12345678901',
      vatNumber: '012345678',
      taxOffice: 'Athens',
      documentType: 'identity_card',
      documentIssuer: 'Athens Police',
      documentNumber: 'AB123456',
      documentIssueDate: '2015-01-01',
      documentExpiryDate: '2030-01-01',
    });

    render(<Harness contact={contact} formData={formData} action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText('run-preview'));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({ completed: true, blockedUnsafeClear: false });
    });
    expect(mockedApiClient.post).not.toHaveBeenCalled();
  });

  it('opens warn dialog and executes only after confirmation for individual changes', async () => {
    const action = jest.fn<Promise<void>, []>(async () => undefined);
    const onResult = jest.fn();
    const contact = makeIndividualContact();
    const formData = makeFormData({
      type: 'individual',
      firstName: 'Marina',
      lastName: 'Papadopoulou',
      fatherName: 'Giorgos',
      motherName: 'Eleni',
      birthDate: '1990-05-10',
      birthCountry: 'GR',
      gender: 'female',
      amka: '12345678901',
      documentType: 'identity_card',
      documentIssuer: 'Athens Police',
      documentNumber: 'AB123456',
      documentIssueDate: '2015-01-01',
      documentExpiryDate: '2030-01-01',
    });
    const preview: ContactIdentityImpactPreview = {
      mode: 'warn',
      changes: [
        { field: 'firstName', category: 'display', oldValue: 'Maria', newValue: 'Marina', isCleared: false },
      ],
      dependencies: [],
      affectedDomains: ['linkedProjects'],
      messageKey: 'identityImpact.messages.warning',
      blockingCount: 0,
      warningCount: 1,
    };
    mockedApiClient.post.mockResolvedValue(preview);

    render(<Harness contact={contact} formData={formData} action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText('run-preview'));

    expect(await screen.findByTestId('identity-impact-dialog')).toHaveAttribute('data-mode', 'warn');
    expect(action).not.toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith({ completed: false, blockedUnsafeClear: false });

    fireEvent.click(screen.getByText('confirm-identity'));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
    });
  });

  it('delegates company mutations directly to action without opening a dialog (runGuardChain owns the dialog)', async () => {
    const action = jest.fn<Promise<void>, []>(async () => undefined);
    const onResult = jest.fn();
    const contact = makeCompanyContact();
    const formData = makeFormData({
      type: 'company',
      companyName: 'Acme Holdings SA',
      companyVatNumber: '099999999',
      vatNumber: '099999999',
      gemiNumber: '123456789000',
      taxOffice: '1104',
      legalForm: 'ΑΕ',
      tradeName: 'Acme',
      gemiStatus: 'active',
    });

    render(<Harness contact={contact} formData={formData} action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText('run-preview'));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({ completed: true, blockedUnsafeClear: false });
    });
    expect(mockedApiClient.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId('company-impact-dialog')).not.toBeInTheDocument();
  });

  it('executes service updates immediately when preview returns allow', async () => {
    const action = jest.fn<Promise<void>, []>(async () => undefined);
    const onResult = jest.fn();
    const contact = makeServiceContact();
    const formData = makeFormData({
      type: 'service',
      serviceName: 'KEP Athens Central',
      shortName: 'KEP ATH',
      serviceType: 'municipality',
      serviceCode: 'KEP-02',
      category: 'Citizen Service',
      supervisionMinistry: 'Interior',
      legalStatus: 'Public Law',
    });
    const preview: ContactIdentityImpactPreview = {
      mode: 'allow',
      changes: [],
      dependencies: [],
      affectedDomains: ['searchAndReporting'],
      messageKey: 'identityImpact.messages.allowed',
      blockingCount: 0,
      warningCount: 0,
    };
    mockedApiClient.post.mockResolvedValue(preview);

    render(<Harness contact={contact} formData={formData} action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText('run-preview'));

    await waitFor(() => {
      expect(action).toHaveBeenCalledTimes(1);
      expect(onResult).toHaveBeenCalledWith({ completed: true, blockedUnsafeClear: false });
    });
  });
});
