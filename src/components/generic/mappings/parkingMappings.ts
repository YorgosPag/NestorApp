/**
 * 🏢 ENTERPRISE: Domain-scoped Parking Component Mapping
 *
 * Contains ONLY parking-related components.
 * This file is the ONLY mapping import needed for parking detail pages.
 *
 * RATIONALE: Splitting from master barrel eliminates transitive imports
 * of project/unit/contact/storage/building components from parking pages,
 * significantly reducing module graph.
 *
 * NOTE: These mappings are IDENTICAL to those in index.ts.
 * This is NOT duplication - it's domain scoping.
 * The index.ts will be kept for legacy/backward compatibility.
 *
 * @module components/generic/mappings/parkingMappings
 */

import React, { type ComponentType } from 'react';
import type { AuditEntityType } from '@/types/audit-trail';
import type { ParkingSpot } from '@/hooks/useFirestoreParkingSpots';
import type { ParkingTabComponentProps } from '@/components/generic/UniversalTabsRenderer';

import { ParkingGeneralTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingGeneralTab';
import { ParkingFloorplanTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingFloorplanTab';
import { ParkingDocumentsTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingDocumentsTab';
import { ParkingPhotosTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingPhotosTab';
import { ParkingVideosTab } from '@/components/space-management/ParkingPage/ParkingDetails/tabs/ParkingVideosTab';
import PlaceholderTab from '@/components/building-management/tabs/PlaceholderTab';
import { ActivityTab } from '@/components/shared/audit/ActivityTab';

function resolveParking(props: ParkingTabComponentProps): ParkingSpot | undefined {
  return props.parking ?? props.data;
}

function ParkingGeneralTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  if (!parking) {
    return null;
  }

  return React.createElement(ParkingGeneralTab, {
    parking,
    isEditing: props.isEditing,
    onEditingChange: props.onEditingChange,
    onSaveRef: props.onSaveRef,
    createMode: props.createMode,
    onCreated: props.onCreated,
  });
}

function ParkingFloorplanTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  return parking ? React.createElement(ParkingFloorplanTab, { parking }) : null;
}

function ParkingDocumentsTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  return parking ? React.createElement(ParkingDocumentsTab, { parking }) : null;
}

function ParkingPhotosTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  return parking ? React.createElement(ParkingPhotosTab, { parking }) : null;
}

function ParkingVideosTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  return parking ? React.createElement(ParkingVideosTab, { parking }) : null;
}

function PlaceholderTabAdapter(props: ParkingTabComponentProps) {
  return React.createElement(PlaceholderTab, {
    title: typeof props.title === 'string' ? props.title : undefined,
    icon: props.icon ?? undefined,
  });
}

function ActivityTabAdapter(props: ParkingTabComponentProps) {
  const parking = resolveParking(props);
  return React.createElement(ActivityTab, {
    ...props,
    entityType: (props.entityType as AuditEntityType | undefined) ?? 'parking',
    entityId: parking?.id,
    data: parking ?? props.data,
  });
}

export const PARKING_COMPONENT_MAPPING: Record<string, ComponentType<ParkingTabComponentProps>> = {
  ParkingGeneralTab: ParkingGeneralTabAdapter,
  ParkingFloorplanTab: ParkingFloorplanTabAdapter,
  ParkingDocumentsTab: ParkingDocumentsTabAdapter,
  ParkingPhotosTab: ParkingPhotosTabAdapter,
  ParkingVideosTab: ParkingVideosTabAdapter,
  PlaceholderTab: PlaceholderTabAdapter,
  ActivityTab: ActivityTabAdapter,
};

export type ParkingComponentName = keyof typeof PARKING_COMPONENT_MAPPING;
