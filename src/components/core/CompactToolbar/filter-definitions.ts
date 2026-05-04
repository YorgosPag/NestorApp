// CompactToolbar — filter/sort definitions and label maps
// Extracted from configs.ts to keep each file under 500 lines (N.7.1).

import {
  UNIFIED_STATUS_FILTER_LABELS,
  PROPERTY_BUILDING_TYPE_LABELS,
  CONTACT_BUSINESS_TYPE_LABELS,
} from '@/constants/property-statuses-enterprise';
import {
  PARKING_TYPE_LABELS,
  PARKING_STATUS_LABELS,
} from '@/components/core/AdvancedFilters/configs/parkingFiltersConfig';

// ============================================================================
// TYPES
// ============================================================================

export type ToolbarType =
  | 'buildings'
  | 'projects'
  | 'contacts'
  | 'properties'
  | 'storages'
  | 'parking'
  | 'communications'
  | 'procurement'
  | 'quotes'
  | 'vendors'
  | 'materials'
  | 'agreements';

// ============================================================================
// LABEL MAPS
// ============================================================================

const COMMUNICATIONS_CHANNEL_LABELS = {
  all: 'toolbar.communications.channels.all',
  email: 'toolbar.communications.channels.email',
  sms: 'toolbar.communications.channels.sms',
  telegram: 'toolbar.communications.channels.telegram',
} as const;

const COMMUNICATIONS_STATUS_LABELS = {
  all: 'toolbar.communications.status.all',
  sent: 'toolbar.communications.status.sent',
  received: 'toolbar.communications.status.received',
  pending: 'toolbar.communications.status.pending',
  failed: 'toolbar.communications.status.failed',
} as const;

export const NEW_ITEM_LABELS_BY_TYPE: Record<string, string> = {
  buildings: 'actions.newBuilding',
  projects: 'actions.newProject',
  contacts: 'actions.newContact',
  properties: 'actions.newProperty',
  storages: 'actions.newStorage',
  parking: 'actions.newParking',
  communications: 'actions.newMessage',
  procurement: 'procurement:list.createPO',
  quotes: 'quotes:list.createQuote',
  vendors: 'procurement:hub.vendorMaster.addVendorHint',
  materials: 'procurement:hub.materialCatalog.create',
  agreements: 'procurement:hub.frameworkAgreements.create',
};

export const NEW_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'tooltips.newBuildingShortcut',
  projects: 'tooltips.newProjectShortcut',
  contacts: 'tooltips.newContactShortcut',
  properties: 'tooltips.newPropertyShortcut',
  storages: 'tooltips.newStorageShortcut',
  parking: 'tooltips.newParkingShortcut',
  communications: 'tooltips.newMessageShortcut',
  procurement: 'procurement:list.createPO',
  quotes: 'quotes:list.createQuote',
  vendors: 'procurement:hub.vendorMaster.addVendorHint',
  materials: 'procurement:hub.materialCatalog.create',
  agreements: 'procurement:hub.frameworkAgreements.create',
};

export const EDIT_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'toolbar.actions.buildings.edit',
  projects: 'toolbar.actions.projects.edit',
  contacts: 'tooltips.editContact',
  properties: 'toolbar.actions.properties.edit',
  storages: 'toolbar.actions.storage.edit',
  parking: 'tooltips.editSelected',
  communications: 'tooltips.editSelected',
  procurement: 'tooltips.editSelected',
  quotes: 'tooltips.editSelected',
  vendors: 'tooltips.editSelected',
  materials: 'tooltips.editSelected',
  agreements: 'tooltips.editSelected',
};

export const DELETE_ITEM_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'toolbar.actions.buildings.delete',
  projects: 'toolbar.actions.projects.delete',
  contacts: 'tooltips.deleteContact',
  properties: 'toolbar.actions.properties.delete',
  storages: 'toolbar.actions.storage.delete',
  parking: 'tooltips.deleteSelected',
  communications: 'tooltips.deleteSelected',
  procurement: 'tooltips.deleteSelected',
  quotes: 'tooltips.deleteSelected',
  vendors: 'tooltips.deleteSelected',
  materials: 'tooltips.deleteSelected',
  agreements: 'tooltips.deleteSelected',
};

