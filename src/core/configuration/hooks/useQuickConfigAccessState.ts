import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/error-utils';
import { ConfigurationAPI } from '../enterprise-config-management';
import type { UseConfigQuickAccessResult } from './configuration-hook-types';

const INITIAL_QUICK_ACCESS_STATE: UseConfigQuickAccessResult = {
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
};

export function useQuickConfigAccessState(): UseConfigQuickAccessResult {
  const [state, setState] = useState<UseConfigQuickAccessResult>(INITIAL_QUICK_ACCESS_STATE);

  const loadQuickAccess = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [companyEmail, companyPhone, appBaseUrl, webhookUrls] = await Promise.all([
        ConfigurationAPI.getCompanyEmail(),
        ConfigurationAPI.getCompanyPhone(),
        ConfigurationAPI.getAppBaseUrl(),
        ConfigurationAPI.getWebhookUrls()
      ]);

      const isProduction = appBaseUrl.includes('vercel.app') || appBaseUrl.includes('production');

      setState({
        companyEmail,
        companyPhone,
        appBaseUrl,
        isProduction,
        webhookUrls,
        isLoading: false,
        error: null
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error, 'Failed to load configuration');
      setState((prev) => ({
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
