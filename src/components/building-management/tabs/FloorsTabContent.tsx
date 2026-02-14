/**
 * FloorsTabContent — IFC-Compliant Floor Management Tab
 *
 * Displays, creates, edits and deletes building floors (IfcBuildingStorey).
 * Each floor has: number (level), name, elevation (metres).
 *
 * @module components/building-management/tabs/FloorsTabContent
 * @see ADR-180 (IFC Floor Management System)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Layers, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react';
import type { Building } from '@/types/building/contracts';

// ============================================================================
// TYPES
// ============================================================================

interface FloorRecord {
  id: string;
  number: number;
  name: string;
  elevation?: number | null;
  buildingId: string;
  units?: number;
}

interface FloorsApiResponse {
  success: boolean;
  floors: FloorRecord[];
  stats: { totalFloors: number };
}

interface FloorMutationResponse {
  success: boolean;
  floor?: FloorRecord;
  message?: string;
  error?: string;
}

interface FloorsTabContentProps {
  building: Building;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FloorsTabContent({ building }: FloorsTabContentProps) {
  const { t } = useTranslation('building');

  // Data state
  const [floors, setFloors] = useState<FloorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline create state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createNumber, setCreateNumber] = useState('0');
  const [createName, setCreateName] = useState('');
  const [createElevation, setCreateElevation] = useState('');
  const [creating, setCreating] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumber, setEditNumber] = useState('');
  const [editName, setEditName] = useState('');
  const [editElevation, setEditElevation] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ============================================================================
  // FETCH FLOORS
  // ============================================================================

  const fetchFloors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<FloorsApiResponse>(
        `/api/floors?buildingId=${building.id}`
      );
      if (result?.floors) {
        const sorted = [...result.floors].sort((a, b) => a.number - b.number);
        setFloors(sorted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load floors');
    } finally {
      setLoading(false);
    }
  }, [building.id]);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  // ============================================================================
  // CREATE FLOOR
  // ============================================================================

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const result = await apiClient.post<FloorMutationResponse>('/api/floors', {
        number: parseInt(createNumber, 10) || 0,
        name: createName.trim(),
        elevation: createElevation ? parseFloat(createElevation) : undefined,
        buildingId: building.id,
        projectId: building.projectId,
      });
      if (result?.success) {
        setShowCreateForm(false);
        setCreateNumber('0');
        setCreateName('');
        setCreateElevation('');
        await fetchFloors();
      }
    } catch (err) {
      console.error('[FloorsTab] Create error:', err);
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // EDIT FLOOR
  // ============================================================================

  const startEdit = (floor: FloorRecord) => {
    setEditingId(floor.id);
    setEditNumber(String(floor.number));
    setEditName(floor.name);
    setEditElevation(floor.elevation != null ? String(floor.elevation) : '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSaving(true);
    try {
      const result = await apiClient.patch<FloorMutationResponse>('/api/floors', {
        floorId: editingId,
        number: parseInt(editNumber, 10),
        name: editName.trim(),
        elevation: editElevation ? parseFloat(editElevation) : null,
      });
      if (result?.success) {
        setEditingId(null);
        await fetchFloors();
      }
    } catch (err) {
      console.error('[FloorsTab] Edit error:', err);
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // DELETE FLOOR
  // ============================================================================

  const handleDelete = async (floor: FloorRecord) => {
    const confirmed = window.confirm(
      t('tabs.floors.deleteConfirm', { name: floor.name })
    );
    if (!confirmed) return;

    setDeletingId(floor.id);
    try {
      const result = await apiClient.delete<FloorMutationResponse>(
        `/api/floors?floorId=${floor.id}`
      );
      if (result?.success) {
        await fetchFloors();
      }
    } catch (err) {
      console.error('[FloorsTab] Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  // ============================================================================
  // FORMAT ELEVATION
  // ============================================================================

  const formatElevation = (elevation: number | null | undefined): string => {
    if (elevation == null) return '—';
    const prefix = elevation > 0 ? '+' : '';
    return `${prefix}${elevation.toFixed(2)} ${t('tabs.floors.elevationUnit')}`;
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
        <Button variant="outline" size="sm" onClick={fetchFloors}>
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
          <Layers className="h-5 w-5 text-primary" />
          {t('tabs.floors.title')}
        </h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowCreateForm(true)}
          disabled={showCreateForm}
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('tabs.floors.addFloor')}
        </Button>
      </header>

      {/* Inline Create Form */}
      {showCreateForm && (
        <form
          className="grid grid-cols-[80px_1fr_120px_auto] items-end gap-2 rounded-lg border border-border bg-muted/30 p-3"
          onSubmit={(e) => { e.preventDefault(); handleCreate(); }}
        >
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('tabs.floors.number')}
            </label>
            <Input
              type="number"
              value={createNumber}
              onChange={(e) => setCreateNumber(e.target.value)}
              placeholder={t('tabs.floors.numberPlaceholder')}
              className="h-9"
              disabled={creating}
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('tabs.floors.name')}
            </label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t('tabs.floors.namePlaceholder')}
              className="h-9"
              disabled={creating}
              autoFocus
            />
          </fieldset>
          <fieldset className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              {t('tabs.floors.elevation')}
            </label>
            <Input
              type="number"
              step="0.01"
              value={createElevation}
              onChange={(e) => setCreateElevation(e.target.value)}
              placeholder={t('tabs.floors.elevationPlaceholder')}
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

      {/* Floors Table */}
      {floors.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('tabs.floors.empty')}
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="w-20 px-3 py-2">{t('tabs.floors.number')}</th>
                <th className="px-3 py-2">{t('tabs.floors.name')}</th>
                <th className="w-32 px-3 py-2">{t('tabs.floors.elevation')}</th>
                <th className="w-20 px-3 py-2 text-center">{t('tabs.floors.units')}</th>
                <th className="w-24 px-3 py-2 text-right">{t('tabs.floors.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {floors.map((floor) => (
                <tr key={floor.id} className="border-b border-border/50 hover:bg-muted/20">
                  {editingId === floor.id ? (
                    /* Editing row */
                    <>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          value={editNumber}
                          onChange={(e) => setEditNumber(e.target.value)}
                          className="h-8 w-16"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-8"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={editElevation}
                          onChange={(e) => setEditElevation(e.target.value)}
                          placeholder="—"
                          className="h-8 w-24"
                          disabled={saving}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center text-muted-foreground">
                        {floor.units ?? 0}
                      </td>
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
                    /* Display row */
                    <>
                      <td className="px-3 py-2 font-mono text-sm font-medium">
                        {floor.number}
                      </td>
                      <td className="px-3 py-2">{floor.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {formatElevation(floor.elevation)}
                      </td>
                      <td className="px-3 py-2 text-center text-muted-foreground">
                        {floor.units ?? 0}
                      </td>
                      <td className="px-3 py-2">
                        <nav className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => startEdit(floor)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(floor)}
                            disabled={deletingId === floor.id}
                          >
                            {deletingId === floor.id ? (
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

          {/* Footer */}
          <footer className="text-xs text-muted-foreground">
            {t('tabs.floors.total', { count: floors.length })}
          </footer>
        </>
      )}
    </section>
  );
}
