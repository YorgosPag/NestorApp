'use client';

/**
 * Centralized Navigation Breadcrumb Component
 * Shows current navigation path with clickable levels
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation - breadcrumb ends at Buildings
 */
import React from 'react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
import { Building, Construction, Home } from 'lucide-react';
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
    // 🏢 ENTERPRISE: selectedFloor αφαιρέθηκε - Floors δεν είναι navigation level (Επιλογή Α)
    navigateToLevel
  } = useNavigation();

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Breadcrumb χωρίς floors level
   * Ιεραρχία: Companies → Projects → Buildings
   */
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    if (selectedCompany) {
      items.push({
        id: selectedCompany.id,
        label: selectedCompany.companyName,
        icon: Building,
        level: 'companies',
        onClick: () => navigateToLevel('companies')
      });
    }

    if (selectedProject) {
      items.push({
        id: selectedProject.id,
        label: selectedProject.name,
        icon: Construction,
        level: 'projects',
        onClick: () => navigateToLevel('projects')
      });
    }

    if (selectedBuilding) {
      items.push({
        id: selectedBuilding.id,
        label: selectedBuilding.name,
        icon: Home,
        level: 'buildings',
        onClick: () => navigateToLevel('buildings')
      });
    }

    // 🏢 ENTERPRISE: floors breadcrumb αφαιρέθηκε (Επιλογή Α)

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className || ''}`} aria-label="Breadcrumb">
      {breadcrumbItems.map((item, index) => (
        <React.Fragment key={item.id}>
          <button
            onClick={item.onClick}
            className={`text-blue-400 flex items-center gap-1 ${HOVER_TEXT_EFFECTS.BLUE}`}
            title={`Μετάβαση σε ${item.label}`}
          >
            <span>
              {typeof item.icon === 'string' ? (
                item.icon
              ) : (
                <item.icon className="h-4 w-4" />
              )}
            </span>
            <span className="truncate max-w-[120px]">{item.label}</span>
          </button>
          {index < breadcrumbItems.length - 1 && (
            <span className="text-gray-500">→</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export default NavigationBreadcrumb;