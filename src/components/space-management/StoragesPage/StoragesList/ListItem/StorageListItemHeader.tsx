'use client';

import React from 'react';
import { MapPin, Warehouse } from "lucide-react";
import { cn } from '@/lib/utils';
import type { Storage } from '@/types/storage/contracts';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface StorageListItemHeaderProps {
  storage: Storage;
}

function getStatusColor(status: Storage['status'], colors?: ReturnType<typeof useSemanticColors>) {
  if (!colors) {
    // Enterprise fallback
    switch (status) {
      case 'available': return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
      case 'occupied': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'reserved': return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300';
      case 'maintenance': return 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300';
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-950 dark:text-slate-300';
    }
  }

  switch (status) {
    case 'available': return `${colors.bg.successSubtle} ${colors.text.success}`;
    case 'occupied': return `${colors.bg.infoSubtle} ${colors.text.info}`;
    case 'reserved': return `${colors.bg.accentSubtle} ${colors.text.accent}`;
    case 'maintenance': return `${colors.bg.warningSubtle} ${colors.text.warning}`;
    default: return `${colors.bg.muted} ${colors.text.muted}`;
  }
}

function getStatusLabel(status: Storage['status']) {
  switch (status) {
    case 'available': return 'Διαθέσιμη';
    case 'occupied': return 'Κατειλημμένη';
    case 'reserved': return 'Κρατημένη';
    case 'maintenance': return 'Συντήρηση';
    default: return 'Άγνωστο';
  }
}

function getTypeLabel(type: Storage['type']) {
  switch (type) {
    case 'large': return 'Μεγάλη';
    case 'small': return 'Μικρή';
    case 'basement': return 'Υπόγεια';
    case 'ground': return 'Ισόγεια';
    case 'special': return 'Ειδική';
    default: return 'Άγνωστο';
  }
}

export function StorageListItemHeader({ storage }: StorageListItemHeaderProps) {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  return (
    <EntityDetailsHeader
      icon={Warehouse}
      title={storage.name}
      variant="compact"
      className="mb-3"
    >
      {/* Status and Type Badges */}
      <div className="flex gap-2 mt-2 mb-2">
        <span className={cn(
          "inline-flex items-center px-2 py-1 text-xs font-medium rounded-full",
          getStatusColor(storage.status, colors)
        )}>
          {getStatusLabel(storage.status)}
        </span>
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
          {getTypeLabel(storage.type)}
        </span>
        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-secondary text-secondary-foreground rounded-full">
          {storage.area} m²
        </span>
      </div>

      {/* Building and Floor */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <MapPin className={iconSizes.xs} />
        <span className="truncate">{storage.building} • {storage.floor}</span>
      </div>
    </EntityDetailsHeader>
  );
}