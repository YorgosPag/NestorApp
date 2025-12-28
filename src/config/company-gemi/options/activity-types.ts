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

// ENTERPRISE: Import από existing centralized system - ZERO DUPLICATES
import { getActivityTypeOptions } from '../../../subapps/dxf-viewer/config/modal-select';

// ============================================================================
// ACTIVITY TYPE OPTIONS - ENTERPRISE WRAPPER
// ============================================================================

/**
 * Activity type options από centralized system
 * ENTERPRISE: Uses existing getActivityTypeOptions - NO HARDCODED VALUES
 */
export const ACTIVITY_TYPE_OPTIONS: SelectOption[] = [
  ...getActivityTypeOptions(),
];