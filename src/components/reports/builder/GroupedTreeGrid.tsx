/**
 * @module components/reports/builder/GroupedTreeGrid
 * @enterprise ADR-268 Phase 2 — WAI-ARIA treegrid for grouped report results
 *
 * Renders grouped rows with expand/collapse, grand total sticky footer,
 * % of total column, sort by subtotal, keyboard navigation.
 * Extracted from ReportResults for Google SRP (<500 lines).
 */

'use client';

import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aggregateKey, UNKNOWN_GROUP_KEY } from '@/services/report-engine/grouping-engine';
import type { ReportColumnDef } from '@/components/reports/core/ReportTable';
import type {
  DomainDefinition,
  GroupedRow,
} from '@/config/report-builder/report-builder-types';

// ============================================================================
// Types
// ============================================================================

export interface GroupedTreeGridProps {
  groups: GroupedRow[];
  grandTotals: Record<string, number>;
  totalRowCount: number;
  columnDefs: ReportColumnDef<Record<string, unknown>>[];
  columns: string[];
  domainDefinition: DomainDefinition;
  expandedGroups: Set<string>;
  onToggleGroup?: (groupKey: string) => void;
  percentOfTotal?: Map<string, number> | null;
  groupSortKey?: string | null;
  groupSortDirection?: 'asc' | 'desc';
  onGroupSort?: (key: string, direction: 'asc' | 'desc') => void;
  loading: boolean;
}

// ============================================================================
// Helpers
// ============================================================================

function getNestedVal(obj: Record<string, unknown>, dotPath: string): unknown {
  const parts = dotPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 1 }).format(value);
}

