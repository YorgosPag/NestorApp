/**
 * ?? ENTERPRISE: Domain-scoped Properties Component Mapping
 *
 * Contains ONLY properties-related components.
 * This file is the ONLY mapping import needed for /properties and PropertiesSidebar.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/building/contact/parking/storage components from units pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/propertiesMappings
 */

import React, { type ComponentType } from 'react';
import type { Property } from '@/types/property-viewer';
import type { PropertyTabComponentProps } from '@/components/generic/UniversalTabsRenderer';
import type { PropertyDetailsContentProps } from '@/features/property-details/types';

import { PropertyDetailsContent } from '@/components/property-viewer/details/PropertyDetailsContent';
import { PropertyCustomerTab as UnitCustomerTab } from '@/components/properties/tabs/PropertyCustomerTab';
import { FloorPlanTab } from '@/features/properties-sidebar/components/FloorPlanTab';
import { DocumentsTab } from '@/features/properties-sidebar/components/DocumentsTab';
import { PhotosTab } from '@/features/properties-sidebar/components/PhotosTab';
import { VideosTab } from '@/features/properties-sidebar/components/VideosTab';

import PhotosTabContent from '@/components/building-management/tabs/PhotosTabContent';
import VideosTabContent from '@/components/building-management/tabs/VideosTabContent';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { FloorplanViewerTab } from '@/components/projects/tabs/FloorplanViewerTab';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';
import type { AuditEntityType } from '@/types/audit-trail';

function isProperty(value: unknown): value is Property {
  return typeof value === 'object' && value !== null && 'id' in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function resolveSelectedProperty(props: PropertyTabComponentProps): Property | null {
  if (isProperty(props.selectedProperty)) {
    return props.selectedProperty;
  }
  if (isProperty(props.unit)) {
    return props.unit;
  }
  if (isProperty(props.data)) {
    return props.data;
  }
  return null;
}

function PropertyDetailsTabAdapter(props: PropertyTabComponentProps) {
  const selectedProperty = resolveSelectedProperty(props);
  if (!selectedProperty) {
    return React.createElement(PlaceholderTab, { title: 'building:placeholder.content' });
  }

  const onSelectFloor = typeof props.onSelectFloor === 'function'
    ? props.onSelectFloor as (floorId: string | null) => void
    : () => {};
  const onUpdateProperty = typeof props.onUpdateProperty === 'function'
    ? props.onUpdateProperty as (propertyId: string, updates: Partial<Property>) => void
    : () => {};

  const detailsProps: PropertyDetailsContentProps = {
    property: selectedProperty as PropertyDetailsContentProps['property'],
    onSelectFloor,
    onUpdateProperty,
    // 🏢 ENTERPRISE: Pass edit-mode props from additionalData → PropertyDetailsContent
    isEditMode: typeof props.isEditMode === 'boolean' ? props.isEditMode : undefined,
    onToggleEditMode: typeof props.onToggleEditMode === 'function'
      ? props.onToggleEditMode as () => void
      : undefined,
    onExitEditMode: typeof props.onExitEditMode === 'function'
      ? props.onExitEditMode as () => void
      : undefined,
    isCreatingNewUnit: typeof props.isCreatingNewUnit === 'boolean' ? props.isCreatingNewUnit : undefined,
    onPropertyCreated: typeof props.onPropertyCreated === 'function'
      ? props.onPropertyCreated as (propertyId: string) => void
      : undefined,
  };

  return React.createElement(PropertyDetailsContent, detailsProps);
}

function UnitCustomerTabAdapter(props: PropertyTabComponentProps) {
  const selectedProperty = resolveSelectedProperty(props);
  if (!selectedProperty) {
    return React.createElement(UnitCustomerTab, { selectedProperty: null as never });
  }
  return React.createElement(UnitCustomerTab, { selectedProperty });
}

function FloorPlanTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(FloorPlanTab, { selectedProperty: resolveSelectedProperty(props) });
}

function DocumentsTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(DocumentsTab, { selectedProperty: resolveSelectedProperty(props) });
}

function PhotosTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(PhotosTab, { selectedProperty: resolveSelectedProperty(props) });
}

function VideosTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(VideosTab, { selectedProperty: resolveSelectedProperty(props) });
}

function PhotosTabContentAdapter(props: PropertyTabComponentProps) {
  const selectedProperty = resolveSelectedProperty(props);
  return React.createElement(PhotosTabContent, { selectedProperty: selectedProperty ?? undefined });
}

function VideosTabContentAdapter() {
  return React.createElement(VideosTabContent);
}

function PlaceholderTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(PlaceholderTab, {
    title: typeof props.title === 'string' ? props.title : undefined,
    icon: props.icon ?? undefined,
    building: isRecord(props.building) ? props.building : undefined,
  });
}

function FloorplanViewerTabAdapter(props: PropertyTabComponentProps) {
  return React.createElement(FloorplanViewerTab, {
    title: typeof props.title === 'string' ? props.title : '',
    floorplanData: props.floorplanData as Parameters<typeof FloorplanViewerTab>[0]['floorplanData'],
    onAddFloorplan: typeof props.onAddFloorplan === 'function'
      ? (props.onAddFloorplan as () => void)
      : undefined,
    onEditFloorplan: typeof props.onEditFloorplan === 'function'
      ? (props.onEditFloorplan as () => void)
      : undefined,
  });
}

function ActivityTabAdapter(props: PropertyTabComponentProps) {
  const selectedProperty = resolveSelectedProperty(props);
  const entityType = (props.entityType as AuditEntityType | undefined) ?? 'property';
  return React.createElement(ActivityTab, {
    ...props,
    entityType,
    entityId: selectedProperty?.id,
    unit: selectedProperty ?? undefined,
    data: selectedProperty ?? props.data,
  });
}

export const PROPERTIES_COMPONENT_MAPPING: Record<string, ComponentType<PropertyTabComponentProps>> = {
  PropertyDetailsContent: PropertyDetailsTabAdapter,
  UnitCustomerTab: UnitCustomerTabAdapter,
  FloorPlanTab: FloorPlanTabAdapter,
  DocumentsTab: DocumentsTabAdapter,
  PhotosTab: PhotosTabAdapter,
  VideosTab: VideosTabAdapter,
  PhotosTabContent: PhotosTabContentAdapter,
  VideosTabContent: VideosTabContentAdapter,
  DocumentsPlaceholder: PlaceholderTabAdapter,
  PlaceholderTab: PlaceholderTabAdapter,
  FloorplanViewerTab: FloorplanViewerTabAdapter,
  ActivityTab: ActivityTabAdapter,
};

export type PropertiesComponentName = keyof typeof PROPERTIES_COMPONENT_MAPPING;
