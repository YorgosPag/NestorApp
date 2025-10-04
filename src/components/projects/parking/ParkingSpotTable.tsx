'use client';

import React, { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

import { ParkingTableHeader } from './ParkingTableHeader';
import { ParkingSpotTableRow } from './ParkingSpotTableRow';

import { useColumnWidths } from '@/components/parking/parking-spot-table/hooks/useColumnWidths';
import { useParkingFilters } from '@/components/parking/parking-spot-table/hooks/useParkingFilters';
import { useParkingSort } from '@/components/parking/parking-spot-table/hooks/useParkingSort';
import { COLUMNS } from '@/components/parking/parking-spot-table/config/columns';
import { SelectAllRow } from '@/components/parking/parking-spot-table/parts/SelectAllRow';
import { FooterBar } from '@/components/parking/parking-spot-table/parts/FooterBar';

import type { ParkingSpotTableProps } from '@/components/parking/parking-spot-table/types';

export function ParkingSpotTable({
  spots,
  selectedSpots,
  onSelectionChange,
  onEdit,
  onView,
  onViewFloorPlan,
}: ParkingSpotTableProps) {
  const { columnWidths, handleColumnResize } = useColumnWidths();
  const { activeFilters, handleFilterChange, filteredSpots: spotsAfterLocalFilter } = useParkingFilters(spots);
  const { sortConfig, handleSort, sortedSpots } = useParkingSort(spotsAfterLocalFilter);

  const handleSelectAll = () => {
    if (selectedSpots.length === sortedSpots.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(sortedSpots.map(s => s.id));
    }
  };

  const allSelected = selectedSpots.length === sortedSpots.length && sortedSpots.length > 0;
  const isIndeterminate = selectedSpots.length > 0 && !allSelected;

  const tableColumns = useMemo(() => COLUMNS.filter(c => c.key !== 'select'), []);

  return (
    <div className="border rounded-md flex flex-col h-[600px] text-sm overflow-hidden">
      <ParkingTableHeader
        columns={tableColumns}
        columnWidths={columnWidths.slice(1)}
        onColumnResize={handleColumnResize}
        filters={activeFilters}
        onFilterChange={handleFilterChange}
        sortConfig={sortConfig}
        onSort={handleSort}
      />
      <ScrollArea className="flex-grow">
        <div className="relative">
          <SelectAllRow
            width={columnWidths[0]}
            allSelected={allSelected}
            isIndeterminate={isIndeterminate}
            onToggle={handleSelectAll}
          />
          {sortedSpots.map((spot) => (
             <ParkingSpotTableRow
                key={spot.id}
                spot={spot}
                columnWidths={columnWidths}
                isSelected={selectedSpots.includes(spot.id)}
                onSelectionChange={onSelectionChange}
                onEdit={onEdit}
                onView={onView}
                onViewFloorPlan={onViewFloorPlan}
             />
          ))}
        </div>
      </ScrollArea>
      <FooterBar filteredCount={sortedSpots.length} totalCount={spots.length} />
    </div>
  );
}
