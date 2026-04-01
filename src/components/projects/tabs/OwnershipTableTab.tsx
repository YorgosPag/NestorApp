'use client';

/**
 * ADR-235: Ownership Table Tab — Πίνακας Χιλιοστών Συνιδιοκτησίας
 * Split: ownership-table-config.ts, useOwnershipTableHandlers.ts, OwnershipTableSummary.tsx
 * @module components/projects/tabs/OwnershipTableTab
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { matchesSearchTerm } from '@/lib/search/search';
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
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import type { OwnerParty, MutableOwnershipTableRow } from '@/types/ownership-table';
import { useOwnershipTable } from '@/hooks/ownership/useOwnershipTable';
import { getBuildingIdsByProject } from '@/services/ownership/ownership-table-service';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableFooter, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Calculator, Lock, Unlock, RefreshCw, Save, Plus, AlertTriangle,
  FileText, Trash2, ArrowUpDown, ArrowUp, ArrowDown,
  ChevronRight, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { COLOR_BRIDGE } from '@/design-system/color-bridge';
import type { SortDirection } from '@/components/building-management/shared/types';
import '@/lib/design-system';

// Extracted modules
import type { OwnershipTableTabProps } from '@/components/projects/tabs/ownership-table-config';
import {
  buildColumns, ownerLabel, categoryLabel,
  getRowClassName, getCategoryBadgeClass,
} from '@/components/projects/tabs/ownership-table-config';
import { useOwnershipTableHandlers } from '@/components/projects/tabs/useOwnershipTableHandlers';
import {
  StatusBadge, ValidationIndicator,
  BartexSummary, CategorySummary, RevisionHistory, LinkedSpaceRows,
} from '@/components/projects/tabs/OwnershipTableSummary';

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
  const colors = useSemanticColors();
  const { confirm, dialogProps } = useConfirmDialog();

  const [buildingIds, setBuildingIds] = useState<string[]>([]);
  useEffect(() => {
    getBuildingIdsByProject(resolvedProjectId).then(setBuildingIds).catch(() => {});
  }, [resolvedProjectId]);

  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRowExpand = useCallback((entityId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(entityId)) next.delete(entityId); else next.add(entityId);
      return next;
    });
  }, []);

  const ownership = useOwnershipTable(resolvedProjectId, buildingIds);
  const {
    table, loading, saving, isDirty, error, validation,
    revisions, isLocked, orphanedBuildingIds,
    updateRow, addAirRightsRow, updateLinkedSpace, removeRow,
    updateTableField, reload,
  } = ownership;

  const handlers = useOwnershipTableHandlers({
    ownership, buildingIds, t, showSuccess, showError,
    userId: user?.uid, confirm,
    setShowUnlockInput, setUnlockReason, unlockReason,
  });

  const groupedRows = useMemo(() => {
    if (!table?.rows.length) return new Map<string, MutableOwnershipTableRow[]>();
    const groups = new Map<string, MutableOwnershipTableRow[]>();
    for (const row of table.rows) {
      const group = groups.get(row.buildingId);
      if (group) group.push(row);
      else groups.set(row.buildingId, [row]);
    }
    return groups;
  }, [table?.rows]);

  const columns = useMemo(() => buildColumns(t), [t]);
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
      if (matchingRows.length > 0) filtered.set(buildingId, matchingRows);
    }
    return filtered;
  }, [groupedRows, columnFilters, hasActiveFilters, columns]);

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

  if (loading && !table) {
    return (
      <section className={cn('flex items-center justify-center', spacingTokens.padding.xl)}>
        <RefreshCw className={cn(iconSizes.lg, 'animate-spin', colors.text.muted)} />
      </section>
    );
  }

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

      <header className={cn('flex flex-wrap items-center', spacingTokens.gap.sm)}>
        <h2 className={typography.heading.md}>{t('common:ownership.title')}</h2>
        <StatusBadge status={table.status} t={t} />
        {table.version > 1 && (
          <span className={typography.special.tertiary}>
            {t('common:ownership.version')} {table.version}
          </span>
        )}
        <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
      </header>


      {orphanedBuildingIds.length > 0 && table.rows.length > 0 && (
        <section className={cn('flex items-start rounded-lg border', spacingTokens.gap.sm, spacingTokens.padding.md, COLOR_BRIDGE.border.warning, COLOR_BRIDGE.bg.warningSubtle)}>
          <AlertTriangle className={cn('mt-0.5 shrink-0', iconSizes.md, COLOR_BRIDGE.text.warning)} />
          <article className={cn('flex-1', spacingTokens.spaceBetween.sm)}>
            <p className={cn(typography.label.sm, COLOR_BRIDGE.text.warning)}>
              {t('common:ownership.messages.orphanedTitle')}
            </p>
            <p className={cn(typography.body.sm, COLOR_BRIDGE.text.warning)}>
              {orphanedBuildingIds.length === 1
                ? t('common:ownership.messages.orphanedSingle')
                : t('common:ownership.messages.orphanedMultiple', { count: orphanedBuildingIds.length })}
              {' '}{t('common:ownership.messages.orphanedAdvice')}
            </p>
            {!isLocked && (
              <nav className={cn('flex', spacingTokens.gap.sm)}>
                <Button variant="outline" size="sm" onClick={handlers.handleAutoPopulate} disabled={loading || buildingIds.length === 0}>
                  <RefreshCw className={cn('mr-1', iconSizes.xs)} />
                  {t('common:ownership.actions.refreshTable')}
                </Button>
                <Button variant="outline" size="sm" onClick={handlers.handleDeleteDraft} className={cn(COLOR_BRIDGE.border.error, COLOR_BRIDGE.text.error)}>
                  <Trash2 className={cn('mr-1', iconSizes.xs)} />
                  {t('common:ownership.actions.deleteTable')}
                </Button>
              </nav>
            )}
          </article>
        </section>
      )}


      <section className={cn('grid grid-cols-1 sm:grid-cols-3', spacingTokens.gap.sm)}>
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel htmlFor="ownership-method" label={t('common:ownership.method')} tooltip={t('common:ownership.tooltips.method')} className={typography.label.sm} />
          <Select value={table.calculationMethod} onValueChange={handlers.handleMethodChange} disabled={isLocked}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="area">{t('common:ownership.methodArea')}</SelectItem>
              <SelectItem value="value">{t('common:ownership.methodValue')}</SelectItem>
              <SelectItem value="volume">{t('common:ownership.methodVolume')}</SelectItem>
            </SelectContent>
          </Select>
        </fieldset>
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel htmlFor="ownership-zone-price" label={t('common:ownership.zonePrice')} tooltip={t('common:ownership.tooltips.zonePrice')} className={typography.label.sm} />
          <Input type="number" min={0} step={0.01} value={table.zonePrice || ''} onChange={e => updateTableField('zonePrice', parseFloat(e.target.value) || 0)} disabled={isLocked} />
        </fieldset>
        <fieldset className={spacingTokens.spaceBetween.xs} disabled={isLocked}>
          <InfoLabel htmlFor="ownership-commerciality" label={t('common:ownership.commercialityCoefficient')} tooltip={t('common:ownership.tooltips.commerciality')} className={typography.label.sm} />
          <Input type="number" min={0} step={0.1} value={table.commercialityCoefficient || ''} onChange={e => updateTableField('commercialityCoefficient', parseFloat(e.target.value) || 1.0)} disabled={isLocked} />
        </fieldset>
      </section>


      <nav className={cn('flex flex-wrap items-center', spacingTokens.gap.sm)}>
        <Button variant="outline" size="sm" onClick={handlers.handleAutoPopulate} disabled={isLocked || loading}>
          <RefreshCw className={cn('mr-1', iconSizes.sm)} />{t('common:ownership.actions.autoPopulate')}
        </Button>
        {table.rows.some(r => r.linkedSpacesSummary && r.linkedSpacesSummary.length > 0) && (
          <Button variant="ghost" size="sm" onClick={() => {
            const allWithChildren = table.rows.filter(r => r.linkedSpacesSummary && r.linkedSpacesSummary.length > 0).map(r => r.entityRef.id);
            const allExpanded = allWithChildren.every(id => expandedRows.has(id));
            setExpandedRows(allExpanded ? new Set() : new Set(allWithChildren));
          }}>
            {expandedRows.size > 0 ? <ChevronDown className={iconSizes.sm} /> : <ChevronRight className={iconSizes.sm} />}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handlers.handleCalculate} disabled={isLocked || table.rows.length === 0}>
          <Calculator className={cn('mr-1', iconSizes.sm)} />{t('common:ownership.actions.calculate')}
        </Button>
        <Button variant="outline" size="sm" onClick={addAirRightsRow} disabled={isLocked}>
          <Plus className={cn('mr-1', iconSizes.sm)} />{t('common:ownership.actions.addAirRights')}
        </Button>
        <Button variant="default" size="sm" onClick={handlers.handleSave} disabled={isLocked || saving || !isDirty}>
          <Save className={cn('mr-1', iconSizes.sm)} />{t('common:buttons.save')}
        </Button>
        <span className="flex-1" />
        {table.rows.length > 0 && <ValidationIndicator total={totalShares} valid={validation?.valid ?? false} t={t} />}
        {!isLocked && table.rows.length > 0 && (
          <Button variant="default" size="sm" onClick={handlers.handleFinalize} disabled={saving || !(validation?.valid)}>
            <Lock className={cn('mr-1', iconSizes.sm)} />{t('common:ownership.actions.finalize')}
          </Button>
        )}
        {isLocked && !showUnlockInput && (
          <Button variant="outline" size="sm" onClick={() => setShowUnlockInput(true)}>
            <Unlock className={cn('mr-1', iconSizes.sm)} />{t('common:ownership.actions.unlock')}
          </Button>
        )}
        {!isLocked && table.rows.length > 0 && (
          <Button variant="outline" size="sm" onClick={handlers.handleDeleteDraft} className={cn(COLOR_BRIDGE.border.error, COLOR_BRIDGE.text.error)}>
            <Trash2 className={cn('mr-1', iconSizes.sm)} />{t('common:buttons.delete')}
          </Button>
        )}
      </nav>


      {showUnlockInput && (
        <section className={cn('flex items-center', spacingTokens.gap.sm)}>
          <Input placeholder={t('common:ownership.unlockReason')} value={unlockReason} onChange={e => setUnlockReason(e.target.value)} className="max-w-sm" />
          <Button size="sm" onClick={handlers.handleUnlock} disabled={!unlockReason.trim()}>{t('common:ownership.actions.unlock')}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowUnlockInput(false); setUnlockReason(''); }}>{t('common:buttons.cancel')}</Button>
        </section>
      )}


      {table.rows.length === 0 ? (
        <section className={cn(borders.quick.dashed, 'text-center', colors.text.muted, spacingTokens.padding.xl)}>
          <FileText className={cn('mx-auto mb-2', iconSizes.xl)} />
          <p>{t('common:ownership.empty')}</p>
        </section>
      ) : (
        <section className="max-h-[calc(100vh-280px)] overflow-auto rounded-lg border">
        <Table size="compact">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              {columns.map(col => {
                const isSortable = !!col.sortValue;
                const isActive = sortColumn === col.key;
                return (
                  <TableHead key={col.key} className={cn(col.width, col.whitespace && 'whitespace-nowrap', col.alignRight && 'text-right', isSortable && 'cursor-pointer select-none hover:text-foreground')} onClick={isSortable ? () => toggleSort(col.key) : undefined}>
                    <span className="inline-flex items-center gap-0.5">
                      {t(col.labelKey)}
                      {isSortable && (isActive
                        ? sortDirection === 'asc' ? <ArrowUp className={cn(iconSizes.xs, 'text-foreground')} /> : <ArrowDown className={cn(iconSizes.xs, 'text-foreground')} />
                        : <ArrowUpDown className={cn(iconSizes.xs, `${colors.text.muted}/50`)} />
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
            <TableRow className="bg-background">
              {columns.map(col => (
                <TableHead key={`filter-${col.key}`}>
                  {col.filterable ? (
                    <Input placeholder="🔍" value={columnFilters[col.key] ?? ''} onChange={e => updateColumnFilter(col.key, e.target.value)} className={typography.body.xs} />
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {Array.from(sortedGroupedRows.entries()).map(([buildingId, rows]) => {
              const buildingName = rows[0]?.buildingName ?? buildingId;
              return (
                <React.Fragment key={buildingId}>
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={12} className={typography.heading.sm}>{buildingName}</TableCell>
                  </TableRow>
                  {rows.map((row, visibleIdx) => {
                    const globalIndex = table.rows.findIndex(r => r.entityRef.id === row.entityRef.id);
                    const isNonParticipating = row.participatesInCalculation === false;
                    const isAirRights = row.category === 'air_rights';
                    const hasChildren = row.linkedSpacesSummary && row.linkedSpacesSummary.length > 0;
                    const isExpanded = expandedRows.has(row.entityRef.id);

                    return (
                      <React.Fragment key={row.entityRef.id}>
                      <TableRow className={getRowClassName(row)}>
                        <TableCell className={colors.text.muted}>
                          <span className="inline-flex items-center">
                            {hasChildren ? (
                              <button type="button" onClick={() => toggleRowExpand(row.entityRef.id)} className={cn('mr-0.5 hover:text-foreground', colors.text.muted)}>
                                {isExpanded ? <ChevronDown className={iconSizes.xs} /> : <ChevronRight className={iconSizes.xs} />}
                              </button>
                            ) : (
                              <span className={cn('mr-0.5 inline-block', iconSizes.xs)} />
                            )}
                            {visibleIdx + 1}
                          </span>
                        </TableCell>
                        <TableCell className={typography.special.codeId}>
                          {row.entityRef.collection === 'units' && <NAVIGATION_ENTITIES.unit.icon className={cn('inline mr-1', iconSizes.xs, NAVIGATION_ENTITIES.unit.color)} />}
                          {row.entityRef.collection === 'units' ? (
                            <button type="button" className="hover:underline cursor-pointer" onClick={() => router.push(`/spaces/properties?propertyId=${row.entityRef.id}`)}>{row.entityCode}</button>
                          ) : row.entityCode}
                        </TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(typography.body.xs, getCategoryBadgeClass(row))}>
                            {categoryLabel(row.category, t, row.participatesInCalculation)}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.floor}</TableCell>
                        <TableCell className={cn('text-right', typography.special.codeId)}>{row.areaNetSqm > 0 ? row.areaNetSqm.toFixed(2) : '—'}</TableCell>
                        <TableCell className={cn('text-right', typography.special.codeId)}>{row.areaSqm > 0 ? row.areaSqm.toFixed(2) : '—'}</TableCell>
                        <TableCell className="text-right">
                          {isNonParticipating ? (
                            <span className={cn(typography.special.codeId, colors.text.muted)}>—</span>
                          ) : isLocked ? (
                            <span className={cn(typography.special.codeId, 'font-semibold')}>{row.millesimalShares}‰</span>
                          ) : (
                            <Input type="number" min={1} value={row.millesimalShares || ''} onChange={e => updateRow(globalIndex, 'millesimalShares', parseInt(e.target.value, 10) || 0)} className={cn("w-20 text-right", typography.special.codeId)} />
                          )}
                        </TableCell>
                        <TableCell>
                          {isLocked ? ownerLabel(row.ownerParty, t) : (
                            <Select value={row.ownerParty} onValueChange={val => updateRow(globalIndex, 'ownerParty', val as OwnerParty)}>
                              <SelectTrigger className={typography.body.xs}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contractor">{t('common:ownership.ownerContractor')}</SelectItem>
                                <SelectItem value="landowner">{t('common:ownership.ownerLandowner')}</SelectItem>
                                <SelectItem value="buyer">{t('common:ownership.ownerBuyer')}</SelectItem>
                                <SelectItem value="unassigned">{t('common:ownership.ownerUnassigned')}</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className={typography.special.tertiary}>{row.owners?.[0]?.name ?? '—'}</TableCell>
                        <TableCell className={typography.special.codeId}>{row.preliminaryContract ?? '—'}</TableCell>
                        <TableCell className={typography.special.codeId}>
                          {isAirRights && !isLocked ? (
                            <Button variant="ghost" size="sm" onClick={() => removeRow(globalIndex)} className={cn('h-6 w-6 p-0', COLOR_BRIDGE.text.error, COLOR_BRIDGE.bg.dangerHover)}>
                              <Trash2 className={iconSizes.xs} />
                            </Button>
                          ) : row.finalContract ?? '—'}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <LinkedSpaceRows
                          row={row} globalIndex={globalIndex} isLocked={isLocked} t={t}
                          typography={typography} spacing={spacingTokens} colors={colors} iconSizes={iconSizes}
                          onNavigate={router.push} updateLinkedSpace={updateLinkedSpace}
                        />
                      )}
                      </React.Fragment>
                    );
                  })}
                  <TableRow className={cn("bg-muted/30", typography.label.md)}>
                    <TableCell colSpan={6} className="text-right">{t('common:ownership.subtotal')} — {buildingName}</TableCell>
                    <TableCell className={cn("text-right font-bold", typography.special.codeId)}>
                      {rows.filter(r => r.participatesInCalculation !== false).reduce((sum, r) => sum + r.millesimalShares, 0)}‰
                    </TableCell>
                    <TableCell colSpan={isLocked ? 1 : 2} />
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>

          <TableFooter>
            <TableRow>
              <TableCell colSpan={6} className={cn("text-right", typography.heading.sm)}>{t('common:ownership.total')}</TableCell>
              <TableCell className={cn('text-right font-mono', typography.heading.md, totalShares === TOTAL_SHARES_TARGET ? COLOR_BRIDGE.text.success : COLOR_BRIDGE.text.error)}>
                {totalShares}‰
              </TableCell>
              <TableCell colSpan={isLocked ? 1 : 2} />
            </TableRow>
          </TableFooter>
        </Table>
        </section>
      )}


      {table.bartex && (
        <BartexSummary bartex={table.bartex} t={t} typography={typography} spacing={spacingTokens} colors={colors} borders={borders} />
      )}
      {table.rows.length > 0 && (
        <CategorySummary summaryByCategory={table.summaryByCategory} t={t} typography={typography} spacing={spacingTokens} colors={colors} borders={borders} />
      )}
      {table.notes && <p className={cn(typography.special.tertiary, 'italic')}>{table.notes}</p>}
      <RevisionHistory revisions={revisions} t={t} typography={typography} spacing={spacingTokens} colors={colors} borders={borders} />
      {error && <p className={cn(typography.body.sm, 'text-destructive')}>{error}</p>}

    </FullscreenOverlay>
    <ConfirmDialog {...dialogProps} />
    </>
  );
}
