'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParkingTableToolbar } from './ParkingTableToolbar';
import { ParkingSpotTable } from './ParkingSpotTable';
import { useParkingData } from '@/hooks/useParkingData';

export function ParkingTab() {
  const {
    parkingSpots,
    selectedSpots,
    setSelectedSpots,
    filters,
    handleFiltersChange,
    stats,
    handleExport,
    handleImport,
    handleAdd,
    handleDelete,
    handleSave,
    handleRefresh,
    handleEdit,
    handleView,
    handleViewFloorPlan,
  } = useParkingData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Διαχείριση Θέσεων Στάθμευσης</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ParkingTableToolbar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            stats={stats}
            selectedCount={selectedSpots.length}
            onExport={handleExport}
            onImport={handleImport}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onSave={handleSave}
            onRefresh={handleRefresh}
          />
          
          <ParkingSpotTable
            spots={parkingSpots}
            filters={filters}
            selectedSpots={selectedSpots}
            onSelectionChange={setSelectedSpots}
            onEdit={handleEdit}
            onView={handleView}
            onViewFloorPlan={handleViewFloorPlan}
          />
        </CardContent>
      </Card>
    </div>
  );
}
