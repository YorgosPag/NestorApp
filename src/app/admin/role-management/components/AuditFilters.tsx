'use client';

/**
 * ADR-244 Phase B: Audit Log Filters
 *
 * Filter controls for date range, actor, target, and action type.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AuditLogFilters as FilterType } from '../types';
import { AUDIT_ACTION_DISPLAY } from '../types';

// =============================================================================
// PROPS
// =============================================================================

interface AuditFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onReset: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AuditFilters({ filters, onFiltersChange, onReset }: AuditFiltersProps) {
  const { t } = useTranslation('admin');

  const actionOptions = Object.entries(AUDIT_ACTION_DISPLAY).map(([key, config]) => ({
    value: key,
    label: config.label,
  }));

  return (
    <section className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-4">
      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('roleManagement.auditTab.dateFrom', 'From')}
        </label>
        <Input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
          className="w-40"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('roleManagement.auditTab.dateTo', 'To')}
        </label>
        <Input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
          className="w-40"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('roleManagement.auditTab.action', 'Action')}
        </label>
        <Select
          value={filters.action}
          onValueChange={(value) => onFiltersChange({ ...filters, action: value as FilterType['action'] })}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t('roleManagement.auditTab.allActions', 'All Actions')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t('roleManagement.auditTab.allActions', 'All Actions')}
            </SelectItem>
            {actionOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('roleManagement.auditTab.actorId', 'Actor ID')}
        </label>
        <Input
          type="text"
          value={filters.actorId}
          onChange={(e) => onFiltersChange({ ...filters, actorId: e.target.value })}
          placeholder="uid..."
          className="w-36"
        />
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {t('roleManagement.auditTab.targetId', 'Target ID')}
        </label>
        <Input
          type="text"
          value={filters.targetId}
          onChange={(e) => onFiltersChange({ ...filters, targetId: e.target.value })}
          placeholder="uid..."
          className="w-36"
        />
      </fieldset>

      <Button variant="outline" size="sm" onClick={onReset}>
        {t('roleManagement.auditTab.reset', 'Reset')}
      </Button>
    </section>
  );
}
