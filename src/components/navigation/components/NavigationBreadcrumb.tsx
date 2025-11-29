'use client';

/**
 * Centralized Navigation Breadcrumb Component
 * Shows current navigation path with clickable levels
 */
import React from 'react';
import { useNavigation } from '../core/NavigationContext';
import type { BreadcrumbItem } from '../core/types';

interface NavigationBreadcrumbProps {
  className?: string;
}

export function NavigationBreadcrumb({ className }: NavigationBreadcrumbProps) {
  const {
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    navigateToLevel
  } = useNavigation();

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    if (selectedCompany) {
      items.push({
        id: selectedCompany.id,
        label: selectedCompany.companyName,
        icon: '🏢',
        level: 'companies',
        onClick: () => navigateToLevel('companies')
      });
    }

    if (selectedProject) {
      items.push({
        id: selectedProject.id,
        label: selectedProject.name,
        icon: '🏗️',
        level: 'projects',
        onClick: () => navigateToLevel('projects')
      });
    }

    if (selectedBuilding) {
      items.push({
        id: selectedBuilding.id,
        label: selectedBuilding.name,
        icon: '🏠',
        level: 'buildings',
        onClick: () => navigateToLevel('buildings')
      });
    }

    if (selectedFloor) {
      items.push({
        id: selectedFloor.id,
        label: selectedFloor.name,
        icon: '🏠',
        level: 'floors',
        onClick: () => navigateToLevel('floors')
      });
    }

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm ${className || ''}`}>
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            onClick={item.onClick}
            className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            title={`Μετάβαση σε ${item.label}`}
          >
            <span>{item.icon}</span>
            <span className="truncate max-w-[120px]">{item.label}</span>
          </button>
          {index < breadcrumbItems.length - 1 && (
            <span className="text-gray-500">→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default NavigationBreadcrumb;