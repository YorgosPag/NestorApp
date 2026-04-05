import { PROPERTY_STATUS_LABELS } from '@/constants/property-statuses-enterprise';
import {
  PROPERTY_TYPES as CANONICAL_PROPERTY_TYPES,
  PROPERTY_TYPE_I18N_KEYS,
} from '@/constants/property-types';

// ADR-145: Derived από canonical SSoT. Όλα τα values χρησιμοποιούν underscore
// form (π.χ. `apartment_2br`) ώστε να ταιριάζουν με τον `PropertyType` union.
// Πριν (buggy): hyphenated values (`apartment-2br`) που δεν ταίριαζαν με τύπο.
export const PROPERTY_TYPES = CANONICAL_PROPERTY_TYPES.map((value) => ({
  value,
  label: `properties.${PROPERTY_TYPE_I18N_KEYS[value]}`,
})) as ReadonlyArray<{
  value: (typeof CANONICAL_PROPERTY_TYPES)[number];
  label: string;
}>;

export const AVAILABILITY = [
  { value: "for-sale", label: PROPERTY_STATUS_LABELS['for-sale'] },
  { value: "for-rent", label: PROPERTY_STATUS_LABELS['for-rent'] },
  { value: "reserved", label: PROPERTY_STATUS_LABELS.reserved },
] as const;

export const PRICE_MIN = 0;
export const PRICE_MAX = 200_000;
export const PRICE_STEP = 5_000;

export const AREA_MIN = 0;
export const AREA_MAX = 100;
export const AREA_STEP = 5;
