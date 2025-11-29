'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { UnitBadge } from '@/core/badges';
import { Home, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
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
  // Empty State - No unit selected
  if (!unit) {
    return (
      <EntityDetailsHeader
        icon={Home}
        title="Επιλέξτε μια μονάδα"
        subtitle="Δεν έχει επιλεγεί μονάδα"
        variant="detailed"
        className="h-[81px] flex items-center"
      />
    );
  }

  // Selected State - Unit is selected
  return (
    <EntityDetailsHeader
      icon={Home}
      title={unit.name}
      badges={[
        {
          type: 'status',
          value: getStatusLabel(unit.status),
          size: 'sm'
        }
      ]}
      actions={[
        {
          label: 'Επίδειξη Μονάδας',
          onClick: () => console.log('Show unit details'),
          icon: Eye,
          className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        }
      ]}
      variant="detailed"
    />
  );
}