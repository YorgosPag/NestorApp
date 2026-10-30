/**
 * COMPANY GEMI ACTIVITY TYPE OPTIONS
 *
 * Enterprise wrapper για activity types από centralized systems
 * ZERO HARDCODED VALUES - Uses existing modal-select system
 *
 * @version 1.0.0 - ENTERPRISE WRAPPER
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SelectOption } from '../core/field-types';
import { KAD_ACTIVITY_TYPES } from '@/types/ContactFormTypes';

// ============================================================================
// ACTIVITY TYPE OPTIONS — ΠΑΡΑΓΩΓΟ της ρίζας ΚΑΔ (ADR-195 (ζ) 🏷️′ #2)
// ============================================================================

/**
 * Εδώ ζούσε ΔΕΥΤΕΡΟ λεξιλόγιο (`main|secondary`, λέξεις `options.activityTypes.*`) για την ίδια
 * έννοια με τον τύπο ΚΑΔ. Τώρα οι επιλογές ΠΑΡΑΓΟΝΤΑΙ από τη ρίζα και οι λέξεις ζουν στο
 * `forms:kad.types.*`. ⚠️ Μετρημένο 29/10: καμία φόρμα δεν αποδίδει αυτές τις επιλογές (νεκρή
 * εξαγωγή μέσω των barrels του `company-gemi`) — υποψήφιο για διαγραφή.
 */
export const ACTIVITY_TYPE_OPTIONS: SelectOption[] = KAD_ACTIVITY_TYPES.map((value) => ({
  value,
  label: `kad.types.${value}`,
}));
