/**
 * UnitsTabContent — Building Units Management Tab
 *
 * Lists building units (apartments, shops, offices, etc.) filtered by buildingId.
 * Inline create/edit forms — same pattern as ParkingTabContent & StorageTab.
 *
 * @module components/building-management/tabs/UnitsTabContent
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatCurrencyWhole } from '@/lib/intl-utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { createUnit } from '@/services/units.service';
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
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog } from '../shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from '../shared';
import { ENTITY_ROUTES } from '@/lib/routes';
import { useDeletionGuard } from '@/hooks/useDeletionGuard';

// ============================================================================
// CONFIRM ACTION TYPE
// ============================================================================

type UnitConfirmAction =
  | { type: 'delete'; item: Unit }
  | { type: 'unlink'; item: Unit };

// ============================================================================
// TYPES
// ============================================================================

interface UnitsApiResponse {
  units: Unit[];
  count?: number;
}

interface FloorRecord {
  id: string;
  number: number;
  name: string;
}

interface FloorsApiResponse {
  floors: FloorRecord[];
}

interface UnitsTabContentProps {
  building: Building;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: 'Διαμέρισμα',
  studio: 'Στούντιο',
  apartment_1br: 'Γκαρσονιέρα',
  apartment_2br: 'Διαμέρισμα 2Δ',
  apartment_3br: 'Διαμέρισμα 3Δ',
  maisonette: 'Μεζονέτα',
  shop: 'Κατάστημα',
  office: 'Γραφείο',
  storage: 'Αποθήκη',
};

const UNIT_TYPES_FOR_FILTER: UnitType[] = [
  'studio', 'apartment_1br', 'apartment', 'apartment_2br', 'apartment_3br',
  'maisonette', 'shop', 'office', 'storage',
];

const UNIT_STATUS_LABELS: Record<string, string> = {
  'for-sale': 'Προς Πώληση',
  'for-rent': 'Προς Ενοικίαση',
  sold: 'Πωλημένη',
  reserved: 'Δεσμευμένη',
  rented: 'Ενοικιασμένη',
  'under-negotiation': 'Υπό Διαπραγμάτευση',
  unavailable: 'Μη Διαθέσιμη',
};

const UNIT_STATUSES_FOR_FILTER = ['for-sale', 'for-rent', 'sold', 'reserved', 'rented', 'under-negotiation', 'unavailable'] as const;

// ============================================================================
// COMPONENT
// ============================================================================

export function UnitsTabContent({ building }: UnitsTabContentProps) {
  const { t } = useTranslation('building');
  const { success, error: notifyError } = useNotifications();
  const router = useRouter();

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [createType, setCreateType] = useState<UnitType | ''>('apartment');
  const [createFloor, setCreateFloor] = useState('');
  const [createAreaNet, setCreateAreaNet] = useState('');
  const [createAreaGross, setCreateAreaGross] = useState('');
  const [createBedrooms, setCreateBedrooms] = useState('');
  const [createBathrooms, setCreateBathrooms] = useState('');
  const [createWC, setCreateWC] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<UnitType | ''>('apartment');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editStatus, setEditStatus] = useState('for-sale');
  const [saving, setSaving] = useState(false);

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

  // ============================================================================
  // FETCH UNITS & FLOORS
  // ============================================================================

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

  // ============================================================================
  // COMPUTED: Stats & Filtered Data
  // ============================================================================

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
        getTypeLabel(unit.type).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || unit.type === filterType;
      const matchesStatus = filterStatus === 'all' || unit.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [units, searchTerm, filterType, filterStatus]);

  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: t('unitStats.total'), value: stats.total, icon: Home, color: 'blue' },
    { title: t('unitStats.available'), value: stats.available, icon: CheckCircle, color: 'green' },
    { title: t('unitStats.totalValue'), value: `€${(stats.totalValue / 1000).toFixed(0)}K`, icon: Euro, color: 'gray' },
    { title: t('unitStats.totalArea'), value: `${stats.totalArea.toFixed(1)} m²`, icon: Ruler, color: 'blue' },
  ], [stats, t]);

  // ============================================================================
  // CREATE — Inline form
  // ============================================================================

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setCreateName('');
    setCreateCode('');
    setCreateType('apartment');
    setCreateFloor('');
    setCreateAreaNet('');
    setCreateAreaGross('');
    setCreateBedrooms('');
    setCreateBathrooms('');
    setCreateWC('');
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      notifyError('Το όνομα είναι υποχρεωτικό');
      return;
    }

    setCreating(true);
    try {
      const unitData: Record<string, unknown> = {
        name: createName.trim(),
        type: createType || 'apartment',
        buildingId: building.id,
        building: building.name || '',
        floor: createFloor ? parseInt(createFloor, 10) : 0,
        project: '',
        status: 'for-sale',
        operationalStatus: 'draft',
        vertices: [],
      };

      if (createCode.trim()) unitData.code = createCode.trim();

      const areas: Record<string, number> = {};
      if (createAreaNet) areas.net = parseFloat(createAreaNet);
      if (createAreaGross) areas.gross = parseFloat(createAreaGross);
      if (Object.keys(areas).length > 0) unitData.areas = areas;
      if (createAreaNet) unitData.area = parseFloat(createAreaNet);

      const layout: Record<string, number> = {};
      if (createBedrooms) layout.bedrooms = parseInt(createBedrooms, 10);
      if (createBathrooms) layout.bathrooms = parseInt(createBathrooms, 10);
      if (createWC) layout.wc = parseInt(createWC, 10);
      if (Object.keys(layout).length > 0) unitData.layout = layout;

      const result = await createUnit(unitData);

      if (result.success) {
        success('Η μονάδα δημιουργήθηκε');
        resetCreateForm();
        await fetchUnits();
      } else {
        notifyError(result.error || 'Σφάλμα δημιουργίας');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα δημιουργίας';
      notifyError(msg);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT — Inline table row editing
  // ============================================================================

  const startEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditName(unit.name || '');
    setEditType(unit.type || 'apartment');
    setEditFloor(unit.floor ? String(unit.floor) : '');
    setEditArea(unit.area ? String(unit.area) : '');
    setEditStatus(unit.status || 'for-sale');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      await apiClient.patch(API_ROUTES.UNITS.BY_ID(editingId), {
        name: editName.trim(),
        type: editType || undefined,
        floor: editFloor ? parseInt(editFloor, 10) : undefined,
        area: editArea ? parseFloat(editArea) : undefined,
        status: editStatus || undefined,
      });
      success('Η μονάδα ενημερώθηκε');
      setEditingId(null);
      await fetchUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα ενημέρωσης';
      notifyError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE & UNLINK
  // ============================================================================

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
        success('Η μονάδα διαγράφηκε');
      } else {
        setUnlinkingId(item.id);
        await apiClient.patch(API_ROUTES.UNITS.BY_ID(item.id), { buildingId: null });
        success('Η μονάδα αποσυνδέθηκε');
      }
      await fetchUnits();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Σφάλμα';
      notifyError(msg);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  };

  // ============================================================================
  // LINK — Fetch unlinked units + link to this building
  // ============================================================================

  const fetchUnlinkedUnits = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<UnitsApiResponse>(API_ROUTES.UNITS.LIST);
    if (!result?.units) return [];
    return result.units
      .filter((u) => !u.buildingId)
      .map((u) => ({
        id: u.id,
        label: u.name,
        sublabel: `${UNIT_TYPE_LABELS[u.type] || u.type} · ${u.floor || '—'}`,
      }));
  }, []);

  const handleLinkUnit = useCallback(async (itemId: string) => {
    await apiClient.patch(API_ROUTES.UNITS.BY_ID(itemId), { buildingId: building.id });
    success('Η μονάδα συνδέθηκε');
    await fetchUnits();
  }, [building.id, fetchUnits]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'for-sale': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'for-rent': 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      rented: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      'under-negotiation': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      unavailable: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}`}>
        {UNIT_STATUS_LABELS[status] || status}
      </span>
    );
  };

  const getTypeLabel = (type: UnitType): string => {
    return UNIT_TYPE_LABELS[type] || type;
  };

  // ============================================================================
  // CENTRALIZED: Column & Card Field Definitions
  // ============================================================================

  const unitColumns: SpaceColumn<Unit>[] = useMemo(() => [
    { key: 'name', label: t('tabs.floors.name'), sortValue: (u) => u.name, render: (u) => <span className="font-medium">{u.name}</span> },
    { key: 'type', label: t('tabs.labels.properties'), width: 'w-28', sortValue: (u) => u.type, render: (u) => <span className="text-muted-foreground">{getTypeLabel(u.type)}</span> },
    { key: 'floor', label: t('tabs.floors.number'), width: 'w-20', sortValue: (u) => u.floor || '', render: (u) => <span className="font-mono text-sm text-muted-foreground">{u.floor}</span> },
    { key: 'area', label: 'm²', width: 'w-20', sortValue: (u) => u.area || 0, render: (u) => <span className="font-mono text-xs">{u.area ? `${u.area}` : '—'}</span> },
    { key: 'status', label: t('tabs.labels.details'), width: 'w-28', sortValue: (u) => u.status, render: (u) => getStatusBadge(u.status) },
  ], [t]);

  const unitCardFields: SpaceCardField<Unit>[] = useMemo(() => [
    { label: 'Τύπος', render: (u) => getTypeLabel(u.type) },
    { label: 'Όροφος', render: (u) => u.floor || '—' },
    { label: 'm²', render: (u) => u.area || '—' },
    { label: 'Τιμή', render: (u) => formatCurrencyWhole(u.price) },
  ], []);

  // ============================================================================
  // RENDER
  // ============================================================================

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
          Retry
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
          <span className="text-sm font-normal text-muted-foreground">({units.length})</span>
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
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${iconSizes.sm}`} />
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
                  <SelectItem key={ut} value={ut}>{UNIT_TYPE_LABELS[ut] || ut}</SelectItem>
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
                  <SelectItem key={us} value={us}>{UNIT_STATUS_LABELS[us] || us}</SelectItem>
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

      {/* Inline Create Form */}
      {showCreateForm && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          {/* Row 1: Name, Code, Type */}
          <fieldset className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Όνομα *
              </span>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Διαμέρισμα Α1"
                className="h-9"
                disabled={creating}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Κωδικός
              </span>
              <Input
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="A-101"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Τύπος
              </span>
              <Select value={createType || 'apartment'} onValueChange={(v) => setCreateType(v as UnitType)} disabled={creating}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_TYPES_FOR_FILTER.map(ut => (
                    <SelectItem key={ut} value={ut}>{UNIT_TYPE_LABELS[ut] || ut}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </fieldset>

          {/* Row 2: Floor, Net m², Gross m², Bedrooms, Bathrooms, WC */}
          <fieldset className="grid grid-cols-6 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Όροφος
              </span>
              {floors.length > 0 ? (
                <Select value={createFloor} onValueChange={setCreateFloor} disabled={creating}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Επιλέξτε..." />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map(f => (
                      <SelectItem key={f.id} value={String(f.number)}>
                        {f.name} ({f.number})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type="number"
                  value={createFloor}
                  onChange={(e) => setCreateFloor(e.target.value)}
                  placeholder="0"
                  className="h-9"
                  disabled={creating}
                />
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Καθαρά m²
              </span>
              <Input
                type="number"
                step="0.1"
                value={createAreaNet}
                onChange={(e) => setCreateAreaNet(e.target.value)}
                placeholder="75"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Μικτά m²
              </span>
              <Input
                type="number"
                step="0.1"
                value={createAreaGross}
                onChange={(e) => setCreateAreaGross(e.target.value)}
                placeholder="90"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Υ/Δ
              </span>
              <Input
                type="number"
                value={createBedrooms}
                onChange={(e) => setCreateBedrooms(e.target.value)}
                placeholder="2"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Μπάνια
              </span>
              <Input
                type="number"
                value={createBathrooms}
                onChange={(e) => setCreateBathrooms(e.target.value)}
                placeholder="1"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                WC
              </span>
              <Input
                type="number"
                value={createWC}
                onChange={(e) => setCreateWC(e.target.value)}
                placeholder="1"
                className="h-9"
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Actions */}
          <nav className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetCreateForm}
              disabled={creating}
            >
              <X className="mr-1 h-4 w-4" />
              Ακύρωση
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!createName.trim() || creating}
            >
              {creating ? <Spinner size="small" color="inherit" className="mr-1" /> : <Check className="mr-1 h-4 w-4" />}
              Αποθήκευση
            </Button>
          </nav>
        </form>
      )}

      {/* View Toggle */}
      <nav className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredUnits.length} αποτελέσματα
        </span>
        <fieldset className="flex items-center gap-2">
          <Button variant={viewMode === 'cards' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('cards')}>
            <Layers className="mr-1 h-4 w-4" /> Κάρτες
          </Button>
          <Button variant={viewMode === 'table' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('table')}>
            <TableIcon className="mr-1 h-4 w-4" /> Πίνακας
          </Button>
        </fieldset>
      </nav>

      {/* Content — Centralized shared components */}
      {filteredUnits.length === 0 ? (
        <p className="py-2 text-center text-sm text-muted-foreground">
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
              onView: (u) => router.push(ENTITY_ROUTES.units.withId(u.id)),
              onEdit: startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
          />
          <footer className="text-xs text-muted-foreground">
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
              onView: (u) => router.push(ENTITY_ROUTES.units.withId(u.id)),
              onEdit: startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
            editingId={editingId}
            renderEditRow={() => (
              <>
                <TableCell>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Select value={editType || 'apartment'} onValueChange={(v) => setEditType(v as UnitType)} disabled={saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPES_FOR_FILTER.map(ut => (<SelectItem key={ut} value={ut}>{UNIT_TYPE_LABELS[ut] || ut}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input type="number" value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={editArea} onChange={(e) => setEditArea(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Select value={editStatus} onValueChange={setEditStatus} disabled={saving}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_STATUSES_FOR_FILTER.map(us => (<SelectItem key={us} value={us}>{UNIT_STATUS_LABELS[us] || us}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <nav className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving || !editName.trim()}>
                      {saving ? <Spinner size="small" color="inherit" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} disabled={saving}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </nav>
                </TableCell>
              </>
            )}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredUnits.length} {t('tabs.labels.units')}
            {filteredUnits.length !== units.length && (
              <span className="ml-1">({units.length} σύνολο)</span>
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

      {/* 🛡️ ADR-226: Deletion Guard blocked dialog */}
      {BlockedDialog}

      {/* Centralized Confirm Dialog (delete / unlink) */}
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
