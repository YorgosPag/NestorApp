'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnitBadge } from '@/core/badges';
import type { UnitStatus } from '@/core/types/BadgeTypes';
import { Button } from '@/components/ui/button';
import { Package, Eye } from 'lucide-react';
import { useBuildingRelationships } from '@/services/relationships/hooks/useEnterpriseRelationships';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

function BuildingUnitsTable({ buildingId }: { buildingId: string }) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  // 🏢 ENTERPRISE: Centralized icon sizes
  const iconSizes = useIconSizes();

  const [units, setUnits] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 🏗️ ENTERPRISE RELATIONSHIP ENGINE: Complete Building→Units hierarchy management
  const buildingRelationships = useBuildingRelationships(`building-${buildingId}`);

  useEffect(() => {
    // Simulate fetching units for the building
    const fetchUnits = async () => {
        try {
            setLoading(true);
            // 🏢 ENTERPRISE: Loading units μέσω centralized Building Relationship Engine
            console.log(`🏗️ ENTERPRISE BuildingUnitsTable: Loading units for building building-${buildingId}`);
            const buildingUnits = await buildingRelationships.getUnits();
            // 🏢 ENTERPRISE: Type assertion for relationship engine results
            setUnits(buildingUnits as Property[]);
            console.log(`✅ ENTERPRISE BuildingUnitsTable: Loaded ${buildingUnits.length} units for building building-${buildingId}`);

        } catch (error) {
            console.error("Failed to fetch units for building:", error);
            setUnits([]);
        } finally {
            setLoading(false);
        }
    };

    fetchUnits();
  }, [buildingId]);
  
  const handleViewUnit = useCallback((unitId: string) => {
    router.push(`/units?unitId=${unitId}`);
  }, [router]);
  
  if (loading) {
    return <div>{t('unitsTable.loading')}</div>;
  }

  if (units.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className={iconSizes.md}/>{t('unitsTable.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('unitsTable.noUnits')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className={iconSizes.md}/>{t('unitsTable.title')}</CardTitle>
        <CardDescription>{t('unitsTable.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('unitsTable.columns.code')}</TableHead>
              <TableHead>{t('unitsTable.columns.type')}</TableHead>
              <TableHead>{t('unitsTable.columns.area')}</TableHead>
              <TableHead>{t('unitsTable.columns.status')}</TableHead>
              <TableHead className="text-right">{t('unitsTable.columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map(unit => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.name}</TableCell>
                <TableCell>{unit.type}</TableCell>
                <TableCell>{unit.area || 0} m²</TableCell>
                <TableCell>
                  <UnitBadge
                    status={unit.status as UnitStatus}
                    size="sm"
                    className="text-xs"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleViewUnit(unit.id)}>
                    <Eye className={`${iconSizes.sm} mr-2`} />
                    {t('unitsTable.view')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export { BuildingUnitsTable };
