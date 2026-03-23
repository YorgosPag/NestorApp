'use client';

/**
 * ============================================================================
 * ADR-235: Ownership Table Tab — Πίνακας Χιλιοστών Συνιδιοκτησίας
 * ============================================================================
 *
 * Tab component for project detail view.
 * Displays ownership percentage table with CRUD, auto-calculate, finalize/unlock.
 *
 * Uses: Table (ui), Select (Radix/ADR-001), Badge, Button, Input
 * Pattern: ProjectLocationsTab (inline editing)
 *
 * @module components/projects/tabs/OwnershipTableTab
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { matchesSearchTerm } from '@/lib/search/search';
import { getErrorMessage } from '@/lib/error-utils';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useAuth } from '@/hooks/useAuth';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InfoLabel } from '@/components/sales/payments/financial-intelligence/InfoLabel';
import { FullscreenOverlay, FullscreenToggleButton } from '@/core/containers/FullscreenOverlay';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import type { Project } from '@/types/project';
import type {
  CalculationMethod,
  OwnerParty,
  MutableOwnershipTableRow,
} from '@/types/ownership-table';
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import { useOwnershipTable } from '@/hooks/ownership/useOwnershipTable';
import { getBuildingIdsByProject, validateBuildingData } from '@/services/ownership/ownership-table-service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calculator,
  Lock,
  Unlock,
  RefreshCw,
  Save,
  Plus,
  AlertTriangle,
  CheckCircle,
  FileText,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { SortDirection } from '@/components/building-management/shared/types';

// ============================================================================
// TYPES
// ============================================================================

/** Column definition for the ownership table — config-driven rendering */
interface OwnershipColumnDef {
  readonly key: string;
  readonly labelKey: string;
  readonly width?: string;
  readonly alignRight?: boolean;
  readonly filterable?: boolean;
  readonly sortValue?: (row: MutableOwnershipTableRow) => string | number;
  readonly whitespace?: boolean;
}

interface OwnershipTableTabProps {
  data: Project;
  projectId?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/** Status badge — colors via COLOR_BRIDGE (semantic, theme-aware) */
function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variants: Record<string, string> = {
    draft: cn(COLOR_BRIDGE.bg.warningSubtle, COLOR_BRIDGE.text.warning),
    finalized: cn(COLOR_BRIDGE.bg.successSubtle, COLOR_BRIDGE.text.success),
    registered: cn(COLOR_BRIDGE.bg.infoSubtle, COLOR_BRIDGE.text.info),
  };
  const labels: Record<string, string> = {
    draft: t('common:ownership.statusDraft'),
    finalized: t('common:ownership.statusFinalized'),
    registered: t('common:ownership.statusRegistered'),
  };

  return (
    <Badge className={cn('text-xs font-medium', variants[status] ?? variants.draft)}>
      {labels[status] ?? status}
    </Badge>
  );
}

/** Validation indicator — colors via COLOR_BRIDGE */
function ValidationIndicator({
  total,
  valid,
  t,
}: {
  total: number;
  valid: boolean;
  t: (key: string) => string;
}) {
  if (valid) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-sm', COLOR_BRIDGE.text.success)}>
        <CheckCircle className="h-4 w-4" />
        {t('common:ownership.validation.totalCorrect')}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', COLOR_BRIDGE.text.error)}>
      <AlertTriangle className="h-4 w-4" />
      {total}‰ / {TOTAL_SHARES_TARGET}‰ ({total - TOTAL_SHARES_TARGET > 0 ? '+' : ''}
      {total - TOTAL_SHARES_TARGET})
    </span>
  );
}

/** Owner party label */
function ownerLabel(party: OwnerParty, t: (key: string) => string): string {
  const map: Record<OwnerParty, string> = {
    contractor: t('common:ownership.ownerContractor'),
    landowner: t('common:ownership.ownerLandowner'),
    buyer: t('common:ownership.ownerBuyer'),
    unassigned: t('common:ownership.ownerUnassigned'),
  };
  return map[party] ?? party;
}

/** Category label */
function categoryLabel(cat: string, t: (key: string) => string, participates?: boolean): string {
  if (cat === 'air_rights') return t('common:ownership.categoryAirRights');
  if (participates === false) return t('common:ownership.categoryInformational');
  return cat === 'main'
    ? t('common:ownership.categoryMain')
    : t('common:ownership.categoryAuxiliary');
}

// ============================================================================
// COLUMN CONFIG — SSoT for headers, filters, sorting
// ============================================================================

