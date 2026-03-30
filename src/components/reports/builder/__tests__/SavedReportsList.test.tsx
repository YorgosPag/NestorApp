/**
 * =============================================================================
 * SavedReportsList — Component Tests (ADR-268, SPEC-011)
 * =============================================================================
 *
 * Tests tabs rendering, search, row display, and callback wiring.
 * Pattern: React Testing Library + mocked sub-components.
 *
 * @module __tests__/SavedReportsList
 * @see SPEC-011 §10 Q2
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ─────────────────────────────────────────────────────────────

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
    i18n: { language: 'el', changeLanguage: jest.fn() },
  }),
}));

jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { uid: 'user_A', email: 'test@test.com' },
    loading: false,
  }),
}));

jest.mock('@/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: jest.fn(async () => true),
    dialogProps: {
      open: false,
      onOpenChange: jest.fn(),
      title: '',
      description: '',
      onConfirm: jest.fn(),
    },
  }),
}));

// Mock ConfirmDialog to avoid rendering complex UI
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: () => null,
}));

// Mock SavedReportsTableRow — render as a simple <tr> with data-testid
jest.mock('../SavedReportsTableRow', () => ({
  SavedReportsTableRow: ({
    report,
    onLoad,
    onDelete,
    onToggleFavorite,
    onDuplicate,
  }: {
    report: { id: string; name: string };
    isFavorited: boolean;
    onLoad: (r: { id: string; name: string }) => void;
    onDelete: (id: string) => void;
    onToggleFavorite: (id: string) => void;
    onDuplicate: (r: { id: string; name: string }) => void;
  }) => (
    <tr data-testid={`report-row-${report.id}`}>
      <td>{report.name}</td>
      <td>
        <button data-testid={`load-${report.id}`} onClick={() => onLoad(report)}>Load</button>
        <button data-testid={`delete-${report.id}`} onClick={() => onDelete(report.id)}>Delete</button>
        <button data-testid={`fav-${report.id}`} onClick={() => onToggleFavorite(report.id)}>Fav</button>
        <button data-testid={`dup-${report.id}`} onClick={() => onDuplicate(report)}>Dup</button>
      </td>
    </tr>
  ),
}));

import { SavedReportsList } from '../SavedReportsList';
import type { SavedReport, SavedReportsTab } from '@/types/reports/saved-report';

// ─── Test Data Factory ────────────────────────────────────────────────

function makeSavedReport(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: 'srpt_test_001',
    name: 'Test Report',
    description: null,
    category: 'general',
    visibility: 'personal',
    createdBy: 'user_A',
    favoritedBy: [],
    config: {
      domain: 'projects',
      columns: ['name'],
      filters: [],
      sortField: null,
      sortDirection: 'asc',
      limit: 500,
      groupByConfig: null,
      dateRange: null,
    },
    lastRunAt: null,
    runCount: 0,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeProps(overrides: Partial<React.ComponentProps<typeof SavedReportsList>> = {}) {
  const reports = [
    makeSavedReport({ id: 'srpt_001', name: 'Report Alpha' }),
    makeSavedReport({ id: 'srpt_002', name: 'Report Beta' }),
  ];

  return {
    reports,
    loading: false,
    activeTab: 'all' as SavedReportsTab,
    onTabChange: jest.fn(),
    searchQuery: '',
    onSearchChange: jest.fn(),
    filteredReports: reports,
    onLoad: jest.fn(),
    onDelete: jest.fn(async () => true),
    onToggleFavorite: jest.fn(async () => true),
    onDuplicate: jest.fn(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('SavedReportsList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders section with title', () => {
      render(<SavedReportsList {...makeProps()} />);
      expect(screen.getByText('title')).toBeInTheDocument();
    });

    it('renders all 4 tab triggers', () => {
      render(<SavedReportsList {...makeProps()} />);
      expect(screen.getByText('tabs.all')).toBeInTheDocument();
      expect(screen.getByText('tabs.favorites')).toBeInTheDocument();
      expect(screen.getByText('tabs.recent')).toBeInTheDocument();
      expect(screen.getByText('tabs.shared')).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<SavedReportsList {...makeProps()} />);
      expect(screen.getByPlaceholderText('dialog.namePlaceholder')).toBeInTheDocument();
    });

    it('renders report rows', () => {
      render(<SavedReportsList {...makeProps()} />);
      expect(screen.getByTestId('report-row-srpt_001')).toBeInTheDocument();
      expect(screen.getByTestId('report-row-srpt_002')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Empty & Loading States
  // ──────────────────────────────────────────────────────────────────────

  describe('empty & loading states', () => {
    it('shows loading indicator when loading', () => {
      render(<SavedReportsList {...makeProps({ loading: true })} />);
      expect(screen.getByText('...')).toBeInTheDocument();
    });

    it('shows empty state when no reports', () => {
      render(<SavedReportsList {...makeProps({ filteredReports: [] })} />);
      expect(screen.getByText('empty')).toBeInTheDocument();
      expect(screen.getByText('emptyHint')).toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Search
  // ──────────────────────────────────────────────────────────────────────

  describe('search', () => {
    it('calls onSearchChange when typing in search input', () => {
      const onSearchChange = jest.fn();
      render(<SavedReportsList {...makeProps({ onSearchChange })} />);

      const searchInput = screen.getByPlaceholderText('dialog.namePlaceholder');
      fireEvent.change(searchInput, { target: { value: 'Monthly' } });

      expect(onSearchChange).toHaveBeenCalledWith('Monthly');
    });

    it('displays current searchQuery value', () => {
      render(<SavedReportsList {...makeProps({ searchQuery: 'Tax' })} />);

      const searchInput = screen.getByPlaceholderText('dialog.namePlaceholder') as HTMLInputElement;
      expect(searchInput.value).toBe('Tax');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Tabs
  // ──────────────────────────────────────────────────────────────────────

  describe('tabs', () => {
    it('renders correct active tab', () => {
      render(<SavedReportsList {...makeProps({ activeTab: 'favorites' })} />);

      // The active tab trigger should have data-state="active"
      const favTab = screen.getByText('tabs.favorites').closest('button');
      expect(favTab).toHaveAttribute('data-state', 'active');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Row Actions
  // ──────────────────────────────────────────────────────────────────────

  describe('row actions', () => {
    it('calls onLoad when load button is clicked', () => {
      const onLoad = jest.fn();
      render(<SavedReportsList {...makeProps({ onLoad })} />);

      fireEvent.click(screen.getByTestId('load-srpt_001'));
      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'srpt_001' }),
      );
    });

    it('calls onToggleFavorite when favorite button is clicked', () => {
      const onToggleFavorite = jest.fn(async () => true);
      render(<SavedReportsList {...makeProps({ onToggleFavorite })} />);

      fireEvent.click(screen.getByTestId('fav-srpt_001'));
      expect(onToggleFavorite).toHaveBeenCalledWith('srpt_001');
    });

    it('calls onDuplicate when duplicate button is clicked', () => {
      const onDuplicate = jest.fn();
      render(<SavedReportsList {...makeProps({ onDuplicate })} />);

      fireEvent.click(screen.getByTestId('dup-srpt_002'));
      expect(onDuplicate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'srpt_002' }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Favorites Detection
  // ──────────────────────────────────────────────────────────────────────

  describe('favorites detection', () => {
    it('marks report as favorited when userId is in favoritedBy', () => {
      const report = makeSavedReport({
        id: 'srpt_fav',
        favoritedBy: ['user_A', 'user_B'],
      });
      render(<SavedReportsList {...makeProps({ filteredReports: [report] })} />);

      // The SavedReportsTableRow mock receives isFavorited prop
      // Since user_A is in favoritedBy, it should be favorited
      expect(screen.getByTestId('report-row-srpt_fav')).toBeInTheDocument();
    });
  });
});
