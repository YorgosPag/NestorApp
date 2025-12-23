'use client';

import React from 'react';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { BuildingBadge } from '@/core/badges';
import {
  Copy,
  Archive,
  Star,
  Share,
  MapPin,
  BarChart3,
  Calendar
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';

interface ToolbarAdvancedSectionProps {
  selectedItems: number[];
  activeFilters: string[];
}

export function ToolbarAdvancedSection({
  selectedItems,
  activeFilters
}: ToolbarAdvancedSectionProps) {
  const iconSizes = useIconSizes();
  return (
    <div className="px-2 pb-2 border-t border-border/50">
      <div className="flex items-center gap-1 pt-2">
        <ToolbarButton 
          tooltip="Αντιγραφή Επιλεγμένων"
          disabled={selectedItems.length === 0}
        >
          <Copy className={iconSizes.sm} />
        </ToolbarButton>
        
        <ToolbarButton 
          tooltip="Αρχειοθέτηση"
          disabled={selectedItems.length === 0}
        >
          <Archive className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Προσθήκη στα Αγαπημένα"
          disabled={selectedItems.length === 0}
        >
          <Star className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Κοινοποίηση"
          disabled={selectedItems.length === 0}
        >
          <Share className={iconSizes.sm} />
        </ToolbarButton>

        <div className={`w-px ${iconSizes.lg} bg-border mx-2`} />

        <ToolbarButton 
          tooltip="Προβολή σε Χάρτη"
          disabled={selectedItems.length === 0}
        >
          <MapPin className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Δημιουργία Αναφοράς"
          disabled={selectedItems.length === 0}
        >
          <BarChart3 className={iconSizes.sm} />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Προγραμματισμός Επίσκεψης"
          disabled={selectedItems.length === 0}
        >
          <Calendar className={iconSizes.sm} />
        </ToolbarButton>

        <div className="flex-1" />

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedItems.length > 0 && (
            <BuildingBadge
              status="occupied"
              customLabel={`${selectedItems.length} επιλεγμένα`}
              variant="secondary"
              className="text-xs"
            />
          )}
          {activeFilters.length > 0 && (
            <BuildingBadge
              status="partially-occupied"
              customLabel={`${activeFilters.length} φίλτρα ενεργά`}
              variant="outline"
              className="text-xs"
            />
          )}
          <span className="flex items-center gap-1">
            <div className={`${iconSizes.xs} bg-green-500 rounded-full animate-pulse`} />
            Συγχρονισμένο
          </span>
        </div>
      </div>
    </div>
  );
}