export const SHARE_TOOLTIP_BY_TYPE: Record<string, string> = {
  buildings: 'tooltips.shareBuilding',
  projects: 'tooltips.shareProject',
  contacts: 'tooltips.shareContact',
  properties: 'tooltips.shareProperty',
  storages: 'tooltips.shareStorage',
  parking: 'toolbar.labels.share',
  communications: 'toolbar.labels.share',
  procurement: 'toolbar.labels.share',
  quotes: 'toolbar.labels.share',
  vendors: 'toolbar.labels.share',
  materials: 'toolbar.labels.share',
  agreements: 'toolbar.labels.share',
};

// ============================================================================
// FILTER CATEGORIES
// ============================================================================

export function getFilterCategoriesForType(type: ToolbarType) {
  const baseCategories = [
    {
      id: 'status',
      label: 'toolbar.filters.categories.status',
      options: [
        { value: 'available', label: UNIFIED_STATUS_FILTER_LABELS.AVAILABLE },
        { value: 'occupied', label: UNIFIED_STATUS_FILTER_LABELS.OCCUPIED },
        { value: 'reserved', label: UNIFIED_STATUS_FILTER_LABELS.RESERVED },
        { value: 'maintenance', label: UNIFIED_STATUS_FILTER_LABELS.MAINTENANCE },
      ],
    },
  ];

  switch (type) {
    case 'buildings':
      return [
        ...baseCategories,
        {
          id: 'type',
          label: 'toolbar.filters.categories.buildingType',
          options: [
            { value: 'residential', label: PROPERTY_BUILDING_TYPE_LABELS.residential },
            { value: 'commercial', label: PROPERTY_BUILDING_TYPE_LABELS.commercial },
            { value: 'mixed', label: PROPERTY_BUILDING_TYPE_LABELS.mixed },
          ],
        },
      ];
    case 'contacts':
      return [
        {
          id: 'type',
          label: 'toolbar.filters.categories.contactType',
          options: [
            { value: 'customer', label: CONTACT_BUSINESS_TYPE_LABELS.customer },
            { value: 'supplier', label: CONTACT_BUSINESS_TYPE_LABELS.supplier },
            { value: 'contractor', label: CONTACT_BUSINESS_TYPE_LABELS.contractor },
          ],
        },
      ];
    case 'parking':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'available', label: PARKING_STATUS_LABELS.available },
            { value: 'occupied', label: PARKING_STATUS_LABELS.occupied },
            { value: 'reserved', label: PARKING_STATUS_LABELS.reserved },
            { value: 'sold', label: PARKING_STATUS_LABELS.sold },
            { value: 'maintenance', label: PARKING_STATUS_LABELS.maintenance },
          ],
        },
        {
          id: 'type',
          label: 'toolbar.filters.categories.parkingType',
          options: [
            { value: 'standard', label: PARKING_TYPE_LABELS.standard },
            { value: 'handicapped', label: PARKING_TYPE_LABELS.handicapped },
            { value: 'motorcycle', label: PARKING_TYPE_LABELS.motorcycle },
            { value: 'electric', label: PARKING_TYPE_LABELS.electric },
            { value: 'visitor', label: PARKING_TYPE_LABELS.visitor },
          ],
        },
      ];
    case 'communications':
      return [
        {
          id: 'channel',
          label: 'toolbar.filters.categories.channel',
          options: [
            { value: 'all', label: COMMUNICATIONS_CHANNEL_LABELS.all },
            { value: 'email', label: COMMUNICATIONS_CHANNEL_LABELS.email },
            { value: 'sms', label: COMMUNICATIONS_CHANNEL_LABELS.sms },
            { value: 'telegram', label: COMMUNICATIONS_CHANNEL_LABELS.telegram },
          ],
        },
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'all', label: COMMUNICATIONS_STATUS_LABELS.all },
            { value: 'sent', label: COMMUNICATIONS_STATUS_LABELS.sent },
            { value: 'received', label: COMMUNICATIONS_STATUS_LABELS.received },
            { value: 'pending', label: COMMUNICATIONS_STATUS_LABELS.pending },
            { value: 'failed', label: COMMUNICATIONS_STATUS_LABELS.failed },
          ],
        },
      ];
    case 'procurement':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'draft', label: 'procurement:filters.poStatus.draft' },
            { value: 'approved', label: 'procurement:filters.poStatus.approved' },
            { value: 'ordered', label: 'procurement:filters.poStatus.ordered' },
            { value: 'partially_delivered', label: 'procurement:filters.poStatus.partially_delivered' },
            { value: 'delivered', label: 'procurement:filters.poStatus.delivered' },
            { value: 'closed', label: 'procurement:filters.poStatus.closed' },
            { value: 'cancelled', label: 'procurement:filters.poStatus.cancelled' },
          ],
        },
      ];
    case 'quotes':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'draft', label: 'quotes:filters.quoteStatus.draft' },
            { value: 'sent_to_vendor', label: 'quotes:filters.quoteStatus.sent_to_vendor' },
            { value: 'submitted', label: 'quotes:filters.quoteStatus.submitted' },
            { value: 'under_review', label: 'quotes:filters.quoteStatus.under_review' },
            { value: 'accepted', label: 'quotes:filters.quoteStatus.accepted' },
            { value: 'rejected', label: 'quotes:filters.quoteStatus.rejected' },
            { value: 'expired', label: 'quotes:filters.quoteStatus.expired' },
            { value: 'archived', label: 'quotes:filters.quoteStatus.archived' },
          ],
        },
      ];
    case 'vendors':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'active', label: 'procurement:filters.vendorStatus.active' },
            { value: 'preferred', label: 'procurement:filters.vendorStatus.preferred' },
            { value: 'inactive', label: 'procurement:filters.vendorStatus.inactive' },
            { value: 'new', label: 'procurement:filters.vendorStatus.new' },
          ],
        },
      ];
    case 'materials':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'recently_used', label: 'procurement:filters.materialStatus.recently_used' },
            { value: 'inactive', label: 'procurement:filters.materialStatus.inactive' },
            { value: 'no_supplier', label: 'procurement:filters.materialStatus.no_supplier' },
          ],
        },
      ];
    case 'agreements':
      return [
        {
          id: 'status',
          label: 'toolbar.filters.categories.status',
          options: [
            { value: 'active', label: 'procurement:filters.agreementStatus.active' },
            { value: 'expiring', label: 'procurement:filters.agreementStatus.expiring' },
            { value: 'expired', label: 'procurement:filters.agreementStatus.expired' },
            { value: 'draft', label: 'procurement:filters.agreementStatus.draft' },
          ],
        },
      ];
    default:
      return baseCategories;
  }
}

