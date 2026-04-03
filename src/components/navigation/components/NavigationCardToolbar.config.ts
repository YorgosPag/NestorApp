import type { CompactToolbarConfig } from '@/components/core/CompactToolbar/types';
import {
  buildingsToolbarConfigFactory,
  companiesToolbarConfigFactory,
  projectsToolbarConfigFactory,
} from './navigation-card-toolbar-config/primary-configs';
import {
  floorsToolbarConfigFactory,
  parkingToolbarConfigFactory,
  propertiesToolbarConfigFactory,
  storageToolbarConfigFactory,
} from './navigation-card-toolbar-config/secondary-configs';
import {
  getDeleteIcon,
  getLevelIcon,
  getLevelIconColor,
  getLevelTitle,
  getNewItemIcon,
} from './navigation-card-toolbar-config/metadata';
import type { NavigationLevel, ToolbarConfigFactoryArgs, TranslationFn } from './navigation-card-toolbar-config/types';

export type { NavigationLevel, TranslationFn } from './navigation-card-toolbar-config/types';
export {
  getLevelTitle,
  getLevelIcon,
  getDeleteIcon,
  getNewItemIcon,
  getLevelIconColor,
} from './navigation-card-toolbar-config/metadata';

const TOOLBAR_CONFIG_FACTORIES: Record<NavigationLevel, (args: ToolbarConfigFactoryArgs) => CompactToolbarConfig> = {
  companies: companiesToolbarConfigFactory,
  projects: projectsToolbarConfigFactory,
  buildings: buildingsToolbarConfigFactory,
  floors: floorsToolbarConfigFactory,
  properties: propertiesToolbarConfigFactory,
  storage: storageToolbarConfigFactory,
  parking: parkingToolbarConfigFactory,
};

export const getToolbarConfig = (
  level: NavigationLevel,
  t: TranslationFn,
  tCommon: TranslationFn
): CompactToolbarConfig => {
  const factory = TOOLBAR_CONFIG_FACTORIES[level];
  if (!factory) {
    throw new Error(`Unknown navigation level: ${level}`);
  }

  return factory({ t, tCommon });
};
