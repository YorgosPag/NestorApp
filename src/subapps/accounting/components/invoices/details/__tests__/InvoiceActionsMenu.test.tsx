/**
 * @fileoverview Tests for InvoiceActionsMenu — cancel/credit note button visibility
 * @see RESEARCH-A1-INVOICE-CANCELLATION-UI.md
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvoiceActionsMenu } from '../InvoiceActionsMenu';
import type { Invoice } from '@/subapps/accounting/types';

// ============================================================================
// MOCKS
// ============================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/subapps/accounting/services/pdf/invoice-pdf-exporter', () => ({
  exportInvoicePDF: jest.fn(),
  printInvoicePDF: jest.fn(),
  extractKadFromProfile: jest.fn(() => null),
}));

// Mock Radix DropdownMenu to render inline (portals don't work in jsdom)
jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} className={className} disabled={disabled}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="separator" />,
}));

// ============================================================================
// FIXTURES
// ============================================================================

function createMockInvoice(status: string): Invoice {
  return {
    invoiceId: 'inv_test_001',
    series: 'A',
    number: 1,
    type: 'service_invoice',
    issueDate: '2026-01-01',
    dueDate: null,
    issuer: {
      name: 'Co', vatNumber: '1', taxOffice: 'X', address: 'X', city: 'X',
      postalCode: '0', phone: null, mobile: null, email: null, website: null,
      profession: 'X', bankAccounts: [],
    },
    customer: {
      contactId: null, name: 'C', vatNumber: null, taxOffice: null,
      address: null, city: null, postalCode: null, country: 'GR', email: null,
    },
    lineItems: [],
    currency: 'EUR',
    totalNetAmount: 0,
    totalVatAmount: 0,
    totalGrossAmount: 0,
    vatBreakdown: [],
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    payments: [],
    totalPaid: 0,
    balanceDue: 0,
    mydata: {
      status: status as 'draft' | 'sent' | 'accepted' | 'rejected' | 'cancelled',
      mark: null, uid: null, authCode: null,
      submittedAt: null, respondedAt: null, errorMessage: null,
    },
    projectId: null,
    propertyId: null,
    relatedInvoiceId: null,
    journalEntryId: null,
    notes: null,
    fiscalYear: 2026,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('InvoiceActionsMenu', () => {
  const defaults = {
    onRefresh: jest.fn(),
    companyProfile: null,
    onSendEmail: jest.fn(),
    onCancel: jest.fn(),
  };

  afterEach(() => jest.clearAllMocks());

  it('shows void button for draft invoice', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('draft')} {...defaults} />);
    expect(screen.getByText('cancelDialog.menuVoid')).toBeInTheDocument();
  });

  it('shows void button for rejected invoice', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('rejected')} {...defaults} />);
    expect(screen.getByText('cancelDialog.menuVoid')).toBeInTheDocument();
  });

  it('shows credit note button for sent invoice', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('sent')} {...defaults} />);
    expect(screen.getByText('cancelDialog.menuCreditNote')).toBeInTheDocument();
  });

  it('shows credit note button for accepted invoice', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('accepted')} {...defaults} />);
    expect(screen.getByText('cancelDialog.menuCreditNote')).toBeInTheDocument();
  });

  it('hides cancel action for already cancelled invoice', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('cancelled')} {...defaults} />);
    expect(screen.queryByText('cancelDialog.menuVoid')).not.toBeInTheDocument();
    expect(screen.queryByText('cancelDialog.menuCreditNote')).not.toBeInTheDocument();
  });

  it('renders separator before cancel action', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('draft')} {...defaults} />);
    expect(screen.getByTestId('separator')).toBeInTheDocument();
  });

  it('applies destructive style to cancel button', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('draft')} {...defaults} />);
    const cancelButton = screen.getByText('cancelDialog.menuVoid').closest('button');
    expect(cancelButton?.className).toContain('text-destructive');
  });

  it('calls onCancel when cancel menu item clicked', () => {
    render(<InvoiceActionsMenu invoice={createMockInvoice('draft')} {...defaults} />);
    fireEvent.click(screen.getByText('cancelDialog.menuVoid'));
    expect(defaults.onCancel).toHaveBeenCalledTimes(1);
  });

  it('hides cancel when onCancel not provided', () => {
    render(
      <InvoiceActionsMenu
        invoice={createMockInvoice('draft')}
        onRefresh={jest.fn()}
        companyProfile={null}
        onSendEmail={jest.fn()}
      />
    );
    expect(screen.queryByText('cancelDialog.menuVoid')).not.toBeInTheDocument();
  });

  it('shows edit for draft, hides for sent', () => {
    const onEdit = jest.fn();
    const { rerender } = render(
      <InvoiceActionsMenu invoice={createMockInvoice('draft')} {...defaults} onEdit={onEdit} />
    );
    expect(screen.getByText('invoices.editInvoice')).toBeInTheDocument();

    rerender(
      <InvoiceActionsMenu invoice={createMockInvoice('sent')} {...defaults} onEdit={onEdit} />
    );
    expect(screen.queryByText('invoices.editInvoice')).not.toBeInTheDocument();
  });
});
