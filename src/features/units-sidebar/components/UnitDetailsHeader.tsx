'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Home, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

function getStatusColor(status: string) {
  switch (status) {
    case 'for-sale': return 'bg-blue-500';
    case 'sold': return 'bg-red-500';
    case 'for-rent': return 'bg-yellow-500';
    case 'rented': return 'bg-green-500';
    case 'reserved': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'for-sale': return 'Προς πώληση';
    case 'sold': return 'Πουλήθηκε';
    case 'for-rent': return 'Προς ενοικίαση';
    case 'rented': return 'Ενοικιάστηκε';
    case 'reserved': return 'Κρατήθηκε';
    default: return status;
  }
}

export function UnitDetailsHeader({ unit }: { unit: Property | null }) {
  if (!unit) {
    return (
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg h-[81px] flex items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">Επιλέξτε μια μονάδα</h3>
            <p className="text-sm text-muted-foreground">Δεν έχει επιλεγεί μονάδα</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-t-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
            <Home className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground line-clamp-1">{unit.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={cn("text-xs", getStatusColor(unit.status) + ' text-white')}>
                {getStatusLabel(unit.status)}
              </Badge>
            </div>
          </div>
        </div>
        <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
          <Eye className="w-4 h-4 mr-2" />
          Επίδειξη Μονάδας
        </Button>
      </div>
    </div>
  );
}