/** Ownership table column definitions. ALL headers, filters, sort derive from this. */
function buildColumns(t: (key: string) => string): OwnershipColumnDef[] {
  return [
    { key: 'ordinal', labelKey: 'common:ownership.columns.ordinal', width: 'w-10', whitespace: true },
    { key: 'code', labelKey: 'common:ownership.columns.entityCode', width: 'w-32', whitespace: true, filterable: true, sortValue: r => r.entityCode },
    { key: 'description', labelKey: 'common:ownership.columns.description', whitespace: true, filterable: true, sortValue: r => r.description },
    { key: 'category', labelKey: 'common:ownership.columns.category', width: 'w-16', whitespace: true, filterable: true, sortValue: r => r.category },
    { key: 'floor', labelKey: 'common:ownership.columns.floor', width: 'w-14', whitespace: true, filterable: true, sortValue: r => r.floor },
    { key: 'netArea', labelKey: 'common:ownership.columns.areaNet', width: 'w-28', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.areaNetSqm },
    { key: 'grossArea', labelKey: 'common:ownership.columns.areaGross', width: 'w-20', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.areaSqm },
    { key: 'shares', labelKey: 'common:ownership.columns.millesimalShares', width: 'w-28', whitespace: true, alignRight: true, filterable: true, sortValue: r => r.millesimalShares },
    { key: 'allocation', labelKey: 'common:ownership.columns.allocation', width: 'w-32', whitespace: true, filterable: true, sortValue: r => r.ownerParty },
    { key: 'buyer', labelKey: 'common:ownership.columns.ownerParty', whitespace: true, filterable: true, sortValue: r => r.buyerName ?? '' },
    { key: 'preliminary', labelKey: 'common:ownership.columns.preliminary', width: 'w-28', whitespace: true, filterable: true, sortValue: r => r.preliminaryContract ?? '' },
    { key: 'final', labelKey: 'common:ownership.columns.final', width: 'w-28', whitespace: true, filterable: true, sortValue: r => r.finalContract ?? '' },
  ];
}

/** Row background color based on category/state — via COLOR_BRIDGE */
function getRowClassName(row: MutableOwnershipTableRow): string {
  if (row.category === 'air_rights') return COLOR_BRIDGE.bg.purple;
  if (row.isManualOverride) return COLOR_BRIDGE.bg.warningLight;
  if (row.participatesInCalculation === false) return COLOR_BRIDGE.bg.infoSubtle;
  return '';
}

