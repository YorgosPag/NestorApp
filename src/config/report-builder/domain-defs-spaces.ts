/**
 * @module config/report-builder/domain-defs-spaces
 * @enterprise ADR-268 Phase 4a — A5 Parking + A6 Storage Domain Definitions
 *
 * Field schemas for parking spots and storage units.
 * Enums match actual Firestore data (SSoT = code).
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { DomainDefinition } from './report-builder-types';

// ============================================================================
// Enum Constants (SSoT — match Firestore data)
// ============================================================================

const PARKING_TYPES = [
  'standard', 'handicapped', 'motorcycle', 'electric', 'visitor',
] as const;

const PARKING_STATUSES = [
  'available', 'occupied', 'reserved', 'sold', 'maintenance',
] as const;

const PARKING_LOCATION_ZONES = [
  'pilotis', 'underground', 'open_space', 'rooftop', 'covered_outdoor',
] as const;

const STORAGE_TYPES = [
  'large', 'small', 'basement', 'ground', 'special',
  'storage', 'parking', 'garage', 'warehouse',
] as const;

const STORAGE_STATUSES = [
  'available', 'occupied', 'maintenance', 'reserved', 'sold', 'unavailable',
] as const;

const SPACE_COMMERCIAL_STATUSES = [
  'unavailable', 'for-sale', 'reserved', 'sold',
] as const;

// ============================================================================
// A5 — Parking Spots
// ============================================================================

export const PARKING_DEFINITION: DomainDefinition = {
  id: 'parking',
  collection: COLLECTIONS.PARKING_SPACES,
  group: 'realestate',
  labelKey: 'domains.parking.label',
  descriptionKey: 'domains.parking.description',
  entityLinkPath: '/parking/{id}',
  defaultSortField: 'number',
  defaultSortDirection: 'asc',
  fields: [
    {
      key: 'number',
      labelKey: 'domains.parking.fields.number',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'code',
      labelKey: 'domains.parking.fields.code',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'buildingId',
      labelKey: 'domains.parking.fields.building',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: true,
      refDomain: 'buildings',
      refDisplayField: 'name',
    },
    {
      key: 'locationZone',
      labelKey: 'domains.parking.fields.locationZone',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: PARKING_LOCATION_ZONES,
      enumLabelPrefix: 'domains.parking.enums.locationZone',
    },
    {
      key: 'type',
      labelKey: 'domains.parking.fields.type',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: PARKING_TYPES,
      enumLabelPrefix: 'domains.parking.enums.type',
    },
    {
      key: 'status',
      labelKey: 'domains.parking.fields.status',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: PARKING_STATUSES,
      enumLabelPrefix: 'domains.parking.enums.status',
    },
    {
      key: 'floor',
      labelKey: 'domains.parking.fields.floor',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'area',
      labelKey: 'domains.parking.fields.area',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
    },
    {
      key: 'price',
      labelKey: 'domains.parking.fields.price',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'currency',
    },
    {
      key: 'commercialStatus',
      labelKey: 'domains.parking.fields.commercialStatus',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: SPACE_COMMERCIAL_STATUSES,
      enumLabelPrefix: 'domains.parking.enums.commercialStatus',
    },
  ],
};

// ============================================================================
// A6 — Storage Units
// ============================================================================

export const STORAGE_DEFINITION: DomainDefinition = {
  id: 'storage',
  collection: COLLECTIONS.STORAGE,
  group: 'realestate',
  labelKey: 'domains.storage.label',
  descriptionKey: 'domains.storage.description',
  entityLinkPath: '/storage/{id}',
  defaultSortField: 'name',
  defaultSortDirection: 'asc',
  fields: [
    {
      key: 'name',
      labelKey: 'domains.storage.fields.name',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'code',
      labelKey: 'domains.storage.fields.code',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'buildingId',
      labelKey: 'domains.storage.fields.building',
      type: 'text',
      filterable: true,
      sortable: false,
      defaultVisible: true,
      refDomain: 'buildings',
      refDisplayField: 'name',
    },
    {
      key: 'type',
      labelKey: 'domains.storage.fields.type',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: STORAGE_TYPES,
      enumLabelPrefix: 'domains.storage.enums.type',
    },
    {
      key: 'status',
      labelKey: 'domains.storage.fields.status',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      enumValues: STORAGE_STATUSES,
      enumLabelPrefix: 'domains.storage.enums.status',
    },
    {
      key: 'floor',
      labelKey: 'domains.storage.fields.floor',
      type: 'text',
      filterable: true,
      sortable: true,
      defaultVisible: true,
    },
    {
      key: 'area',
      labelKey: 'domains.storage.fields.area',
      type: 'number',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'number',
    },
    {
      key: 'price',
      labelKey: 'domains.storage.fields.price',
      type: 'currency',
      filterable: true,
      sortable: true,
      defaultVisible: true,
      format: 'currency',
    },
    {
      key: 'commercialStatus',
      labelKey: 'domains.storage.fields.commercialStatus',
      type: 'enum',
      filterable: true,
      sortable: true,
      defaultVisible: false,
      enumValues: SPACE_COMMERCIAL_STATUSES,
      enumLabelPrefix: 'domains.storage.enums.commercialStatus',
    },
    {
      key: 'hasElectricity',
      labelKey: 'domains.storage.fields.hasElectricity',
      type: 'boolean',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'hasWater',
      labelKey: 'domains.storage.fields.hasWater',
      type: 'boolean',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
    {
      key: 'hasClimateControl',
      labelKey: 'domains.storage.fields.hasClimateControl',
      type: 'boolean',
      filterable: true,
      sortable: false,
      defaultVisible: false,
    },
  ],
};
