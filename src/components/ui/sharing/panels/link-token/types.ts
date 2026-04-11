/**
 * =============================================================================
 * 🏢 ENTERPRISE: Link-Token Panel — Draft & Result Types
 * =============================================================================
 *
 * @module components/ui/sharing/panels/link-token/types
 * @see ADR-147 Unified Share Surface
 */

export interface LinkTokenDraft {
  expiresInHours: string;
  password: string;
  maxDownloads: string;
  note: string;
}

export interface LinkTokenResultData {
  url: string;
  expiresInHoursLabel: string;
  maxDownloadsCount: number;
  passwordProtected: boolean;
}

export const INITIAL_LINK_TOKEN_DRAFT: LinkTokenDraft = {
  expiresInHours: '72',
  password: '',
  maxDownloads: '0',
  note: '',
};
