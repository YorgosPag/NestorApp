/**
 * @fileoverview Journal Page Content — Κύρια σελίδα Βιβλίου Εσόδων-Εξόδων
 * @description Εμφανίζει header, filters, loading/empty/error states, πίνακα εγγραφών & φόρμα
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, no inline styles
 */

'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useJournalEntries } from '../../hooks/useJournalEntries';
import type { EntryType, FiscalQuarter } from '@/subapps/accounting/types';
import { JournalEntriesTable } from './JournalEntriesTable';
import { JournalFilters } from './JournalFilters';
import type { JournalFilterState } from './JournalFilters';
import { JournalEntryForm } from './JournalEntryForm';

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalPageContent() {
  const { t } = useTranslation('accounting');

  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState<JournalFilterState>({
    fiscalYear: new Date().getFullYear(),
    type: '',
    quarter: '',
  });

  // Build hook options from filter state
  const hookOptions = {
    fiscalYear: filters.fiscalYear,
    ...(filters.type ? { type: filters.type as EntryType } : {}),
    ...(filters.quarter ? { quarter: filters.quarter as FiscalQuarter } : {}),
  };

  const { entries, loading, error, refetch } = useJournalEntries(hookOptions);

  const handleFilterChange = useCallback((partial: Partial<JournalFilterState>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowForm(false);
    refetch();
  }, [refetch]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('journal.title')}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t('journal.description')}</p>
          </div>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('journal.newEntry')}
            </Button>
          )}
        </div>
        {!showForm && (
          <JournalFilters filters={filters} onFilterChange={handleFilterChange} />
        )}
      </header>

      {/* Content Area */}
      <section className="p-6">
        {showForm ? (
          <JournalEntryForm onSuccess={handleFormSuccess} onCancel={handleFormCancel} />
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">{error}</p>
            <Button variant="outline" onClick={refetch}>
              {t('common.retry')}
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg font-medium text-foreground mb-1">{t('journal.noEntries')}</p>
            <p className="text-muted-foreground mb-4">{t('journal.noEntriesDescription')}</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('journal.newEntry')}
            </Button>
          </div>
        ) : (
          <JournalEntriesTable entries={entries} />
        )}
      </section>
    </main>
  );
}
