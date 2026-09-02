/**
 * =============================================================================
 * 🏢 ENTERPRISE: Property Fields Form Constants
 * =============================================================================
 *
 * Extracted from PropertyFieldsBlock.tsx for SRP compliance (ADR N.7.1).
 * Single source of truth for all dropdown/select option arrays.
 *
 * @module features/property-details/components/property-fields-constants
 * @since 2026-03-27
 */

import type { PropertyType, CommercialStatus, OperationalStatus } from '@/types/property';
import { CREATABLE_PROPERTY_TYPES } from '@/constants/property-types';
import type {
  OrientationType,
  ConditionType,
  EnergyClassType,
  HeatingType,
  CoolingType,
  FlooringType,
  FrameType,
  GlazingType,
  InteriorFeatureCodeType,
  SecurityFeatureCodeType,
} from '@/constants/property-features-enterprise';
// ADR-842 Α4 — η αυθεντία του λεξιλογίου· οι λίστες παρακάτω είναι **όψη** του.
import {
  ORIENTATIONS,
  ENERGY_CLASSES,
  INTERIOR_FEATURES,
  SECURITY_FEATURES,
  CONDITIONS,
  HEATING_TYPES,
  COOLING_TYPES,
  FLOORINGS,
  FRAMES,
  GLAZINGS,
} from '@/constants/property-features-enterprise';

/**
 * 🔴 **ΔΕΝ ΕΙΝΑΙ ΠΙΑ ΛΙΣΤΕΣ — ΕΙΝΑΙ ΟΨΗ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ** *(ADR-842 Α4, 2026-09-02)*.
 *
 * Μέχρι σήμερα οι δέκα λίστες παρακάτω απαριθμούσαν **με το χέρι** τις ίδιες τιμές που
 * δηλώνει το `constants/property-features-enterprise.ts` — δεύτερος τόπος για το ίδιο
 * λεξιλόγιο. Μετρήθηκε ότι συμφωνούσαν **10 στα 10**· αυτό ήταν τύχη, όχι δομή: ο τύπος
 * `XType[]` δέχεται **υποσύνολο**, άρα νέα τιμή στο λεξιλόγιο **δεν** έφτανε ποτέ στο
 * dropdown και **κανείς δεν το μάθαινε**. Δες το πλήρες σκεπτικό εκεί.
 *
 * ⚠️ **ΜΗΝ ξαναγράψεις τιμές εδώ.** Το αρχείο κρατά το **όνομα** που ξέρουν οι πέντε
 * καταναλωτές του· η **αυθεντία** έφυγε. Νέα τιμή → στο λεξιλόγιο, και φτάνει εδώ μόνη της.
 *
 * 🔑 Το `[...X]` δεν είναι διακοσμητικό: η SSoT είναι `readonly` (`as const`) ενώ τα
 * controls ζητούν μεταβλητό πίνακα — **ίδιο ιδίωμα με το `EDITABLE_PROPERTY_TYPES`**
 * λίγες γραμμές πιο κάτω, που το κάνει ήδη για τους τύπους ακινήτου.
 */
export const ORIENTATION_OPTIONS: OrientationType[] = [...ORIENTATIONS];

export const CONDITION_OPTIONS: ConditionType[] = [...CONDITIONS];

export const ENERGY_CLASS_OPTIONS: EnergyClassType[] = [...ENERGY_CLASSES];

export const HEATING_OPTIONS: HeatingType[] = [...HEATING_TYPES];

export const COOLING_OPTIONS: CoolingType[] = [...COOLING_TYPES];

export const FLOORING_OPTIONS: FlooringType[] = [...FLOORINGS];

export const FRAME_OPTIONS: FrameType[] = [...FRAMES];

export const GLAZING_OPTIONS: GlazingType[] = [...GLAZINGS];

export const INTERIOR_FEATURE_OPTIONS: InteriorFeatureCodeType[] = [...INTERIOR_FEATURES];

export const SECURITY_FEATURE_OPTIONS: SecurityFeatureCodeType[] = [...SECURITY_FEATURES];

// ADR-145: PropertyType options derived from SSoT (@/constants/property-types).
// Uses CREATABLE_PROPERTY_TYPES (excludes 'storage' — ADR-287 Batch 20).
// Widened to PropertyType[] (which includes legacy Greek values) so existing
// callers that accept the broader union remain type-compatible.
/**
 * Οι τύποι ακινήτου που προσφέρει η **φόρμα επεξεργασίας** — μεταβλητό αντίγραφο του
 * SSoT `CREATABLE_PROPERTY_TYPES`, γιατί το control θέλει `PropertyType[]`.
 *
 * 🔴 **ΛΕΓΟΤΑΝ `PROPERTY_TYPE_OPTIONS` ΚΑΙ ΗΤΑΝ ΨΕΜΑ** (ADR-806 §7 #2): δεν είναι
 * *options* (καμία ετικέτα) — είναι **τιμές**. Το ίδιο όνομα το είχαν **τρία** ακόμη
 * σώματα, με **τρία διαφορετικά σχήματα**: το `VOCAB_PROPERTY_TYPE_OPTIONS` (ωμά
 * ελληνικά, **νεκρό**), το `TypeQuickFilters` (**νεκρό**) και το `SalesQuickFilters`
 * (κλειδιά i18n **και εικονίδια**, τοπικό, ζωντανό). Ομωνυμία, όχι διπλότυπο —
 * γι' αυτό το context μπήκε στο όνομα αντί να ενωθούν.
 */
export const EDITABLE_PROPERTY_TYPES: PropertyType[] = [...CREATABLE_PROPERTY_TYPES];

// Transaction statuses (reserved, sold, rented) require buyer/tenant selection
// and can ONLY be set through SalesActionDialogs (ReserveDialog/SellDialog).
// See: Sentry fix 2026-03-24 — ApiClientError "Buyer contact is required"
export const COMMERCIAL_STATUS_OPTIONS: CommercialStatus[] = [
  'unavailable', 'for-sale', 'for-rent', 'for-sale-and-rent',
];

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = [
  'draft', 'under-construction', 'inspection', 'ready', 'maintenance',
];

// =============================================================================
// SSoT: Visual tokens for property detail cards (SALES_ICON_COLORS pattern)
// =============================================================================

/** Icon colors per card section — SSoT so every card header is defined once. */
export const PROPERTY_CARD_COLORS = {
  // Card headers
  identity: 'text-primary',
  areas: 'text-primary',
  layout: 'text-primary',
  orientation: 'text-[hsl(var(--text-warning))]',
  condition: 'text-[hsl(var(--text-warning))]',
  energy: 'text-[hsl(var(--text-success))]',
  systems: 'text-destructive',
  finishes: 'text-primary',
  features: 'text-primary',
  floor: 'text-[hsl(var(--text-success))]',
  linkedSpaces: 'text-primary',
  // Sub-icons inside cards
  conditionIcon: 'text-[hsl(var(--text-warning))]',
  energyIcon: 'text-[hsl(var(--text-success))]',
  heating: 'text-[hsl(var(--text-warning))]',
  cooling: 'text-primary',
  bedrooms: 'text-primary',
  bathrooms: 'text-primary',
  wc: 'text-primary',
  parking: 'text-primary',
  storage: 'text-[hsl(var(--text-warning))]',
} as const;

/** Micro typography for compact property cards — below Tailwind's text-xs (12px). */
export const PROPERTY_MICRO_TEXT = {
  /** 12px — helper text, hints, metadata */
  helper: 'text-xs',
  /** 12px — multi-level indicators (ανά όροφο / κοινά) */
  micro: 'text-xs',
} as const;
