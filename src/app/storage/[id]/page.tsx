'use client';

import React, { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UnitBadge } from '@/core/badges';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getStorageUnitById } from '@/services/storage.service';
import type { StorageUnit } from '@/types/storage';
import { 
  Package, 
  Car, 
  Euro, 
  Ruler, 
  Building, 
  MapPin, 
  CheckCircle,
  Link as LinkIcon,
  ArrowLeft
} from 'lucide-react';
import { getParkingStatusLabel, getParkingStatusColor, getParkingTypeLabel } from '@/components/projects/utils/parking-utils';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium w-32">{label}:</span>
            <span className="text-sm text-foreground">{value}</span>
        </div>
    );
}


export default function StorageUnitPage({ params }: { params: { id: string } }) {
  const [unit, setUnit] = useState<StorageUnit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      getStorageUnitById(params.id)
        .then(data => {
          if (data) {
            setUnit(data);
          } else {
            // Handle case where unit is not found
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [params.id]);

  if (loading) {
    return (
        <div className="p-8">
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-2/3" />
                    <Skeleton className="h-6 w-3/4" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!unit) {
    notFound();
  }
  
  const isStorage = unit.type === 'storage';
  const MainIcon = isStorage ? Package : Car;
  const statusColor = getParkingStatusColor(unit.status);
  const statusLabel = getParkingStatusLabel(unit.status);

  return (
    <div className="p-4 md:p-8">
       <div className="mb-4">
            <Button asChild variant="outline" size="sm">
                <Link href="/projects">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Επιστροφή στα Έργα
                </Link>
            </Button>
       </div>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-muted">
                    <MainIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-2xl">{unit.code}</CardTitle>
                    <CardDescription>{getParkingTypeLabel(unit.type)}</CardDescription>
                </div>
            </div>
             <UnitBadge
               status={unit.status as any}
               size="sm"
               className={cn("text-base", statusColor)}
             />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                     <InfoRow icon={Ruler} label="Εμβαδόν" value={`${unit.area} m²`} />
                     <InfoRow icon={Euro} label="Τιμή" value={`${unit.price.toLocaleString('el-GR')} €`} />
                     <InfoRow icon={MapPin} label="Επίπεδο" value={unit.level} />
                     <InfoRow icon={Building} label="Project" value={unit.projectId} />
                 </div>
                 <div className="space-y-3">
                     <InfoRow icon={User} label="Ιδιοκτήτης" value={unit.owner || 'Διαθέσιμο'} />
                     {unit.propertyCode && <InfoRow icon={LinkIcon} label="Συνδεδεμένο με" value={unit.propertyCode} />}
                     <InfoRow icon={CheckCircle} label="Καταχωρήθηκε από" value={unit.constructedBy} />
                 </div>
            </div>
            {unit.notes && (
                <div>
                    <h4 className="font-semibold text-sm mb-2">Σημειώσεις</h4>
                    <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-md border">{unit.notes}</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
