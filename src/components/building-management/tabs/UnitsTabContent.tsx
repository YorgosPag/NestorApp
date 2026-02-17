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
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Home, Plus, Loader2, Search, CheckCircle, Euro, Ruler, BarChart3 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { UnifiedDashboard } from '@/components/property-management/dashboard/UnifiedDashboard';
import type { DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
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

  // Data state
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // AddUnitDialog state
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<UnitType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const iconSizes = useIconSizes();

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

      {/* Stats Cards */}
      <UnifiedDashboard stats={dashboardStats} columns={4} className="" />

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <fieldset className="grid grid-cols-1 md:grid-cols-5 gap-4">
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

      {/* Table */}
      {filteredUnits.length === 0 ? (
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
              {filteredUnits.map((unit) => (
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
            {filteredUnits.length} {t('tabs.labels.units')}
            {filteredUnits.length !== units.length && (
              <span className="ml-1">({units.length} {t('allStatuses', { ns: 'filters' }).toLowerCase()})</span>
            )}
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
