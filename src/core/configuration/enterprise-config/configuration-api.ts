/**
 * ============================================================================
 * 🎯 ENTERPRISE CONFIGURATION — QUICK ACCESS API
 * ============================================================================
 *
 * Quick access wrapper methods for common configurations.
 * Extracted from enterprise-config-management.ts (ADR-314 C.5.43 SRP split).
 *
 * ============================================================================
 */

import { EnterpriseConfigurationManager } from './manager';

/**
 * Get singleton instance - Global access pattern
 */
export const getConfigManager = (): EnterpriseConfigurationManager => {
  return EnterpriseConfigurationManager.getInstance();
};

/**
 * Quick access methods για common configurations
 */
export const ConfigurationAPI = {
  getCompanyEmail: async (): Promise<string> => {
    const config = await getConfigManager().getCompanyConfig();
    return config.email;
  },

  getCompanyPhone: async (): Promise<string> => {
    const config = await getConfigManager().getCompanyConfig();
    return config.phone;
  },

  getAppBaseUrl: async (): Promise<string> => {
    const config = await getConfigManager().getSystemConfig();
    return config.app.baseUrl;
  },

  getWebhookUrls: async (): Promise<{ telegram: string; slack: string; email: string }> => {
    const config = await getConfigManager().getSystemConfig();
    return config.integrations.webhooks;
  },

  getApiEndpoints: async (): Promise<{ maps: string; weather: string; notifications: string }> => {
    const config = await getConfigManager().getSystemConfig();
    return config.integrations.apis;
  },

  /**
   * 🏢 ENTERPRISE: Get Primary Admin UID
   * Used for sending system notifications to admin
   */
  getAdminUid: async (): Promise<string> => {
    const adminConfig = await getConfigManager().getAdminConfig();
    if (!adminConfig.primaryAdminUid) {
      throw new Error('CRITICAL: Admin UID not configured in system settings');
    }
    return adminConfig.primaryAdminUid;
  },

  getAdminEmail: async (): Promise<string> => {
    const adminConfig = await getConfigManager().getAdminConfig();
    return adminConfig.adminEmail;
  },

  getAllAdminUids: async (): Promise<readonly string[]> => {
    const adminConfig = await getConfigManager().getAdminConfig();
    const allUids = [adminConfig.primaryAdminUid, ...adminConfig.additionalAdminUids];
    return allUids.filter(Boolean);
  },

  isErrorReportingEnabled: async (): Promise<boolean> => {
    const adminConfig = await getConfigManager().getAdminConfig();
    return adminConfig.enableErrorReporting;
  }
} as const;
