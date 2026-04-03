import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import {
  type EnterpriseConfiguration,
  type EnterpriseConfigurationManager,
  getConfigManager
} from '../enterprise-config-management';
import type {
  ConfigurationState,
  UseManagedConfigurationOptions
} from './configuration-hook-types';

export interface UseManagedConfigurationResult<T> {
  readonly state: ConfigurationState<T>;
  readonly reload: () => Promise<void>;
  readonly update: (updates: Partial<T>) => Promise<void>;
}

export function useManagedConfiguration<T>(
  config: UseManagedConfigurationOptions<T>
): UseManagedConfigurationResult<T> {
  const {
    options,
    defaultValue,
    loadConfig,
    updateConfig,
    selectRealtimeConfig,
    loadErrorMessage,
    updateErrorMessage
  } = config;

  const {
    enableRealTimeUpdates = false,
    cacheTimeout = 5 * 60 * 1000,
    retryAttempts = 3,
    fallbackToDefaults = true
  } = options;

  const [state, setState] = useState<ConfigurationState<T>>({
    data: fallbackToDefaults ? defaultValue : null,
    isLoading: true,
    error: null,
    lastUpdated: null
  });

  const configManagerRef = useRef<EnterpriseConfigurationManager | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheRef = useRef<{ data: T; timestamp: number } | null>(null);

  useEffect(() => {
    configManagerRef.current = getConfigManager();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const applyLoadedData = useCallback((data: T, timestamp: number) => {
    cacheRef.current = { data, timestamp };
    setState((prev) => ({
      ...prev,
      data,
      isLoading: false,
      error: null,
      lastUpdated: new Date(timestamp)
    }));
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (cacheRef.current) {
      const isExpired = Date.now() - cacheRef.current.timestamp > cacheTimeout;
      if (!isExpired) {
        applyLoadedData(cacheRef.current.data, cacheRef.current.timestamp);
        return;
      }
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const loadedConfig = await loadConfig();
      applyLoadedData(loadedConfig, Date.now());
      retryCountRef.current = 0;
    } catch (error) {
      const errorMessage = getErrorMessage(error, loadErrorMessage);
      retryCountRef.current += 1;

      if (retryCountRef.current <= retryAttempts) {
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        retryTimeoutRef.current = setTimeout(() => {
          void reload();
        }, delay);
        return;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        data: fallbackToDefaults ? defaultValue : null
      }));
    }
  }, [applyLoadedData, cacheTimeout, defaultValue, fallbackToDefaults, loadConfig, loadErrorMessage, retryAttempts]);

  const update = useCallback(async (updates: Partial<T>): Promise<void> => {
    if (!updateConfig) {
      throw new Error('Configuration updates are not supported for this resource');
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      await updateConfig(updates);
      cacheRef.current = null;
      retryCountRef.current = 0;
      await reload();
    } catch (error) {
      const errorMessage = getErrorMessage(error, updateErrorMessage);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [reload, updateConfig, updateErrorMessage]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enableRealTimeUpdates || !configManagerRef.current || !selectRealtimeConfig) {
      return undefined;
    }

    const manager = configManagerRef.current;
    manager.setupConfigurationListener((nextConfig: EnterpriseConfiguration) => {
      const nextData = selectRealtimeConfig(nextConfig);
      if (!nextData) {
        return;
      }

      applyLoadedData(nextData, Date.now());
    });

    return () => {
      manager.cleanup();
    };
  }, [applyLoadedData, enableRealTimeUpdates, selectRealtimeConfig]);

  return {
    state,
    reload,
    update
  };
}
