/**
 * ============================================================================
 * 🎯 ENTERPRISE CONFIGURATION REACT HOOK
 * ============================================================================
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  type CompanyConfiguration,
  type SystemConfiguration,
  type ProjectTemplateConfiguration,
  ConfigurationAPI,
  DEFAULT_COMPANY_CONFIG,
  DEFAULT_SYSTEM_CONFIG,
  getConfigManager
} from './enterprise-config-management';
import type {
  ConfigurationOptions,
  UseCompanyConfigResult,
  UseSystemConfigResult,
  UseConfigQuickAccessResult,
  UseProjectTemplatesResult
} from './hooks/configuration-hook-types';
import { useManagedConfiguration } from './hooks/useManagedConfiguration';
import { useQuickConfigAccessState } from './hooks/useQuickConfigAccessState';

export function useCompanyConfig(
  options: ConfigurationOptions = {}
): UseCompanyConfigResult {
  const { state, reload, update } = useManagedConfiguration<CompanyConfiguration>({
    options,
    defaultValue: DEFAULT_COMPANY_CONFIG,
    loadConfig: async () => getConfigManager().getCompanyConfig(),
    updateConfig: async (updates) => getConfigManager().updateCompanyConfig(updates),
    selectRealtimeConfig: (config) => config.company,
    loadErrorMessage: 'Failed to load company configuration',
    updateErrorMessage: 'Failed to update company configuration'
  });

  return {
    company: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    reload,
    loadCompanyConfig: reload,
    updateCompany: update
  };
}

export function useSystemConfig(
  options: ConfigurationOptions = {}
): UseSystemConfigResult {
  const { state, reload, update } = useManagedConfiguration<SystemConfiguration>({
    options,
    defaultValue: DEFAULT_SYSTEM_CONFIG,
    loadConfig: async () => getConfigManager().getSystemConfig(),
    updateConfig: async (updates) => getConfigManager().updateSystemConfig(updates),
    selectRealtimeConfig: (config) => config.system,
    loadErrorMessage: 'Failed to load system configuration',
    updateErrorMessage: 'Failed to update system configuration'
  });

  return {
    system: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    reload,
    loadSystemConfig: reload,
    updateSystem: update
  };
}

export function useProjectTemplates(
  options: ConfigurationOptions = {}
): UseProjectTemplatesResult {
  const templateOptions = useMemo<ConfigurationOptions>(() => ({
    ...options,
    cacheTimeout: options.cacheTimeout ?? 10 * 60 * 1000
  }), [options]);

  const { state, reload } = useManagedConfiguration<readonly ProjectTemplateConfiguration[]>({
    options: templateOptions,
    defaultValue: [],
    loadConfig: async () => getConfigManager().getProjectTemplates(),
    loadErrorMessage: 'Failed to load project templates',
    updateErrorMessage: 'Project template updates are not supported'
  });

  const getTemplate = useCallback((id: string): ProjectTemplateConfiguration | undefined => {
    return state.data?.find((template) => template.id === id);
  }, [state.data]);

  const getTemplatesByCategory = useCallback((category: string): readonly ProjectTemplateConfiguration[] => {
    return state.data?.filter((template) => template.category === category) || [];
  }, [state.data]);

  return {
    templates: state.data || [],
    isLoading: state.isLoading,
    error: state.error,
    reload,
    getTemplate,
    getTemplatesByCategory
  };
}

export function useConfigQuickAccess(): UseConfigQuickAccessResult {
  return useQuickConfigAccessState();
}

export function useCompanyEmail(): {
  email: string;
  isLoading: boolean;
  error: string | null;
} {
  const { companyEmail, isLoading, error } = useConfigQuickAccess();
  return { email: companyEmail, isLoading, error };
}

export function useAppUrls(): {
  baseUrl: string;
  apiUrl: string;
  isProduction: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const { appBaseUrl, isProduction, isLoading, error } = useConfigQuickAccess();
  return {
    baseUrl: appBaseUrl,
    apiUrl: `${appBaseUrl}/api`,
    isProduction,
    isLoading,
    error
  };
}

export function useWebhookUrls(): {
  webhooks: {
    readonly telegram: string;
    readonly slack: string;
    readonly email: string;
  };
  isLoading: boolean;
  error: string | null;
} {
  const { webhookUrls, isLoading, error } = useConfigQuickAccess();
  return { webhooks: webhookUrls, isLoading, error };
}

export function useCompanyConfigSSR(): Pick<UseCompanyConfigResult, 'company' | 'isLoading' | 'error'> {
  const [isMounted, setIsMounted] = useState(false);
  const result = useCompanyConfig({ fallbackToDefaults: true });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return {
      company: DEFAULT_COMPANY_CONFIG,
      isLoading: false,
      error: null
    };
  }

  return result;
}

export function useSystemConfigSSR(): Pick<UseSystemConfigResult, 'system' | 'isLoading' | 'error'> {
  const [isMounted, setIsMounted] = useState(false);
  const result = useSystemConfig({ fallbackToDefaults: true });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return {
      system: DEFAULT_SYSTEM_CONFIG,
      isLoading: false,
      error: null
    };
  }

  return result;
}

export {
  type UseCompanyConfigResult,
  type UseSystemConfigResult,
  type UseConfigQuickAccessResult,
  type UseProjectTemplatesResult,
  type ConfigurationOptions
};

export interface UseEnterpriseConfigResult {
  companyConfig: CompanyConfiguration | null;
  systemConfig: SystemConfiguration | null;
  isLoading: boolean;
  error: string | null;
  updateCompanyConfig: (updates: Partial<CompanyConfiguration>) => Promise<boolean>;
  updateSystemConfig: (updates: Partial<SystemConfiguration>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useEnterpriseConfig(
  options: ConfigurationOptions = {}
): UseEnterpriseConfigResult {
  const companyResult = useCompanyConfig(options);
  const systemResult = useSystemConfig(options);

  const updateCompanyConfig = useCallback(async (updates: Partial<CompanyConfiguration>) => {
    await companyResult.updateCompany(updates);
    return true;
  }, [companyResult.updateCompany]);

  const updateSystemConfig = useCallback(async (updates: Partial<SystemConfiguration>) => {
    await systemResult.updateSystem(updates);
    return true;
  }, [systemResult.updateSystem]);

  const refetch = useCallback(async () => {
    await Promise.all([
      companyResult.loadCompanyConfig(),
      systemResult.loadSystemConfig()
    ]);
  }, [companyResult.loadCompanyConfig, systemResult.loadSystemConfig]);

  return {
    companyConfig: companyResult.company,
    systemConfig: systemResult.system,
    isLoading: companyResult.isLoading || systemResult.isLoading,
    error: companyResult.error || systemResult.error,
    updateCompanyConfig,
    updateSystemConfig,
    refetch
  };
}

export default useEnterpriseConfig;
