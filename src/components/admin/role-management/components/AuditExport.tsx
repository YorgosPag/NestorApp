'use client';

/**
 * ADR-244 Phase B: Audit Export Dropdown
 *
 * Export audit logs as CSV or JSON (super_admin only).
 */

import { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { API_ROUTES } from '@/config/domain-constants';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNotifications } from '@/providers/NotificationProvider';
import { getAuth } from 'firebase/auth';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import type { AuditLogFilters } from '../types';

// =============================================================================
// PROPS
// =============================================================================

interface AuditExportProps {
  filters: AuditLogFilters;
  canExport: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AuditExport({ filters, canExport }: AuditExportProps) {
  const { t } = useTranslation('admin');
  const { success, error: notifyError } = useNotifications();
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      // Direct fetch for file download (apiClient doesn't support raw responses)
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(
        `${API_ROUTES.ADMIN.ROLE_MANAGEMENT.AUDIT_LOG_EXPORT}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token ?? ''}` } }
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition');
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] ?? `audit-log.${format}`;
      triggerExportDownload({ blob, filename });

      success(t('roleManagement.auditTab.exportSuccess', 'Export completed'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      notifyError(message);
    } finally {
      setIsExporting(false);
    }
  }, [format, filters, success, notifyError, t]);

  if (!canExport) return null;

  return (
    <footer className="flex items-center gap-2">
      <Select value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
        <SelectTrigger className="w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="csv">CSV</SelectItem>
          <SelectItem value="json">JSON</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
      >
        {isExporting
          ? t('roleManagement.auditTab.exporting', 'Exporting...')
          : t('roleManagement.auditTab.export', 'Export')}
      </Button>
    </footer>
  );
}
