/**
 * UnitsTabContent — Building Units Management Tab
 *
 * Lists building units (apartments, shops, offices, etc.) filtered by buildingId.
 * Uses the same AddUnitDialog as the /units page for consistent create experience.
 *
 * @module components/building-management/tabs/UnitsTabContent
 * @see ADR-184 (Building Spaces Tabs)
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { Button } from '@/components/ui/button';
import { Home, Plus, Loader2 } from 'lucide-react';
import type { Building } from '@/types/building/contracts';
import type { Unit, UnitType } from '@/types/unit';
import { AddUnitDialog } from '@/components/units/dialogs/AddUnitDialog';

// ============================================================================
// TYPES
// ============================================================================

interface UnitsApiResponse {
  units: Unit[];
  count?: number;
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

// ============================================================================
// COMPONENT
// ============================================================================

export function UnitsTabContent({ building }: UnitsTabContentProps) {
  const { t } = useTranslation('building');

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AddUnitDialog state
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Pre-build the buildings array for AddUnitDialog (single building, pre-selected)
  const buildingsForDialog = useMemo(() => [building], [building]);

  // ============================================================================
  // FETCH UNITS
  // ============================================================================

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<UnitsApiResponse>(
        `/api/units?buildingId=${building.id}`
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
  }, [fetchUnits]);

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, string> = {
      available: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'for-sale': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
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
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          {t('tabs.labels.units')}
        </Button>
      </header>

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
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-3 py-2 font-medium">{unit.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{getTypeLabel(unit.type)}</td>
                  <td className="px-3 py-2 font-mono text-sm text-muted-foreground">{unit.floor}</td>
                  <td className="px-3 py-2 font-mono text-xs">{unit.area ? `${unit.area}` : '—'}</td>
                  <td className="px-3 py-2">{getStatusBadge(unit.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="text-xs text-muted-foreground">
            {units.length} {t('tabs.labels.units')}
          </footer>
        </>
      )}

      {/* Enterprise AddUnitDialog — Same modal as /units page */}
      <AddUnitDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onUnitAdded={fetchUnits}
        buildings={buildingsForDialog}
        buildingsLoading={false}
      />
    </section>
  );
}

export default UnitsTabContent;
