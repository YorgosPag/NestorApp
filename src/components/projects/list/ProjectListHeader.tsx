'use client';

import React from 'react';
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp, DollarSign } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Project, ProjectSortKey } from '@/types/project';

interface ProjectListHeaderProps {
  projects: Project[];
  sortBy: ProjectSortKey;
  setSortBy: (sort: ProjectSortKey) => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
}

export function ProjectListHeader({
  projects,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}: ProjectListHeaderProps) {
  return (
    <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
          <Briefcase className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Έργα</h3>
          <p className="text-xs text-muted-foreground">
            {projects.length} έργα συνολικά
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="text-xs px-2 py-1 rounded border bg-background"
        >
          <option value="name">Όνομα</option>
          <option value="progress">Πρόοδος</option>
          <option value="totalValue">Αξία</option>
          <option value="area">Επιφάνεια</option>
          <option value="status">Κατάσταση</option>
        </select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="text-xs h-7"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
    </div>
  );
}
