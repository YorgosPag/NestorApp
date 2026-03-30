/**
 * @module components/reports/builder/SavedReportsList
 * @enterprise ADR-268 Phase 7 — Saved Reports List Panel
 *
 * Table listing saved reports with tabs, search, and row actions.
 * Pattern: Salesforce saved views + QuickBooks memorized reports.
 */

'use client';

import '@/lib/design-system';
import { useCallback } from 'react';
import { Search, FileText } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SavedReportsTableRow } from './SavedReportsTableRow';
import type { SavedReport, SavedReportsTab } from '@/types/reports/saved-report';

// ============================================================================
// Types
// ============================================================================

interface SavedReportsListProps {
  reports: SavedReport[];
  loading: boolean;
  activeTab: SavedReportsTab;
  onTabChange: (tab: SavedReportsTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filteredReports: SavedReport[];
  onLoad: (report: SavedReport) => void;
  onDelete: (id: string) => Promise<boolean>;
  onToggleFavorite: (id: string) => Promise<boolean>;
  onDuplicate: (report: SavedReport) => void;
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState() {
  const { t } = useTranslation('saved-reports');
  return (
    <figure className="flex flex-col items-center gap-2 py-12 text-center">
      <FileText className="h-10 w-10 text-muted-foreground" />
      <figcaption>
        <p className="text-sm font-medium text-muted-foreground">{t('empty')}</p>
        <p className="text-xs text-muted-foreground">{t('emptyHint')}</p>
      </figcaption>
    </figure>
  );
}

function TableHeader() {
  const { t } = useTranslation('saved-reports');
  return (
    <thead>
      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
        <th className="w-10 px-2 py-2" aria-label="Favorite" />
        <th className="px-3 py-2">{t('table.name')}</th>
        <th className="px-3 py-2">{t('table.category')}</th>
        <th className="hidden px-3 py-2 sm:table-cell">{t('table.visibility')}</th>
        <th className="hidden px-3 py-2 md:table-cell">{t('table.lastRun')}</th>
        <th className="w-10 px-2 py-2" aria-label="Actions" />
      </tr>
    </thead>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SavedReportsList({
  loading,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  filteredReports,
  onLoad,
  onDelete,
  onToggleFavorite,
  onDuplicate,
}: SavedReportsListProps) {
  const { t } = useTranslation('saved-reports');
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const { confirm, dialogProps } = useConfirmDialog();

  const handleDelete = useCallback(async (id: string) => {
    const report = filteredReports.find(r => r.id === id);
    const confirmed = await confirm({
      title: t('deleteConfirm.title'),
      description: t('deleteConfirm.message', { name: report?.name ?? '' }),
      variant: 'destructive',
    });
    if (confirmed) {
      await onDelete(id);
    }
  }, [confirm, filteredReports, onDelete, t]);

  const handleToggleFavorite = useCallback((id: string) => {
    void onToggleFavorite(id);
  }, [onToggleFavorite]);

  const tabValues: SavedReportsTab[] = ['all', 'favorites', 'recent', 'shared'];

  return (
    <section
      className="rounded-lg border bg-card"
      aria-label={t('title')}
    >
      {/* Header: Title + Search */}
      <header className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">{t('title')}</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('dialog.namePlaceholder')}
            className="pl-9"
          />
        </div>
      </header>

      {/* Tabs + Content */}
      <Tabs
        value={activeTab}
        onValueChange={v => onTabChange(v as SavedReportsTab)}
      >
        <nav className="border-b px-4">
          <TabsList className="h-10 bg-transparent p-0">
            {tabValues.map(tab => (
              <TabsTrigger key={tab} value={tab} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                {t(`tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </nav>

        {tabValues.map(tab => (
          <TabsContent key={tab} value={tab} className="m-0">
            {loading ? (
              <figure className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">...</p>
              </figure>
            ) : filteredReports.length === 0 ? (
              <EmptyState />
            ) : (
              <table className="w-full">
                <TableHeader />
                <tbody>
                  {filteredReports.map(report => (
                    <SavedReportsTableRow
                      key={report.id}
                      report={report}
                      isFavorited={report.favoritedBy.includes(userId)}
                      onLoad={onLoad}
                      onDelete={handleDelete}
                      onToggleFavorite={handleToggleFavorite}
                      onDuplicate={onDuplicate}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ConfirmDialog {...dialogProps} />
    </section>
  );
}
