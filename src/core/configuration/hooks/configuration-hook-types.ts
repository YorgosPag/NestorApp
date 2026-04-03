import type {
  CompanyConfiguration,
  EnterpriseConfiguration,
  ProjectTemplateConfiguration,
  SystemConfiguration
} from '../enterprise-config-management';

export interface ConfigurationState<T> {
  readonly data: T | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
}

export interface ConfigurationOptions {
  readonly enableRealTimeUpdates?: boolean;
  readonly cacheTimeout?: number;
  readonly retryAttempts?: number;
  readonly fallbackToDefaults?: boolean;
}

export interface UseCompanyConfigResult {
  readonly company: CompanyConfiguration | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
  readonly reload: () => Promise<void>;
  readonly loadCompanyConfig: () => Promise<void>;
  readonly updateCompany: (updates: Partial<CompanyConfiguration>) => Promise<void>;
}

export interface UseSystemConfigResult {
  readonly system: SystemConfiguration | null;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly lastUpdated: Date | null;
  readonly reload: () => Promise<void>;
  readonly loadSystemConfig: () => Promise<void>;
  readonly updateSystem: (updates: Partial<SystemConfiguration>) => Promise<void>;
}

export interface UseConfigQuickAccessResult {
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

export interface UseProjectTemplatesResult {
  readonly templates: readonly ProjectTemplateConfiguration[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
  readonly getTemplate: (id: string) => ProjectTemplateConfiguration | undefined;
  readonly getTemplatesByCategory: (category: string) => readonly ProjectTemplateConfiguration[];
}

export interface UseManagedConfigurationOptions<T> {
  readonly options: ConfigurationOptions;
  readonly defaultValue: T | null;
  readonly loadConfig: () => Promise<T>;
  readonly updateConfig?: (updates: Partial<T>) => Promise<void>;
  readonly selectRealtimeConfig?: (config: EnterpriseConfiguration) => T | null;
  readonly loadErrorMessage: string;
  readonly updateErrorMessage: string;
}
