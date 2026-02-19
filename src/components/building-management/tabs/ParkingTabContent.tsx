/**
 * ParkingTabContent — Building Parking Spots Management Tab
 *
 * Lists, creates and manages parking spots for a building.
 * Reads from the same Firestore collection as /spaces/parking (bidirectional sync).
 *
 * @module components/building-management/tabs/ParkingTabContent
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Car, Plus, Check, X, Loader2, Search, CheckCircle, Euro, Ruler, BarChart3, Layers, Table as TableIcon, Link2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { Building } from '@/types/building/contracts';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';
import { RealtimeService } from '@/services/realtime/RealtimeService';
import { BuildingSpaceTable, BuildingSpaceCardGrid, BuildingSpaceConfirmDialog, BuildingSpaceLinkDialog, SpaceFloorplanInline } from '../shared';
import type { SpaceColumn, SpaceCardField, LinkableItem } from '../shared';

// ============================================================================
// CONFIRM ACTION TYPE
// ============================================================================

type ParkingConfirmAction =
  | { type: 'delete'; item: ParkingSpot }
  | { type: 'unlink'; item: ParkingSpot };

// ============================================================================
// TYPES
// ============================================================================

interface ParkingApiResponse {
  parkingSpots: ParkingSpot[];
  count?: number;
}

/** POST /api/parking returns { parkingSpotId } via apiSuccess (unwrapped by apiClient) */
interface ParkingCreateResult {
  parkingSpotId: string;
}

/** PATCH/DELETE /api/parking/[id] returns { id } via apiSuccess */
interface ParkingMutationResult {
  id: string;
}

