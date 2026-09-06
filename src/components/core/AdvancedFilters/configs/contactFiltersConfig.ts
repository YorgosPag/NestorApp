import type { ContactFilterState, FilterPanelConfig } from '../types';
import { AFO, COMMON_FILTER_LABELS, FL, FT, PROPERTY_BUILDING_TYPE_LABELS, PROPERTY_FILTER_LABELS, RL, SP, UNIFIED_STATUS_FILTER_LABELS } from './shared';
import {
  PROPERTIES_COUNT_BUCKETS,
  TOTAL_AREA_BUCKETS,
  type PropertiesCountBucket,
  type TotalAreaBucket,
} from '@/lib/contacts/owner-property-stats';

/**
 * 🔴 **ΟΙ ΤΙΜΕΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟΝ ΚΡΙΤΗ, ΟΙ ΕΤΙΚΕΤΕΣ ΜΕΝΟΥΝ ΕΔΩ** (ADR-842 §7.6.13 Δ).
 *
 * Μέχρι σήμερα οι τιμές `'1-2'`/`'3-5'`/`'6+'` ήταν γραμμένες **εδώ** και ο κριτής που
 * τις ερμήνευε ζούσε **αλλού** — όσο ζούσε. Δύο ανεξάρτητες λίστες για ένα λεξιλόγιο:
 * μια αλλαγή ορίου («ας γίνει 1-3») θα άλλαζε την **ετικέτα** χωρίς να αλλάξει τον
 * **κανόνα**, και το σφάλμα θα ήταν αθόρυβο — το dropdown θα έλεγε ένα, το φίλτρο θα
 * έκανε άλλο.
 *
 * 🔑 Ο τύπος `Record<Bucket, string>` κάνει τον **μεταγλωττιστή** φύλακα: νέος κάδος
 * στο SSoT ⇒ **υποχρεωτική** ετικέτα εδώ. Δεν είναι σύμβαση, είναι σφάλμα build.
 */
const PROPERTIES_COUNT_LABELS: Record<PropertiesCountBucket, string> = {
  all: COMMON_FILTER_LABELS.ALL_UNITS,
  '1-2': RL.units_1_2,
  '3-5': RL.units_3_5,
  '6+': RL.units_6_plus,
};

const TOTAL_AREA_LABELS: Record<TotalAreaBucket, string> = {
  all: COMMON_FILTER_LABELS.ALL_AREAS,
  '0-100': RL.area_up_to_100,
  '101-300': RL.area_101_300,
  '301+': RL.area_301_plus,
};

const propertiesCountOptions = PROPERTIES_COUNT_BUCKETS.map((value) => ({
  value,
  label: PROPERTIES_COUNT_LABELS[value],
}));

const totalAreaOptions = TOTAL_AREA_BUCKETS.map((value) => ({
  value,
  label: TOTAL_AREA_LABELS[value],
}));

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
          options: propertiesCountOptions,
        },
        {
          id: "totalArea",
          type: "select",
          label: FL.total_area,
          placeholder: RL.areas_all,
          width: 1,
          options: totalAreaOptions,
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

