/**
 * COMPANY GEMI OPTIONS INDEX
 *
 * Centralized export για όλα τα select options
 * ZERO HARDCODED VALUES - All από existing centralized systems
 *
 * @version 1.0.0 - ENTERPRISE INDEX
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

// ENTERPRISE: Import existing centralized options - ZERO DUPLICATES
import {
  getAddressTypeOptions,
  getShareholderTypeOptions,
  getDocumentTypeOptions,
  getBoardTypeOptions,
  getRepresentativePositionOptions,
} from '../../../subapps/dxf-viewer/config/modal-select';

// Re-export local options
export {
  LEGAL_FORM_OPTIONS,
  loadLegalForms,
  getEnterpriseLegalForms
} from './legal-forms';

export {
  GEMI_STATUS_OPTIONS,
  loadCompanyStatuses,
  getEnterpriseCompanyStatuses,
  getLifecycleGemiStatuses
} from './gemi-statuses';

export {
  CURRENCY_OPTIONS,
  getRegionalCurrencies
} from './currencies';

export {
  ACTIVITY_TYPE_OPTIONS
} from './activity-types';

// ============================================================================
// ADDITIONAL OPTIONS από CENTRALIZED SYSTEMS - ZERO DUPLICATES
// ============================================================================

/**
 * Address type options από centralized system
 * ENTERPRISE: Uses existing getAddressTypeOptions - NO HARDCODED VALUES
 */
export const ADDRESS_TYPE_OPTIONS = getAddressTypeOptions();

/**
 * Shareholder type options από centralized system
 * ENTERPRISE: Uses existing getShareholderTypeOptions - NO HARDCODED VALUES
 */
export const SHAREHOLDER_TYPE_OPTIONS = getShareholderTypeOptions();

/**
 * Document type options από centralized system
 * ENTERPRISE: Uses existing getDocumentTypeOptions - NO HARDCODED VALUES
 */
export const DOCUMENT_TYPE_OPTIONS = getDocumentTypeOptions();

/**
 * Board type options από centralized system
 * ENTERPRISE: Uses existing getBoardTypeOptions - NO HARDCODED VALUES
 */
export const BOARD_TYPE_OPTIONS = getBoardTypeOptions();

/**
 * Representative position options από centralized system
 * ENTERPRISE: Uses existing getRepresentativePositionOptions - NO HARDCODED VALUES
 */
export const REPRESENTATIVE_POSITION_OPTIONS = getRepresentativePositionOptions();