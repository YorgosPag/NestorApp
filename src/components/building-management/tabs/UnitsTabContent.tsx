/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors */
/** UnitsTabContent — Building Units tab with inline create/edit. ADR-184 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useNotifications } from '@/providers/NotificationProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Home, Plus, Search, CheckCircle, Euro, Ruler, BarChart3, Layers, Table as TableIcon, Link2, Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import type { Unit, UnitType } from '@/types/unit';
import { UnitInlineCreateForm } from './UnitInlineCreateForm';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog } from '../shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';
import {
  UNIT_TYPES_FOR_FILTER, UNIT_STATUSES_FOR_FILTER,
  UNIT_STATUS_COLOR_MAP, getUnitTypeLabel, getUnitStatusLabel,
} from './unit-tab-constants';
import type { FloorRecord } from './unit-tab-constants';
import { usePropertyInlineEdit } from './usePropertyInlineEdit';

type UnitConfirmAction =
  | { type: 'delete'; item: Unit }
  | { type: 'unlink'; item: Unit };

interface UnitsApiResponse {
  units: Unit[];
  count?: number;
}

interface FloorsApiResponse {
  floors: FloorRecord[];
}

interface UnitsTabContentProps {
  building: Building;
}

export function UnitsTabContent({ building }: UnitsTabContentProps) {
  const { t } = useTranslation('building');
  const { t: tUnits } = useTranslation('units');
  const { success, error: notifyError } = useNotifications();
  const router = useRouter();

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form visibility (form state managed by UnitInlineCreateForm)
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Delete & Unlink state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<UnitConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // 🛡️ ADR-226 Phase 3: Deletion Guard
  const { checkBeforeDelete, BlockedDialog } = useDeletionGuard('unit');

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Filter & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<UnitType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  const fetchFloors = useCallback(async () => {
    try {
      const result = await apiClient.get<FloorsApiResponse>(
        `${API_ROUTES.FLOORS.LIST}?buildingId=${building.id}`
      );
      if (result?.floors) {
        const sorted = [...result.floors].sort((a, b) => a.number - b.number);
        setFloors(sorted);
      }
    } catch {
      // Non-blocking — floors dropdown will simply be empty
    }
  }, [building.id]);

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<UnitsApiResponse>(
        `${API_ROUTES.UNITS.LIST}?buildingId=${building.id}`
      );
      if (result?.units) {
        setUnits(result.units as Unit[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [building.id]);

  useEffect(() => {
    fetchUnits();
    fetchFloors();
  }, [fetchUnits, fetchFloors]);

  const edit = usePropertyInlineEdit(fetchUnits);

  const stats = useMemo(() => ({
    total: units.length,
    available: units.filter(u => u.status === 'for-sale' || u.status === 'for-rent').length,
    totalValue: units.reduce((sum, u) => sum + (u.price || 0), 0),
    totalArea: units.reduce((sum, u) => sum + (u.area || 0), 0),
  }), [units]);

  const filteredUnits = useMemo(() => {
    return units.filter(unit => {
      const matchesSearch = !searchTerm ||
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        getUnitTypeLabel(unit.type, tUnits).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || unit.type === filterType;
      const matchesStatus = filterStatus === 'all' || unit.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [units, searchTerm, filterType, filterStatus, tUnits]);

  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: t('unitStats.total'), value: stats.total, icon: Home, color: 'blue' },
    { title: t('unitStats.available'), value: stats.available, icon: CheckCircle, color: 'green' },
    { title: t('unitStats.totalValue'), value: `€${(stats.totalValue / 1000).toFixed(0)}K`, icon: Euro, color: 'gray' },
    { title: t('unitStats.totalArea'), value: `${stats.totalArea.toFixed(1)} m²`, icon: Ruler, color: 'blue' },
  ], [stats, t]);

  const handleCreateSuccess = useCallback(async () => {
    setShowCreateForm(false);
    await fetchUnits();
  }, [fetchUnits]);

  const handleDeleteClick = async (unit: Unit) => {
    const allowed = await checkBeforeDelete(unit.id);
    if (allowed) {
      setConfirmAction({ type: 'delete', item: unit });
    }
  };

  const handleUnlinkClick = (unit: Unit) => {
    setConfirmAction({ type: 'unlink', item: unit });
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    setConfirmLoading(true);
    const { type, item } = confirmAction;

    try {
      if (type === 'delete') {
        setDeletingId(item.id);
        await apiClient.delete(API_ROUTES.UNITS.BY_ID(item.id));
        success(t('unitStats.deleted'));
      } else {
        setUnlinkingId(item.id);
        await apiClient.patch(API_ROUTES.UNITS.BY_ID(item.id), { buildingId: null });
        success(t('unitStats.unlinked'));
      }
      await fetchUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('unitStats.error');
      notifyError(msg);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  };

  const fetchUnlinkedUnits = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<UnitsApiResponse>(API_ROUTES.UNITS.LIST);
    if (!result?.units) return [];
    return result.units
      .filter((u) => !u.buildingId)
      .map((u) => ({
        id: u.id,
        label: u.name,
        sublabel: `${getUnitTypeLabel(u.type, tUnits)} · ${u.floor || '—'}`,
      }));
  }, [tUnits]);

  const handleLinkUnit = useCallback(async (itemId: string) => {
    await apiClient.patch(API_ROUTES.UNITS.BY_ID(itemId), { buildingId: building.id });
    success(t('unitStats.linked'));
    await fetchUnits();
  }, [building.id, fetchUnits]);

  const getStatusBadge = (status: string) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${UNIT_STATUS_COLOR_MAP[status] || UNIT_STATUS_COLOR_MAP.unavailable}`}>
      {getUnitStatusLabel(status, tUnits)}
    </span>
  );

  const unitColumns: SpaceColumn<Unit>[] = useMemo(() => [
    { key: 'name', label: t('tabs.floors.name'), sortValue: (u) => u.name, render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'type', label: t('tabs.labels.properties'), width: 'w-28', sortValue: (u) => u.type, render: (u) => <span className={colors.text.muted}>{getUnitTypeLabel(u.type, tUnits)}</span> },
    { key: 'floor', label: t('tabs.floors.number'), width: 'w-20', sortValue: (u) => u.floor || '', render: (u) => <span className={cn("font-mono text-sm", colors.text.muted)}>{u.floor}</span> },
    { key: 'area', label: 'm²', width: 'w-20', sortValue: (u) => u.area || 0, render: (u) => <span className="font-mono text-xs">{u.area ? `${u.area}` : '—'}</span> },
    { key: 'status', label: t('tabs.labels.details'), width: 'w-28', sortValue: (u) => u.status, render: (u) => getStatusBadge(u.status) },
  ], [t, tUnits]);

  const unitCardFields: SpaceCardField<Unit>[] = useMemo(() => [
    { label: tUnits('card.stats.type'), render: (u) => getUnitTypeLabel(u.type, tUnits) },
    { label: tUnits('card.stats.floor'), render: (u) => u.floor || '—' },
    { label: 'm²', render: (u) => u.area || '—' },
    { label: tUnits('table.price'), render: (u) => formatCurrencyWhole(u.price) },
  ], [tUnits]);

  if (loading) {
    return (
      <section className="flex items-center justify-center py-2">
        <Spinner size="large" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center gap-2 py-2">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchUnits}>
          {t('unitStats.retry')}
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2 p-2">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Home className="h-5 w-5 text-primary" />
          {t('tabs.labels.units')}
          <span className={cn("text-sm font-normal", colors.text.muted)}>({units.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
            <Link2 className="mr-1 h-4 w-4" />
            {t('spaceLink.linkExisting')}
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('tabs.labels.units')}
          </Button>
        </nav>
      </header>

      {/* Stats Cards */}
      <UnifiedDashboard stats={dashboardStats} columns={4} className="" />

      {/* Filters */}
      <Card>
        <CardContent className="p-2">
          <fieldset className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <label className="relative md:col-span-2">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.muted} ${iconSizes.sm}`} />
              <Input
                placeholder={t('unitStats.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </label>

            <Select value={filterType} onValueChange={(val) => setFilterType(val as UnitType | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allTypes', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes', { ns: 'filters' })}</SelectItem>
                {UNIT_TYPES_FOR_FILTER.map(ut => (
                  <SelectItem key={ut} value={ut}>{getUnitTypeLabel(ut, tUnits)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses', { ns: 'filters' })}</SelectItem>
                {UNIT_STATUSES_FOR_FILTER.map(us => (
                  <SelectItem key={us} value={us}>{getUnitStatusLabel(us, tUnits)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className={iconSizes.sm} />
              {t('unitStats.exportReport')}
            </Button>
          </fieldset>
        </CardContent>
      </Card>

      {showCreateForm && (
        <UnitInlineCreateForm
          buildingId={building.id}
          buildingName={building.name || ''}
          floors={floors}
          onCreated={handleCreateSuccess}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      <nav className="flex items-center justify-between">
        <span className={cn("text-sm", colors.text.muted)}>
          {filteredUnits.length} {t('unitStats.results')}
        </span>
        <fieldset className="flex items-center gap-2">
          <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
            <Layers className="mr-1 h-4 w-4" /> {t('unitStats.cards')}
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
            <TableIcon className="mr-1 h-4 w-4" /> {t('unitStats.table')}
          </Button>
        </fieldset>
      </nav>

      {/* Content — Centralized shared components */}
      {filteredUnits.length === 0 ? (
        <p className={cn("py-2 text-center text-sm", colors.text.muted)}>
          {t('tabs.labels.units')} — 0
        </p>
      ) : viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<Unit>
            items={filteredUnits}
            getKey={(u) => u.id}
            getName={(u) => u.name}
            renderStatus={(u) => getStatusBadge(u.status)}
            fields={unitCardFields}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.properties.withId(u.id)),
              onEdit: edit.startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
          />
          <footer className={cn("text-xs", colors.text.muted)}>
            {filteredUnits.length} {t('tabs.labels.units')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<Unit>
            items={filteredUnits}
            columns={unitColumns}
            getKey={(u) => u.id}
            actions={{
              onView: (u) => router.push(ENTITY_ROUTES.properties.withId(u.id)),
              onEdit: edit.startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
            editingId={edit.editingId}
            renderEditRow={() => (
              <>
                <TableCell>
                  <Input value={edit.editName} onChange={(e) => edit.setEditName(e.target.value)} className="h-8" disabled={edit.saving} />
                </TableCell>
                <TableCell>
                  <Select value={edit.editType || 'apartment'} onValueChange={(v) => edit.setEditType(v as UnitType)} disabled={edit.saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES_FOR_FILTER.map(ut => (<SelectItem key={ut} value={ut}>{getUnitTypeLabel(ut, tUnits)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input type="number" value={edit.editFloor} onChange={(e) => edit.setEditFloor(e.target.value)} className="h-8 w-16" disabled={edit.saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={edit.editArea} onChange={(e) => edit.setEditArea(e.target.value)} className="h-8 w-16" disabled={edit.saving} />
                </TableCell>
                <TableCell>
                  <Select value={edit.editStatus} onValueChange={edit.setEditStatus} disabled={edit.saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_STATUSES_FOR_FILTER.map(us => (<SelectItem key={us} value={us}>{getUnitStatusLabel(us, tUnits)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <nav className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={edit.handleSaveEdit} disabled={edit.saving || !edit.editName.trim()}>
                      {edit.saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={edit.cancelEdit} disabled={edit.saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </nav>
                </TableCell>
              </>
            )}
          />
          <footer className={cn("text-xs", colors.text.muted)}>
            {filteredUnits.length} {t('tabs.labels.units')}
            {filteredUnits.length !== units.length && (
              <span className="ml-1">({units.length} {t('unitStats.totalSummary')})</span>
            )}
          </footer>
        </>
      )}

      {/* Link Existing Dialog */}
      <BuildingSpaceLinkDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        title={t('spaceLink.linkUnit')}
        description={t('spaceLink.linkUnitDesc')}
        fetchUnlinked={fetchUnlinkedUnits}
        onLink={handleLinkUnit}
      />

      {BlockedDialog}

      <BuildingSpaceConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={
          confirmAction?.type === 'delete'
            ? t('spaceConfirm.deleteUnit')
            : t('spaceConfirm.unlinkUnit')
        }
        description={
          confirmAction?.type === 'delete' ? (
            <>
              {t('spaceConfirm.deleteUnitDesc')}{' '}
              <strong>&quot;{confirmAction.item.name}&quot;</strong>;
              <br /><br />
              {t('spaceConfirm.irreversible')}
            </>
          ) : (
            <>
              {t('spaceConfirm.unlinkUnitDesc')}
              <br /><br />
              <strong>{confirmAction?.item.name}</strong>
            </>
          )
        }
        confirmLabel={
          confirmAction?.type === 'delete'
            ? t('spaceActions.delete')
            : t('spaceActions.unlink')
        }
        onConfirm={handleConfirm}
        loading={confirmLoading}
        variant={confirmAction?.type === 'delete' ? 'destructive' : 'warning'}
      />
    </section>
  );
}

export default UnitsTabContent;
