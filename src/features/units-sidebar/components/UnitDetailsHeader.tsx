'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { UnitBadge } from '@/core/badges';
import { Home, Eye } from 'lucide-react';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property-viewer';

// Removed hardcoded getStatusColor and getStatusLabel functions - using centralized UnitBadge instead

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
      actions={[
        {
          label: 'Επίδειξη Μονάδας',
          onClick: () => console.log('Show unit details'),
          icon: Eye,
          className: 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
        }
      ]}
      variant="detailed"
    >
      {/* Centralized UnitBadge Component */}
      <div className="flex gap-2 mt-2">
        <UnitBadge status={unit.status as any} size="sm" />
      </div>
    </EntityDetailsHeader>
  );
}