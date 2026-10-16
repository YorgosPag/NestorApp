'use client';

/**
 * 📊 ΤΟ ΕΝΑ ταμπλό της οθόνης ακινήτων (ADR-840 Σ3).
 *
 * 🔑 **Μετρά ό,τι ΒΛΕΠΕΙΣ** (πρότυπο Linear / Power BI cross-filter): τα `stats` είναι της μηχανής πάνω στο
 * **φιλτραρισμένο** σύνολο — αλλάζεις φίλτρο, αλλάζουν οι αριθμοί. Ως το Σ3 υπήρχαν **δύο** ταμπλό: λειτουργικό
 * (όλο το απόθεμα, αγνοώντας τα φίλτρα) στο `/spaces/properties` και εμπορικό στο `/properties`. Εδώ είναι **και τα δύο**,
 * χωρίς δεύτερο υπολογισμό: αξία/μέση τιμή **ανά ρόλο** (`priceTotalsView` — ποτέ ένα άθροισμα πάνω από πώληση και
 * ενοίκιο) · κατάσταση · τύπος · όροφος · πληρότητα.
 *
 * 🔑 **Κάθε κάρτα που φιλτράρει, γράφει στη διεύθυνση** (`onFiltersChange` ⇒ `?status=` / `?missing=`) και είναι
 * **εναλλαγή**: δεύτερο κλικ το αναιρεί. Ήταν τοπικό `activeCardFilter` που ταυτοποιούσε την κάρτα **από τον τίτλο της**
 * (μεταφρασμένο κείμενο) και έγραφε `status: ['ready']` — τιμή που το πεδίο δεν είχε ποτέ.
 *
 * @module components/properties/page/PropertyPageDashboard
 */

import { useMemo } from 'react';
import { MapPin, Maximize, TrendingUp } from 'lucide-react';
import { UnifiedDashboard, type DashboardStat } from '@/components/property-management/dashboard/UnifiedDashboard';
import { StatusCard } from '@/components/property-management/dashboard/StatusCard';
import { DetailsCard } from '@/components/property-management/dashboard/DetailsCard';
import { CoverageCard } from '@/components/property-management/dashboard/CoverageCard';
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { priceTotalsView } from '@/lib/listings/listing-price-label';
import type { PropertyScreenStats } from '@/hooks/usePropertyFilters';
import type { FilterState } from '@/types/property-viewer';
import { createStatusLabelGetter, createTypeLabelGetter } from '../properties-page-helpers';

type CoverageFlag = keyof NonNullable<FilterState['coverage']>;

/** Ο κουβάς διάθεσης «στην αγορά» (`lib/spaces/space-availability`). */
const LISTED_BUCKET = 'listed';

interface PropertyPageDashboardProps {
  stats: PropertyScreenStats;
  filters: FilterState;
  onFiltersChange: (change: Partial<FilterState>) => void;
}

/**
 * 🔑 Μόνο η κάρτα που **φιλτράρει** έχει πράξη (`onActivate`) και κατάσταση (`pressed`): οι πληροφοριακές δεν
 * δείχνουν δείκτη ούτε σταματούν το Tab. Ως τώρα **όλες** ήταν «κλικαρίσιμες» και η ενεργή φαινόταν μόνο από το
 * χρώμα (πράσινο → indigo) — αόρατη σε αναγνώστη οθόνης και σε αχρωματοψία (ADR-771).
 */
function useDashboardCards({ stats, filters, onFiltersChange }: PropertyPageDashboardProps): DashboardStat[] {
  const { t } = useTranslation(['properties', 'common', 'filters']);
  return useMemo<DashboardStat[]>(() => {
    const listedOnly = filters.status.length === 1 && filters.status[0] === LISTED_BUCKET;
    return [
      { title: t('dashboard.stats.totalProperties'), value: stats.totalProperties, icon: NAVIGATION_ENTITIES.property.icon, color: 'blue' },
      {
        title: t('filters:propertyAvailability.listed'), value: stats.onMarketProperties, icon: TrendingUp, color: 'green',
        pressed: listedOnly,
        onActivate: () => onFiltersChange({ status: listedOnly ? [] : [LISTED_BUCKET] }),
      },
      { title: t('dashboard.stats.totalValue'), ...priceTotalsView(t, stats.priceTotals, 'total'), icon: NAVIGATION_ENTITIES.price.icon, color: 'cyan' },
      { title: t('dashboard.stats.averagePrice'), ...priceTotalsView(t, stats.priceTotals, 'average'), icon: NAVIGATION_ENTITIES.price.icon, color: 'orange' },
      { title: t('page.dashboard.totalArea'), value: `${Math.round(stats.totalArea)} m²`, icon: Maximize, color: 'purple' },
      { title: t('page.dashboard.uniqueBuildings'), value: stats.uniqueBuildings, icon: NAVIGATION_ENTITIES.building.icon, color: 'pink' },
    ];
  }, [filters.status, onFiltersChange, stats, t]);
}

export function PropertyPageDashboard(props: PropertyPageDashboardProps) {
  const { stats, filters, onFiltersChange } = props;
  const { t } = useTranslation(['properties', 'properties-detail', 'properties-enums', 'properties-viewer']);
  const cards = useDashboardCards(props);
  const getStatusLabel = useMemo(() => createStatusLabelGetter(t), [t]);
  const getTypeLabel = useMemo(() => createTypeLabelGetter(t), [t]);

  const toggleCoverage = (flag: CoverageFlag) => () => {
    const active = filters.coverage?.[flag] === true;
    onFiltersChange({ coverage: { ...filters.coverage, [flag]: !active } });
  };

  return (
    <UnifiedDashboard
      stats={cards}
      columns={6}
      additionalContainers={
        <>
          <StatusCard statsByStatus={stats.propertiesByStatus} getStatusLabel={getStatusLabel} />
          <DetailsCard title={t('page.dashboard.unitTypes')} icon={NAVIGATION_ENTITIES.property.icon} data={stats.propertiesByType} labelFormatter={getTypeLabel} />
          <DetailsCard title={t('page.dashboard.floorDistribution')} icon={MapPin} data={stats.propertiesByFloor} isFloorData />
          <CoverageCard
            coverage={stats.coverage}
            activeMissing={filters.coverage ?? {}}
            onMissingPhotosClick={toggleCoverage('missingPhotos')}
            onMissingFloorplansClick={toggleCoverage('missingFloorplans')}
            onMissingDocumentsClick={toggleCoverage('missingDocuments')}
          />
        </>
      }
    />
  );
}
