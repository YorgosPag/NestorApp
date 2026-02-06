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
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized real-time service for cross-page sync
import { RealtimeService, type UnitUpdatedPayload, type UnitCreatedPayload, type UnitDeletedPayload } from '@/services/realtime';

function BuildingUnitsTable({ buildingId }: { buildingId: string }) {
  // 🏢 ENTERPRISE: i18n hook for translations
  const { t } = useTranslation('building');
  // 🏢 ENTERPRISE: Centralized icon sizes + typography
  const iconSizes = useIconSizes();
  const typography = useTypography();

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

  // 🏢 ENTERPRISE: Centralized Real-time Service (ZERO DUPLICATES)
  // Subscribe to unit updates for cross-page sync
  useEffect(() => {
    const handleUnitUpdate = (payload: UnitUpdatedPayload) => {
      console.log('🔄 [BuildingUnitsTable] Applying update for unit:', payload.unitId);

      setUnits(prev => prev.map(unit => {
        if (unit.id !== payload.unitId) return unit;

        // 🏢 ENTERPRISE: Type-safe partial update - only apply defined values
        const updates: Partial<Property> = {};
        if (payload.updates.name !== undefined) updates.name = payload.updates.name;
        if (payload.updates.type !== undefined) updates.type = payload.updates.type;
        if (payload.updates.area !== undefined) updates.area = payload.updates.area;
        if (payload.updates.floor !== undefined) updates.floor = payload.updates.floor;
        if (payload.updates.buildingId !== undefined) updates.buildingId = payload.updates.buildingId ?? unit.buildingId;
        if (payload.updates.soldTo !== undefined) updates.soldTo = payload.updates.soldTo;
        // Status requires type assertion due to union type
        if (payload.updates.status !== undefined) {
          updates.status = payload.updates.status as Property['status'];
        }

        return { ...unit, ...updates };
      }));
    };

    // Subscribe to unit updates (same-page + cross-page)
    const unsubscribe = RealtimeService.subscribeToUnitUpdates(handleUnitUpdate, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

  // 🏢 ENTERPRISE: Subscribe to unit CREATED events for cross-page sync
  useEffect(() => {
    const handleUnitCreated = (payload: UnitCreatedPayload) => {
      // Only care about units belonging to this building
      if (payload.unit.buildingId !== `building-${buildingId}`) return;

      console.log('➕ [BuildingUnitsTable] New unit created for this building:', payload.unitId);
      // Refetch units for this building
      const refetchUnits = async () => {
        const buildingUnits = await buildingRelationships.getUnits();
        setUnits(buildingUnits as Property[]);
      };
      refetchUnits();
    };

    const unsubscribe = RealtimeService.subscribeToUnitCreated(handleUnitCreated, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, [buildingId, buildingRelationships]);

  // 🏢 ENTERPRISE: Subscribe to unit DELETED events for cross-page sync
  useEffect(() => {
    const handleUnitDeleted = (payload: UnitDeletedPayload) => {
      console.log('🗑️ [BuildingUnitsTable] Unit deleted:', payload.unitId);
      // Remove the deleted unit from the list
      setUnits(prev => prev.filter(unit => unit.id !== payload.unitId));
    };

    const unsubscribe = RealtimeService.subscribeToUnitDeleted(handleUnitDeleted, {
      checkPendingOnMount: false
    });

    return unsubscribe;
  }, []);

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
          <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}><Package className={iconSizes.md}/>{t('unitsTable.title')}</CardTitle>
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
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}><Package className={iconSizes.md}/>{t('unitsTable.title')}</CardTitle>
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
