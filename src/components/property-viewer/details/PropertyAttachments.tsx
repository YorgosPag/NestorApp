'use client';

import React from 'react';
import Link from 'next/link';
import { Package, Car } from 'lucide-react';
import type { StorageUnitStub, ParkingSpotStub } from '@/types/property-viewer';

interface PropertyAttachmentsProps {
  storage: StorageUnitStub[];
  parking: ParkingSpotStub[];
}

export function PropertyAttachments({ storage, parking }: PropertyAttachmentsProps) {
  return (
    <div className="space-y-3">
      {storage.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Package className="h-3 w-3" />
            Συνδεδεμένες Αποθήκες
          </h4>
          <div className="pl-4">
            {storage.map(item => (
              <Link key={item.id} href={`/storage/${item.id}`} className="block">
                <p className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                  {item.code} - {item.floor} ({item.area} τ.μ.)
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
      {parking.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <Car className="h-3 w-3" />
            Συνδεδεμένες Θέσεις Στάθμευσης
          </h4>
          <div className="pl-4">
            {parking.map(item => (
              <Link key={item.id} href={`/storage/${item.id}`} className="block">
                <p className="text-xs text-muted-foreground hover:text-primary hover:underline cursor-pointer">
                  {item.code} - {item.level} ({item.type})
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
