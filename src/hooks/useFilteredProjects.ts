'use client';

import { useMemo } from 'react';
import type { Project } from '@/types/project';

export function useFilteredProjects(projects: Project[], searchTerm: string, filterCompany: string, filterStatus: string) {
  console.log('🔎 useFilteredProjects Debug:');
  console.log('  - input projects:', projects?.length || 0, projects);
  console.log('  - searchTerm:', searchTerm);
  console.log('  - filterCompany:', filterCompany);
  console.log('  - filterStatus:', filterStatus);
  
  const filtered = useMemo(() => {
    const result = projects.filter(project => {
      const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            project.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCompany = filterCompany === 'all' || project.company === filterCompany;
      const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
      
      console.log(`  - ${project.name}: search=${matchesSearch}, company=${matchesCompany}, status=${matchesStatus}`);
      return matchesSearch && matchesCompany && matchesStatus;
    });
    
    console.log('  - filtered result:', result?.length || 0, result);
    return result;
  }, [projects, searchTerm, filterCompany, filterStatus]);

  const stats = useMemo(() => ({
    totalProjects: projects.length,
    activeProjects: projects.filter(p => p.status === 'in_progress').length,
    totalValue: projects.reduce((sum, p) => sum + p.totalValue, 0),
    totalArea: projects.reduce((sum, p) => sum + p.totalArea, 0),
    averageProgress: projects.length > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length)
      : 0,
  }), [projects]);

  return { filtered, stats };
}
