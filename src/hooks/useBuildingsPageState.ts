'use client';

import { useState, useMemo } from 'react';
import type { Building } from '@/components/building-management/BuildingsPageContent';

export function useBuildingsPageState(initialBuildings: Building[]) {
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(initialBuildings.length > 0 ? initialBuildings[0] : null);
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'byType' | 'byStatus'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDashboard, setShowDashboard] = useState(true);

  const filteredBuildings = useMemo(() => {
    return initialBuildings.filter(building => {
      const matchesSearch = building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           building.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           building.address?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCompany = filterCompany === 'all' || building.company === filterCompany;
      const matchesProject = filterProject === 'all' || building.project === filterProject;
      const matchesStatus = filterStatus === 'all' || building.status === filterStatus;
      
      return matchesSearch && matchesCompany && matchesProject && matchesStatus;
    });
  }, [initialBuildings, searchTerm, filterCompany, filterProject, filterStatus]);

  return {
    selectedBuilding,
    setSelectedBuilding,
    viewMode,
    setViewMode,
    searchTerm,
    setSearchTerm,
    filterCompany,
    setFilterCompany,
    filterProject,
    setFilterProject,
    filterStatus,
    setFilterStatus,
    showDashboard,
    setShowDashboard,
    filteredBuildings,
  };
}
