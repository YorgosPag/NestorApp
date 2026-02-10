/**
 * COMPANY GEMI STATUS OPTIONS
 *
 * Enterprise wrapper για GEMI statuses από centralized systems
 * ZERO HARDCODED VALUES - Uses existing modal-select system
 *
 * @version 1.0.0 - ENTERPRISE WRAPPER
 * @updated 2025-12-28 - Split from monolithic company-gemi-config.ts
 */

import { SelectOption, EnterpriseOptions } from '../core/field-types';
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('gemi-statuses');

// ENTERPRISE: Import από existing centralized system - ZERO DUPLICATES
import {
  getGemiStatusOptions,
  MODAL_SELECT_GEMI_STATUSES
} from '../../../subapps/dxf-viewer/config/modal-select';
import { businessRulesService } from '../../../services/business/EnterpriseBusinessRulesService';

// ============================================================================
// GEMI STATUS OPTIONS - ENTERPRISE WRAPPER
// ============================================================================

/**
 * Static GEMI status options από centralized system
 * ENTERPRISE: Uses existing getGemiStatusOptions - NO HARDCODED VALUES
 */
export const GEMI_STATUS_OPTIONS: SelectOption[] =
  getGemiStatusOptions().map(status => ({
    value: status.value,
    label: status.label
  }));

/**
 * Enterprise company statuses loader function
 * ENTERPRISE: Uses existing EnterpriseBusinessRulesService
 *
 * @example
 * ```typescript
 * const statuses = await loadCompanyStatuses('my-tenant', 'GR');
 * ```
 */
export async function loadCompanyStatuses(
  tenantId: string = 'default',
  jurisdiction: string = 'GR',
  environment: string = 'production'
): Promise<SelectOption[]> {
  try {
    // Try to load from enterprise service
    return await businessRulesService.getCompanyStatusesForSelect(
      tenantId,
      jurisdiction,
      environment
    );
  } catch (error) {
    logger.warn('Failed to load company statuses from service, using fallback', { error });

    // Fallback to existing centralized values
    return GEMI_STATUS_OPTIONS;
  }
}

/**
 * Get enterprise company statuses με workflow support
 * ENTERPRISE: Uses existing EnterpriseBusinessRulesService με metadata
 */
export async function getEnterpriseCompanyStatuses(options: EnterpriseOptions = {}): Promise<Array<SelectOption & {
  category?: string;
  businessImpact?: string;
  allowedTransitions?: string[];
}>> {
  const {
    tenantId = 'default',
    jurisdiction = 'GR',
    environment = 'production',
    includeMetadata = false
  } = options;

  try {
    if (includeMetadata) {
      // Get full status configurations με transitions από existing service
      const statuses = await businessRulesService.getCompanyStatuses(
        tenantId,
        jurisdiction,
        environment
      );

      return statuses.map(cs => ({
        value: cs.value,
        label: cs.label,
        category: cs.category,
        businessImpact: cs.businessImpact,
        allowedTransitions: cs.allowedTransitions
      }));
    } else {
      // Get simple select options από existing service
      return await businessRulesService.getCompanyStatusesForSelect(
        tenantId,
        jurisdiction,
        environment
      );
    }
  } catch (error) {
    logger.warn('Failed to load enterprise company statuses, using fallback', { error });

    // Enhanced fallback
    return GEMI_STATUS_OPTIONS.map(option => ({
      ...option,
      category: 'operational'
    }));
  }
}

/**
 * Get filtered GEMI statuses για specific lifecycle states
 * ENTERPRISE: Uses existing MODAL_SELECT_GEMI_STATUSES με filtering
 */
export function getLifecycleGemiStatuses(): SelectOption[] {
  return MODAL_SELECT_GEMI_STATUSES.filter(status =>
    ['active', 'inactive', 'dissolved', 'bankruptcy', 'liquidation'].includes(status.value)
  );
}