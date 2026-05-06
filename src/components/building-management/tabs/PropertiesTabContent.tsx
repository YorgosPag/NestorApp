/* eslint-disable design-system/prefer-design-system-imports, design-system/enforce-semantic-colors */
/** PropertiesTabContent — Building Properties tab with inline create/edit. ADR-184 */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
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
import { Home, Plus, Search, CheckCircle, Euro, Ruler, BarChart3, Layers, Table as TableIcon, Link2 } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import type { Property, PropertyType } from '@/types/property';
import { UnitQuickCreateSheet } from '../dialogs/UnitQuickCreateSheet';
import { PropertyInlineEditRow } from './PropertyInlineEditRow';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, buildTypeCodeField, buildFloorField, buildAreaField, buildPriceField } from '../shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { usePropertyDeletionGuard } from '@/hooks/usePropertyDeletionGuard';
import {
  UNIT_TYPES_FOR_FILTER, UNIT_STATUSES_FOR_FILTER,
  UNIT_STATUS_COLOR_MAP, getPropertyTypeLabel, getPropertyStatusLabel,
} from './property-tab-constants';
import type { FloorRecord } from './property-tab-constants';
import { usePropertyInlineEdit } from './usePropertyInlineEdit';
import {
  deletePropertyWithPolicy,
  updatePropertyBuildingLinkWithPolicy,
} from '@/services/property/property-mutation-gateway';
import { translatePropertyMutationError } from '@/services/property/property-mutation-feedback';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { createStaleCache } from '@/lib/stale-cache';

// ADR-300: Module-level caches — keyed by buildingId, survive re-navigation
const buildingPropertiesCache = createStaleCache<Property[]>('building-properties-tab');
const buildingFloorsTabCache = createStaleCache<FloorRecord[]>('building-floors-tab');

type PropertyConfirmAction = { type: 'unlink'; item: Property };

interface PropertiesApiResponse {
  /** API returns `properties` — not `units` */
  properties: Property[];
  count?: number;
}

interface FloorsApiResponse {
  floors: FloorRecord[];
}

interface PropertiesTabContentProps {
  building: Building;
}

