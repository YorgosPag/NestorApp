'use client';

import React from 'react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Minus, 
  Save, 
  RefreshCw, 
  HelpCircle,
  Download,
  Upload
} from 'lucide-react';
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

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Action Toolbar */}
        <div className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ToolbarButton 
                tooltip="Νέα Θέση Στάθμευσης" 
                className="text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400"
                onClick={onAdd}
              >
                <Plus className="w-4 h-4" />
              </ToolbarButton>
              
              <ToolbarButton 
                tooltip="Διαγραφή Επιλεγμένων" 
                className="text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400"
                onClick={onDelete}
                disabled={selectedCount === 0}
              >
                <Minus className="w-4 h-4" />
              </ToolbarButton>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <ToolbarButton 
                tooltip="Αποθήκευση Αλλαγών"
                onClick={onSave}
              >
                <Save className="w-4 h-4" />
              </ToolbarButton>
              
              <ToolbarButton 
                tooltip="Ανανέωση Δεδομένων"
                onClick={onRefresh}
              >
                <RefreshCw className="w-4 h-4" />
              </ToolbarButton>
              
              <div className="w-px h-6 bg-border mx-1" />
              
              <ToolbarButton 
                tooltip="Εξαγωγή Δεδομένων"
                onClick={onExport}
              >
                <Download className="w-4 h-4" />
              </ToolbarButton>
              
              <ToolbarButton 
                tooltip="Εισαγωγή Δεδομένων"
                onClick={onImport}
              >
                <Upload className="w-4 h-4" />
              </ToolbarButton>
            </div>
            
            {selectedCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedCount} επιλεγμένες
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <ToolbarButton 
              tooltip="Βοήθεια"
            >
              <HelpCircle className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </div>

        <ParkingStatsSummary stats={stats} />
        <ParkingFilterPanel filters={filters} onFiltersChange={onFiltersChange} />
      </div>
    </TooltipProvider>
  );
}
