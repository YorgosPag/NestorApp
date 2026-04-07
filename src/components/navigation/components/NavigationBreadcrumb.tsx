'use client';

/**
 * Centralized Navigation Breadcrumb Component
 * Shows current navigation path with clickable levels
 *
 * 🏢 ENTERPRISE ARCHITECTURE (Επιλογή Α):
 * Floors αφαιρέθηκαν από navigation
 * Ιεραρχία: Companies → Projects → Buildings → Units
 *
 * 🔗 ADR-016: Breadcrumb items are clickable Links (not buttons)
 * - Uses ContextualNavigationService.generateRoute() for URL generation
 * - Ctrl+Click opens in new tab (native browser behavior)
 * - Last item (current page) is NOT clickable
 *
 * 🏢 ENTERPRISE: i18n support
 *
 * @see navigation-entities.ts - Single Source of Truth για icons/colors
 * @see ContextualNavigationService - Centralized route generation
 */
import React from 'react';
import Link from 'next/link';
// 🏢 ENTERPRISE: Shadcn Tooltip for accessible tooltips (replaces native title)
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: Icons από centralized config - ZERO hardcoded imports
import { NAVIGATION_ENTITIES, isNavigationEntityType } from '../config';
import { useNavigation } from '../core/NavigationContext';
import type { BreadcrumbItem } from '../core/types';
// 🏢 ENTERPRISE: Centralized route generation - ZERO hardcoded URLs
import { ContextualNavigationService, type NavigableEntityType } from '@/services/navigation/ContextualNavigationService';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import '@/lib/design-system';
import { formatBuildingLabel } from '@/lib/entity-formatters';

interface NavigationBreadcrumbProps {
  className?: string;
}

/**
 * 🏢 ENTERPRISE: Extended BreadcrumbItem with href for Link navigation
 */
interface BreadcrumbItemWithHref extends BreadcrumbItem {
  href: string;
  entityType: NavigableEntityType;
}

export function NavigationBreadcrumb({ className }: NavigationBreadcrumbProps) {
  const {
    selectedCompany,
    selectedProject,
    selectedBuilding,
    selectedProperty,  // 🏢 ENTERPRISE: Unit for breadcrumb display
  } = useNavigation();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('navigation');

  /**
   * 🏢 ENTERPRISE (ADR-016): Breadcrumb με clickable Links
   *
   * Ιεραρχία: Companies → Projects → Buildings → Units/Storage/Parking
   *
   * Κάθε item έχει href που δημιουργείται από ContextualNavigationService.generateRoute()
   * - company → /contacts?contactId=X&selectedCompany=true
   * - project → /projects?projectId=X&selected=true
   * - building → /buildings?buildingId=X&selected=true
   * - unit/storage/parking → current page (last item, not clickable)
   */
  const getBreadcrumbItems = (): BreadcrumbItemWithHref[] => {
    const items: BreadcrumbItemWithHref[] = [];

    // 🏢 ENTERPRISE: Icons/Colors από NAVIGATION_ENTITIES - Single Source of Truth
    if (selectedCompany) {
      items.push({
        id: selectedCompany.id,
        label: selectedCompany.companyName,
        icon: NAVIGATION_ENTITIES.company.icon,
        color: NAVIGATION_ENTITIES.company.color,
        level: 'companies',
        entityType: 'company',
        href: ContextualNavigationService.generateRoute('company', selectedCompany.id, { action: 'select' }),
        onClick: () => {} // Legacy - not used with Link
      });
    }

    if (selectedProject) {
      items.push({
        id: selectedProject.id,
        label: selectedProject.name,
        icon: NAVIGATION_ENTITIES.project.icon,
        color: NAVIGATION_ENTITIES.project.color,
        level: 'projects',
        entityType: 'project',
        href: ContextualNavigationService.generateRoute('project', selectedProject.id, { action: 'select' }),
        onClick: () => {} // Legacy - not used with Link
      });
    }

    if (selectedBuilding) {
      items.push({
        id: selectedBuilding.id,
        label: formatBuildingLabel(selectedBuilding.code, selectedBuilding.name),
        icon: NAVIGATION_ENTITIES.building.icon,
        color: NAVIGATION_ENTITIES.building.color,
        level: 'buildings',
        entityType: 'building',
        href: ContextualNavigationService.generateRoute('building', selectedBuilding.id, { action: 'select' }),
        onClick: () => {} // Legacy - not used with Link
      });
    }

    if (selectedProperty) {
      // 🏢 ENTERPRISE: Dynamic entity config based on selectedProperty.type
      // Supports: 'parking', 'storage', or defaults to 'unit'
      const entityType = selectedProperty.type && isNavigationEntityType(selectedProperty.type)
        ? selectedProperty.type
        : 'property';
      const entityConfig = NAVIGATION_ENTITIES[entityType];

      // Map navigation entity type to NavigableEntityType for route generation
      const navigableType: NavigableEntityType = entityType as NavigableEntityType;

      items.push({
        id: selectedProperty.id,
        label: selectedProperty.name,
        icon: entityConfig.icon,
        color: entityConfig.color,
        level: 'properties',
        entityType: navigableType,
        href: ContextualNavigationService.generateRoute(navigableType, selectedProperty.id, { action: 'select' }),
        onClick: () => {} // Legacy - not used with Link
      });
    }

    return items;
  };

  const breadcrumbItems = getBreadcrumbItems();

  if (breadcrumbItems.length === 0) {
    return null;
  }

  /**
   * 🏢 ENTERPRISE: Render breadcrumb item content (shared between Link and span)
   */
  const renderItemContent = (item: BreadcrumbItemWithHref) => (
    <>
      {/* 🏢 ENTERPRISE: Icon with entity-specific color from centralized config */}
      <span className={item.color}>
        {typeof item.icon === 'string' ? (
          item.icon
        ) : (
          <item.icon className="h-4 w-4" />
        )}
      </span>
      {/* 🏢 ENTERPRISE: Label */}
      <span>{item.label}</span>
    </>
  );

  return (
    <nav className={`flex items-center space-x-2 text-sm ${className || ''}`} aria-label="Breadcrumb">
      {breadcrumbItems.map((item, index) => {
        const isLastItem = index === breadcrumbItems.length - 1;

        return (
          <React.Fragment key={item.id}>
            {isLastItem ? (
              /**
               * 🏢 ENTERPRISE (ADR-016): Last item is CURRENT PAGE - not clickable
               * Displayed as plain text with distinct styling
               */
              <span
                className="flex items-center gap-1 text-white font-medium"
                aria-current="page"
              >
                {renderItemContent(item)}
              </span>
            ) : (
              /**
               * 🏢 ENTERPRISE (ADR-016): Clickable Link for navigation
               * - Uses ContextualNavigationService.generateRoute() for URL
               * - Ctrl+Click opens in new tab (native browser behavior)
               * - Proper <a> semantics for accessibility
               * - Shadcn Tooltip replaces native title for better UX
               */
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className="flex items-center gap-1 text-gray-300 hover:text-white transition-colors"
                  >
                    {renderItemContent(item)}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>{t('page.breadcrumb.navigateTo', { name: item.label })}</TooltipContent>
              </Tooltip>
            )}
            {!isLastItem && (
              <span className="text-gray-500" aria-hidden="true">→</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export default NavigationBreadcrumb;