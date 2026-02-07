/**
 * ============================================================================
 * 🎯 ENTERPRISE CONFIGURATION REACT HOOK
 * ============================================================================
 *
 * REACT HOOK ΓΙΑ ΕΎΚΟΛΗ ΧΡΗΣΗ ΤΟΥ CONFIGURATION SYSTEM
 *
 * Production-ready React hook που αντικαθιστά όλες τις σκληρές τιμές
 * με dynamic configuration από τη βάση δεδομένων.
 *
 * Τηρεί όλους τους κανόνες CLAUDE.md:
 * - ΟΧΙ any types ✅
 * - Type-safe React patterns ✅
 * - Performance optimization ✅
 * - Error handling ✅
 *
 * Features:
 * - Real-time configuration updates
 * - Automatic caching
 * - Error states
 * - Loading states
 * - TypeScript support
 * - SSR compatibility
 *
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CompanyConfiguration,
  SystemConfiguration,
  ProjectTemplateConfiguration,
  EnterpriseConfigurationManager,
  ConfigurationAPI,
  getConfigManager,
  DEFAULT_COMPANY_CONFIG,
  DEFAULT_SYSTEM_CONFIG
} from './enterprise-config-management';

// ============================================================================
// 🎯 HOOK TYPES - FULL TYPE SAFETY
// ============================================================================

/**
 * Configuration Hook State
 * Comprehensive state για όλες τις configurations
 */
interface ConfigurationState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
}

/**
 * Hook Options για configuration loading
 */
interface ConfigurationOptions {
  readonly enableRealTimeUpdates?: boolean;
  readonly cacheTimeout?: number;
  readonly retryAttempts?: number;
  readonly fallbackToDefaults?: boolean;
}

/**
 * Company Configuration Hook Result
 */
interface UseCompanyConfigResult {
  readonly company: CompanyConfiguration | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
  readonly reload: () => Promise<void>;
  readonly loadCompanyConfig: () => Promise<void>;
  readonly updateCompany: (updates: Partial<CompanyConfiguration>) => Promise<void>;
}

/**
 * System Configuration Hook Result
 */
interface UseSystemConfigResult {
  readonly system: SystemConfiguration | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
  readonly reload: () => Promise<void>;
  readonly loadSystemConfig: () => Promise<void>;
  readonly updateSystem: (updates: Partial<SystemConfiguration>) => Promise<void>;
}

/**
 * Quick Access Hook Result
 * Για γρήγορη πρόσβαση σε common values
 */
interface UseConfigQuickAccessResult {
  readonly companyEmail: string;
  readonly companyPhone: string;
  readonly appBaseUrl: string;
  readonly isProduction: boolean;
  readonly webhookUrls: {
    readonly telegram: string;
    readonly slack: string;
    readonly email: string;
  };
  readonly isLoading: boolean;
  readonly error: string | null;
}

/**
 * Project Templates Hook Result
 */
