/**
 * ADR-344 Phase 5.B — pure role→capability mapping.
 *
 * Kept React-free so the unit test suite can iterate every role without
 * pulling in firebase via the UserRoleContext. The React hook
 * `useCanEditText` wraps this function for component consumption.
 */

export interface TextEditCapabilities {
  readonly canCreate: boolean;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly canUnlockLayer: boolean;
  /** i18n key for the "why denied" tooltip; null when fully allowed. */
  readonly denyReason: string | null;
}

const FULL: TextEditCapabilities = {
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canUnlockLayer: true,
  denyReason: null,
};

const PRO: TextEditCapabilities = {
  canCreate: true,
  canEdit: true,
  canDelete: true,
  canUnlockLayer: false,
  denyReason: null,
};

const SITE_MANAGER: TextEditCapabilities = {
  canCreate: true,
  canEdit: true,
  canDelete: false,
  canUnlockLayer: false,
  denyReason: null,
};

const NONE: TextEditCapabilities = {
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canUnlockLayer: false,
  denyReason: 'textToolbar.denyReason.insufficientRole',
};

const UNAUTH: TextEditCapabilities = {
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canUnlockLayer: false,
  denyReason: 'textToolbar.denyReason.notAuthenticated',
};

export function capabilitiesForRole(role: string | null | undefined): TextEditCapabilities {
  switch (role) {
    case 'super_admin':
    case 'admin':
    case 'company_admin':
      return FULL;
    case 'project_manager':
    case 'architect':
    case 'engineer':
      return PRO;
    case 'site_manager':
    case 'foreman':
      return SITE_MANAGER;
    case 'accountant':
    case 'sales_agent':
    case 'data_entry':
    case 'vendor':
    case 'viewer':
    case 'client':
      return NONE;
    case null:
    case undefined:
    case '':
      return UNAUTH;
    default:
      return NONE;
  }
}
