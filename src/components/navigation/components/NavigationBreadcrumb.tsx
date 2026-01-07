'use client';

/**
 * Centralized Navigation Breadcrumb Component
 * Shows current navigation path with clickable levels
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation
 * Ιεραρχία: Companies → Projects → Buildings → Units
 *
 * @see navigation-entities.ts - Single Source of Truth για icons/colors
 */
import React from 'react';
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';
// 🏢 ENTERPRISE: Icons από centralized config - ZERO hardcoded imports
import { NAVIGATION_ENTITIES } from '../config';
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
    selectedUnit,  // 🏢 ENTERPRISE: Unit for breadcrumb display
    navigateToLevel,
    selectUnit  // 🏢 ENTERPRISE: Clear unit on click
  } = useNavigation();

  /**
   * 🏢 ENTERPRISE (Επιλογή Α): Breadcrumb με units
   * Ιεραρχία: Companies → Projects → Buildings → Units
   */
  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    // 🏢 ENTERPRISE: Icons/Colors από NAVIGATION_ENTITIES - Single Source of Truth
    if (selectedCompany) {
      items.push({
        id: selectedCompany.id,
        label: selectedCompany.companyName,
        icon: NAVIGATION_ENTITIES.company.icon,
        color: NAVIGATION_ENTITIES.company.color,  // 🏢 ENTERPRISE: Centralized color
        level: 'companies',
        onClick: () => {
          selectUnit(null);
          navigateToLevel('companies');
        }
      });
    }

    if (selectedProject) {
      items.push({
        id: selectedProject.id,
        label: selectedProject.name,
        icon: NAVIGATION_ENTITIES.project.icon,
        color: NAVIGATION_ENTITIES.project.color,  // 🏢 ENTERPRISE: Centralized color
        level: 'projects',
        onClick: () => {
          selectUnit(null);
          navigateToLevel('projects');
        }
      });
    }

    if (selectedBuilding) {
      items.push({
        id: selectedBuilding.id,
        label: selectedBuilding.name,
        icon: NAVIGATION_ENTITIES.building.icon,
        color: NAVIGATION_ENTITIES.building.color,  // 🏢 ENTERPRISE: Centralized color
        level: 'buildings',
        onClick: () => {
          selectUnit(null);
          navigateToLevel('buildings');
        }
      });
    }

    if (selectedUnit) {
      items.push({
        id: selectedUnit.id,
        label: selectedUnit.name,
        icon: NAVIGATION_ENTITIES.unit.icon,
        color: NAVIGATION_ENTITIES.unit.color,  // 🏢 ENTERPRISE: Centralized color
        level: 'units',
        onClick: () => navigateToLevel('units')
      });
    }

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
            className={`flex items-center gap-1 hover:opacity-80 transition-opacity`}
            title={`Μετάβαση σε ${item.label}`}
          >
            {/* 🏢 ENTERPRISE: Icon with entity-specific color from centralized config */}
            <span className={item.color}>
              {typeof item.icon === 'string' ? (
                item.icon
              ) : (
                <item.icon className="h-4 w-4" />
              )}
            </span>
            {/* 🏢 ENTERPRISE: Label in neutral color */}
            <span className="text-gray-300 hover:text-white transition-colors">{item.label}</span>
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