export function PropertiesTabContent({ building }: PropertiesTabContentProps) {
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);
  const { t: tUnits } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const { success, error: notifyError } = useNotifications();
  const router = useRouter();

  // Data state — ADR-300: Seed from module-level cache → zero flash on re-navigation
  const [units, setUnits] = useState<Property[]>(buildingPropertiesCache.get(building.id) ?? []);
  const [floors, setFloors] = useState<FloorRecord[]>(buildingFloorsTabCache.get(building.id) ?? []);
  const [loading, setLoading] = useState(!buildingPropertiesCache.hasLoaded(building.id));
  const [error, setError] = useState<string | null>(null);

  // Create form visibility (form state managed by PropertyInlineCreateForm)
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Delete & Unlink state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PropertyConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // 🛡️ ADR-226 Phase 3: Deletion Guard
  const { requestDelete, Dialogs: DeletionDialogs } = usePropertyDeletionGuard();

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Filter & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | 'all'>('all');
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
        buildingFloorsTabCache.set(sorted, building.id);
        setFloors(sorted);
      }
    } catch {
      // Non-blocking — floors dropdown will simply be empty
    }
  }, [building.id]);

  const fetchProperties = useCallback(async () => {
    // ADR-300: Only show spinner on first load — not on re-navigation
    if (!buildingPropertiesCache.hasLoaded(building.id)) setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<PropertiesApiResponse>(
        `${API_ROUTES.PROPERTIES.LIST}?buildingId=${building.id}`
      );
      if (result?.properties) {
        // ADR-300: Write to module-level cache so next remount skips spinner
        buildingPropertiesCache.set(result.properties, building.id);
        setUnits(result.properties);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [building.id]);

  useEffect(() => {
    fetchProperties();
    fetchFloors();
  }, [fetchProperties, fetchFloors]);

  // Real-time: refetch when properties change via RealtimeService events
  useEffect(() => {
    const unsubCreate = RealtimeService.subscribe('UNIT_CREATED', () => fetchProperties());
    const unsubUpdate = RealtimeService.subscribe('UNIT_UPDATED', () => fetchProperties());
    const unsubDelete = RealtimeService.subscribe('UNIT_DELETED', () => fetchProperties());
    return () => { unsubCreate(); unsubUpdate(); unsubDelete(); };
  }, [fetchProperties]);

  const edit = usePropertyInlineEdit(fetchProperties);

  const stats = useMemo(() => ({
    total: units.length,
    available: units.filter(u => u.status === 'for-sale' || u.status === 'for-rent').length,
    totalValue: units.reduce((sum, u) => sum + (u.price || 0), 0),
    totalArea: units.reduce((sum, u) => sum + (u.areas?.gross || u.areas?.net || u.area || 0), 0),
  }), [units]);

  const filteredUnits = useMemo(() => {
    return units.filter(unit => {
      const matchesSearch = !searchTerm ||
        unit.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (unit.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        getPropertyTypeLabel(unit.type, tUnits).toLowerCase().includes(searchTerm.toLowerCase());
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
    await fetchProperties();
  }, [fetchProperties]);

  const handleDeleteClick = async (unit: Property) => {
    await requestDelete(
      {
        id: unit.id,
        name: unit.name,
      },
      async () => {
        setDeletingId(unit.id);
        try {
          await deletePropertyWithPolicy({ propertyId: unit.id });
          success(t('unitStats.deleted'));
          await fetchProperties();
        } catch (err) {
          notifyError(
            translatePropertyMutationError(
              err,
              tUnits,
              'viewer.messages.deleteFailed',
            ),
          );
        } finally {
          setDeletingId(null);
        }
      },
    );
  };

  const handleUnlinkClick = (unit: Property) => {
    setConfirmAction({ type: 'unlink', item: unit });
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    setConfirmLoading(true);
    const { item } = confirmAction;

    try {
      setUnlinkingId(item.id);
      await updatePropertyBuildingLinkWithPolicy({
        propertyId: item.id,
        currentProperty: item,
        buildingId: null,
        floorId: null,
      });
      success(t('unitStats.unlinked'));
      await fetchProperties();
    } catch (err) {
      notifyError(
        translatePropertyMutationError(
          err,
          tUnits,
          'unitStats.error',
        ),
      );
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  };

  const fetchUnlinkedUnits = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<PropertiesApiResponse>(API_ROUTES.PROPERTIES.LIST);
    if (!result?.properties) return [];
    return result.properties
      .filter((u) => !u.buildingId)
      .map((u) => ({
        id: u.id,
        label: u.name,
        sublabel: `${getPropertyTypeLabel(u.type, tUnits)} · ${u.floor || '—'}`,
      }));
  }, [tUnits]);

  const handleLinkUnit = useCallback(async (itemId: string) => {
    const propertyToLink = units.find((unit) => unit.id === itemId);
    if (!propertyToLink) {
      throw new Error(t('unitStats.error'));
    }

    await updatePropertyBuildingLinkWithPolicy({
      propertyId: itemId,
      currentProperty: propertyToLink,
      buildingId: building.id,
      floorId: propertyToLink.floorId ?? null,
    });
    success(t('unitStats.linked'));
    await fetchProperties();
  }, [building.id, fetchProperties, t, units]);

  const getStatusBadge = (status: string) => (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${UNIT_STATUS_COLOR_MAP[status] || UNIT_STATUS_COLOR_MAP.unavailable}`}>
      {getPropertyStatusLabel(status, tUnits)}
    </span>
  );

  const unitColumns: SpaceColumn<Property>[] = useMemo(() => [
    { key: 'name', label: t('tabs.floors.name'), sortValue: (u) => u.name, render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'type', label: t('tabs.labels.properties'), width: 'w-28', sortValue: (u) => u.type, render: (u) => <span className={colors.text.muted}>{getPropertyTypeLabel(u.type, tUnits)}</span> },
    { key: 'floor', label: t('tabs.floors.number'), width: 'w-20', sortValue: (u) => u.floor || '', render: (u) => <span className={cn("font-mono text-sm", colors.text.muted)}>{u.floor}</span> },
    { key: 'area', label: 'm²', width: 'w-20', sortValue: (u) => u.areas?.gross || u.areas?.net || u.area || 0, render: (u) => { const a = u.areas?.gross || u.areas?.net || u.area; return <span className="font-mono text-xs">{a ? `${a}` : '—'}</span>; } },
    { key: 'status', label: t('tabs.labels.details'), width: 'w-28', sortValue: (u) => u.status, render: (u) => getStatusBadge(u.status) },
  ], [t, tUnits]);

  const unitCardFields: SpaceCardField<Property>[] = useMemo(() => [
    buildTypeCodeField(tUnits('card.stats.type'), (u) => getPropertyTypeLabel(u.type, tUnits), (u) => u.code),
    buildFloorField(tUnits('card.stats.floor'), (u) => u.floor != null ? String(u.floor) : undefined),
    buildAreaField((u) => u.areas?.gross || u.areas?.net || u.area),
    buildPriceField(tUnits('table.price'), (u) => u.price),
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
        <Button variant="outline" size="sm" onClick={fetchProperties}>
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

            <Select value={filterType} onValueChange={(val) => setFilterType(val as PropertyType | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allTypes', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes', { ns: 'filters' })}</SelectItem>
                {UNIT_TYPES_FOR_FILTER.map(ut => (
                  <SelectItem key={ut} value={ut}>{getPropertyTypeLabel(ut, tUnits)}</SelectItem>
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
                  <SelectItem key={us} value={us}>{getPropertyStatusLabel(us, tUnits)}</SelectItem>
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

      <UnitQuickCreateSheet
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        building={building}
        floors={floors}
        onCreated={handleCreateSuccess}
      />

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
          <BuildingSpaceCardGrid<Property>
            items={filteredUnits}
            getKey={(u) => u.id}
            getName={(u) => u.name || u.code || u.id}
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
          <BuildingSpaceTable<Property>
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
            renderEditRow={() => <PropertyInlineEditRow edit={edit} tUnits={tUnits} />}
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
        title={t('spaceLink.linkProperty')}
        description={t('spaceLink.linkPropertyDesc')}
        fetchUnlinked={fetchUnlinkedUnits}
        onLink={handleLinkUnit}
      />

      {DeletionDialogs}

      <BuildingSpaceConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={t('spaceConfirm.unlinkProperty')}
        description={
          <>
            {t('spaceConfirm.unlinkPropertyDesc')}
            <br /><br />
            <strong>{confirmAction?.item.name}</strong>
          </>
        }
        confirmLabel={t('spaceActions.unlink')}
        onConfirm={handleConfirm}
        loading={confirmLoading}
        variant="warning"
      />
      {edit.ImpactDialog}
    </section>
  );
}

export default PropertiesTabContent;
