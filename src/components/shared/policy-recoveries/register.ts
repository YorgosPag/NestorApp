/**
 * =============================================================================
 * ENTERPRISE: Policy Recovery Registrations
 * =============================================================================
 *
 * Side-effect module: binds each policy error code to its inline recovery
 * component. Importing this file once (happens automatically via
 * <PolicyErrorBanner>) populates the central recovery registry.
 *
 * To add a new recovery:
 *   1. Build the component in this folder, matching `PolicyRecoveryContext`
 *   2. Register it here
 *   3. (Optional) Document the expected `context` shape in the component
 *
 * @module components/shared/policy-recoveries/register
 */

import { POLICY_ERROR_CODES, registerPolicyRecovery } from '@/lib/policy';
import { ProjectCompanyRecoveryLink } from './ProjectCompanyRecoveryLink';

registerPolicyRecovery(
  POLICY_ERROR_CODES.PROJECT_ORPHAN_NO_COMPANY,
  ProjectCompanyRecoveryLink,
);