function formatAggKeyLabel(key: string): string {
  const [fn, ...rest] = key.split(':');
  const field = rest.join(':');
  const shortField = field.includes('.') ? field.split('.').pop() : field;
  return `${fn} ${shortField}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function GroupedTreeGrid({
  groups,
  grandTotals,
  totalRowCount,
  columnDefs,
  domainDefinition,
  expandedGroups,
  onToggleGroup,
  percentOfTotal,
  groupSortKey,
  groupSortDirection = 'desc',
  onGroupSort,
}: GroupedTreeGridProps) {
  const { t } = useTranslation('report-builder');
  const tableRef = useRef<HTMLTableElement>(null);

  const aggKeys = useMemo(() => {
    if (groups.length === 0) return [];
    return Object.keys(groups[0].aggregates).filter(k => k !== aggregateKey('COUNT', '*'));
  }, [groups]);

  const handleHeaderSort = (key: string) => {
    if (!onGroupSort) return;
    const nextDir = groupSortKey === key && groupSortDirection === 'desc' ? 'asc' : 'desc';
    onGroupSort(key, nextDir);
  };

  const handleKeyDown = (e: React.KeyboardEvent, groupKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onToggleGroup?.(groupKey);
    }
  };

  return (
    <div className="rounded-md border overflow-auto">
      <table
        ref={tableRef}
        role="treegrid"
        aria-label={t('results.title')}
        className="w-full text-sm"
      >
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium w-8" />
            <th className="px-3 py-2 text-left font-medium">
              {t(`domains.${domainDefinition.id}.fields.${groups[0]?.groupField}`, groups[0]?.groupField ?? 'Group')}
            </th>
            <th className="px-3 py-2 text-right font-medium">
              {t('aggregations.count')}
            </th>
            {percentOfTotal && (
              <th className="px-3 py-2 text-right font-medium">
                {t('percentOfTotal.label')}
              </th>
            )}
            {aggKeys.map(key => (
              <th key={key} className="px-3 py-2 text-right font-medium">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => handleHeaderSort(key)}
                  aria-label={t('accessibility.sortBySubtotal', { column: key })}
                >
                  {formatAggKeyLabel(key)}
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map(group => (
            <GroupRow
              key={group.groupKey}
              group={group}
              expanded={expandedGroups.has(group.groupKey)}
              onToggle={() => onToggleGroup?.(group.groupKey)}
              onKeyDown={handleKeyDown}
              aggKeys={aggKeys}
              percentOfTotal={percentOfTotal}
              columnDefs={columnDefs}
            />
          ))}
        </tbody>
        {/* Grand Total sticky footer */}
        <tfoot>
          <tr className="sticky bottom-0 border-t-2 bg-muted font-bold">
            <td className="px-3 py-2" />
            <td className="px-3 py-2">{t('grandTotal.label')}</td>
            <td className="px-3 py-2 text-right">{totalRowCount}</td>
            {percentOfTotal && (
              <td className="px-3 py-2 text-right">100%</td>
            )}
            {aggKeys.map(key => (
              <td key={key} className="px-3 py-2 text-right">
                {formatNumber(grandTotals[key] ?? 0)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ============================================================================
// Group Row (with expand/collapse)
// ============================================================================

function GroupRow({
  group,
  expanded,
  onToggle,
  onKeyDown,
  aggKeys,
  percentOfTotal,
  columnDefs,
}: {
  group: GroupedRow;
  expanded: boolean;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent, key: string) => void;
  aggKeys: string[];
  percentOfTotal?: Map<string, number> | null;
  columnDefs: ReportColumnDef<Record<string, unknown>>[];
}) {
  const { t } = useTranslation('report-builder');
  const isL1WithSubGroups = group.depth === 0 && group.children.length > 0 && 'groupKey' in group.children[0];
  const ChevronIcon = expanded ? ChevronDown : ChevronRight;
  const pct = percentOfTotal?.get(group.groupKey);

  return (
    <>
      {/* Group header row */}
      <tr
        role="row"
        aria-expanded={expanded}
        aria-level={group.depth + 1}
        className={cn(
          'border-b cursor-pointer hover:bg-muted/50 motion-safe:transition-colors motion-safe:duration-200',
          group.depth === 0 ? 'font-semibold bg-muted/30' : 'bg-muted/15',
        )}
        onClick={onToggle}
        onKeyDown={(e) => onKeyDown(e, group.groupKey)}
        tabIndex={0}
        aria-label={expanded
          ? t('accessibility.collapseGroup', { group: group.groupKey })
          : t('accessibility.expandGroup', { group: group.groupKey })
        }
      >
        <td className="px-3 py-2 w-8" style={{ paddingLeft: `${12 + group.depth * 16}px` }}>
          <ChevronIcon className="h-4 w-4" />
        </td>
        <td className="px-3 py-2">
          {group.groupKey === UNKNOWN_GROUP_KEY ? t('grouping.noGrouping') : group.groupKey}
        </td>
        <td className="px-3 py-2 text-right">{group.rowCount}</td>
        {percentOfTotal && (
          <td className="px-3 py-2 text-right text-muted-foreground">
            {pct !== undefined ? `${pct.toFixed(1)}%` : ''}
          </td>
        )}
        {aggKeys.map(key => (
          <td key={key} className="px-3 py-2 text-right">
            {formatNumber(group.aggregates[key] ?? 0)}
          </td>
        ))}
      </tr>

      {/* Expanded children */}
      {expanded && (
        isL1WithSubGroups
          ? (group.children as GroupedRow[]).map(child => (
              <GroupRow
                key={child.groupKey}
                group={child}
                expanded={false}
                onToggle={() => {}}
                onKeyDown={() => {}}
                aggKeys={aggKeys}
                percentOfTotal={null}
                columnDefs={columnDefs}
              />
            ))
          : (group.children as Record<string, unknown>[]).map((row, idx) => (
              <tr
                key={String(row['id'] ?? idx)}
                role="row"
                aria-level={group.depth + 2}
                className="border-b text-muted-foreground motion-safe:transition-colors motion-safe:duration-200"
              >
                <td className="px-3 py-1.5" />
                {columnDefs.slice(0, 1).map(col => (
                  <td key={col.key} className="px-3 py-1.5">
                    {col.render ? col.render(getNestedVal(row, col.key), row) : String(getNestedVal(row, col.key) ?? '')}
                  </td>
                ))}
                <td className="px-3 py-1.5" />
                {percentOfTotal && <td className="px-3 py-1.5" />}
                {aggKeys.map(key => (
                  <td key={key} className="px-3 py-1.5" />
                ))}
              </tr>
            ))
      )}
    </>
  );
}
