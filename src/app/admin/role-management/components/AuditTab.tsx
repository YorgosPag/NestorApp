'use client';

/**
 * ADR-244 Phase B: Audit Tab — Container component
 *
 * Fetches audit log entries from API, manages filters and pagination,
 * renders AuditTimeline + AuditFilters + AuditExport.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';

import { AuditFilters } from './AuditFilters';
import { AuditTimeline } from './AuditTimeline';
import { AuditExport } from './AuditExport';

import type { AuditLogFilters, AuditLogResponse, FrontendAuditEntry } from '../types';
import { DEFAULT_AUDIT_FILTERS } from '../types';

// =============================================================================
// PROPS
// =============================================================================

interface AuditTabProps {
  canExport: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AuditTab({ canExport }: AuditTabProps) {
  const { t } = useTranslation('admin');
  const { error: notifyError } = useNotifications();

  const [entries, setEntries] = useState<FrontendAuditEntry[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>(DEFAULT_AUDIT_FILTERS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch audit logs
  // ---------------------------------------------------------------------------
  const fetchLogs = useCallback(async (cursor?: string | null) => {
    const isMore = !!cursor;
    if (isMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
      if (filters.actorId) params.set('actorId', filters.actorId);
      if (filters.targetId) params.set('targetId', filters.targetId);
      if (filters.action && filters.action !== 'all') params.set('action', filters.action);

      // apiClient unwraps canonical { success, data } → returns data directly
      const data = await apiClient.get<AuditLogResponse['data']>(
        `${API_ROUTES.ADMIN.ROLE_MANAGEMENT.AUDIT_LOG}?${params.toString()}`
      );

      if (isMore) {
        setEntries((prev) => [...prev, ...data.entries]);
      } else {
        setEntries(data.entries);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load audit logs';
      notifyError(message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [filters, notifyError]);

  // Re-fetch when filters change
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ---------------------------------------------------------------------------
  // Filter callbacks
  // ---------------------------------------------------------------------------
  const handleFilterByActor = useCallback((actorId: string) => {
    setFilters((prev) => ({ ...prev, actorId }));
  }, []);

  const handleFilterByTarget = useCallback((targetId: string) => {
    setFilters((prev) => ({ ...prev, targetId }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_AUDIT_FILTERS);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t('roleManagement.auditTab.title', 'Audit Log')}
        </h2>
        <AuditExport filters={filters} canExport={canExport} />
      </header>

      <AuditFilters
        filters={filters}
        onFiltersChange={setFilters}
        onReset={handleResetFilters}
      />

      {isLoading ? (
        <p className="py-8 text-center text-muted-foreground animate-pulse">
          {t('roleManagement.auditTab.loading', 'Loading audit logs...')}
        </p>
      ) : (
        <>
          <AuditTimeline
            entries={entries}
            onFilterByActor={handleFilterByActor}
            onFilterByTarget={handleFilterByTarget}
          />

          {nextCursor && (
            <footer className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchLogs(nextCursor)}
                disabled={isLoadingMore}
              >
                {isLoadingMore
                  ? t('roleManagement.auditTab.loadingMore', 'Loading more...')
                  : t('roleManagement.auditTab.loadMore', 'Load more')}
              </Button>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
