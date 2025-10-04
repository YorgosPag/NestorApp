'use client';

import React from 'react';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Archive,
  Star,
  Share,
  MapPin,
  BarChart3,
  Calendar
} from 'lucide-react';

interface ToolbarAdvancedSectionProps {
  selectedItems: number[];
  activeFilters: string[];
}

export function ToolbarAdvancedSection({
  selectedItems,
  activeFilters
}: ToolbarAdvancedSectionProps) {
  return (
    <div className="px-2 pb-2 border-t border-border/50">
      <div className="flex items-center gap-1 pt-2">
        <ToolbarButton 
          tooltip="Αντιγραφή Επιλεγμένων"
          disabled={selectedItems.length === 0}
        >
          <Copy className="w-4 h-4" />
        </ToolbarButton>
        
        <ToolbarButton 
          tooltip="Αρχειοθέτηση"
          disabled={selectedItems.length === 0}
        >
          <Archive className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Προσθήκη στα Αγαπημένα"
          disabled={selectedItems.length === 0}
        >
          <Star className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Κοινοποίηση"
          disabled={selectedItems.length === 0}
        >
          <Share className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-2" />

        <ToolbarButton 
          tooltip="Προβολή σε Χάρτη"
          disabled={selectedItems.length === 0}
        >
          <MapPin className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Δημιουργία Αναφοράς"
          disabled={selectedItems.length === 0}
        >
          <BarChart3 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton 
          tooltip="Προγραμματισμός Επίσκεψης"
          disabled={selectedItems.length === 0}
        >
          <Calendar className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        {/* Status Indicators */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {selectedItems.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedItems.length} επιλεγμένα
            </Badge>
          )}
          {activeFilters.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {activeFilters.length} φίλτρα ενεργά
            </Badge>
          )}
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Συγχρονισμένο
          </span>
        </div>
      </div>
    </div>
  );
}