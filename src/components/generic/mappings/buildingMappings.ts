/**
 * 🏢 ENTERPRISE: Domain-scoped Building Component Mapping
 *
 * Contains ONLY building-related components.
 * This file is the ONLY mapping import needed for building detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/parking/storage components from building pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/buildingMappings
 */

import React, { type ComponentType } from 'react';
import type { BuildingTabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import type { AuditEntityType } from '@/types/audit-trail';

import { GeneralTabContent } from '@/components/building-management/tabs/GeneralTabContent';
import TimelineTabContent from '@/components/building-management/tabs/TimelineTabContent';
import AnalyticsTabContent from '@/components/building-management/tabs/AnalyticsTabContent';
import { StorageTab } from '@/components/building-management/StorageTab';
import { BuildingCustomersTab } from '@/components/building-management/tabs/BuildingCustomersTab';
import { BuildingContactsTab } from '@/components/building-management/tabs/BuildingContactsTab';
import { BuildingLocationsTab } from '@/components/building-management/tabs/BuildingLocationsTab';
import { BuildingFloorplanTab } from '@/components/building-management/tabs/BuildingFloorplanTab';
import { BuildingPhotosTab } from '@/components/building-management/tabs/BuildingPhotosTab';
import { BuildingVideosTab } from '@/components/building-management/tabs/BuildingVideosTab';
import { BuildingContractsTab } from '@/components/building-management/tabs/BuildingContractsTab';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { MeasurementsTabContent } from '@/components/building-management/tabs/MeasurementsTabContent';
import { FloorsTabContent } from '@/components/building-management/tabs/FloorsTabContent';
import { ParkingTabContent } from '@/components/building-management/tabs/ParkingTabContent';
import { PropertiesTabContent } from '@/components/building-management/tabs/PropertiesTabContent';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';

function resolveBuilding(props: BuildingTabComponentProps): BuildingTabComponentProps['building'] | undefined {
  return props.building ?? props.data;
}

function resolveNormalizedBuilding(props: BuildingTabComponentProps): BuildingTabComponentProps['building'] | undefined {
  const building = resolveBuilding(props);
  if (!building) {
    return undefined;
  }

  return {
    ...building,
    id: String(building.id),
  } as BuildingTabComponentProps['building'];
}

function BuildingCustomersTabAdapter(props: BuildingTabComponentProps) {
  const buildingId = props.buildingId ?? resolveBuilding(props)?.id;
  if (buildingId === undefined || buildingId === null) {
    return null;
  }
  return React.createElement(BuildingCustomersTab, { buildingId: String(buildingId) });
}

function BuildingContactsTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingContactsTab> = {
    building: building as React.ComponentProps<typeof BuildingContactsTab>['building'],
    data: building as React.ComponentProps<typeof BuildingContactsTab>['data'],
  };
  return React.createElement(BuildingContactsTab, componentProps);
}

function BuildingLocationsTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingLocationsTab> = {
    building: building as React.ComponentProps<typeof BuildingLocationsTab>['building'],
    data: building as React.ComponentProps<typeof BuildingLocationsTab>['data'],
  };
  return React.createElement(BuildingLocationsTab, componentProps);
}

function GeneralTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof GeneralTabContent> = {
    building: building as React.ComponentProps<typeof GeneralTabContent>['building'],
    isEditing: props.isEditing,
    onEditingChange: props.onEditingChange,
    onSaveRef: props.onSaveRef,
    isCreateMode: props.isCreateMode,
    onBuildingCreated: props.onBuildingCreated,
  };

  return React.createElement(GeneralTabContent, componentProps);
}

function TimelineTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof TimelineTabContent> = {
    building: building as React.ComponentProps<typeof TimelineTabContent>['building'],
  };

  return React.createElement(TimelineTabContent, componentProps);
}

function AnalyticsTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof AnalyticsTabContent> = {
    building: building as React.ComponentProps<typeof AnalyticsTabContent>['building'],
  };

  return React.createElement(AnalyticsTabContent, componentProps);
}

function BuildingFloorplanTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingFloorplanTab> = {
    building: building as React.ComponentProps<typeof BuildingFloorplanTab>['building'],
    data: building as React.ComponentProps<typeof BuildingFloorplanTab>['data'],
    title: typeof props.title === 'string' ? props.title : undefined,
  };
  return React.createElement(BuildingFloorplanTab, componentProps);
}

function BuildingPhotosTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingPhotosTab> = {
    building: building as React.ComponentProps<typeof BuildingPhotosTab>['building'],
    data: building as React.ComponentProps<typeof BuildingPhotosTab>['data'],
    title: typeof props.title === 'string' ? props.title : undefined,
  };
  return React.createElement(BuildingPhotosTab, componentProps);
}

function BuildingVideosTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingVideosTab> = {
    building: building as React.ComponentProps<typeof BuildingVideosTab>['building'],
    data: building as React.ComponentProps<typeof BuildingVideosTab>['data'],
    title: typeof props.title === 'string' ? props.title : undefined,
  };
  return React.createElement(BuildingVideosTab, componentProps);
}

function BuildingContractsTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof BuildingContractsTab> = {
    building: building as React.ComponentProps<typeof BuildingContractsTab>['building'],
    data: building as React.ComponentProps<typeof BuildingContractsTab>['data'],
    title: typeof props.title === 'string' ? props.title : undefined,
  };
  return React.createElement(BuildingContractsTab, componentProps);
}

function PlaceholderTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  const componentProps: React.ComponentProps<typeof PlaceholderTab> = {
    title: typeof props.title === 'string' ? props.title : undefined,
    building: (building as React.ComponentProps<typeof PlaceholderTab>['building']) ?? undefined,
    icon: props.icon ?? undefined,
  };
  return React.createElement(PlaceholderTab, componentProps);
}

function StorageTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof StorageTab> = {
    building: building as React.ComponentProps<typeof StorageTab>['building'],
  };

  return React.createElement(StorageTab, componentProps);
}

function MeasurementsTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof MeasurementsTabContent> = {
    building: building as React.ComponentProps<typeof MeasurementsTabContent>['building'],
  };

  return React.createElement(MeasurementsTabContent, componentProps);
}

function FloorsTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof FloorsTabContent> = {
    building: building as React.ComponentProps<typeof FloorsTabContent>['building'],
  };

  return React.createElement(FloorsTabContent, componentProps);
}

function ParkingTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof ParkingTabContent> = {
    building: building as React.ComponentProps<typeof ParkingTabContent>['building'],
  };

  return React.createElement(ParkingTabContent, componentProps);
}

function PropertiesTabContentAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  if (!building) {
    return null;
  }

  const componentProps: React.ComponentProps<typeof PropertiesTabContent> = {
    building: building as React.ComponentProps<typeof PropertiesTabContent>['building'],
  };

  return React.createElement(PropertiesTabContent, componentProps);
}

function ActivityTabAdapter(props: BuildingTabComponentProps) {
  const building = resolveNormalizedBuilding(props);
  return React.createElement(ActivityTab, {
    ...props,
    entityType: (props.entityType as AuditEntityType | undefined) ?? 'building',
    entityId: building?.id ? String(building.id) : undefined,
    building,
    data: building ?? props.data,
  });
}

export const BUILDING_COMPONENT_MAPPING: Record<string, ComponentType<BuildingTabComponentProps>> = {
  GeneralTabContent: GeneralTabContentAdapter,
  TimelineTabContent: TimelineTabContentAdapter,
  AnalyticsTabContent: AnalyticsTabContentAdapter,
  PhotosTabContent: BuildingPhotosTabAdapter,
  VideosTabContent: BuildingVideosTabAdapter,
  PlaceholderTab: PlaceholderTabAdapter,
  FloorplanViewerTab: BuildingFloorplanTabAdapter,
  StorageTab: StorageTabAdapter,
  BuildingCustomersTab: BuildingCustomersTabAdapter,
  BuildingContactsTab: BuildingContactsTabAdapter,
  BuildingLocationsTab: BuildingLocationsTabAdapter,
  MeasurementsTabContent: MeasurementsTabContentAdapter,
  FloorsTabContent: FloorsTabContentAdapter,
  ParkingTabContent: ParkingTabContentAdapter,
  PropertiesTabContent: PropertiesTabContentAdapter,
  BuildingGeneralTab: GeneralTabContentAdapter,
  BuildingFloorsTab: TimelineTabContentAdapter,
  BuildingFloorplansTab: BuildingFloorplanTabAdapter,
  BuildingDocumentsTab: BuildingContractsTabAdapter,
  BuildingPhotosTab: BuildingPhotosTabAdapter,
  BuildingVideosTab: BuildingVideosTabAdapter,
  BuildingActivityTab: AnalyticsTabContentAdapter,
  BuildingMeasurementsTab: MeasurementsTabContentAdapter,
  ActivityTab: ActivityTabAdapter,
};

export type BuildingComponentName = keyof typeof BUILDING_COMPONENT_MAPPING;
