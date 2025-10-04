
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  LayoutGrid,
  List,
  FolderOpen,
  CheckSquare,
} from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: 'list' | 'grid' | 'byType' | 'byStatus';
  setViewMode: (mode: 'list' | 'grid' | 'byType' | 'byStatus') => void;
}

export function ViewModeToggle({ viewMode, setViewMode }: ViewModeToggleProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Προβολή Λίστας</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Προβολή Πλέγματος</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'byType' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('byType')}
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Ομαδοποίηση ανά Τύπο
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ομαδοποίηση των κτιρίων ανά τύπο (π.χ. Κατοικίες, Εμπορικό).</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={viewMode === 'byStatus' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('byStatus')}
          >
            <CheckSquare className="w-4 h-4 mr-2" />
            Ομαδοποίηση ανά Κατάσταση
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ομαδοποίηση των κτιρίων ανά κατάσταση (π.χ. Ενεργό, Υπό Κατασκευή).</TooltipContent>
      </Tooltip>
    </>
  );
}
