/**
 * QuoteOriginalDocumentPanel — smoke tests.
 *
 * Verifies the four critical UI states:
 *   - loading: shows spinner
 *   - empty: shows "no attachment" empty state
 *   - ready (full): shows preview + download/open actions
 *   - ready (compact): shows compact list with download/open buttons
 */

import { render, screen } from '@testing-library/react';
import { QuoteOriginalDocumentPanel } from '../QuoteOriginalDocumentPanel';
import type { FileRecord } from '@/types/file-record';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/components/shared/files/preview/FilePreviewRenderer', () => ({
  FilePreviewRenderer: ({ url, displayName }: { url?: string; displayName: string }) => (
    <div data-testid="preview-renderer">{`preview:${displayName}:${url ?? 'none'}`}</div>
  ),
}));

jest.mock('@/components/shared/files/hooks/useFileDownload', () => ({
  useFileDownload: () => ({ handleDownload: jest.fn() }),
}));

const mockUseEntityFiles = jest.fn();
jest.mock('@/components/shared/files/hooks/useEntityFiles', () => ({
  useEntityFiles: (params: unknown) => mockUseEntityFiles(params),
}));

const baseFile: FileRecord = {
  id: 'file_1',
  companyId: 'co_1',
  entityType: 'quote',
  entityId: 'quote_1',
  domain: 'sales',
  category: 'documents',
  storagePath: 'companies/co_1/entities/quote/quote_1/domains/sales/categories/documents/files/file_1.pdf',
  downloadUrl: 'https://example.com/file_1.pdf',
  displayName: 'Quote 2024-001',
  originalFilename: 'quote.pdf',
  ext: 'pdf',
  contentType: 'application/pdf',
  sizeBytes: 12345,
  status: 'ready',
  createdAt: '2026-04-29T00:00:00Z',
  createdBy: 'user_1',
};

function makeReturn(overrides: Partial<{ files: FileRecord[]; loading: boolean; error: Error | null }>) {
  return {
    files: [],
    loading: false,
    error: null,
    refetch: jest.fn(),
    moveToTrash: jest.fn(),
    renameFile: jest.fn(),
    updateDescription: jest.fn(),
    deleteFile: jest.fn(),
    totalStorageBytes: 0,
    ...overrides,
  };
}

describe('QuoteOriginalDocumentPanel', () => {
  beforeEach(() => {
    mockUseEntityFiles.mockReset();
  });

  it('shows loading state when files empty + loading', () => {
    mockUseEntityFiles.mockReturnValue(makeReturn({ loading: true }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" />);
    expect(screen.getByText('quotes.loading')).toBeInTheDocument();
  });

  it('shows empty state when no files', () => {
    mockUseEntityFiles.mockReturnValue(makeReturn({ files: [] }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" />);
    expect(screen.getByText('quotes.scan.originalDocument.empty')).toBeInTheDocument();
  });

  it('renders preview + actions in full mode', () => {
    mockUseEntityFiles.mockReturnValue(makeReturn({ files: [baseFile] }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" />);
    expect(screen.getByText('quotes.scan.originalDocument.title')).toBeInTheDocument();
    expect(screen.getByText('quotes.scan.originalDocument.badge')).toBeInTheDocument();
    expect(screen.getByTestId('preview-renderer')).toHaveTextContent(
      'preview:Quote 2024-001:https://example.com/file_1.pdf',
    );
    expect(screen.getByText('quotes.scan.originalDocument.download')).toBeInTheDocument();
    expect(screen.getByText('quotes.scan.originalDocument.openExternal')).toBeInTheDocument();
  });

  it('renders multi-file selector when more than one file', () => {
    const second: FileRecord = { ...baseFile, id: 'file_2', displayName: 'Quote 2024-002' };
    mockUseEntityFiles.mockReturnValue(makeReturn({ files: [baseFile, second] }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" />);
    expect(screen.getByText('Quote 2024-001')).toBeInTheDocument();
    expect(screen.getByText('Quote 2024-002')).toBeInTheDocument();
  });

  it('renders compact list (no preview) when compact prop set', () => {
    mockUseEntityFiles.mockReturnValue(makeReturn({ files: [baseFile] }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" compact />);
    expect(screen.queryByTestId('preview-renderer')).not.toBeInTheDocument();
    expect(screen.getByText('Quote 2024-001')).toBeInTheDocument();
  });

  it('shows error when useEntityFiles errors', () => {
    mockUseEntityFiles.mockReturnValue(makeReturn({ error: new Error('boom') }));
    render(<QuoteOriginalDocumentPanel quoteId="quote_1" companyId="co_1" />);
    expect(screen.getByText('boom')).toBeInTheDocument();
  });
});
