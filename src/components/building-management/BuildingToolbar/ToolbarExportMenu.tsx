'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToolbarButton } from '@/components/ui/ToolbarButton';
import { Upload, Download, FileText, BarChart3, Calendar } from 'lucide-react';

interface ToolbarExportMenuProps {
  onExport: () => void;
}

export function ToolbarExportMenu({ onExport }: ToolbarExportMenuProps) {
  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div>
            <ToolbarButton tooltip="Εξαγωγή Δεδομένων">
              <Download className="w-4 h-4" />
            </ToolbarButton>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Εξαγωγή σε:</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onExport}>
            <FileText className="w-4 h-4 mr-2" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <FileText className="w-4 h-4 mr-2" />
            PDF Αναφορά
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Στατιστικά Dashboard
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport}>
            <Calendar className="w-4 h-4 mr-2" />
            Χρονοδιάγραμμα
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ToolbarButton 
        tooltip="Εισαγωγή Δεδομένων"
        onClick={() => console.log('Importing...')}
      >
        <Upload className="w-4 h-4" />
      </ToolbarButton>
    </div>
  );
}