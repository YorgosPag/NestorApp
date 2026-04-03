import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';

export type NavigationLevel = 'companies' | 'projects' | 'buildings' | 'floors' | 'properties' | 'storage' | 'parking';
export type TranslationFn = (key: string) => string;

export interface ToolbarConfigFactoryArgs {
  t: TranslationFn;
  tCommon: TranslationFn;
}

export type ToolbarLevelConfigFactory = (args: ToolbarConfigFactoryArgs) => CompactToolbarConfig;
