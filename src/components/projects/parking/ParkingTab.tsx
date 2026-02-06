'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ParkingTableToolbar } from './ParkingTableToolbar';
import { ParkingSpotTable } from './ParkingSpotTable';
import { OverflowContainer } from './OverflowContainer';
import { useParkingData } from '@/hooks/useParkingData';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

export function ParkingTab() {
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('projects');
  const typography = useTypography();
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
    <div className="space-y-6 min-w-0">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle className={typography.card.titleCompact}>{t('parkingManagement.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 w-full max-w-full overflow-x-auto">
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
          
          <OverflowContainer>
            {/* 🏢 ENTERPRISE: ParkingSpotTable uses internal filter logic (useParkingFilters hook) */}
            <ParkingSpotTable
              spots={parkingSpots}
              selectedSpots={selectedSpots}
              onSelectionChange={setSelectedSpots}
              onEdit={handleEdit}
              onView={handleView}
              onViewFloorPlan={handleViewFloorPlan}
            />
          </OverflowContainer>
        </CardContent>
      </Card>
    </div>
  );
}
