'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnitBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Package, Eye } from 'lucide-react';
import { getUnitsByBuilding } from '@/services/units.service';
import type { Property } from '@/types/property-viewer';
import { getStatusColor, getStatusLabel } from '@/lib/project-utils';

function BuildingUnitsTable({ buildingId }: { buildingId: number }) {
  const [units, setUnits] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Simulate fetching units for the building
    const fetchUnits = async () => {
        try {
            setLoading(true);
            const buildingUnits = await getUnitsByBuilding(`building-${buildingId}`);
            setUnits(buildingUnits);
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
    return <div>Φόρτωση μονάδων...</div>;
  }
  
  if (units.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5"/>Μονάδες Κτιρίου</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν καταχωρημένες μονάδες για αυτό το κτίριο.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Package className="w-5 h-5"/>Μονάδες Κτιρίου</CardTitle>
        <CardDescription>Λίστα των ακινήτων που περιλαμβάνονται σε αυτό το κτίριο.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Κωδικός</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Εμβαδόν</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead className="text-right">Ενέργειες</TableHead>
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
                    status={unit.status as any}
                    size="sm"
                    className="text-xs"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => handleViewUnit(unit.id)}>
                    <Eye className="w-4 h-4 mr-2" />
                    Προβολή
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
