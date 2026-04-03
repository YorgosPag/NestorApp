import type { CompactToolbarConfig, FilterCategory, SortOption } from '@/components/core/CompactToolbar/types';
import type { NavigationLevel, ToolbarConfigFactoryArgs } from './types';

export function createBaseToolbarConfig(level: NavigationLevel, t: ToolbarConfigFactoryArgs['t'], tCommon: ToolbarConfigFactoryArgs['tCommon']): Pick<CompactToolbarConfig, 'labels' | 'tooltips'> {
  return {
    labels: {
      newItem: level === 'companies' ? tCommon('buttons.add') : t('toolbar.labels.link'),
      editItem: tCommon('buttons.edit'),
      deleteItems: level === 'companies' ? t('toolbar.labels.remove') : t('toolbar.labels.unlink'),
      filters: t('toolbar.labels.filters'),
      favorites: t('toolbar.labels.favorites'),
      archive: t('toolbar.labels.archive'),
      export: tCommon('buttons.export'),
      import: tCommon('buttons.import'),
      refresh: tCommon('buttons.refresh'),
      preview: t('toolbar.labels.preview'),
      copy: t('toolbar.labels.copy'),
      share: t('toolbar.labels.share'),
      reports: t('toolbar.labels.reports'),
      settings: t('toolbar.labels.settings'),
      favoritesManagement: t('toolbar.labels.favoritesManagement'),
      help: t('toolbar.labels.help'),
      sorting: t('toolbar.labels.sorting'),
    },
    tooltips: {
      newItem: '',
      editItem: '',
      deleteItems: '',
      filters: t('toolbar.tooltips.filters'),
      favorites: t('toolbar.tooltips.favorites'),
      archive: t('toolbar.tooltips.archive'),
      export: t('toolbar.tooltips.exportData'),
      import: t('toolbar.tooltips.importData'),
      refresh: t('toolbar.tooltips.refreshData'),
      preview: t('toolbar.tooltips.preview'),
      copy: t('toolbar.tooltips.copy'),
      share: t('toolbar.tooltips.share'),
      reports: t('toolbar.tooltips.reports'),
      settings: t('toolbar.tooltips.settings'),
      favoritesManagement: t('toolbar.tooltips.favoritesManagement'),
      help: t('toolbar.tooltips.help'),
      sorting: t('toolbar.tooltips.sorting'),
    },
  };
}

export function createToolbarConfig(
  args: ToolbarConfigFactoryArgs,
  level: NavigationLevel,
  searchPlaceholder: string,
  actionTooltipKeyPrefix: string,
  filterCategories: FilterCategory[],
  sortOptions: SortOption[],
  availableActions: CompactToolbarConfig['availableActions']
): CompactToolbarConfig {
  const baseConfig = createBaseToolbarConfig(level, args.t, args.tCommon);

  return {
    searchPlaceholder,
    ...baseConfig,
    tooltips: {
      ...baseConfig.tooltips,
      newItem: args.t(`${actionTooltipKeyPrefix}.new`),
      editItem: args.t(`${actionTooltipKeyPrefix}.edit`),
      deleteItems: args.t(`${actionTooltipKeyPrefix}.delete`),
    },
    filterCategories,
    sortOptions,
    availableActions,
  };
}
