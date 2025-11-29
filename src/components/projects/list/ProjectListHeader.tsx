'use client';

import React from 'react';
import { Briefcase } from 'lucide-react';
import type { Project } from '@/types/project';
import { SectionHeader } from '@/core/headers';

interface ProjectListHeaderProps {
  projects: Project[];
}

export function ProjectListHeader({
  projects,
}: ProjectListHeaderProps) {
  return (
    <SectionHeader
      icon={Briefcase}
      title="Έργα"
      count={projects.length}
    />
  );
}
