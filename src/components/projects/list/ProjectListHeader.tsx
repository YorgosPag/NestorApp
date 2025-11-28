'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import type { Project } from '@/types/project';

interface ProjectListHeaderProps {
  projects: Project[];
}

export function ProjectListHeader({
  projects,
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

    </div>
  );
}