/** Category badge color — via COLOR_BRIDGE */
function getCategoryBadgeClass(row: MutableOwnershipTableRow): string {
  if (row.category === 'air_rights') return cn(COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info);
  if (row.participatesInCalculation === false) return cn(COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info);
  return '';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OwnershipTableTab({ data, projectId }: OwnershipTableTabProps) {
  const resolvedProjectId = projectId ?? data.id;
  const { t } = useTranslation();
  const { success: showSuccess, error: showError } = useNotifications();
  const { user } = useAuth();
  const router = useRouter();
  const fullscreen = useFullscreen();
  const spacingTokens = useSpacingTokens();
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const borders = useBorderTokens();
  const { confirm, dialogProps } = useConfirmDialog();

  // Building IDs — fetch from Firestore (buildings where projectId matches)
  const [buildingIds, setBuildingIds] = useState<string[]>([]);

  useEffect(() => {
    getBuildingIdsByProject(resolvedProjectId)
      .then(setBuildingIds)
      .catch(() => { /* Silent — ownership table will just show empty */ });
  }, [resolvedProjectId]);

  // Unlock dialog state
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  // Tree children accordion state — expanded unit IDs
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpand = useCallback((entityId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId);
      else next.add(entityId);
      return next;
    });
  }, []);

  const {
    table,
    loading,
    saving,
    isDirty,
    error,
    validation,
    revisions,
    isLocked,
    orphanedBuildingIds,
    autoPopulate,
    calculate,
    updateRow,
    addAirRightsRow,
    updateLinkedSpace,
    removeRow,
    updateTableField,
    save,
    finalize,
    unlock,
    deleteDraft,
    reload,
  } = useOwnershipTable(resolvedProjectId, buildingIds);

  // --- Group rows by building ---
  const groupedRows = useMemo(() => {
    if (!table?.rows.length) return new Map<string, MutableOwnershipTableRow[]>();

    const groups = new Map<string, MutableOwnershipTableRow[]>();
    for (const row of table.rows) {
      const key = row.buildingId;
      const group = groups.get(key);
      if (group) {
        group.push(row);
      } else {
        groups.set(key, [row]);
      }
    }
    return groups;
  }, [table?.rows]);

  // --- Column config (SSoT for headers, filters, sorting) ---
  const columns = useMemo(() => buildColumns(t), [t]);

  // --- Per-column search filters (config-driven, reuses centralized matchesSearchTerm) ---
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const updateColumnFilter = useCallback((col: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [col]: value }));
  }, []);

  const hasActiveFilters = Object.values(columnFilters).some(v => v.trim() !== '');

  const filteredGroupedRows = useMemo(() => {
    if (!hasActiveFilters) return groupedRows;

    const filtered = new Map<string, MutableOwnershipTableRow[]>();
    for (const [buildingId, rows] of groupedRows) {
      const matchingRows = rows.filter(row => {
        for (const col of columns) {
          const filterValue = columnFilters[col.key];
          if (!filterValue || !col.filterable || !col.sortValue) continue;
          if (!matchesSearchTerm([String(col.sortValue(row))], filterValue)) return false;
        }
        return true;
      });
      if (matchingRows.length > 0) {
        filtered.set(buildingId, matchingRows);
      }
    }
    return filtered;
  }, [groupedRows, columnFilters, hasActiveFilters, columns]);

  // --- Column sorting (config-driven, same pattern as BuildingSpaceTable) ---
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const toggleSort = useCallback((col: string) => {
    setSortColumn(prev => {
      if (prev === col) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
        return col;
      }
      setSortDirection('asc');
      return col;
    });
  }, []);

  const sortedGroupedRows = useMemo(() => {
    if (!sortColumn) return filteredGroupedRows;

    const colDef = columns.find(c => c.key === sortColumn);
    if (!colDef?.sortValue) return filteredGroupedRows;

    const extractor = colDef.sortValue;
    const sorted = new Map<string, MutableOwnershipTableRow[]>();

    for (const [buildingId, rows] of filteredGroupedRows) {
      const sortedRows = [...rows].sort((a, b) => {
        const av = extractor(a);
        const bv = extractor(b);
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortDirection === 'asc' ? av - bv : bv - av;
        }
        const cmp = String(av).localeCompare(String(bv), 'el');
        return sortDirection === 'asc' ? cmp : -cmp;
      });
      sorted.set(buildingId, sortedRows);
    }
    return sorted;
  }, [filteredGroupedRows, sortColumn, sortDirection, columns]);

  // --- Handlers ---
  const handleAutoPopulate = useCallback(async () => {
    if (buildingIds.length === 0) {
      showError(t('common:ownership.messages.noBuildings'));
      return;
    }

    try {
      const validation = await validateBuildingData(buildingIds);
      const issues: string[] = [];

      if (validation.totalFloors === 0) issues.push(t('common:ownership.messages.noFloors'));
      if (validation.totalUnits === 0) issues.push(t('common:ownership.messages.noUnits'));
      if (validation.unitsWithoutArea > 0) issues.push(t('common:ownership.messages.unitsWithoutArea', { count: validation.unitsWithoutArea }));
      if (validation.unitsWithoutFloor > 0) issues.push(t('common:ownership.messages.unitsWithoutFloor', { count: validation.unitsWithoutFloor }));

      if (validation.totalUnits === 0) {
        showError(issues.join('\n'));
        return;
      }

      const rowCount = await autoPopulate();

      if (issues.length > 0) {
        showError(`${t('common:ownership.messages.populateWithWarnings', { count: rowCount })}\n${issues.join('\n')}`);
      } else {
        showSuccess(t('common:ownership.messages.populateSuccess', { count: rowCount }));
      }
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.dataCheckError')));
    }
  }, [autoPopulate, buildingIds, showSuccess, showError, t]);

  const handleCalculate = useCallback(() => {
    const rows = table?.rows ?? [];

    // Check: air rights without millesimal shares
    const emptyAirRights = rows.filter(
      r => r.category === 'air_rights' && r.millesimalShares === 0,
    );
    if (emptyAirRights.length > 0) {
      showError(t('common:ownership.messages.airRightsNoShares', { count: emptyAirRights.length }));
      return;
    }

    // Check: participating rows (units/storage) without area — blocks calculation
    const noAreaRows = rows.filter(
      r => r.participatesInCalculation && !r.isManualOverride && r.areaSqm <= 0,
    );
    if (noAreaRows.length > 0) {
      const codes = noAreaRows.map(r => r.entityCode).join(', ');
      showError(t('common:ownership.messages.noAreaRows', { count: noAreaRows.length, codes }));
      return;
    }

    // Warning: linked parking/storage without area — informational only
    const warnings: string[] = [];
    for (const row of rows) {
      if (!row.linkedSpacesSummary) continue;
      for (const ls of row.linkedSpacesSummary) {
        if (ls.areaNetSqm <= 0) {
          warnings.push(`${ls.entityCode} (${ls.spaceType === 'parking' ? t('common:ownership.categoryInformational') : t('common:ownership.categoryAuxiliary')})`);
        }
      }
    }

    calculate();

    // Record calculation method + timestamp in notes
    const methodLabels: Record<string, string> = {
      area: t('common:ownership.methodArea'),
      value: t('common:ownership.methodValue'),
      volume: t('common:ownership.methodVolume'),
    };
    const methodName = methodLabels[table?.calculationMethod ?? 'area'] ?? table?.calculationMethod;
    const timestamp = new Date().toLocaleString('el-GR');
    const note = `${t('common:ownership.messages.calculationNote', { method: methodName, date: timestamp })}`;
    updateTableField('notes', note);

    if (warnings.length > 0) {
      showSuccess(`${t('common:ownership.actions.calculate')} — ${t('common:ownership.messages.spacesNoArea', { count: warnings.length, codes: warnings.join(', ') })}`);
    } else {
      showSuccess(t('common:ownership.actions.calculate'));
    }
  }, [calculate, table, showSuccess, showError, updateTableField, t]);

  const handleSave = useCallback(async () => {
    await save();
    showSuccess(t('common:buttons.save'));
  }, [save, showSuccess, t]);

  const handleFinalize = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await finalize(user.uid);
      showSuccess(t('common:ownership.actions.finalize'));
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.deleteError')));
    }
  }, [finalize, user, showSuccess, showError, t]);

  const handleUnlock = useCallback(async () => {
    if (!unlockReason.trim() || !user?.uid) return;
    try {
      await unlock(user.uid, unlockReason);
      showSuccess(t('common:ownership.actions.unlock'));
      setShowUnlockInput(false);
      setUnlockReason('');
    } catch (err) {
      showError(getErrorMessage(err));
    }
  }, [unlock, unlockReason, user, showSuccess, showError, t]);

  const handleDeleteDraft = useCallback(async () => {
    const ok = await confirm({
      title: t('common:ownership.actions.deleteTable'),
      description: t('common:ownership.messages.orphanedAdvice'),
      variant: 'destructive',
      confirmText: t('common:ownership.actions.confirmDelete'),
    });
    if (!ok) return;
    try {
      await deleteDraft();
      showSuccess(t('common:ownership.messages.tableDeleted'));
    } catch (err) {
      showError(getErrorMessage(err, t('common:ownership.messages.deleteError')));
    }
  }, [deleteDraft, confirm, showSuccess, showError, t]);

  const handleMethodChange = useCallback((method: string) => {
    updateTableField('calculationMethod', method);
    calculate(method as CalculationMethod);
  }, [updateTableField, calculate]);

  // --- Loading state ---
  if (loading && !table) {
    return (
      <section className={cn('flex items-center justify-center', spacingTokens.padding.xl)}>
        <RefreshCw className={cn(iconSizes.lg, 'animate-spin text-muted-foreground')} />
      </section>
    );
  }

  // --- Error state ---
  if (error && !table) {
    return (
      <section className={spacingTokens.padding.lg}>
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={reload} className={spacingTokens.margin.top.sm}>
          {t('common:buttons.refresh')}
        </Button>
      </section>
    );
  }

  if (!table) return null;

  const totalShares = table.rows
    .filter(r => r.participatesInCalculation !== false)
    .reduce((sum, r) => {
      let rowTotal = r.millesimalShares;
      if (r.linkedSpacesSummary) {
        for (const ls of r.linkedSpacesSummary) {
          if (ls.hasOwnShares) rowTotal += ls.millesimalShares;
        }
      }
      return sum + rowTotal;
    }, 0);

  return (
    <>
    <FullscreenOverlay
      isFullscreen={fullscreen.isFullscreen}
      onToggle={fullscreen.toggle}
      ariaLabel={t('common:ownership.title')}
      className={spacingTokens.spaceBetween.sm}
      fullscreenClassName={cn(spacingTokens.spaceBetween.sm, spacingTokens.padding.sm, 'overflow-auto')}
    >
      {/* ============================================================ */}
      {/* HEADER: Method, Zone Price, Status */}
      {/* ============================================================ */}
      <header className={cn('flex flex-wrap items-center', spacingTokens.gap.sm)}>
        <h2 className={typography.heading.md}>
          {t('common:ownership.title')}
        </h2>
        <StatusBadge status={table.status} t={t} />
        {table.version > 1 && (
          <span className={typography.special.tertiary}>
            {t('common:ownership.version')} {table.version}
          </span>
        )}
        <FullscreenToggleButton
          isFullscreen={fullscreen.isFullscreen}
          onToggle={fullscreen.toggle}
        />
      </header>

      {/* ============================================================ */}
      {/* ORPHANED BUILDINGS WARNING */}
      {/* ============================================================ */}
      {orphanedBuildingIds.length > 0 && table.rows.length > 0 && (
        <section className={cn('flex items-start rounded-lg border', spacingTokens.gap.sm, spacingTokens.padding.md, COLOR_BRIDGE.border.warning, COLOR_BRIDGE.bg.warningSubtle)}>
          <AlertTriangle className={cn('mt-0.5 shrink-0', iconSizes.md, COLOR_BRIDGE.text.warning)} />
          <article className={cn('flex-1', spacingTokens.spaceBetween.sm)}>
            <p className={cn('text-sm font-medium', COLOR_BRIDGE.text.warning)}>
              {t('common:ownership.messages.orphanedTitle')}
            </p>
            <p className={cn('text-sm', COLOR_BRIDGE.text.warning)}>
              {orphanedBuildingIds.length === 1
                ? t('common:ownership.messages.orphanedSingle')
                : t('common:ownership.messages.orphanedMultiple', { count: orphanedBuildingIds.length })}
              {' '}{t('common:ownership.messages.orphanedAdvice')}
            </p>
            {!isLocked && (
              <nav className={cn('flex', spacingTokens.gap.sm)}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoPopulate}
                  disabled={loading || buildingIds.length === 0}
                >
                  <RefreshCw className={cn('mr-1', iconSizes.xs)} />
                  {t('common:ownership.actions.refreshTable')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteDraft}
                  className={cn(COLOR_BRIDGE.border.error, COLOR_BRIDGE.text.error)}
                >
                  <Trash2 className={cn('mr-1', iconSizes.xs)} />
                  {t('common:ownership.actions.deleteTable')}
                </Button>
              </nav>
            )}
          </article>
        </section>
      )}

      {/* ============================================================ */}
      {/* CONTROLS: Method selector + Zone price + ΣΕ */}
      {/* ============================================================ */}
      <section className={cn('grid grid-cols-1 sm:grid-cols-3', spacingTokens.gap.sm)}>
        {/* Method selector */}
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel
            htmlFor="ownership-method"
            label={t('common:ownership.method')}
            tooltip={t('common:ownership.tooltips.method')}
            className={typography.label.sm}
          />
          <Select
            value={table.calculationMethod}
            onValueChange={handleMethodChange}
            disabled={isLocked}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="area">{t('common:ownership.methodArea')}</SelectItem>
              <SelectItem value="value">{t('common:ownership.methodValue')}</SelectItem>
              <SelectItem value="volume">{t('common:ownership.methodVolume')}</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>

        {/* Zone price */}
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel
            htmlFor="ownership-zone-price"
            label={t('common:ownership.zonePrice')}
            tooltip={t('common:ownership.tooltips.zonePrice')}
            className={typography.label.sm}
          />
          <Input
            type="number"
            min={0}
            step={0.01}
            value={table.zonePrice || ''}
            onChange={e => updateTableField('zonePrice', parseFloat(e.target.value) || 0)}
            disabled={isLocked}
          />
        </fieldset>

        {/* Commerciality coefficient */}
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel
            htmlFor="ownership-commerciality"
            label={t('common:ownership.commercialityCoefficient')}
            tooltip={t('common:ownership.tooltips.commerciality')}
            className={typography.label.sm}
          />
          <Input
            type="number"
            min={0}
            step={0.1}
            value={table.commercialityCoefficient || ''}
            onChange={e =>
              updateTableField('commercialityCoefficient', parseFloat(e.target.value) || 1.0)
            }
            disabled={isLocked}
          />
        </fieldset>
      </section>

      {/* ============================================================ */}
      {/* ACTION BAR */}
      {/* ============================================================ */}
      <nav className={cn('flex flex-wrap items-center', spacingTokens.gap.sm)}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoPopulate}
          disabled={isLocked || loading}
        >
          <RefreshCw className={cn('mr-1', iconSizes.sm)} />
          {t('common:ownership.actions.autoPopulate')}
        </Button>
        {table.rows.some(r => r.linkedSpacesSummary && r.linkedSpacesSummary.length > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const allWithChildren = table.rows
                .filter(r => r.linkedSpacesSummary && r.linkedSpacesSummary.length > 0)
                .map(r => r.entityRef.id);
              const allExpanded = allWithChildren.every(id => expandedRows.has(id));
              setExpandedRows(allExpanded ? new Set() : new Set(allWithChildren));
            }}
          >
            {expandedRows.size > 0
              ? <ChevronDown className={iconSizes.sm} />
              : <ChevronRight className={iconSizes.sm} />
            }
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCalculate}
          disabled={isLocked || table.rows.length === 0}
        >
          <Calculator className={cn('mr-1', iconSizes.sm)} />
          {t('common:ownership.actions.calculate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={addAirRightsRow}
          disabled={isLocked}
        >
          <Plus className={cn('mr-1', iconSizes.sm)} />
          {t('common:ownership.actions.addAirRights')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isLocked || saving || !isDirty}
        >
          <Save className={cn('mr-1', iconSizes.sm)} />
          {t('common:buttons.save')}
        </Button>

        <span className="flex-1" />

        {/* Validation */}
        {table.rows.length > 0 && (
          <ValidationIndicator
            total={totalShares}
            valid={validation?.valid ?? false}
            t={t}
          />
        )}

        {/* Finalize / Unlock */}
        {!isLocked && table.rows.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={handleFinalize}
            disabled={saving || !(validation?.valid)}
          >
            <Lock className={cn('mr-1', iconSizes.sm)} />
            {t('common:ownership.actions.finalize')}
          </Button>
        )}
        {isLocked && !showUnlockInput && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUnlockInput(true)}
          >
            <Unlock className={cn('mr-1', iconSizes.sm)} />
            {t('common:ownership.actions.unlock')}
          </Button>
        )}

        {/* Delete draft — uses centralized ConfirmDialog */}
        {!isLocked && table.rows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteDraft}
            className={cn(COLOR_BRIDGE.border.error, COLOR_BRIDGE.text.error)}
          >
            <Trash2 className={cn('mr-1', iconSizes.sm)} />
            {t('common:buttons.delete')}
          </Button>
        )}
      </nav>

      {/* Unlock reason input */}
      {showUnlockInput && (
        <section className={cn('flex items-center', spacingTokens.gap.sm)}>
          <Input
            placeholder={t('common:ownership.unlockReason')}
            value={unlockReason}
            onChange={e => setUnlockReason(e.target.value)}
            className="max-w-sm"
          />
          <Button size="sm" onClick={handleUnlock} disabled={!unlockReason.trim()}>
            {t('common:ownership.actions.unlock')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setShowUnlockInput(false); setUnlockReason(''); }}
          >
            {t('common:buttons.cancel')}
          </Button>
        </section>
      )}

      {/* ============================================================ */}
      {/* TABLE */}
      {/* ============================================================ */}
      {table.rows.length === 0 ? (
        <section className={cn(borders.quick.dashed, 'text-center text-muted-foreground', spacingTokens.padding.xl)}>
          <FileText className={cn('mx-auto mb-2', iconSizes.xl)} />
          <p>{t('common:ownership.empty')}</p>
        </section>
      ) : (
        <section className="max-h-[calc(100vh-280px)] overflow-auto rounded-lg border">
        <Table size="compact">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {/* Headers — config-driven from columns array */}
            <TableRow>
              {columns.map(col => {
                const isSortable = !!col.sortValue;
                const isActive = sortColumn === col.key;
                return (
                  <TableHead
                    key={col.key}
                    className={cn(
                      col.width,
                      col.whitespace && 'whitespace-nowrap',
                      col.alignRight && 'text-right',
                      isSortable && 'cursor-pointer select-none hover:text-foreground',
                    )}
                    onClick={isSortable ? () => toggleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {t(col.labelKey)}
                      {isSortable && (
                        isActive
                          ? sortDirection === 'asc'
                            ? <ArrowUp className={cn(iconSizes.xs, 'text-foreground')} />
                            : <ArrowDown className={cn(iconSizes.xs, 'text-foreground')} />
                          : <ArrowUpDown className={cn(iconSizes.xs, 'text-muted-foreground/50')} />
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
            {/* Filters — config-driven from columns array */}
            <TableRow className="bg-background">
              {columns.map(col => (
                <TableHead key={`filter-${col.key}`}>
                  {col.filterable ? (
                    <Input
                      placeholder="🔍"
                      value={columnFilters[col.key] ?? ''}
                      onChange={e => updateColumnFilter(col.key, e.target.value)}
                      className={typography.body.xs}
                    />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {Array.from(sortedGroupedRows.entries()).map(([buildingId, rows]) => {
              const buildingName = rows[0]?.buildingName ?? buildingId;
              const subtotal = rows.reduce((sum, r) => sum + r.millesimalShares, 0);

              return (
                <React.Fragment key={buildingId}>
                  {/* Building group header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={12} className={typography.heading.sm}>
                      {buildingName}
                    </TableCell>
                  </TableRow>

                  {/* Rows */}
                  {rows.map((row, visibleIdx) => {
                    const globalIndex = table.rows.findIndex(
                      r => r.entityRef.id === row.entityRef.id,
                    );
                    const isNonParticipating = row.participatesInCalculation === false;
                    const isAirRights = row.category === 'air_rights';
                    const hasChildren = row.linkedSpacesSummary && row.linkedSpacesSummary.length > 0;
                    const isExpanded = expandedRows.has(row.entityRef.id);

                    return (
                      <React.Fragment key={row.entityRef.id}>
                      <TableRow className={getRowClassName(row)}>
                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center">
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleRowExpand(row.entityRef.id)}
                                className="mr-0.5 text-muted-foreground hover:text-foreground"
                              >
                                {isExpanded
                                  ? <ChevronDown className={iconSizes.xs} />
                                  : <ChevronRight className={iconSizes.xs} />
                                }
                              </button>
                            ) : (
                              <span className={cn('mr-0.5 inline-block', iconSizes.xs)} />
                            )}
                            {visibleIdx + 1}
                          </span>
                        </TableCell>
                        <TableCell className={typography.special.codeId}>
                          {row.entityRef.collection === 'units' && (
                            <NAVIGATION_ENTITIES.unit.icon className={cn('inline mr-1', iconSizes.xs, NAVIGATION_ENTITIES.unit.color)} />
                          )}
                          {row.entityRef.collection === 'units' ? (
                            <button
                              type="button"
                              className="hover:underline cursor-pointer"
                              onClick={() => router.push(`/spaces/apartments?unitId=${row.entityRef.id}`)}
                            >
                              {row.entityCode}
                            </button>
                          ) : (
                            row.entityCode
                          )}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', getCategoryBadgeClass(row))}>
                            {categoryLabel(row.category, t, row.participatesInCalculation)}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.floor}</TableCell>
                        <TableCell className={cn('text-right', typography.special.codeId)}>
                          {row.areaNetSqm > 0 ? row.areaNetSqm.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className={cn('text-right', typography.special.codeId)}>
                          {row.areaSqm > 0 ? row.areaSqm.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {isNonParticipating ? (
                            <span className={cn(typography.special.codeId, 'text-muted-foreground')}>—</span>
                          ) : isLocked ? (
                            <span className={cn(typography.special.codeId, 'font-semibold')}>{row.millesimalShares}‰</span>
                          ) : (
                            <Input
                              type="number"
                              min={1}
                              value={row.millesimalShares || ''}
                              onChange={e =>
                                updateRow(
                                  globalIndex,
                                  'millesimalShares',
                                  parseInt(e.target.value, 10) || 0,
                                )
                              }
                              className="w-20 text-right font-mono text-xs"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          {isLocked ? (
                            ownerLabel(row.ownerParty, t)
                          ) : (
                            <Select
                              value={row.ownerParty}
                              onValueChange={val =>
                                updateRow(globalIndex, 'ownerParty', val as OwnerParty)
                              }
                            >
                              <SelectTrigger className={typography.body.xs}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contractor">{t('common:ownership.ownerContractor')}</SelectItem>
                                <SelectItem value="landowner">{t('common:ownership.ownerLandowner')}</SelectItem>
                                <SelectItem value="buyer">{t('common:ownership.ownerBuyer')}</SelectItem>
                                <SelectItem value="unassigned">{t('common:ownership.ownerUnassigned')}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className={typography.special.tertiary}>
                          {row.buyerName ?? '—'}
                        </TableCell>
                        <TableCell className={typography.special.codeId}>
                          {row.preliminaryContract ?? '—'}
                        </TableCell>
                        <TableCell className={typography.special.codeId}>
                          {isAirRights && !isLocked ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRow(globalIndex)}
                              className={cn('h-6 w-6 p-0', COLOR_BRIDGE.text.error, COLOR_BRIDGE.bg.dangerHover)}
                            >
                              <Trash2 className={iconSizes.xs} />
                            </Button>
                          ) : (
                            row.finalContract ?? '—'
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Linked spaces as tree-branch child rows (accordion) */}
                      {isExpanded && row.linkedSpacesSummary && row.linkedSpacesSummary.length > 0 &&
                        row.linkedSpacesSummary.map((ls, idx) => {
                          const isLast = idx === (row.linkedSpacesSummary?.length ?? 0) - 1;

                          return (
                            <TableRow
                              key={`${row.entityRef.id}-ls-${idx}`}
                              className="bg-muted/20 dark:bg-muted/10"
                            >
                              <TableCell className="pl-5 text-muted-foreground text-xs select-none">
                                {isLast ? '└─' : '├─'}
                              </TableCell>
                              <TableCell className={cn(typography.special.codeId, 'whitespace-nowrap')}>
                                {ls.spaceType === 'parking'
                                  ? <NAVIGATION_ENTITIES.parking.icon className={cn('inline', iconSizes.xs, NAVIGATION_ENTITIES.parking.color)} />
                                  : <NAVIGATION_ENTITIES.storage.icon className={cn('inline', iconSizes.xs, NAVIGATION_ENTITIES.storage.color)} />
                                }
                                {' '}
                                <button
                                  type="button"
                                  className="hover:underline cursor-pointer"
                                  onClick={() => router.push(
                                    ls.spaceType === 'parking'
                                      ? `/spaces/parking?parkingId=${ls.spaceId}`
                                      : `/spaces/storage?storageId=${ls.spaceId}`,
                                  )}
                                >
                                  {ls.entityCode}
                                </button>
                              </TableCell>
                              <TableCell className={typography.special.tertiary}>
                                {ls.description}
                              </TableCell>
                              <TableCell>
                                {ls.spaceType === 'storage' && !isLocked ? (
                                  <label className={cn('inline-flex items-center cursor-pointer', spacingTokens.gap.xs)}>
                                    <input
                                      type="checkbox"
                                      checked={ls.hasOwnShares}
                                      onChange={e => updateLinkedSpace(globalIndex, idx, 'hasOwnShares', e.target.checked)}
                                      className="accent-current"
                                    />
                                    <span className={typography.body.xs}>‰</span>
                                  </label>
                                ) : (
                                  <Badge variant="outline" className={cn(typography.body.xs, COLOR_BRIDGE.border.info, COLOR_BRIDGE.text.info)}>
                                    {t('common:ownership.categoryAuxiliary')}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className={typography.body.xs}>{ls.floor}</TableCell>
                              <TableCell className={cn('text-right', typography.special.codeId)}>
                                {ls.areaNetSqm > 0 ? ls.areaNetSqm.toFixed(2) : '—'}
                              </TableCell>
                              <TableCell className={cn('text-right', typography.special.codeId)}>
                                {ls.areaSqm > 0 ? ls.areaSqm.toFixed(2) : '—'}
                              </TableCell>
                              <TableCell className="text-right">
                                {ls.spaceType === 'storage' ? (
                                  ls.hasOwnShares ? (
                                    <Input
                                      type="number"
                                      min={0}
                                      value={ls.millesimalShares || ''}
                                      onChange={e => updateLinkedSpace(globalIndex, idx, 'millesimalShares', parseInt(e.target.value, 10) || 0)}
                                      className={cn('w-20 text-right', typography.special.codeId)}
                                      disabled={isLocked}
                                    />
                                  ) : (
                                    <span className={cn(typography.special.codeId, 'text-muted-foreground')}>—</span>
                                  )
                                ) : (
                                  <span className={cn(typography.special.codeId, 'text-muted-foreground')}>—</span>
                                )}
                              </TableCell>
                              <TableCell className={typography.special.tertiary}>
                                {ownerLabel(row.ownerParty, t)}
                              </TableCell>
                              <TableCell className={typography.special.tertiary}>
                                {row.buyerName ?? '—'}
                              </TableCell>
                              <TableCell className={typography.special.codeId}>
                                {row.preliminaryContract ?? '—'}
                              </TableCell>
                              <TableCell className={typography.special.codeId}>
                                {row.finalContract ?? '—'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      }
                      </React.Fragment>
                    );
                  })}

                  {/* Building subtotal — only participating rows */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell colSpan={6} className="text-right">
                      {t('common:ownership.subtotal')} — {buildingName}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {rows.filter(r => r.participatesInCalculation !== false).reduce((sum, r) => sum + r.millesimalShares, 0)}‰
                    </TableCell>
                    <TableCell colSpan={isLocked ? 1 : 2} />
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>

          {/* Grand total footer */}
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6} className="text-right font-bold">
                {t('common:ownership.total')}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right font-mono text-lg font-bold',
                  totalShares === TOTAL_SHARES_TARGET
                    ? COLOR_BRIDGE.text.success
                    : COLOR_BRIDGE.text.error,
                )}
              >
                {totalShares}‰
              </TableCell>
              <TableCell colSpan={isLocked ? 1 : 2} />
            </TableRow>
          </TableFooter>
        </Table>
        </section>
      )}

      {/* ============================================================ */}
      {/* BARTEX SUMMARY */}
      {/* ============================================================ */}
      {table.bartex && (
        <section className={cn(borders.quick.card, spacingTokens.padding.md)}>
          <h3 className={cn(spacingTokens.margin.bottom.sm, typography.heading.sm)}>{t('common:ownership.bartex.title')}</h3>
          <dl className={cn('grid grid-cols-2 text-sm sm:grid-cols-4', spacingTokens.gap.sm)}>
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.percentage')}</dt>
              <dd className={typography.heading.xs}>{table.bartex.bartexPercentage}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.contractor')}</dt>
              <dd className={cn(typography.special.codeId, 'font-semibold')}>
                {table.bartex.contractorShares}‰ ({(table.bartex.contractorShares / 10).toFixed(1)}%)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.landowners')}</dt>
              <dd className={cn(typography.special.codeId, 'font-semibold')}>
                {table.bartex.totalLandownerShares}‰ (
                {(table.bartex.totalLandownerShares / 10).toFixed(1)}%)
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* ============================================================ */}
      {/* CATEGORY SUMMARY */}
      {/* ============================================================ */}
      {table.rows.length > 0 && (
        <section className={cn('grid grid-cols-2 text-sm', spacingTokens.gap.md)}>
          <article className={cn(borders.quick.card, spacingTokens.padding.sm)}>
            <h4 className="text-muted-foreground">{t('common:ownership.categoryMain')}</h4>
            <p className={typography.heading.lg}>
              {table.summaryByCategory.main.shares}‰
            </p>
            <p className={typography.special.tertiary}>
              {table.summaryByCategory.main.count} {t('common:ownership.categoryMain').toLowerCase()}
            </p>
          </article>
          <article className={cn(borders.quick.card, spacingTokens.padding.sm)}>
            <h4 className="text-muted-foreground">{t('common:ownership.categoryAuxiliary')}</h4>
            <p className={typography.heading.lg}>
              {table.summaryByCategory.auxiliary.shares}‰
            </p>
            <p className={typography.special.tertiary}>
              {table.summaryByCategory.auxiliary.count} {t('common:ownership.categoryAuxiliary').toLowerCase()}
            </p>
          </article>
        </section>
      )}

      {/* ============================================================ */}
      {/* CALCULATION NOTE */}
      {/* ============================================================ */}
      {table.notes && (
        <p className={cn(typography.special.tertiary, 'italic')}>
          {table.notes}
        </p>
      )}

      {/* ============================================================ */}
      {/* REVISION HISTORY */}
      {/* ============================================================ */}
      {revisions.length > 0 && (
        <details className={cn(borders.quick.card, spacingTokens.padding.sm)}>
          <summary className="cursor-pointer font-medium">
            {t('common:ownership.revisionHistory')} ({revisions.length})
          </summary>
          <ul className={cn('text-sm', spacingTokens.margin.top.sm, spacingTokens.spaceBetween.xs)}>
            {revisions.map(rev => (
              <li key={rev.id} className={cn('flex items-center text-muted-foreground', spacingTokens.gap.sm)}>
                <Badge variant="outline" className={typography.body.xs}>
                  v{rev.version}
                </Badge>
                <span>{rev.finalizedAt?.toDate?.().toLocaleDateString?.() ?? '—'}</span>
                {rev.changeReason && (
                  <span className="italic">({rev.changeReason})</span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Error display */}
      {error && (
        <p className={cn(typography.body.sm, 'text-destructive')}>{error}</p>
      )}

    </FullscreenOverlay>
    <ConfirmDialog {...dialogProps} />
    </>
  );
}
