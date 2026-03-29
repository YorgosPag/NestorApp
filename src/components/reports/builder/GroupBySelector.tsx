/**
 * @module components/reports/builder/GroupBySelector
 * @enterprise ADR-268 Phase 2 — Group-by selection (Radix Select — ADR-001)
 *
 * Two-level group-by selector with % of Total toggle and expand/collapse controls.
 * Only categorical fields (enum, text, date, boolean) are available for grouping.
 */

'use client';

import '@/lib/design-system';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Layers, ChevronDown, ChevronUp, X } from 'lucide-react';
import type {
  DomainDefinition,
  FieldDefinition,
  GroupByConfig,
  FieldAggregation,
} from '@/config/report-builder/report-builder-types';
import { AGGREGATIONS_BY_TYPE } from '@/config/report-builder/report-builder-types';

// ============================================================================
// Types
// ============================================================================

interface GroupBySelectorProps {
  domainDefinition: DomainDefinition;
  columns: string[];
  groupByConfig: GroupByConfig | null;
  onConfigChange: (config: GroupByConfig | null) => void;
  showPercentOfTotal: boolean;
  onTogglePercentOfTotal: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasGroups: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

const GROUPABLE_TYPES = new Set(['enum', 'text', 'date', 'boolean']);

function getGroupableFields(fields: FieldDefinition[]): FieldDefinition[] {
  return fields.filter(f => GROUPABLE_TYPES.has(f.type));
}

function buildDefaultAggregations(
  columns: string[],
  fields: FieldDefinition[],
): FieldAggregation[] {
  const fieldMap = new Map(fields.map(f => [f.key, f]));
  const aggregations: FieldAggregation[] = [];

  for (const col of columns) {
    const field = fieldMap.get(col);
    if (!field) continue;
    const validFns = AGGREGATIONS_BY_TYPE[field.type];
    if (validFns.length <= 1) continue; // Only COUNT — skip

    if (field.type === 'currency') {
      aggregations.push({ fieldKey: col, function: 'SUM' });
    } else if (field.type === 'percentage') {
      aggregations.push({ fieldKey: col, function: 'AVG' });
    } else if (field.type === 'number') {
      aggregations.push({ fieldKey: col, function: 'SUM' });
    }
  }
  return aggregations;
}

// ============================================================================
// Component
// ============================================================================

export function GroupBySelector({
  domainDefinition,
  columns,
  groupByConfig,
  onConfigChange,
  showPercentOfTotal,
  onTogglePercentOfTotal,
  onExpandAll,
  onCollapseAll,
  hasGroups,
}: GroupBySelectorProps) {
  const { t } = useTranslation('report-builder');
  const groupableFields = getGroupableFields(domainDefinition.fields);

  const handleLevel1Change = (value: string) => {
    if (value === '__none__') {
      onConfigChange(null);
      return;
    }
    const aggregations = buildDefaultAggregations(columns, domainDefinition.fields);
    onConfigChange({
      level1: value,
      level2: groupByConfig?.level2 === value ? undefined : groupByConfig?.level2,
      aggregations,
    });
  };

  const handleLevel2Change = (value: string) => {
    if (!groupByConfig) return;
    if (value === '__none__') {
      onConfigChange({ ...groupByConfig, level2: undefined });
      return;
    }
    onConfigChange({ ...groupByConfig, level2: value });
  };

  const handleRemoveLevel2 = () => {
    if (!groupByConfig) return;
    onConfigChange({ ...groupByConfig, level2: undefined });
  };

  const level2Fields = groupableFields.filter(
    f => f.key !== groupByConfig?.level1,
  );

  return (
    <section
      className="rounded-lg border p-4 space-y-3 bg-card"
      aria-label={t('grouping.title')}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{t('grouping.title')}</h3>
        </div>
        {hasGroups && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onExpandAll}
              className="h-7 text-xs"
            >
              <ChevronDown className="mr-1 h-3 w-3" />
              {t('grouping.expandAll')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCollapseAll}
              className="h-7 text-xs"
            >
              <ChevronUp className="mr-1 h-3 w-3" />
              {t('grouping.collapseAll')}
            </Button>
          </div>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-3">
        {/* Level 1 */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">
            {t('grouping.level1')}
          </Label>
          <Select
            value={groupByConfig?.level1 ?? '__none__'}
            onValueChange={handleLevel1Change}
          >
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder={t('grouping.noGrouping')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('grouping.noGrouping')}</SelectItem>
              {groupableFields.map(field => (
                <SelectItem key={field.key} value={field.key}>
                  {t(`domains.${domainDefinition.id}.fields.${field.key}`, field.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Level 2 (only when level 1 is set) */}
        {groupByConfig?.level1 && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t('grouping.level2')}
            </Label>
            <div className="flex items-center gap-1">
              <Select
                value={groupByConfig.level2 ?? '__none__'}
                onValueChange={handleLevel2Change}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue placeholder={t('grouping.noGrouping')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('grouping.noGrouping')}</SelectItem>
                  {level2Fields.map(field => (
                    <SelectItem key={field.key} value={field.key}>
                      {t(`domains.${domainDefinition.id}.fields.${field.key}`, field.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {groupByConfig.level2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleRemoveLevel2}
                  aria-label={t('grouping.removeLevel2')}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* % of Total toggle */}
        {hasGroups && (
          <div className="flex items-center gap-2 pb-0.5">
            <Switch
              id="pct-toggle"
              checked={showPercentOfTotal}
              onCheckedChange={onTogglePercentOfTotal}
            />
            <Label htmlFor="pct-toggle" className="text-xs cursor-pointer">
              {t('percentOfTotal.toggle')}
            </Label>
          </div>
        )}
      </div>
    </section>
  );
}
