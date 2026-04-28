import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ContactQuotesSection } from '../ContactQuotesSection';
import type { Quote, QuoteStatus } from '@/subapps/procurement/types/quote';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/lib/intl-formatting', () => ({
  formatCurrency: (n: number) => `EUR ${n.toFixed(2)}`,
  formatDate: (ms: number) => new Date(ms).toISOString().slice(0, 10),
}));

jest.mock('@/subapps/procurement/components/QuoteStatusBadge', () => ({
  QuoteStatusBadge: ({ status }: { status: string }) => (
    <span data-testid={`status-${status}`}>{status}</span>
  ),
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

jest.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({
    children,
    onClick,
    className,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    [k: string]: unknown;
  }) => (
    <tr onClick={onClick} className={className} {...rest}>
      {children}
    </tr>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <td className={className}>{children}</td>
  ),
}));

jest.mock('lucide-react', () => ({
  ArrowRight: () => <span data-testid="icon-arrow" />,
  Plus: () => <span data-testid="icon-plus" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q-1',
    displayNumber: 'QT-0001',
    rfqId: null,
    projectId: 'p-1',
    buildingId: null,
    companyId: 'c-1',
    vendorContactId: 'v-1',
    trade: 'concrete',
    source: 'manual',
    status: 'draft' as QuoteStatus,
    lines: [],
    totals: { subtotal: 100, vatAmount: 24, total: 124, vatRate: 24 },
    validUntil: null,
    paymentTerms: null,
    deliveryTerms: null,
    warranty: null,
    notes: null,
    attachments: [],
    extractedData: null,
    overallConfidence: null,
    acceptanceMode: null,
    overrideReason: null,
    overrideAt: null,
    overriddenBy: null,
    vendorEditHistory: [],
    editWindowExpiresAt: null,
    auditTrail: [],
    submittedAt: null,
    submitterIp: null,
    linkedPoId: null,
    createdAt: { seconds: 1735689600, nanoseconds: 0 } as Quote['createdAt'],
    updatedAt: { seconds: 1735689600, nanoseconds: 0 } as Quote['updatedAt'],
    createdBy: 'u-1',
    ...overrides,
  } as Quote;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContactQuotesSection', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('renders empty state when no quotes', () => {
    render(
      <ContactQuotesSection quotes={[]} loading={false} archived={false} contactId="c-1" />,
    );
    expect(screen.getByText('quotes:quotes.empty')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    render(
      <ContactQuotesSection quotes={[]} loading archived={false} contactId="c-1" />,
    );
    expect(screen.getByText('quotes:quotes.loading')).toBeInTheDocument();
  });

  it('renders one row per quote', () => {
    const quotes = [
      makeQuote({ id: 'q-1', displayNumber: 'QT-0001' }),
      makeQuote({ id: 'q-2', displayNumber: 'QT-0002', status: 'submitted' }),
      makeQuote({ id: 'q-3', displayNumber: 'QT-0003', status: 'accepted' }),
    ];
    render(
      <ContactQuotesSection
        quotes={quotes}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByTestId('quote-row-q-1')).toBeInTheDocument();
    expect(screen.getByTestId('quote-row-q-2')).toBeInTheDocument();
    expect(screen.getByTestId('quote-row-q-3')).toBeInTheDocument();
    expect(screen.getByText('QT-0001')).toBeInTheDocument();
    expect(screen.getByText('QT-0002')).toBeInTheDocument();
    expect(screen.getByText('QT-0003')).toBeInTheDocument();
  });

  it('navigates to review page on row click', () => {
    const quotes = [makeQuote({ id: 'q-42', displayNumber: 'QT-0042' })];
    render(
      <ContactQuotesSection
        quotes={quotes}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    fireEvent.click(screen.getByTestId('quote-row-q-42'));
    expect(mockPush).toHaveBeenCalledWith('/procurement/quotes/q-42/review');
  });

  it('renders status badge per row', () => {
    const quotes = [
      makeQuote({ id: 'q-1', status: 'draft' }),
      makeQuote({ id: 'q-2', status: 'accepted' }),
    ];
    render(
      <ContactQuotesSection
        quotes={quotes}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByTestId('status-draft')).toBeInTheDocument();
    expect(screen.getByTestId('status-accepted')).toBeInTheDocument();
  });

  it('shows create button when not archived and triggers navigation', () => {
    render(
      <ContactQuotesSection
        quotes={[]}
        loading={false}
        archived={false}
        contactId="c-99"
      />,
    );
    const createBtn = screen.getByText('quotes:quotes.create');
    expect(createBtn).toBeInTheDocument();
    fireEvent.click(createBtn);
    expect(mockPush).toHaveBeenCalledWith(
      '/procurement/quotes/new?vendorContactId=c-99',
    );
  });

  it('hides create button when archived', () => {
    render(
      <ContactQuotesSection
        quotes={[]}
        loading={false}
        archived
        contactId="c-1"
      />,
    );
    expect(screen.queryByText('quotes:quotes.create')).not.toBeInTheDocument();
  });

  it('handles createdAt as Date instance without crash', () => {
    const quote = makeQuote({ id: 'q-d' });
    (quote as { createdAt: unknown }).createdAt = new Date('2026-04-29T10:00:00Z');
    render(
      <ContactQuotesSection
        quotes={[quote]}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByTestId('quote-row-q-d')).toBeInTheDocument();
  });

  it('handles createdAt as ISO string without crash', () => {
    const quote = makeQuote({ id: 'q-s' });
    (quote as { createdAt: unknown }).createdAt = '2026-04-29T10:00:00Z';
    render(
      <ContactQuotesSection
        quotes={[quote]}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByTestId('quote-row-q-s')).toBeInTheDocument();
  });

  it('handles createdAt as Admin SDK { _seconds } shape without crash', () => {
    const quote = makeQuote({ id: 'q-a' });
    (quote as { createdAt: unknown }).createdAt = { _seconds: 1735689600, _nanoseconds: 0 };
    render(
      <ContactQuotesSection
        quotes={[quote]}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByTestId('quote-row-q-a')).toBeInTheDocument();
  });

  it('renders em-dash when createdAt missing or invalid', () => {
    const quote = makeQuote({ id: 'q-n' });
    (quote as { createdAt: unknown }).createdAt = null;
    render(
      <ContactQuotesSection
        quotes={[quote]}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    const row = screen.getByTestId('quote-row-q-n');
    expect(row).toHaveTextContent('—');
  });

  it('renders formatted total per row', () => {
    const quotes = [
      makeQuote({
        id: 'q-1',
        totals: { subtotal: 1000, vatAmount: 240, total: 1240, vatRate: 24 },
      }),
    ];
    render(
      <ContactQuotesSection
        quotes={quotes}
        loading={false}
        archived={false}
        contactId="c-1"
      />,
    );
    expect(screen.getByText('EUR 1240.00')).toBeInTheDocument();
  });
});