// ============================================================================
// SORT OPTIONS
// ============================================================================

export function getSortOptionsForType(type: ToolbarType) {
  if (type === 'communications') {
    return [
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
      { field: 'channel' as const, ascLabel: 'toolbar.sort.channel.asc', descLabel: 'toolbar.sort.channel.desc' },
      { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' },
    ];
  }
  if (type === 'procurement' || type === 'quotes') {
    return [
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
      { field: 'number' as const, ascLabel: 'toolbar.sort.number.asc', descLabel: 'toolbar.sort.number.desc' },
      { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' },
      { field: 'value' as const, ascLabel: 'toolbar.sort.value.asc', descLabel: 'toolbar.sort.value.desc' },
    ];
  }
  if (type === 'vendors') {
    return [
      { field: 'name' as const, ascLabel: 'toolbar.sort.name.asc', descLabel: 'toolbar.sort.name.desc' },
      { field: 'value' as const, ascLabel: 'toolbar.sort.value.asc', descLabel: 'toolbar.sort.value.desc' },
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
    ];
  }
  if (type === 'materials') {
    return [
      { field: 'name' as const, ascLabel: 'toolbar.sort.name.asc', descLabel: 'toolbar.sort.name.desc' },
      { field: 'number' as const, ascLabel: 'toolbar.sort.number.asc', descLabel: 'toolbar.sort.number.desc' },
      { field: 'value' as const, ascLabel: 'toolbar.sort.value.asc', descLabel: 'toolbar.sort.value.desc' },
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
    ];
  }
  if (type === 'agreements') {
    return [
      { field: 'name' as const, ascLabel: 'toolbar.sort.name.asc', descLabel: 'toolbar.sort.name.desc' },
      { field: 'number' as const, ascLabel: 'toolbar.sort.number.asc', descLabel: 'toolbar.sort.number.desc' },
      { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' },
      { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
    ];
  }
  return [
    { field: 'name' as const, ascLabel: 'toolbar.sort.name.asc', descLabel: 'toolbar.sort.name.desc' },
    { field: 'date' as const, ascLabel: 'toolbar.sort.date.asc', descLabel: 'toolbar.sort.date.desc' },
    { field: 'status' as const, ascLabel: 'toolbar.sort.status.asc', descLabel: 'toolbar.sort.status.desc' },
  ];
}
