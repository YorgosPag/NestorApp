'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommonBadge } from '@/core/badges';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';
import {
  Plus,
  Minus,
  Save,
  RefreshCw,
  HelpCircle,
  Download,
  Upload
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ParkingFilters, ParkingStats } from '@/types/parking';
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { ParkingStatsSummary } from './ParkingStatsSummary';
import { ParkingFilterPanel } from './ParkingFilterPanel';
import { SortToggleButton } from '@/features/units-toolbar/components/SortToggleButton';


interface ParkingTableToolbarProps {
  filters: ParkingFilters;
  onFiltersChange: (filters: Partial<ParkingFilters>) => void;
  stats: ParkingStats;
  onExport?: () => void;
  onImport?: () => void;
  onAdd?: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  onRefresh?: () => void;
  selectedCount?: number;
}

export function ParkingTableToolbar({
  filters,
  onFiltersChange,
  stats,
  onExport,
  onImport,
  onAdd,
  onDelete,
  onSave,
  onRefresh,
  selectedCount = 0
}: ParkingTableToolbarProps) {
  const iconSizes = useIconSizes();

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Action Toolbar */}
        <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ToolbarButton
                tooltip="Νέα Θέση Στάθμευσης"
                className={`text-green-600 dark:text-green-500 ${INTERACTIVE_PATTERNS.SUCCESS_HOVER}`}
                onClick={onAdd}
              >
                <Plus className={iconSizes.sm} />
              </ToolbarButton>
              
              <ToolbarButton
                tooltip="Διαγραφή Επιλεγμένων"
                className={`text-red-600 dark:text-red-500 ${INTERACTIVE_PATTERNS.DESTRUCTIVE_HOVER}`}
                onClick={onDelete}
                disabled={selectedCount === 0}
              >
                <Minus className={iconSizes.sm} />
              </ToolbarButton>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <ToolbarButton 
                tooltip="Αποθήκευση Αλλαγών"
                onClick={onSave}
              >
                <Save className={iconSizes.sm} />
              </ToolbarButton>
              
              <ToolbarButton 
                tooltip="Ανανέωση Δεδομένων"
                onClick={onRefresh}
              >
                <RefreshCw className={iconSizes.sm} />
              </ToolbarButton>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <ToolbarButton 
                tooltip="Εξαγωγή Δεδομένων"
                onClick={onExport}
              >
                <Download className={iconSizes.sm} />
              </ToolbarButton>
              
              <ToolbarButton 
                tooltip="Εισαγωγή Δεδομένων"
                onClick={onImport}
              >
                <Upload className={iconSizes.sm} />
              </ToolbarButton>
            </div>
            
            {selectedCount > 0 && (
              <CommonBadge
                status="company"
                customLabel={`${selectedCount} επιλεγμένες`}
                variant="secondary"
                className="ml-2"
              />
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ToolbarButton 
              tooltip="Βοήθεια"
            >
              <HelpCircle className={iconSizes.sm} />
            </ToolbarButton>
          </div>
        </div>

        <ParkingStatsSummary stats={stats} />
        <ParkingFilterPanel filters={filters} onFiltersChange={onFiltersChange} />
      </div>
    </TooltipProvider>
  );
}
