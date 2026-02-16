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

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Car, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { Building } from '@/types/building/contracts';
import type { ParkingSpot, ParkingSpotType, ParkingSpotStatus } from '@/hooks/useFirestoreParkingSpots';

// ============================================================================
// TYPES
// ============================================================================

interface ParkingApiResponse {
  parkingSpots: ParkingSpot[];
  count?: number;
}

interface ParkingMutationResponse {
  success: boolean;
  parkingSpot?: ParkingSpot;
  message?: string;
  error?: string;
}

interface ParkingTabContentProps {
  building: Building;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PARKING_TYPES: ParkingSpotType[] = ['standard', 'handicapped', 'motorcycle', 'electric', 'visitor'];

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

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('');
  const [createType, setCreateType] = useState<ParkingSpotType>('standard');
  const [createFloor, setCreateFloor] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editType, setEditType] = useState<ParkingSpotType>('standard');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================================================
  // FETCH PARKING SPOTS
  // ============================================================================

  const fetchParkingSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try buildingId-filtered query first; fallback to full list + client filter
      let result: ParkingApiResponse | null = null;
      try {
        result = await apiClient.get<ParkingApiResponse>(
          `/api/parking?buildingId=${building.id}`
        );
      } catch {
        // Tenant isolation may reject — fallback to unfiltered + client filter
        const allResult = await apiClient.get<ParkingApiResponse>('/api/parking');
        if (allResult?.parkingSpots) {
          result = {
            parkingSpots: allResult.parkingSpots.filter(s => s.buildingId === building.id),
            count: 0,
          };
        }
      }
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
  // CREATE PARKING SPOT
  // ============================================================================

  const handleCreate = async () => {
    if (!createNumber.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.post<ParkingMutationResponse>('/api/parking', {
        number: createNumber.trim(),
        type: createType,
        floor: createFloor.trim(),
        area: createArea ? parseFloat(createArea) : undefined,
        buildingId: building.id,
        projectId: building.projectId,
        status: 'available' as ParkingSpotStatus,
      });
      if (result?.success) {
        setShowCreateForm(false);
        setCreateNumber('');
        setCreateType('standard');
        setCreateFloor('');
        setCreateArea('');
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT PARKING SPOT
  // ============================================================================

  const startEdit = (spot: ParkingSpot) => {
    setEditingId(spot.id);
    setEditNumber(spot.number);
    setEditType(spot.type || 'standard');
    setEditFloor(spot.floor || '');
    setEditArea(spot.area ? String(spot.area) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editNumber.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<ParkingMutationResponse>(`/api/parking/${editingId}`, {
        number: editNumber.trim(),
        type: editType,
        floor: editFloor.trim(),
        area: editArea ? parseFloat(editArea) : undefined,
      });
      if (result?.success) {
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
  // DELETE PARKING SPOT
  // ============================================================================

  const handleDelete = async (spot: ParkingSpot) => {
    const confirmed = window.confirm(
      `${tBuilding('tabs.labels.parking')}: ${spot.number} — Delete?`
    );
    if (!confirmed) return;

    setDeletingId(spot.id);
    try {
      const result = await apiClient.delete<ParkingMutationResponse>(
        `/api/parking/${spot.id}`
      );
      if (result?.success) {
        await fetchParkingSpots();
      }
    } catch (err) {
      console.error('[ParkingTab] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

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
        {t(`status.${s}`)}
      </span>
    );
  };

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
      <section className="flex flex-col items-center gap-3 py-12">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchParkingSpots}>
          Retry
        </Button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 p-4">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Car className="h-5 w-5 text-primary" />
          {tBuilding('tabs.labels.parking')}
          <span className="text-sm font-normal text-muted-foreground">({parkingSpots.length})</span>
        </h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <Plus className="mr-1 h-4 w-4" />
          {tBuilding('tabs.labels.parking')}
        </Button>
      </header>

      {/* Inline Create Form */}
      {showCreateForm && (
        <form
          className="grid grid-cols-[1fr_120px_80px_80px_auto] items-end gap-2 rounded-lg border border-border bg-muted/30 p-3"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('general.fields.spotCode')}
            </label>
            <Input
              value={createNumber}
              onChange={(e) => setCreateNumber(e.target.value)}
              placeholder="P-001"
              className="h-9"
              disabled={creating}
              autoFocus
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('general.fields.type')}
            </label>
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value as ParkingSpotType)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              disabled={creating}
            >
              {PARKING_TYPES.map(pt => (
                <option key={pt} value={pt}>{t(`types.${pt}`)}</option>
              ))}
            </select>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('general.fields.floor')}
            </label>
            <Input
              value={createFloor}
              onChange={(e) => setCreateFloor(e.target.value)}
              placeholder="-1"
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              m²
            </label>
            <Input
              type="number"
              step="0.01"
              value={createArea}
              onChange={(e) => setCreateArea(e.target.value)}
              placeholder="12"
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <nav className="flex gap-1">
            <Button
              type="submit"
              size="sm"
              disabled={!createNumber.trim() || creating}
              className="h-9"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateForm(false)}
              disabled={creating}
              className="h-9"
            >
              <X className="h-4 w-4" />
            </Button>
          </nav>
        </form>
      )}

      {/* Table */}
      {parkingSpots.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {tBuilding('tabs.labels.parking')} — 0
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-3 py-2">{t('general.fields.spotCode')}</th>
                <th className="w-28 px-3 py-2">{t('general.fields.type')}</th>
                <th className="w-20 px-3 py-2">{t('general.fields.floor')}</th>
                <th className="w-20 px-3 py-2">m²</th>
                <th className="w-28 px-3 py-2">{t('general.fields.status')}</th>
                <th className="w-24 px-3 py-2 text-right">{tBuilding('tabs.floors.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {parkingSpots.map((spot) => (
                <tr key={spot.id} className="border-b border-border/50 hover:bg-muted/20">
                  {editingId === spot.id ? (
                    <>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="h-8"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as ParkingSpotType)}
                          className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm"
                          disabled={saving}
                        >
                          {PARKING_TYPES.map(pt => (
                            <option key={pt} value={pt}>{t(`types.${pt}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editFloor}
                          onChange={(e) => setEditFloor(e.target.value)}
                          className="h-8 w-16"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={editArea}
                          onChange={(e) => setEditArea(e.target.value)}
                          className="h-8 w-16"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">{getStatusBadge(spot.status)}</td>
                      <td className="px-3 py-1.5">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            disabled={saving || !editNumber.trim()}
                          >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-500" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </nav>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono font-medium">{spot.number}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t(`types.${spot.type || 'standard'}`)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{spot.floor || '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">{spot.area ? `${spot.area}` : '—'}</td>
                      <td className="px-3 py-2">{getStatusBadge(spot.status)}</td>
                      <td className="px-3 py-2">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(spot)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(spot)}
                            disabled={deletingId === spot.id}
                          >
                            {deletingId === spot.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </nav>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="text-xs text-muted-foreground">
            {parkingSpots.length} {tBuilding('tabs.labels.parking')}
          </footer>
        </>
      )}
    </section>
  );
}

export default ParkingTabContent;
