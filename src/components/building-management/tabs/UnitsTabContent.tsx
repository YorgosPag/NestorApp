/**
 * UnitsTabContent — Building Units Management Tab
 *
 * Lists building units (apartments, shops, offices, etc.) filtered by buildingId.
 * Reads from the same Firestore collection as /spaces/units (bidirectional sync).
 *
 * @module components/building-management/tabs/UnitsTabContent
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Home, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { Building } from '@/types/building/contracts';
import type { Unit, UnitType } from '@/types/unit';

// ============================================================================
// TYPES
// ============================================================================

interface UnitsApiResponse {
  units: Unit[];
  count?: number;
}

interface UnitMutationResponse {
  success: boolean;
  unit?: Unit;
  message?: string;
  error?: string;
}

interface UnitsTabContentProps {
  building: Building;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const UNIT_TYPES: UnitType[] = ['apartment', 'studio', 'apartment_2br', 'apartment_3br', 'maisonette', 'shop', 'office', 'storage'];

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

// ============================================================================
// COMPONENT
// ============================================================================

export function UnitsTabContent({ building }: UnitsTabContentProps) {
  const { t } = useTranslation('building');

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState<UnitType>('apartment');
  const [createFloor, setCreateFloor] = useState('0');
  const [createArea, setCreateArea] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<UnitType>('apartment');
  const [editFloor, setEditFloor] = useState('');
  const [editArea, setEditArea] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================================================
  // FETCH UNITS
  // ============================================================================

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try buildingId-filtered query first; fallback to full list + client filter
      let result: UnitsApiResponse | null = null;
      try {
        result = await apiClient.get<UnitsApiResponse>(
          `/api/units?buildingId=${building.id}`
        );
      } catch {
        // Composite index / tenant isolation may reject — fallback
        const allResult = await apiClient.get<UnitsApiResponse>('/api/units');
        if (allResult?.units) {
          result = {
            units: (allResult.units as Unit[]).filter(u => u.buildingId === building.id),
            count: 0,
          };
        }
      }
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
  }, [fetchUnits]);

  // ============================================================================
  // CREATE UNIT
  // ============================================================================

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.post<UnitMutationResponse>('/api/units/create', {
        name: createName.trim(),
        type: createType,
        floor: parseInt(createFloor, 10) || 0,
        area: createArea ? parseFloat(createArea) : undefined,
        buildingId: building.id,
        building: building.name,
        project: building.projectId,
        status: 'available',
      });
      if (result?.success) {
        setShowCreateForm(false);
        setCreateName('');
        setCreateType('apartment');
        setCreateFloor('0');
        setCreateArea('');
        await fetchUnits();
      }
    } catch (err) {
      console.error('[UnitsTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT UNIT
  // ============================================================================

  const startEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditName(unit.name);
    setEditType(unit.type);
    setEditFloor(String(unit.floor));
    setEditArea(unit.area ? String(unit.area) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<UnitMutationResponse>(`/api/units/${editingId}`, {
        name: editName.trim(),
        type: editType,
        floor: parseInt(editFloor, 10),
        area: editArea ? parseFloat(editArea) : undefined,
      });
      if (result?.success) {
        setEditingId(null);
        await fetchUnits();
      }
    } catch (err) {
      console.error('[UnitsTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE UNIT
  // ============================================================================

  const handleDelete = async (unit: Unit) => {
    const confirmed = window.confirm(
      `${t('tabs.labels.units')}: ${unit.name} — Delete?`
    );
    if (!confirmed) return;

    setDeletingId(unit.id);
    try {
      const result = await apiClient.delete<UnitMutationResponse>(
        `/api/units/${unit.id}`
      );
      if (result?.success) {
        await fetchUnits();
      }
    } catch (err) {
      console.error('[UnitsTab] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      sold: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      under_construction: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    };
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorMap[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'}`}>
        {status}
      </span>
    );
  };

  const getTypeLabel = (type: UnitType): string => {
    return UNIT_TYPE_LABELS[type] || type;
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
        <Button variant="outline" size="sm" onClick={fetchUnits}>
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
          <Home className="h-5 w-5 text-primary" />
          {t('tabs.labels.units')}
          <span className="text-sm font-normal text-muted-foreground">({units.length})</span>
        </h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('tabs.labels.units')}
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
              {t('tabs.floors.name')}
            </label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="A-101"
              className="h-9"
              disabled={creating}
              autoFocus
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('tabs.labels.properties')}
            </label>
            <select
              value={createType}
              onChange={(e) => setCreateType(e.target.value as UnitType)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              disabled={creating}
            >
              {UNIT_TYPES.map(ut => (
                <option key={ut} value={ut}>{getTypeLabel(ut)}</option>
              ))}
            </select>
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('tabs.floors.number')}
            </label>
            <Input
              type="number"
              value={createFloor}
              onChange={(e) => setCreateFloor(e.target.value)}
              placeholder="0"
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
              placeholder="85"
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <nav className="flex gap-1">
            <Button
              type="submit"
              size="sm"
              disabled={!createName.trim() || creating}
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
      {units.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('tabs.labels.units')} — 0
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-3 py-2">{t('tabs.floors.name')}</th>
                <th className="w-28 px-3 py-2">{t('tabs.labels.properties')}</th>
                <th className="w-20 px-3 py-2">{t('tabs.floors.number')}</th>
                <th className="w-20 px-3 py-2">m²</th>
                <th className="w-28 px-3 py-2">{t('tabs.labels.details')}</th>
                <th className="w-24 px-3 py-2 text-right">{t('tabs.floors.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-border/50 hover:bg-muted/20">
                  {editingId === unit.id ? (
                    <>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as UnitType)}
                          className="h-8 w-full rounded-md border border-input bg-background px-1 text-sm"
                          disabled={saving}
                        >
                          {UNIT_TYPES.map(ut => (
                            <option key={ut} value={ut}>{getTypeLabel(ut)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
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
                      <td className="px-3 py-1.5">{getStatusBadge(unit.status)}</td>
                      <td className="px-3 py-1.5">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleSaveEdit}
                            disabled={saving || !editName.trim()}
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
                      <td className="px-3 py-2 font-medium">{unit.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{getTypeLabel(unit.type)}</td>
                      <td className="px-3 py-2 font-mono text-sm text-muted-foreground">{unit.floor}</td>
                      <td className="px-3 py-2 font-mono text-xs">{unit.area ? `${unit.area}` : '—'}</td>
                      <td className="px-3 py-2">{getStatusBadge(unit.status)}</td>
                      <td className="px-3 py-2">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(unit)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(unit)}
                            disabled={deletingId === unit.id}
                          >
                            {deletingId === unit.id ? (
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
            {units.length} {t('tabs.labels.units')}
          </footer>
        </>
      )}
    </section>
  );
}

export default UnitsTabContent;
