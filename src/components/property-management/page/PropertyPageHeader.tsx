'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, List, BarChart3, Eye, EyeOff, Plus, Home } from 'lucide-react';

interface PropertyPageHeaderProps {
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  viewMode: 'list' | 'grid';
  setViewMode: (mode: 'list' | 'grid') => void;
}

export function PropertyPageHeader({
  showDashboard,
  setShowDashboard,
  viewMode,
  setViewMode
}: PropertyPageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Home className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold">Διαχείριση Ακινήτων</h1>
        </div>
        <Badge variant="secondary" className="text-xs">
          Διαχείριση και παρακολούθηση ακινήτων έργων
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={showDashboard ? "default" : "outline"}
          size="sm"
          onClick={() => setShowDashboard(!showDashboard)}
          className="h-8"
        >
          {showDashboard ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showDashboard ? 'Απόκρυψη' : 'Εμφάνιση'} Dashboard
        </Button>

        <div className="flex border rounded-md bg-background">
          <Button
            variant={viewMode === 'list' ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 rounded-r-none border-0"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 rounded-l-none border-0"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
        </div>

        <Button size="sm" className="h-8">
          <Plus className="w-4 h-4 mr-2" />
          Νέο Ακίνητο
        </Button>
      </div>
    </div>
  );
}
