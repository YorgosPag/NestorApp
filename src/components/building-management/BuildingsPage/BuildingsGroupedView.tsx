
'use client';

import React from 'react';
import { BuildingCard } from '../BuildingCard';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { Building } from '../BuildingsPageContent';
import { groupByKey } from '@/utils/collection-utils';
import { gridPatterns } from '@/styles/design-tokens';
import '@/lib/design-system';

interface BuildingsGroupedViewProps {
  viewMode: 'grid' | 'byType' | 'byStatus';
  filteredBuildings: Building[];
  selectedBuilding: Building | null;
  setSelectedBuilding: (building: Building | null) => void;
}

/**
 * Το πλέγμα καρτών — **ένα**, όχι τρία.
 *
 * 🔴 Ήταν γραμμένο **τρεις φορές** (πλέγμα · κατά τύπο · κατά κατάσταση) και οι δύο τελευταίες
 * ήταν **χαρακτήρα προς χαρακτήρα** ίδιες. Το ονόμασε το **CHECK 3.28** (ADR-584) όταν το αρχείο
 * ακουμπήθηκε για τη μετανάστευση του ADR-784 §10 — δηλαδή το βρήκε **άλλη ερώτηση**, όπως και
 * τα πέντε `MediaGrid` του §10.4.
 */
function BuildingsCardGrid({ buildings, selectedBuilding, setSelectedBuilding }: {
  buildings: Building[];
  selectedBuilding: Building | null;
  setSelectedBuilding: (building: Building | null) => void;
}) {
  return (
    <div className={`grid gap-2 ${gridPatterns.cards.tile}`}>
      {buildings.map((building) => (
        <BuildingCard
          key={building.id}
          building={building}
          isSelected={selectedBuilding?.id === building.id}
          onClick={() => setSelectedBuilding(building)}
        />
      ))}
    </div>
  );
}

/**
 * Ομαδοποιημένη προβολή. Η **μόνη** διαφορά ανάμεσα στο «κατά τύπο» και στο «κατά κατάσταση»
 * ήταν το κλειδί ομαδοποίησης και το πρόθεμα του κλειδιού μετάφρασης — άρα είναι **παράμετροι**,
 * όχι δεύτερο σώμα.
 */
function BuildingsGroups({ groups, labelOf, selectedBuilding, setSelectedBuilding }: {
  groups: Record<string, Building[]>;
  labelOf: (groupKey: string) => string;
  selectedBuilding: Building | null;
  setSelectedBuilding: (building: Building | null) => void;
}) {
  return (
    <div className="flex-1 p-2 overflow-auto">
      {Object.entries(groups).map(([groupKey, buildingsOfGroup]) => (
        <div key={groupKey} className="mb-2">
          <h2 className="text-xl font-bold mb-2 capitalize border-b pb-2">
            {labelOf(groupKey)} ({buildingsOfGroup.length})
          </h2>
          <BuildingsCardGrid
            buildings={buildingsOfGroup}
            selectedBuilding={selectedBuilding}
            setSelectedBuilding={setSelectedBuilding}
          />
        </div>
      ))}
    </div>
  );
}

export function BuildingsGroupedView({
  viewMode,
  filteredBuildings,
  selectedBuilding,
  setSelectedBuilding,
}: BuildingsGroupedViewProps) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation(['building', 'building-address', 'building-filters', 'building-storage', 'building-tabs', 'building-timeline']);

  const groupedByType = groupByKey(filteredBuildings, building => building.category || 'mixed');
  const groupedByStatus = groupByKey(filteredBuildings, building => building.status);

  if (viewMode === 'grid') {
    return (
      <div className="flex-1 p-2 overflow-auto">
        <BuildingsCardGrid
          buildings={filteredBuildings}
          selectedBuilding={selectedBuilding}
          setSelectedBuilding={setSelectedBuilding}
        />
      </div>
    );
  }

  if (viewMode === 'byType') {
    return (
      <BuildingsGroups
        groups={groupedByType}
        labelOf={(type) => t(`category.${type}`, { defaultValue: type })}
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
      />
    );
  }

  if (viewMode === 'byStatus') {
    return (
      <BuildingsGroups
        groups={groupedByStatus}
        labelOf={(status) => t(`status.${status}`, { defaultValue: status })}
        selectedBuilding={selectedBuilding}
        setSelectedBuilding={setSelectedBuilding}
      />
    );
  }

  return null;
}
