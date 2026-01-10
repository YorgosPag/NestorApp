'use client';

/**
 * 🏢 ENTERPRISE CONTEXTUAL NAVIGATION HANDLER
 *
 * Centralized handler for URL-based navigation context.
 * Implements enterprise patterns from Bentley Systems, Autodesk, Google.
 *
 * Features:
 * - Automatic entity selection from URL parameters
 * - Deep linking support
 * - Context preservation during navigation
 * - Zero hardcoded values
 *
 * @enterprise-certified
 * @centralized-system
 */

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useNavigation } from './NavigationContext';

/**
 * Enterprise handler for contextual navigation
 * Reads URL parameters and automatically selects entities
 */
export function ContextualNavigationHandler() {
  const searchParams = useSearchParams();
  const navigation = useNavigation();

  // Track previous selections to avoid loops
  const previousSelections = useRef({
    projectId: null as string | null,
    buildingId: null as string | null,
    unitId: null as string | null,
    storageId: null as string | null,
    parkingId: null as string | null
  });

  useEffect(() => {
    // 🏢 ENTERPRISE: Wait until navigation data is loaded
    // This prevents race conditions where we try to select before data exists
    if (navigation.companies.length === 0 || navigation.projects.length === 0) {
      console.log('⏳ [ContextualNavigation] Waiting for navigation data to load...');
      return;
    }

    // Extract all navigation parameters
    const params = {
      projectId: searchParams.get('projectId') || searchParams.get('selectedProject'),
      buildingId: searchParams.get('buildingId') || searchParams.get('selectedBuilding'),
      unitId: searchParams.get('unitId') || searchParams.get('selectedUnit'),
      storageId: searchParams.get('storageId') || searchParams.get('selectedStorage'),
      parkingId: searchParams.get('parkingId') || searchParams.get('selectedParking')
    };

    // 🏢 ENTERPRISE: Skip if no contextual parameters
    if (!params.projectId && !params.buildingId && !params.unitId && !params.storageId && !params.parkingId) {
      return;
    }

    // Handle Project Selection
    if (params.projectId && params.projectId !== previousSelections.current.projectId) {
      console.log('🎯 [ContextualNavigation] Auto-selecting project:', params.projectId);
      previousSelections.current.projectId = params.projectId;

      // Find and select the project
      const project = navigation.projects.find(p => p.id === params.projectId);
      if (project) {
        // First select the company that owns this project
        const company = navigation.companies.find(c => c.id === project.companyId);
        if (company && navigation.selectedCompany?.id !== company.id) {
          console.log('🏢 [ContextualNavigation] Auto-selecting parent company:', company.name);
          navigation.selectCompany(company.id);
        }

        // Then select the project
        setTimeout(() => {
          navigation.selectProject(params.projectId!);
        }, 100); // Small delay to ensure company is selected first
      }
    }

    // Handle Building Selection
    else if (params.buildingId && params.buildingId !== previousSelections.current.buildingId) {
      console.log('🏗️ [ContextualNavigation] Auto-selecting building:', params.buildingId);
      previousSelections.current.buildingId = params.buildingId;

      // For buildings, we need to know which project they belong to
      // This requires the building data to have projectId
      navigation.selectBuilding(params.buildingId);
    }

    // Handle Unit/Storage/Parking Selection
    else if (params.unitId || params.storageId || params.parkingId) {
      const spaceId = params.unitId || params.storageId || params.parkingId;
      const spaceType = params.unitId ? 'unit' : params.storageId ? 'storage' : 'parking';

      const previousSpaceId = params.unitId
        ? previousSelections.current.unitId
        : params.storageId
        ? previousSelections.current.storageId
        : previousSelections.current.parkingId;

      if (spaceId && spaceId !== previousSpaceId) {
        console.log('🏠 [ContextualNavigation] Auto-selecting space:', spaceType, spaceId);

        // Update previous selection
        if (params.unitId) previousSelections.current.unitId = params.unitId;
        if (params.storageId) previousSelections.current.storageId = params.storageId;
        if (params.parkingId) previousSelections.current.parkingId = params.parkingId;

        // Note: Actual selection needs to be handled by BuildingSpacesTabs
        // We can dispatch a custom event for it to handle
        window.dispatchEvent(new CustomEvent('selectBuildingSpace', {
          detail: { type: spaceType, id: spaceId }
        }));
      }
    }
  }, [searchParams, navigation]);

  // This component doesn't render anything - it only handles side effects
  return null;
}

export default ContextualNavigationHandler;