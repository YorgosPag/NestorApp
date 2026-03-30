/**
 * =============================================================================
 * SaveReportDialog — Component Tests (ADR-268, SPEC-011)
 * =============================================================================
 *
 * Tests save/saveAs modes, form validation, and callbacks.
 * Pattern: React Testing Library + fireEvent + getByRole.
 *
 * @module __tests__/SaveReportDialog
 * @see SPEC-011 §10 Q2 (i18n mock: key-based in unit tests)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mocks ─────────────────────────────────────────────────────────────

// i18n mock: returns key (+ interpolation params) — SPEC-011 §10 Q2
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}::${JSON.stringify(opts)}` : key,
    i18n: { language: 'el', changeLanguage: jest.fn() },
  }),
}));

// design-system import (no-op)
jest.mock('@/lib/design-system', () => ({}));

jest.mock('@/hooks/useBorderTokens', () => ({
  useBorderTokens: () => ({ quick: { input: 'border border-input rounded-md' } }),
}));

jest.mock('@/ui-adapters/react/useSemanticColors', () => ({
  useSemanticColors: () => ({
    bg: { primary: 'bg-background' },
    text: { primary: 'text-foreground' },
    border: { primary: 'border-border' },
  }),
}));

import { SaveReportDialog } from '../SaveReportDialog';
import type {
  SavedReport,
  SavedReportConfig,
} from '@/types/reports/saved-report';

// ─── Test Data Factory ────────────────────────────────────────────────

function makeConfig(overrides: Partial<SavedReportConfig> = {}): SavedReportConfig {
  return {
    domain: 'projects',
    columns: ['name', 'status'],
    filters: [],
    sortField: null,
    sortDirection: 'asc',
    limit: 500,
    groupByConfig: null,
    dateRange: null,
    ...overrides,
  };
}

function makeSavedReport(overrides: Partial<SavedReport> = {}): SavedReport {
  return {
    id: 'srpt_test_001',
    name: 'Existing Report',
    description: 'A test report',
    category: 'monthly',
    visibility: 'personal',
    createdBy: 'user_A',
    favoritedBy: [],
    config: makeConfig(),
    lastRunAt: null,
    runCount: 0,
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Default Props ────────────────────────────────────────────────────

function makeProps(overrides: Partial<React.ComponentProps<typeof SaveReportDialog>> = {}) {
  return {
    open: true,
    onOpenChange: jest.fn(),
    mode: 'save' as const,
    existingReport: null,
    currentConfig: makeConfig(),
    onSave: jest.fn(async () => makeSavedReport()),
    onUpdate: jest.fn(async () => makeSavedReport()),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('SaveReportDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────
  // Rendering
  // ──────────────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders dialog title for save mode', () => {
      render(<SaveReportDialog {...makeProps()} />);
      expect(screen.getByText('dialog.saveTitle')).toBeInTheDocument();
    });

    it('renders dialog title for saveAs mode', () => {
      render(<SaveReportDialog {...makeProps({ mode: 'saveAs' })} />);
      expect(screen.getByText('dialog.saveAsTitle')).toBeInTheDocument();
    });

    it('renders name and description input fields', () => {
      render(<SaveReportDialog {...makeProps()} />);
      expect(screen.getByLabelText('dialog.nameLabel')).toBeInTheDocument();
      expect(screen.getByLabelText('dialog.descriptionLabel')).toBeInTheDocument();
    });

    it('renders save and cancel buttons', () => {
      render(<SaveReportDialog {...makeProps()} />);
      expect(screen.getByText('dialog.save')).toBeInTheDocument();
      expect(screen.getByText('dialog.cancel')).toBeInTheDocument();
    });

    it('does not render when open is false', () => {
      render(<SaveReportDialog {...makeProps({ open: false })} />);
      expect(screen.queryByText('dialog.saveTitle')).not.toBeInTheDocument();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Form Pre-population
  // ──────────────────────────────────────────────────────────────────────

  describe('form pre-population', () => {
    it('populates form with existing report data in save mode', () => {
      const existing = makeSavedReport({ name: 'My Report', description: 'Desc' });
      render(<SaveReportDialog {...makeProps({ mode: 'save', existingReport: existing })} />);

      const nameInput = screen.getByLabelText('dialog.nameLabel') as HTMLInputElement;
      expect(nameInput.value).toBe('My Report');
    });

    it('appends suffix to name in saveAs mode', () => {
      const existing = makeSavedReport({ name: 'My Report' });
      render(<SaveReportDialog {...makeProps({ mode: 'saveAs', existingReport: existing })} />);

      const nameInput = screen.getByLabelText('dialog.nameLabel') as HTMLInputElement;
      // Name should include the duplicate suffix (t key)
      expect(nameInput.value).toContain('My Report');
      expect(nameInput.value).toContain('messages.duplicateSuffix');
    });

    it('starts with empty form for new report', () => {
      render(<SaveReportDialog {...makeProps({ mode: 'save', existingReport: null })} />);

      const nameInput = screen.getByLabelText('dialog.nameLabel') as HTMLInputElement;
      expect(nameInput.value).toBe('');
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Validation
  // ──────────────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('disables save button when name is empty', () => {
      render(<SaveReportDialog {...makeProps()} />);

      const saveButton = screen.getByText('dialog.save').closest('button');
      expect(saveButton).toBeDisabled();
    });

    it('disables save button when name has less than 2 characters', () => {
      render(<SaveReportDialog {...makeProps()} />);

      const nameInput = screen.getByLabelText('dialog.nameLabel');
      fireEvent.change(nameInput, { target: { value: 'A' } });

      const saveButton = screen.getByText('dialog.save').closest('button');
      expect(saveButton).toBeDisabled();
    });

    it('enables save button when existing report has valid name', () => {
      // Pre-populated via useEffect (bypasses fireEvent.change limitation in jsdom)
      const existing = makeSavedReport({ name: 'Valid Report Name' });
      render(<SaveReportDialog {...makeProps({ mode: 'save', existingReport: existing })} />);

      const saveButton = screen.getByText('dialog.save').closest('button');
      expect(saveButton).not.toBeDisabled();
    });

    it('trims whitespace for validation (2+ non-space chars required)', () => {
      render(<SaveReportDialog {...makeProps()} />);

      const nameInput = screen.getByLabelText('dialog.nameLabel');
      fireEvent.change(nameInput, { target: { value: '  A  ' } });

      const saveButton = screen.getByText('dialog.save').closest('button');
      expect(saveButton).toBeDisabled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Submit Behavior
  // ──────────────────────────────────────────────────────────────────────

  describe('submit behavior', () => {
    it('calls onSave in saveAs mode (creates new report)', async () => {
      const existing = makeSavedReport({ name: 'Original' });
      const onSave = jest.fn(async () => makeSavedReport());
      const onUpdate = jest.fn();
      render(<SaveReportDialog {...makeProps({
        mode: 'saveAs',
        existingReport: existing,
        onSave,
        onUpdate,
      })} />);

      // Name pre-populated via useEffect (saveAs appends suffix)
      const saveButton = screen.getByText('dialog.save').closest('button')!;
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            config: expect.objectContaining({ domain: 'projects' }),
          }),
        );
        expect(onUpdate).not.toHaveBeenCalled();
      });
    });

    it('calls onUpdate for existing report in save mode', async () => {
      const existing = makeSavedReport();
      const onUpdate = jest.fn(async () => makeSavedReport());
      render(<SaveReportDialog {...makeProps({ mode: 'save', existingReport: existing, onUpdate })} />);

      // Click save (name is pre-populated)
      const saveButton = screen.getByText('dialog.save').closest('button')!;
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          'srpt_test_001',
          expect.objectContaining({
            name: 'Existing Report',
          }),
        );
      });
    });

    it('calls onSave (not onUpdate) in saveAs mode', async () => {
      const existing = makeSavedReport();
      const onSave = jest.fn(async () => makeSavedReport());
      const onUpdate = jest.fn();
      render(<SaveReportDialog {...makeProps({ mode: 'saveAs', existingReport: existing, onSave, onUpdate })} />);

      const saveButton = screen.getByText('dialog.save').closest('button')!;
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalled();
        expect(onUpdate).not.toHaveBeenCalled();
      });
    });

    it('closes dialog after successful save', async () => {
      const existing = makeSavedReport({ name: 'Report To Save' });
      const onOpenChange = jest.fn();
      const onUpdate = jest.fn(async () => makeSavedReport());
      render(<SaveReportDialog {...makeProps({
        mode: 'save',
        existingReport: existing,
        onOpenChange,
        onUpdate,
      })} />);

      // Name pre-populated → button enabled
      const saveButton = screen.getByText('dialog.save').closest('button')!;
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('does not close dialog on save error', async () => {
      const existing = makeSavedReport({ name: 'Report To Save' });
      const onUpdate = jest.fn(async (): Promise<never> => { throw new Error('Network error'); });
      const onOpenChange = jest.fn();
      render(<SaveReportDialog {...makeProps({
        mode: 'save',
        existingReport: existing,
        onOpenChange,
        onUpdate,
      })} />);

      const saveButton = screen.getByText('dialog.save').closest('button')!;
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalled();
      });

      // Dialog should NOT have been closed (error caught)
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });
  });
});
