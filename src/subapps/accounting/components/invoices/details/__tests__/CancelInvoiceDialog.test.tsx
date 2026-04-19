/**
 * @fileoverview Tests for CancelInvoiceDialog component
 * @see RESEARCH-A1-INVOICE-CANCELLATION-UI.md
 * @see AUDIT-2026-03-29 Task A-1
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CancelInvoiceDialog } from '../CancelInvoiceDialog';
import type { Invoice } from '@/subapps/accounting/types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    text: { muted: 'text-muted', primary: 'text-primary' },
    bg: { primary: 'bg-primary', muted: 'bg-muted' },
    border: { primary: 'border-primary' },
  }),
}));

const mockGetIdToken = jest.fn().mockResolvedValue('mock-token');
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { getIdToken: mockGetIdToken },
  }),
}));

jest.mock('@/config/domain-constants', () => ({
  API_ROUTES: {
    ACCOUNTING: {
      INVOICES: {
        BY_ID: (id: string) => `/api/accounting/invoices/${id}`,
      },
    },
  },
}));

jest.mock('../../../../utils/format', () => ({
  formatAccountingCurrency: (v: number) => `€${v.toFixed(2)}`,
}));

// Mock Dialog to render inline (portals don't work in jsdom)
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock Select to render as native select
jest.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
    disabled,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (val: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="select-wrapper">
      <select
        data-testid="reason-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">--</option>
        {children}
      </select>
    </div>
  ),
  SelectTrigger: React.forwardRef<HTMLButtonElement, { children: React.ReactNode; id?: string }>(
    (props, _ref) => null
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
}));

// ============================================================================
// FIXTURES
// ============================================================================

function createMockInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    invoiceId: 'inv_test_001',
    series: 'A',
    number: 42,
    type: 'service_invoice',
    issueDate: '2026-03-15',
    dueDate: '2026-04-15',
    issuer: {
      name: 'Test Company',
      vatNumber: '123456789',
      taxOffice: 'ΔΟΥ Test',
      address: '123 Test St',
      city: 'Athens',
      postalCode: '10000',
      phone: null,
      mobile: null,
      email: null,
      website: null,
      profession: 'Test',
      bankAccounts: [],
    },
    customer: {
      contactId: null,
      name: 'Test Customer',
      vatNumber: '987654321',
      taxOffice: null,
      address: null,
      city: null,
      postalCode: null,
      country: 'GR',
      email: null,
    },
    lineItems: [],
    currency: 'EUR',
    totalNetAmount: 100,
    totalVatAmount: 24,
    totalGrossAmount: 124,
    vatBreakdown: [],
    paymentMethod: 'bank_transfer',
    paymentStatus: 'unpaid',
    payments: [],
    totalPaid: 0,
    balanceDue: 124,
    mydata: {
      status: 'draft',
      mark: null,
      uid: null,
      authCode: null,
      submittedAt: null,
      respondedAt: null,
      errorMessage: null,
    },
    projectId: null,
    propertyId: null,
    relatedInvoiceId: null,
    journalEntryId: null,
    notes: null,
    fiscalYear: 2026,
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('CancelInvoiceDialog', () => {
  const mockOnOpenChange = jest.fn();
  const mockOnSuccess = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Path A: Draft/Rejected → Void
  // --------------------------------------------------------------------------

  describe('Path A: Void (draft invoice)', () => {
    it('renders void title and warning for draft', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('cancelDialog.titleVoid')).toBeInTheDocument();
      expect(screen.getByText('cancelDialog.warningVoid')).toBeInTheDocument();
    });

    it('renders void for rejected invoices', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice({ mydata: { ...createMockInvoice().mydata, status: 'rejected' } })}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('cancelDialog.titleVoid')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Path B: Sent/Accepted → Credit Note
  // --------------------------------------------------------------------------

  describe('Path B: Credit Note (issued invoice)', () => {
    it('renders credit note title for sent', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice({ mydata: { ...createMockInvoice().mydata, status: 'sent' } })}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('cancelDialog.titleCreditNote')).toBeInTheDocument();
      expect(screen.getByText('cancelDialog.warningCreditNote')).toBeInTheDocument();
    });

    it('renders credit note for accepted', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice({ mydata: { ...createMockInvoice().mydata, status: 'accepted' } })}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('cancelDialog.titleCreditNote')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Form Validation
  // --------------------------------------------------------------------------

  describe('Form validation', () => {
    it('disables submit when no reason selected', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      const submitButton = screen.getByText('cancelDialog.confirmVoid');
      expect(submitButton).toBeDisabled();
    });

    it('enables submit after selecting reason', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'BILLING_ERROR' } });
      const submitButton = screen.getByText('cancelDialog.confirmVoid');
      expect(submitButton).not.toBeDisabled();
    });

    it('shows invoice summary', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.getByText('A-42')).toBeInTheDocument();
      expect(screen.getByText('Test Customer')).toBeInTheDocument();
      expect(screen.getByText('€124.00')).toBeInTheDocument();
    });

    it('shows notes-required hint when OTHER selected and notes empty', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'OTHER' } });
      expect(screen.getByText('cancelDialog.notesRequiredHint')).toBeInTheDocument();

      // Submit should be disabled
      expect(screen.getByText('cancelDialog.confirmVoid')).toBeDisabled();
    });

    it('enables submit for OTHER when notes provided', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'OTHER' } });
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Custom reason' } });
      expect(screen.getByText('cancelDialog.confirmVoid')).not.toBeDisabled();
    });
  });

  // --------------------------------------------------------------------------
  // API Call
  // --------------------------------------------------------------------------

  describe('API submission', () => {
    it('calls DELETE with correct payload', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { invoiceId: 'inv_test_001', action: 'voided' },
        }),
      });
      global.fetch = mockFetch;

      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'DUPLICATE' } });
      fireEvent.click(screen.getByText('cancelDialog.confirmVoid'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/accounting/invoices/inv_test_001',
          expect.objectContaining({
            method: 'DELETE',
            body: JSON.stringify({ reasonCode: 'DUPLICATE', notes: '' }),
          })
        );
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('cancelDialog.successVoid')).toBeInTheDocument();
      });
    });

    it('shows error on API failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          error: 'Invoice already cancelled',
        }),
      });

      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'BILLING_ERROR' } });
      fireEvent.click(screen.getByText('cancelDialog.confirmVoid'));

      await waitFor(() => {
        expect(screen.getByText('Invoice already cancelled')).toBeInTheDocument();
      });
    });

    it('shows network error message', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );

      fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'BILLING_ERROR' } });
      fireEvent.click(screen.getByText('cancelDialog.confirmVoid'));

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Dialog state
  // --------------------------------------------------------------------------

  describe('Dialog state', () => {
    it('does not render when closed', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open={false}
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      expect(screen.queryByText('cancelDialog.titleVoid')).not.toBeInTheDocument();
    });

    it('calls onOpenChange(false) on back button', () => {
      render(
        <CancelInvoiceDialog
          invoice={createMockInvoice()}
          open
          onOpenChange={mockOnOpenChange}
          onSuccess={mockOnSuccess}
        />
      );
      fireEvent.click(screen.getByText('cancelDialog.backButton'));
      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
