
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BarChart3, Plus } from 'lucide-react';

interface HeaderActionsProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
}

export function HeaderActions({ showDashboard, setShowDashboard }: HeaderActionsProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={showDashboard ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowDashboard(!showDashboard)}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </TooltipTrigger>
        <TooltipContent>Εμφάνιση/Απόκρυψη Dashboard</TooltipContent>
      </Tooltip>
      <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
        <Plus className="w-4 h-4 mr-2" />
        Νέο Κτίριο
      </Button>
    </>
  );
}
