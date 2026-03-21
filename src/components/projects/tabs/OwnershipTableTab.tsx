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
import type { Project } from '@/types/project';
import type {
  CalculationMethod,
  OwnerParty,
  MutableOwnershipTableRow,
} from '@/types/ownership-table';
import { TOTAL_SHARES_TARGET } from '@/types/ownership-table';
import { useOwnershipTable } from '@/hooks/ownership/useOwnershipTable';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useNotifications } from '@/providers/NotificationProvider';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface OwnershipTableTabProps {
  data: Project;
  projectId?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/** Status badge with color coding */
function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variants: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    finalized: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    registered: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
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

/** Validation indicator */
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
      <span className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        {t('common:ownership.validation.totalCorrect')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
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
function categoryLabel(cat: string, t: (key: string) => string): string {
  return cat === 'main'
    ? t('common:ownership.categoryMain')
    : t('common:ownership.categoryAuxiliary');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OwnershipTableTab({ data, projectId }: OwnershipTableTabProps) {
  const resolvedProjectId = projectId ?? data.id;
  const { t } = useTranslation();
  const { success: showSuccess, error: showError } = useNotifications();

  // Building IDs — fetch from Firestore (buildings where projectId matches)
  const [buildingIds, setBuildingIds] = useState<string[]>([]);

  useEffect(() => {
    async function fetchBuildingIds() {
      try {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const { COLLECTIONS } = await import('@/config/firestore-collections');
        const snap = await getDocs(
          query(collection(db, COLLECTIONS.BUILDINGS), where('projectId', '==', resolvedProjectId))
        );
        const ids = snap.docs.map(d => d.id);
        setBuildingIds(ids);
      } catch {
        // Silent — ownership table will just show empty
      }
    }
    fetchBuildingIds();
  }, [resolvedProjectId]);

  // Unlock dialog state
  const [showUnlockInput, setShowUnlockInput] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');

  const {
    table,
    loading,
    saving,
    isDirty,
    error,
    validation,
    revisions,
    isLocked,
    autoPopulate,
    calculate,
    updateRow,
    updateTableField,
    save,
    finalize,
    unlock,
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

  // --- Handlers ---
  const handleAutoPopulate = useCallback(async () => {
    // ── Step 1: Check buildings linked to project ──
    if (buildingIds.length === 0) {
      showError('Δεν βρέθηκαν κτίρια συνδεδεμένα με αυτό το έργο. Συνδέστε πρώτα ένα κτίριο με το έργο (Κτίριο → Γενικά → Έργο).');
      return;
    }

    // ── Step 2: Check floors exist in buildings ──
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const { COLLECTIONS } = await import('@/config/firestore-collections');

      let totalFloors = 0;
      let totalUnits = 0;
      let unitsWithoutArea = 0;
      let unitsWithoutFloor = 0;

      for (const bId of buildingIds) {
        const floorsSnap = await getDocs(query(collection(db, COLLECTIONS.FLOORS), where('buildingId', '==', bId)));
        totalFloors += floorsSnap.size;

        const unitsSnap = await getDocs(query(collection(db, COLLECTIONS.UNITS), where('buildingId', '==', bId)));
        totalUnits += unitsSnap.size;

        for (const unitDoc of unitsSnap.docs) {
          const data = unitDoc.data();
          const area = (data.area as number) ?? (data.areaSqm as number) ?? 0;
          if (area <= 0) unitsWithoutArea++;
          if (!data.floorId) unitsWithoutFloor++;
        }
      }

      // ── Step 3: Report issues ──
      const issues: string[] = [];

      if (totalFloors === 0) {
        issues.push('Δεν υπάρχουν όροφοι στα κτίρια. Προσθέστε ορόφους πρώτα.');
      }
      if (totalUnits === 0) {
        issues.push('Δεν υπάρχουν μονάδες στα κτίρια. Προσθέστε μονάδες πρώτα.');
      }
      if (unitsWithoutArea > 0) {
        issues.push(`${unitsWithoutArea} μονάδ${unitsWithoutArea === 1 ? 'α' : 'ες'} χωρίς εμβαδόν — ο υπολογισμός χιλιοστών θα είναι λανθασμένος.`);
      }
      if (unitsWithoutFloor > 0) {
        issues.push(`${unitsWithoutFloor} μονάδ${unitsWithoutFloor === 1 ? 'α' : 'ες'} χωρίς σύνδεση με όροφο — ο συντελεστής ορόφου δεν θα υπολογιστεί.`);
      }

      if (totalUnits === 0) {
        showError(issues.join('\n'));
        return;
      }

      // ── Step 4: Proceed with auto-populate ──
      const rowCount = await autoPopulate();

      if (issues.length > 0) {
        // Has data but with warnings
        showError(`Συμπληρώθηκαν ${rowCount} εγγραφές, αλλά:\n${issues.join('\n')}`);
      } else {
        showSuccess(`Συμπληρώθηκαν ${rowCount} εγγραφές. Πατήστε "Υπολογισμός" για να υπολογιστούν τα χιλιοστά.`);
      }
    } catch {
      showError('Σφάλμα κατά τον έλεγχο δεδομένων. Δοκιμάστε ξανά.');
    }
  }, [autoPopulate, buildingIds, showSuccess, showError]);

  const handleCalculate = useCallback(() => {
    calculate();
    showSuccess(t('common:ownership.actions.calculate'));
  }, [calculate, showSuccess, t]);

  const handleSave = useCallback(async () => {
    await save();
    showSuccess(t('common:buttons.save'));
  }, [save, showSuccess, t]);

  const handleFinalize = useCallback(async () => {
    try {
      await finalize('current-user'); // TODO: Replace with actual userId from auth
      showSuccess(t('common:ownership.actions.finalize'));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error');
    }
  }, [finalize, showSuccess, showError, t]);

  const handleUnlock = useCallback(async () => {
    if (!unlockReason.trim()) return;
    try {
      await unlock('current-user', unlockReason); // TODO: Replace with actual userId
      showSuccess(t('common:ownership.actions.unlock'));
      setShowUnlockInput(false);
      setUnlockReason('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Error');
    }
  }, [unlock, unlockReason, showSuccess, showError, t]);

  const handleMethodChange = useCallback((method: string) => {
    updateTableField('calculationMethod', method);
    calculate(method as CalculationMethod);
  }, [updateTableField, calculate]);

  // --- Loading state ---
  if (loading && !table) {
    return (
      <section className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </section>
    );
  }

  // --- Error state ---
  if (error && !table) {
    return (
      <section className="p-6">
        <p className="text-destructive">{error}</p>
        <Button variant="outline" onClick={reload} className="mt-2">
          {t('common:buttons.refresh')}
        </Button>
      </section>
    );
  }

  if (!table) return null;

  const totalShares = table.rows.reduce((sum, r) => sum + r.millesimalShares, 0);

  return (
    <section className="space-y-6">
      {/* ============================================================ */}
      {/* HEADER: Method, Zone Price, Status */}
      {/* ============================================================ */}
      <header className="flex flex-wrap items-center gap-4">
        <h2 className="text-lg font-semibold">
          {t('common:ownership.title')}
        </h2>
        <StatusBadge status={table.status} t={t} />
        {table.version > 1 && (
          <span className="text-xs text-muted-foreground">
            {t('common:ownership.version')} {table.version}
          </span>
        )}
      </header>

      {/* ============================================================ */}
      {/* CONTROLS: Method selector + Zone price + ΣΕ */}
      {/* ============================================================ */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Method selector */}
        <fieldset className="space-y-1" disabled={isLocked}>
          <label className="text-sm font-medium">
            {t('common:ownership.method')}
          </label>
          <Select
            value={table.calculationMethod}
            onValueChange={handleMethodChange}
            disabled={isLocked}
          >
            <SelectTrigger>
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
        <fieldset className="space-y-1" disabled={isLocked}>
          <label className="text-sm font-medium">
            {t('common:ownership.zonePrice')}
          </label>
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
        <fieldset className="space-y-1" disabled={isLocked}>
          <label className="text-sm font-medium">
            {t('common:ownership.commercialityCoefficient')}
          </label>
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
      <nav className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAutoPopulate}
          disabled={isLocked || loading}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          {t('common:ownership.actions.autoPopulate')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCalculate}
          disabled={isLocked || table.rows.length === 0}
        >
          <Calculator className="mr-1 h-4 w-4" />
          {t('common:ownership.actions.calculate')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          disabled={isLocked || saving || !isDirty}
        >
          <Save className="mr-1 h-4 w-4" />
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
        {!isLocked && table.rows.length > 0 && validation?.valid && (
          <Button
            variant="default"
            size="sm"
            onClick={handleFinalize}
            disabled={saving}
          >
            <Lock className="mr-1 h-4 w-4" />
            {t('common:ownership.actions.finalize')}
          </Button>
        )}
        {isLocked && !showUnlockInput && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUnlockInput(true)}
          >
            <Unlock className="mr-1 h-4 w-4" />
            {t('common:ownership.actions.unlock')}
          </Button>
        )}
      </nav>

      {/* Unlock reason input */}
      {showUnlockInput && (
        <section className="flex items-center gap-2">
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
        <section className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <FileText className="mx-auto mb-2 h-8 w-8" />
          <p>{t('common:ownership.empty')}</p>
        </section>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t('common:ownership.columns.ordinal')}</TableHead>
              <TableHead className="w-24">{t('common:ownership.columns.entityCode')}</TableHead>
              <TableHead>{t('common:ownership.columns.description')}</TableHead>
              <TableHead className="w-20">{t('common:ownership.columns.category')}</TableHead>
              <TableHead className="w-20">{t('common:ownership.columns.floor')}</TableHead>
              <TableHead className="w-24 text-right">
                {t('common:ownership.columns.areaNet', { defaultValue: 'Καθαρά (m²)' })}
              </TableHead>
              <TableHead className="w-24 text-right">
                {t('common:ownership.columns.areaSqm')}
              </TableHead>
              <TableHead className="w-24 text-right">
                {t('common:ownership.columns.millesimalShares')}
              </TableHead>
              <TableHead className="w-40">{t('common:ownership.columns.ownerParty')}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {Array.from(groupedRows.entries()).map(([buildingId, rows]) => {
              const buildingName = rows[0]?.buildingName ?? buildingId;
              const subtotal = rows.reduce((sum, r) => sum + r.millesimalShares, 0);

              return (
                <React.Fragment key={buildingId}>
                  {/* Building group header */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={isLocked ? 8 : 9} className="font-semibold">
                      {buildingName}
                    </TableCell>
                  </TableRow>

                  {/* Rows */}
                  {rows.map(row => {
                    const globalIndex = table.rows.findIndex(
                      r => r.entityRef.id === row.entityRef.id,
                    );

                    return (
                      <TableRow
                        key={row.entityRef.id}
                        className={cn(
                          row.isManualOverride && 'bg-amber-50/50 dark:bg-amber-950/20',
                        )}
                      >
                        <TableCell className="text-muted-foreground">{row.ordinal}</TableCell>
                        <TableCell className="font-mono text-xs">{row.entityCode}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {categoryLabel(row.category, t)}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.floor}</TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {row.areaNetSqm > 0 ? row.areaNetSqm.toFixed(2) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {isLocked ? (
                            row.areaSqm.toFixed(2)
                          ) : (
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={row.areaSqm || ''}
                              onChange={e =>
                                updateRow(globalIndex, 'areaSqm', parseFloat(e.target.value) || 0)
                              }
                              className="h-7 w-20 text-right font-mono text-xs"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isLocked ? (
                            <span className="font-mono font-semibold">{row.millesimalShares}‰</span>
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
                              className="h-7 w-20 text-right font-mono text-xs"
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
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="contractor">
                                  {t('common:ownership.ownerContractor')}
                                </SelectItem>
                                <SelectItem value="landowner">
                                  {t('common:ownership.ownerLandowner')}
                                </SelectItem>
                                <SelectItem value="buyer">
                                  {t('common:ownership.ownerBuyer')}
                                </SelectItem>
                                <SelectItem value="unassigned">
                                  {t('common:ownership.ownerUnassigned')}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        {/* Μονάδα κτιρίου = υποχρεωτικά στον πίνακα. Για αφαίρεση → αποσύνδεση από κτίριο. */}
                      </TableRow>
                    );
                  })}

                  {/* Building subtotal */}
                  <TableRow className="bg-muted/30 font-medium">
                    <TableCell colSpan={6} className="text-right">
                      {t('common:ownership.subtotal')} — {buildingName}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {subtotal}‰
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
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {totalShares}‰
              </TableCell>
              <TableCell colSpan={isLocked ? 1 : 2} />
            </TableRow>
          </TableFooter>
        </Table>
      )}

      {/* ============================================================ */}
      {/* BARTEX SUMMARY */}
      {/* ============================================================ */}
      {table.bartex && (
        <section className="rounded-lg border p-4">
          <h3 className="mb-2 font-semibold">{t('common:ownership.bartex.title')}</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.percentage')}</dt>
              <dd className="font-semibold">{table.bartex.bartexPercentage}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.contractor')}</dt>
              <dd className="font-mono font-semibold">
                {table.bartex.contractorShares}‰ ({(table.bartex.contractorShares / 10).toFixed(1)}%)
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('common:ownership.bartex.landowners')}</dt>
              <dd className="font-mono font-semibold">
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
        <section className="grid grid-cols-2 gap-4 text-sm">
          <article className="rounded-lg border p-3">
            <h4 className="text-muted-foreground">{t('common:ownership.categoryMain')}</h4>
            <p className="text-xl font-bold">
              {table.summaryByCategory.main.shares}‰
            </p>
            <p className="text-xs text-muted-foreground">
              {table.summaryByCategory.main.count} {t('common:ownership.categoryMain').toLowerCase()}
            </p>
          </article>
          <article className="rounded-lg border p-3">
            <h4 className="text-muted-foreground">{t('common:ownership.categoryAuxiliary')}</h4>
            <p className="text-xl font-bold">
              {table.summaryByCategory.auxiliary.shares}‰
            </p>
            <p className="text-xs text-muted-foreground">
              {table.summaryByCategory.auxiliary.count} {t('common:ownership.categoryAuxiliary').toLowerCase()}
            </p>
          </article>
        </section>
      )}

      {/* ============================================================ */}
      {/* REVISION HISTORY */}
      {/* ============================================================ */}
      {revisions.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer font-medium">
            {t('common:ownership.revisionHistory')} ({revisions.length})
          </summary>
          <ul className="mt-2 space-y-1 text-sm">
            {revisions.map(rev => (
              <li key={rev.id} className="flex items-center gap-2 text-muted-foreground">
                <Badge variant="outline" className="text-xs">
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
        <p className="text-sm text-destructive">{error}</p>
      )}

    </section>
  );
}
