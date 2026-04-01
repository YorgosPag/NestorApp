import type { ContactFilterState, FilterPanelConfig } from '../types';
import { AFO, COMMON_FILTER_LABELS, FL, FT, PROPERTY_BUILDING_TYPE_LABELS, PROPERTY_FILTER_LABELS, RL, SP, UNIFIED_STATUS_FILTER_LABELS } from './shared';

export const contactFiltersConfig: FilterPanelConfig = {
  title: FT.contacts,
  searchPlaceholder: SP.contacts_search,
  i18nNamespace: "filters", // 🏢 ENTERPRISE: Filters domain namespace
  rows: [
    {
      id: "contact-basic",
      fields: [
        {
          id: "searchTerm",
          type: "search",
          label: FL.search,
          placeholder: SP.general,
          width: 2,
          ariaLabel: "Search contacts",
        },
        {
          id: "contactType",
          type: "select",
          label: FL.contact_type,
          placeholder: PROPERTY_FILTER_LABELS.ALL_TYPES,
          width: 1,
          options: [
            { value: "all", label: PROPERTY_FILTER_LABELS.ALL_TYPES },
            {
              value: "individual",
              label: PROPERTY_BUILDING_TYPE_LABELS.individual,
            },
            { value: "company", label: PROPERTY_BUILDING_TYPE_LABELS.company },
            { value: "service", label: PROPERTY_BUILDING_TYPE_LABELS.service },
          ],
        },
        {
          id: "status",
          type: "select",
          label: FL.status,
          placeholder: SP.status_placeholder,
          width: 1,
          options: [
            { value: "all", label: PROPERTY_FILTER_LABELS.ALL_STATUSES },
            { value: "active", label: UNIFIED_STATUS_FILTER_LABELS.ACTIVE },
            { value: "inactive", label: UNIFIED_STATUS_FILTER_LABELS.INACTIVE },
            { value: "lead", label: UNIFIED_STATUS_FILTER_LABELS.LEAD },
          ],
        },
      ],
    },
    {
      id: "contact-properties",
      fields: [
        {
          id: "propertiesCount",
          type: "select",
          label: FL.properties_count,
          placeholder: RL.units_all,
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_UNITS },
            { value: "1-2", label: RL.units_1_2 },
            { value: "3-5", label: RL.units_3_5 },
            { value: "6+", label: RL.units_6_plus },
          ],
        },
        {
          id: "totalArea",
          type: "select",
          label: FL.total_area,
          placeholder: RL.areas_all,
          width: 1,
          options: [
            { value: "all", label: COMMON_FILTER_LABELS.ALL_AREAS },
            { value: "0-100", label: RL.area_up_to_100 },
            { value: "101-300", label: RL.area_101_300 },
            { value: "301+", label: RL.area_301_plus },
          ],
        },
        {
          id: "hasProperties",
          type: "checkbox",
          label: FL.has_properties,
          width: 1,
        },
        {
          id: "isFavorite",
          type: "checkbox",
          label: FL.is_favorite,
          width: 1,
        },
        {
          id: "showArchived",
          type: "checkbox",
          label: FL.show_archived,
          width: 1,
        },
      ],
    },
  ],
  advancedFilters: {
    show: true,
    title: FT.advanced,
    options: [
      { id: "isFavorite", label: AFO.is_favorite_contacts, category: "status" },
      { id: "hasEmail", label: AFO.has_email, category: "contact" },
      { id: "hasPhone", label: AFO.has_phone, category: "contact" },
      {
        id: "recentActivity",
        label: AFO.recent_activity,
        category: "activity",
      },
    ],
    categories: ["status", "contact", "activity"],
  },
};

// Building Filters Configuration
// [ENTERPRISE]: 100% centralized labels - ZERO hardcoded values

export const defaultContactFilters: ContactFilterState = {
  searchTerm: "",
  company: [],
  status: [],
  contactType: "all",
  propertiesCount: "all",
  totalArea: "all",
  hasProperties: false,
  isFavorite: false,
  showArchived: false,
  tags: [],
  dateRange: { from: undefined, to: undefined },
};