interface ParkingTabContentProps {
  building: Building;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PARKING_TYPES: ParkingSpotType[] = ['standard', 'handicapped', 'motorcycle', 'electric', 'visitor'];
const PARKING_STATUSES: ParkingSpotStatus[] = ['available', 'occupied', 'reserved', 'sold', 'maintenance'];

const PARKING_TYPE_LABELS: Record<ParkingSpotType, string> = {
  standard: 'Κανονική',
  handicapped: 'ΑμεΑ',
  motorcycle: 'Μοτοσυκλέτα',
  electric: 'Ηλεκτρικό',
  visitor: 'Επισκέπτης',
};

const PARKING_STATUS_LABELS: Record<ParkingSpotStatus, string> = {
  available: 'Διαθέσιμη',
  occupied: 'Κατειλημμένη',
  reserved: 'Δεσμευμένη',
  sold: 'Πωλημένη',
  maintenance: 'Συντήρηση',
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ParkingTabContent({ building }: ParkingTabContentProps) {
  const { t } = useTranslation('parking');
  const { t: tBuilding } = useTranslation('building');

  // Data state
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createStatus, setCreateStatus] = useState<ParkingSpotStatus>('available');
  const [createFloor, setCreateFloor] = useState('');
  const [createLocation, setCreateLocation] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createPrice, setCreatePrice] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState<ParkingSpotType>('standard');
  const [editStatus, setEditStatus] = useState<ParkingSpotStatus>('available');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete & Unlink state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ParkingConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Link dialog state
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  // Expand state (for inline floorplans)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    []
  );

  // Auto-collapse expanded row when editing starts
  useEffect(() => {
    if (editingId) setExpandedId(null);
  }, [editingId]);

  // Filter & view state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<ParkingSpotType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<ParkingSpotStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const iconSizes = useIconSizes();

  // ============================================================================
  // FETCH
  // ============================================================================

  const fetchParkingSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<ParkingApiResponse>(
        `/api/parking?buildingId=${building.id}`
      );
      if (result?.parkingSpots) {
        setParkingSpots(result.parkingSpots);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load parking spots');
    } finally {
      setLoading(false);
    }
  }, [building.id]);

  useEffect(() => {
    fetchParkingSpots();
  }, [fetchParkingSpots]);

  // ============================================================================
  // CREATE
  // ============================================================================

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setCreateNumber('');
    setCreateType('standard');
    setCreateStatus('available');
    setCreateFloor('');
    setCreateLocation('');
    setCreateArea('');
    setCreatePrice('');
    setCreateNotes('');
  };

  const handleCreate = async () => {
    if (!createNumber.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.post<ParkingCreateResult>('/api/parking', {
        number: createNumber.trim(),
        type: createType,
        status: createStatus,
        floor: createFloor.trim() || undefined,
        location: createLocation.trim() || undefined,
        area: createArea ? parseFloat(createArea) : undefined,
        price: createPrice ? parseFloat(createPrice) : undefined,
        notes: createNotes.trim() || undefined,
        buildingId: building.id,
        projectId: building.projectId,
      });
      if (result?.parkingSpotId) {
        RealtimeService.dispatch('PARKING_CREATED', {
          parkingSpotId: result.parkingSpotId,
          parkingSpot: {
            number: createNumber.trim(),
            buildingId: building.id,
            type: createType,
            status: createStatus,
          },
          timestamp: Date.now(),
        });
        resetCreateForm();
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT
  // ============================================================================

  const startEdit = (spot: ParkingSpot) => {
    setEditingId(spot.id);
    setEditNumber(spot.number);
    setEditType(spot.type || 'standard');
    setEditStatus(spot.status || 'available');
    setEditFloor(spot.floor || '');
    setEditArea(spot.area ? String(spot.area) : '');
    setEditPrice(spot.price ? String(spot.price) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editNumber.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<ParkingMutationResult>(`/api/parking/${editingId}`, {
        number: editNumber.trim(),
        type: editType,
        status: editStatus,
        floor: editFloor.trim() || undefined,
        area: editArea ? parseFloat(editArea) : undefined,
        price: editPrice ? parseFloat(editPrice) : undefined,
      });
      if (result?.id) {
        RealtimeService.dispatch('PARKING_UPDATED', {
          parkingSpotId: editingId,
          updates: {
            number: editNumber.trim(),
            type: editType,
            status: editStatus,
            floor: editFloor.trim() || undefined,
            area: editArea ? parseFloat(editArea) : undefined,
            price: editPrice ? parseFloat(editPrice) : undefined,
          },
          timestamp: Date.now(),
        });
        setEditingId(null);
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE
  // ============================================================================

  const handleDeleteClick = (spot: ParkingSpot) => {
    setConfirmAction({ type: 'delete', item: spot });
  };

  // ============================================================================
  // UNLINK — Disassociate parking spot from building (keeps spot in system)
  // ============================================================================

  const handleUnlinkClick = (spot: ParkingSpot) => {
    setConfirmAction({ type: 'unlink', item: spot });
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    setConfirmLoading(true);
    const { type, item } = confirmAction;

    try {
      if (type === 'delete') {
        setDeletingId(item.id);
        const result = await apiClient.delete<ParkingMutationResult>(
          `/api/parking/${item.id}`
        );
        if (result?.id) {
          RealtimeService.dispatch('PARKING_DELETED', {
            parkingSpotId: item.id,
            timestamp: Date.now(),
          });
        }
      } else {
        setUnlinkingId(item.id);
        const result = await apiClient.patch<ParkingMutationResult>(
          `/api/parking/${item.id}`,
          { buildingId: null }
        );
        if (result?.id) {
          RealtimeService.dispatch('PARKING_UPDATED', {
            parkingSpotId: item.id,
            updates: { buildingId: null },
            timestamp: Date.now(),
          });
        }
      }
      await fetchParkingSpots();
    } catch (err) {
      console.error(`[ParkingTab] ${type} error:`, err);
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
      setDeletingId(null);
      setUnlinkingId(null);
    }
  };

  // ============================================================================
  // LINK — Fetch unlinked parking spots + link to this building
  // ============================================================================

  const fetchUnlinkedParking = useCallback(async (): Promise<LinkableItem[]> => {
    const result = await apiClient.get<ParkingApiResponse>('/api/parking');
    if (!result?.parkingSpots) return [];
    return result.parkingSpots
      .filter((s) => !s.buildingId)
      .map((s) => ({
        id: s.id,
        label: s.number,
        sublabel: `${PARKING_TYPE_LABELS[s.type || 'standard']} · ${s.floor || '—'}`,
      }));
  }, []);

  const handleLinkParking = useCallback(async (itemId: string) => {
    await apiClient.patch<ParkingMutationResult>(`/api/parking/${itemId}`, {
      buildingId: building.id,
    });
    RealtimeService.dispatch('PARKING_UPDATED', {
      parkingSpotId: itemId,
      updates: { buildingId: building.id },
      timestamp: Date.now(),
    });
    await fetchParkingSpots();
  }, [building.id, fetchParkingSpots]);

  // ============================================================================
  // COMPUTED: Stats & Filtered Data
  // ============================================================================

  const stats = useMemo(() => ({
    total: parkingSpots.length,
    available: parkingSpots.filter(s => s.status === 'available').length,
    totalValue: parkingSpots.reduce((sum, s) => sum + (s.price || 0), 0),
    totalArea: parkingSpots.reduce((sum, s) => sum + (s.area || 0), 0),
  }), [parkingSpots]);

  const filteredSpots = useMemo(() => {
    return parkingSpots.filter(spot => {
      const matchesSearch = !searchTerm ||
        spot.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (spot.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || spot.type === filterType;
      const matchesStatus = filterStatus === 'all' || spot.status === filterStatus;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [parkingSpots, searchTerm, filterType, filterStatus]);

  const dashboardStats: DashboardStat[] = useMemo(() => [
    { title: tBuilding('parkingStats.total'), value: stats.total, icon: Car, color: 'blue' },
    { title: tBuilding('parkingStats.available'), value: stats.available, icon: CheckCircle, color: 'green' },
    { title: tBuilding('parkingStats.totalValue'), value: `€${(stats.totalValue / 1000).toFixed(0)}K`, icon: Euro, color: 'gray' },
    { title: tBuilding('parkingStats.totalArea'), value: `${stats.totalArea.toFixed(1)} m²`, icon: Ruler, color: 'blue' },
  ], [stats, tBuilding]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status: ParkingSpotStatus | undefined) => {
    const s = status || 'available';
    const colorMap: Record<string, string> = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      occupied: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      maintenance: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[s] || colorMap.available}`}>
        {PARKING_STATUS_LABELS[s] || s}
      </span>
    );
  };

  // ============================================================================
  // CENTRALIZED: Column & Card Field Definitions
  // ============================================================================

  const parkingColumns: SpaceColumn<ParkingSpot>[] = useMemo(() => [
    { key: 'number', label: 'Κωδικός', sortValue: (s) => s.number, render: (s) => <span className="font-mono font-medium">{s.number}</span> },
    { key: 'type', label: 'Τύπος', width: 'w-28', sortValue: (s) => s.type || 'standard', render: (s) => <span className="text-muted-foreground">{PARKING_TYPE_LABELS[s.type || 'standard']}</span> },
    { key: 'floor', label: 'Όροφος', width: 'w-20', sortValue: (s) => s.floor || '', render: (s) => <span className="text-muted-foreground">{s.floor || '—'}</span> },
    { key: 'area', label: 'm²', width: 'w-20', sortValue: (s) => s.area || 0, render: (s) => <span className="font-mono text-xs">{s.area ? `${s.area}` : '—'}</span> },
    { key: 'price', label: 'Τιμή', width: 'w-24', sortValue: (s) => s.price || 0, render: (s) => <span className="font-mono text-xs">{s.price ? `€${s.price.toLocaleString()}` : '—'}</span> },
    { key: 'status', label: 'Κατάσταση', width: 'w-28', sortValue: (s) => s.status || '', render: (s) => getStatusBadge(s.status) },
  ], []);

  const parkingCardFields: SpaceCardField<ParkingSpot>[] = useMemo(() => [
    { label: 'Τύπος', render: (s) => PARKING_TYPE_LABELS[s.type || 'standard'] },
    { label: 'Όροφος', render: (s) => s.floor || '—' },
    { label: 'm²', render: (s) => s.area || '—' },
    { label: 'Τιμή', render: (s) => s.price ? `€${s.price.toLocaleString()}` : '—' },
  ], []);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <section className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col items-center gap-2 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchParkingSpots}>
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
          <Car className="h-5 w-5 text-primary" />
          {tBuilding('tabs.labels.parking')}
          <span className="text-sm font-normal text-muted-foreground">({parkingSpots.length})</span>
        </h2>
        <nav className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkDialog(true)}
          >
            <Link2 className="mr-1 h-4 w-4" />
            {tBuilding('spaceLink.linkExisting')}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            disabled={showCreateForm}
          >
            <Plus className="mr-1 h-4 w-4" />
            {tBuilding('tabs.labels.parking')}
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
                placeholder={tBuilding('parkingStats.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </label>

            <Select value={filterType} onValueChange={(val) => setFilterType(val as ParkingSpotType | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allTypes', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes', { ns: 'filters' })}</SelectItem>
                {PARKING_TYPES.map(pt => (
                  <SelectItem key={pt} value={pt}>{PARKING_TYPE_LABELS[pt]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val as ParkingSpotStatus | 'all')}>
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses', { ns: 'filters' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStatuses', { ns: 'filters' })}</SelectItem>
                {PARKING_STATUSES.map(ps => (
                  <SelectItem key={ps} value={ps}>{PARKING_STATUS_LABELS[ps]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className={iconSizes.sm} />
              {tBuilding('parkingStats.exportReport')}
            </Button>
          </fieldset>
        </CardContent>
      </Card>

      {/* Create Form — Expanded with all parking fields */}
      {showCreateForm && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          {/* Row 1: Number, Type, Status */}
          <fieldset className="grid grid-cols-3 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Κωδικός *
              </span>
              <Input
                value={createNumber}
                onChange={(e) => setCreateNumber(e.target.value)}
                placeholder="P-001"
                className="h-9"
                disabled={creating}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Τύπος
              </span>
              <select
                value={createType}
                onChange={(e) => setCreateType(e.target.value as ParkingSpotType)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                disabled={creating}
              >
                {PARKING_TYPES.map(pt => (
                  <option key={pt} value={pt}>{PARKING_TYPE_LABELS[pt]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Κατάσταση
              </span>
              <select
                value={createStatus}
                onChange={(e) => setCreateStatus(e.target.value as ParkingSpotStatus)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                disabled={creating}
              >
                {PARKING_STATUSES.map(ps => (
                  <option key={ps} value={ps}>{PARKING_STATUS_LABELS[ps]}</option>
                ))}
              </select>
            </label>
          </fieldset>

          {/* Row 2: Floor, Location, Area, Price */}
          <fieldset className="grid grid-cols-4 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Όροφος
              </span>
              <Input
                value={createFloor}
                onChange={(e) => setCreateFloor(e.target.value)}
                placeholder="-1"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Τοποθεσία
              </span>
              <Input
                value={createLocation}
                onChange={(e) => setCreateLocation(e.target.value)}
                placeholder="Πυλωτή, Υπόγειο Α"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                m²
              </span>
              <Input
                type="number"
                step="0.01"
                value={createArea}
                onChange={(e) => setCreateArea(e.target.value)}
                placeholder="12"
                className="h-9"
                disabled={creating}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Τιμή (€)
              </span>
              <Input
                type="number"
                step="0.01"
                value={createPrice}
                onChange={(e) => setCreatePrice(e.target.value)}
                placeholder="15000"
                className="h-9"
                disabled={creating}
              />
            </label>
          </fieldset>

          {/* Row 3: Notes */}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              Σημειώσεις
            </span>
            <Textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Σημειώσεις θέσης στάθμευσης..."
              className="h-16 resize-none"
              disabled={creating}
            />
          </label>

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
              disabled={!createNumber.trim() || creating}
            >
              {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              Αποθήκευση
            </Button>
          </nav>
        </form>
      )}

      {/* View Toggle */}
      <nav className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filteredSpots.length} αποτελέσματα
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
      {filteredSpots.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {tBuilding('tabs.labels.parking')} — 0
        </p>
      ) : viewMode === 'cards' ? (
        <>
          <BuildingSpaceCardGrid<ParkingSpot>
            items={filteredSpots}
            getKey={(s) => s.id}
            getName={(s) => s.number}
            renderStatus={(s) => getStatusBadge(s.status)}
            fields={parkingCardFields}
            actions={{
              onView: () => {},
              onEdit: startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            renderExpandedContent={(s) => (
              <SpaceFloorplanInline
                entityType="parking_spot"
                entityId={s.id}
                entityLabel={s.number}
                projectId={building.projectId}
              />
            )}
          />
          <footer className="text-xs text-muted-foreground">
            {filteredSpots.length} {tBuilding('tabs.labels.parking')}
          </footer>
        </>
      ) : (
        <>
          <BuildingSpaceTable<ParkingSpot>
            items={filteredSpots}
            columns={parkingColumns}
            getKey={(s) => s.id}
            actions={{
              onView: () => {},
              onEdit: startEdit,
              onUnlink: handleUnlinkClick,
              onDelete: handleDeleteClick,
            }}
            actionState={{ unlinkingId, deletingId }}
            editingId={editingId}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
            renderExpandedContent={(s) => (
              <SpaceFloorplanInline
                entityType="parking_spot"
                entityId={s.id}
                entityLabel={s.number}
                projectId={building.projectId}
              />
            )}
            renderEditRow={() => (
              <>
                <TableCell>
                  <Input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} className="h-8" disabled={saving} />
                </TableCell>
                <TableCell>
                  <select value={editType} onChange={(e) => setEditType(e.target.value as ParkingSpotType)} className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm" disabled={saving}>
                    {PARKING_TYPES.map(pt => (<option key={pt} value={pt}>{PARKING_TYPE_LABELS[pt]}</option>))}
                  </select>
                </TableCell>
                <TableCell>
                  <Input value={editFloor} onChange={(e) => setEditFloor(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={editArea} onChange={(e) => setEditArea(e.target.value)} className="h-8 w-16" disabled={saving} />
                </TableCell>
                <TableCell>
                  <Input type="number" step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="h-8 w-20" disabled={saving} />
                </TableCell>
                <TableCell>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value as ParkingSpotStatus)} className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm" disabled={saving}>
                    {PARKING_STATUSES.map(ps => (<option key={ps} value={ps}>{PARKING_STATUS_LABELS[ps]}</option>))}
                  </select>
                </TableCell>
                <TableCell>
                  <nav className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveEdit} disabled={saving || !editNumber.trim()}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
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
            {filteredSpots.length} {tBuilding('tabs.labels.parking')}
            {filteredSpots.length !== parkingSpots.length && (
              <span className="ml-1">({parkingSpots.length} σύνολο)</span>
            )}
          </footer>
        </>
      )}
      {/* Link Existing Dialog */}
      <BuildingSpaceLinkDialog
        open={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        title={tBuilding('spaceLink.linkParking')}
        description={tBuilding('spaceLink.linkParkingDesc')}
        fetchUnlinked={fetchUnlinkedParking}
        onLink={handleLinkParking}
      />

      {/* Centralized Confirm Dialog (delete / unlink) */}
      <BuildingSpaceConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title={
          confirmAction?.type === 'delete'
            ? tBuilding('spaceConfirm.deleteParking')
            : tBuilding('spaceConfirm.unlinkParking')
        }
        description={
          confirmAction?.type === 'delete' ? (
            <>
              {tBuilding('spaceConfirm.deleteParkingDesc')}{' '}
              <strong>&quot;{confirmAction.item.number}&quot;</strong>;
              <br /><br />
              {tBuilding('spaceConfirm.irreversible')}
            </>
          ) : (
            <>
              {tBuilding('spaceConfirm.unlinkParkingDesc')}
              <br /><br />
              <strong>{confirmAction?.item.number}</strong>
            </>
          )
        }
        confirmLabel={
          confirmAction?.type === 'delete'
            ? tBuilding('spaceActions.delete')
            : tBuilding('spaceActions.unlink')
        }
        onConfirm={handleConfirm}
        loading={confirmLoading}
        variant={confirmAction?.type === 'delete' ? 'destructive' : 'warning'}
      />
    </section>
  );
}

export default ParkingTabContent;