interface UseProjectTemplatesResult {
  readonly templates: readonly ProjectTemplateConfiguration[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
  readonly getTemplate: (id: string) => ProjectTemplateConfiguration | undefined;
  readonly getTemplatesByCategory: (category: string) => readonly ProjectTemplateConfiguration[];
}

// ============================================================================
// 🏢 COMPANY CONFIGURATION HOOK
// ============================================================================

/**
 * Hook για Company Configuration
 * Αντικαθιστά hardcoded company data
 */
export function useCompanyConfig(
  options: ConfigurationOptions = {}
): UseCompanyConfigResult {
  const {
    enableRealTimeUpdates = false,
    cacheTimeout = 5 * 60 * 1000, // 5 minutes
    retryAttempts = 3,
    fallbackToDefaults = true
  } = options;

  const [state, setState] = useState<ConfigurationState<CompanyConfiguration>>({
    data: fallbackToDefaults ? DEFAULT_COMPANY_CONFIG : null,
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const configManagerRef = useRef<EnterpriseConfigurationManager>();
  const retryCountRef = useRef(0);
  const cacheRef = useRef<{ data: CompanyConfiguration; timestamp: number } | null>(null);

  // Initialize config manager
  useEffect(() => {
    configManagerRef.current = getConfigManager();
  }, []);

  // Load company configuration
  const loadCompanyConfig = useCallback(async () => {
    if (!configManagerRef.current) return;

    // Check cache first
    if (cacheRef.current) {
      const isExpired = Date.now() - cacheRef.current.timestamp > cacheTimeout;
      if (!isExpired) {
        setState(prev => ({
          ...prev,
          data: cacheRef.current!.data,
          isLoading: false,
          lastUpdated: new Date(cacheRef.current!.timestamp)
        }));
        return;
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const company = await configManagerRef.current.getCompanyConfig();

      // Update cache
      cacheRef.current = {
        data: company,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        data: company,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      }));

      retryCountRef.current = 0;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load company configuration';

      retryCountRef.current++;

      if (retryCountRef.current <= retryAttempts) {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(() => {
          void loadCompanyConfig();
        }, delay);
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
          data: fallbackToDefaults ? DEFAULT_COMPANY_CONFIG : null
        }));
      }
    }
  }, [cacheTimeout, retryAttempts, fallbackToDefaults]);

  // Update company configuration
  const updateCompany = useCallback(async (updates: Partial<CompanyConfiguration>) => {
    if (!configManagerRef.current) {
      throw new Error('Configuration manager not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await configManagerRef.current.updateCompanyConfig(updates);

      // Invalidate cache
      cacheRef.current = null;

      // Reload updated configuration
      await loadCompanyConfig();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update company configuration';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [loadCompanyConfig]);

  // Load configuration on mount
  useEffect(() => {
    void loadCompanyConfig();
  }, [loadCompanyConfig]);

  // Setup real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates || !configManagerRef.current) return;

    const cleanup = configManagerRef.current.setupConfigurationListener((config) => {
      if (config.company) {
        setState(prev => ({
          ...prev,
          data: config.company,
          lastUpdated: new Date()
        }));

        // Update cache
        cacheRef.current = {
          data: config.company,
          timestamp: Date.now()
        };
      }
    });

    return cleanup;
  }, [enableRealTimeUpdates]);

  return {
    company: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    reload: loadCompanyConfig,
    loadCompanyConfig,
    updateCompany
  };
}

// ============================================================================
// ⚙️ SYSTEM CONFIGURATION HOOK
// ============================================================================

/**
 * Hook για System Configuration
 * Αντικαθιστά hardcoded system settings
 */
export function useSystemConfig(
  options: ConfigurationOptions = {}
): UseSystemConfigResult {
  const {
    enableRealTimeUpdates = false,
    cacheTimeout = 5 * 60 * 1000,
    retryAttempts = 3,
    fallbackToDefaults = true
  } = options;

  const [state, setState] = useState<ConfigurationState<SystemConfiguration>>({
    data: fallbackToDefaults ? DEFAULT_SYSTEM_CONFIG : null,
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const configManagerRef = useRef<EnterpriseConfigurationManager>();
  const cacheRef = useRef<{ data: SystemConfiguration; timestamp: number } | null>(null);

  useEffect(() => {
    configManagerRef.current = getConfigManager();
  }, []);

  const loadSystemConfig = useCallback(async () => {
    if (!configManagerRef.current) return;

    // Check cache
    if (cacheRef.current) {
      const isExpired = Date.now() - cacheRef.current.timestamp > cacheTimeout;
      if (!isExpired) {
        setState(prev => ({
          ...prev,
          data: cacheRef.current!.data,
          isLoading: false,
          lastUpdated: new Date(cacheRef.current!.timestamp)
        }));
        return;
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const system = await configManagerRef.current.getSystemConfig();

      cacheRef.current = {
        data: system,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        data: system,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load system configuration';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        data: fallbackToDefaults ? DEFAULT_SYSTEM_CONFIG : null
      }));
    }
  }, [cacheTimeout, fallbackToDefaults]);

  const updateSystem = useCallback(async (updates: Partial<SystemConfiguration>) => {
    if (!configManagerRef.current) {
      throw new Error('Configuration manager not initialized');
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      await configManagerRef.current.updateSystemConfig(updates);

      // Invalidate cache
      cacheRef.current = null;

      await loadSystemConfig();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update system configuration';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [loadSystemConfig]);

  useEffect(() => {
    void loadSystemConfig();
  }, [loadSystemConfig]);

  return {
    system: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    reload: loadSystemConfig,
    loadSystemConfig,
    updateSystem
  };
}

// ============================================================================
// 📊 PROJECT TEMPLATES HOOK
// ============================================================================

/**
 * Hook για Project Templates
 * Αντικαθιστά hardcoded project data
 */
export function useProjectTemplates(
  options: ConfigurationOptions = {}
): UseProjectTemplatesResult {
  const { cacheTimeout = 10 * 60 * 1000 } = options; // 10 minutes for templates

  const [state, setState] = useState<ConfigurationState<readonly ProjectTemplateConfiguration[]>>({
    data: [],
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const configManagerRef = useRef<EnterpriseConfigurationManager>();
  const cacheRef = useRef<{ data: readonly ProjectTemplateConfiguration[]; timestamp: number } | null>(null);

  useEffect(() => {
    configManagerRef.current = getConfigManager();
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!configManagerRef.current) return;

    // Check cache
    if (cacheRef.current) {
      const isExpired = Date.now() - cacheRef.current.timestamp > cacheTimeout;
      if (!isExpired) {
        setState(prev => ({
          ...prev,
          data: cacheRef.current!.data,
          isLoading: false,
          lastUpdated: new Date(cacheRef.current!.timestamp)
        }));
        return;
      }
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const templates = await configManagerRef.current.getProjectTemplates();

      cacheRef.current = {
        data: templates,
        timestamp: Date.now()
      };

      setState(prev => ({
        ...prev,
        data: templates,
        isLoading: false,
        error: null,
        lastUpdated: new Date()
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load project templates';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        data: []
      }));
    }
  }, [cacheTimeout]);

  const getTemplate = useCallback((id: string): ProjectTemplateConfiguration | undefined => {
    return state.data?.find(template => template.id === id);
  }, [state.data]);

  const getTemplatesByCategory = useCallback((category: string): readonly ProjectTemplateConfiguration[] => {
    return state.data?.filter(template => template.category === category) || [];
  }, [state.data]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  return {
    templates: state.data || [],
    isLoading: state.isLoading,
    error: state.error,
    reload: loadTemplates,
    getTemplate,
    getTemplatesByCategory
  };
}

// ============================================================================
// ⚡ QUICK ACCESS HOOK - PERFORMANCE OPTIMIZED
// ============================================================================

/**
 * Hook για γρήγορη πρόσβαση σε common configuration values
 * Performance-optimized για frequent access
 */
export function useConfigQuickAccess(): UseConfigQuickAccessResult {
  const [state, setState] = useState<UseConfigQuickAccessResult>({
    companyEmail: 'loading...',
    companyPhone: 'loading...',
    appBaseUrl: 'loading...',
    isProduction: false,
    webhookUrls: {
      telegram: '',
      slack: '',
      email: ''
    },
    isLoading: true,
    error: null
  });

  const loadQuickAccess = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load all needed data in parallel
      const [companyEmail, companyPhone, appBaseUrl, webhookUrls] = await Promise.all([
        ConfigurationAPI.getCompanyEmail(),
        ConfigurationAPI.getCompanyPhone(),
        ConfigurationAPI.getAppBaseUrl(),
        ConfigurationAPI.getWebhookUrls()
      ]);

      const isProduction = appBaseUrl.includes('vercel.app') || appBaseUrl.includes('production');

      setState(prev => ({
        ...prev,
        companyEmail,
        companyPhone,
        appBaseUrl,
        isProduction,
        webhookUrls,
        isLoading: false,
        error: null
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load configuration';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
    }
  }, []);

  useEffect(() => {
    void loadQuickAccess();
  }, [loadQuickAccess]);

  return state;
}

// ============================================================================
// 🎯 CONVENIENCE HOOKS - SPECIFIC USE CASES
// ============================================================================

/**
 * Hook που αντικαθιστά hardcoded emails
 */
export function useCompanyEmail(): {
  email: string;
  isLoading: boolean;
  error: string | null;
} {
  const { companyEmail, isLoading, error } = useConfigQuickAccess();
  return { email: companyEmail, isLoading, error };
}

/**
 * Hook που αντικαθιστά hardcoded URLs
 */
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

/**
 * Hook που αντικαθιστά hardcoded webhook URLs
 */
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

// ============================================================================
// 📱 SSR-SAFE HOOKS
// ============================================================================

/**
 * SSR-safe version του company config hook
 */
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

/**
 * SSR-safe version του system config hook
 */
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

// ============================================================================
// 🎯 EXPORT ALL HOOKS - PUBLIC API
// ============================================================================

export {
  type UseCompanyConfigResult,
  type UseSystemConfigResult,
  type UseConfigQuickAccessResult,
  type UseProjectTemplatesResult,
  type ConfigurationOptions
};

// ============================================================================
// 🎯 MAIN ENTERPRISE CONFIG HOOK - COMBINES ALL CONFIGS
// ============================================================================

/**
 * 🏢 MAIN ENTERPRISE CONFIGURATION HOOK
 *
 * Combined hook που παρέχει access σε όλες τις configurations
 * μέσα από ένα unified interface.
 *
 * Features:
 * - Company configuration (companyConfig)
 * - System configuration
 * - Combined loading state
 * - Combined error handling
 * - Type-safe interface
 */
export interface UseEnterpriseConfigResult {
  companyConfig: CompanyConfiguration | null;
  systemConfig: SystemConfiguration | null;
  isLoading: boolean;
  error: string | null;
  updateCompanyConfig: (updates: Partial<CompanyConfiguration>) => Promise<boolean>;
  updateSystemConfig: (updates: Partial<SystemConfiguration>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * 🎯 ENTERPRISE CONFIGURATION HOOK
 * Main hook που αντικαθιστά όλες τις hardcoded values με centralized config
 */
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
    // Trigger re-loading of configurations
    await Promise.all([
      companyResult.loadCompanyConfig(),
      systemResult.loadSystemConfig()
    ]);
  }, [companyResult, systemResult]);

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

/**
 * Default export for main configuration hook
 */
export default useEnterpriseConfig;
