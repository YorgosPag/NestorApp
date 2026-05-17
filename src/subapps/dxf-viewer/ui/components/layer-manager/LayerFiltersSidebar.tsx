'use client';

/**
 * LayerFiltersSidebar — left 260px column with Smart / Group / Property
 * sections (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Hosts the filter list + modals. Subscribes to `LayerFiltersStore` via
 * `useSyncExternalStore`.
 */

import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';
import { Plus, Download, Upload } from 'lucide-react';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import {
  getLayerFiltersStoreSnapshot,
  subscribeLayerFiltersStore,
  setProjectId,
} from '../../../stores/LayerFiltersStore';
import {
  isLayerGroupFilter,
  isLayerPropertiesFilter,
  type ActiveLayerFilterEntry,
  type LayerFilter,
} from '../../../types/layer-filters';
import { useLayerFiltersUi } from './useLayerFiltersUi';
import { LayerFilterRuleBuilder } from './LayerFilterRuleBuilder';
import { LayerGroupFilterEditor } from './LayerGroupFilterEditor';
import { LayerFilterContextMenu } from './LayerFilterContextMenu';

export interface LayerFiltersSidebarProps {
  readonly projectId: string | null;
  readonly projectName: string;
}

export function LayerFiltersSidebar({
  projectId, projectName,
}: LayerFiltersSidebarProps): React.ReactElement {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setProjectId(projectId);
  }, [projectId]);

  const snapshot = useSyncExternalStore(
    subscribeLayerFiltersStore,
    getLayerFiltersStoreSnapshot,
    getLayerFiltersStoreSnapshot,
  );

  const ui = useLayerFiltersUi();

  const activeIds = useMemo(() => new Set(snapshot.activeFilters.map((e) => e.filterId)), [snapshot.activeFilters]);
  const pinnedSet = useMemo(() => new Set(snapshot.pinnedSmartIds), [snapshot.pinnedSmartIds]);

  const groupFilters = snapshot.userFilters.filter(isLayerGroupFilter);
  const propertyFilters = snapshot.userFilters.filter(isLayerPropertiesFilter);
  const smartSorted = useMemo(() => sortPinnedFirst(snapshot.smartFilters, pinnedSet), [snapshot.smartFilters, pinnedSet]);

  const handleClick = (filterId: string) => (e: React.MouseEvent): void => {
    if (e.shiftKey) ui.onSelectFilter(filterId, 'shift');
    else if (e.ctrlKey || e.metaKey) ui.onSelectFilter(filterId, 'ctrl');
    else ui.onSelectFilter(filterId, 'none');
  };

  const handleContextMenu = (filterId: string) => (e: React.MouseEvent): void => {
    e.preventDefault();
    ui.openContextMenu(filterId, e.clientX, e.clientY);
  };

  const handleExport = (): void => {
    ui.onExport(snapshot.userFilters, projectName);
  };

  const handleImportClick = (): void => {
    importInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      ui.onImport(text, snapshot.userFilters);
      if (importInputRef.current) importInputRef.current.value = '';
    });
  };

  return (
    <aside
      className={`${getStatusBorder('muted')} ${PANEL_LAYOUT.PADDING.LEFT_SM} ${PANEL_LAYOUT.PADDING.RIGHT_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_SM} ${PANEL_LAYOUT.SPACING.GAP_SM}`}
      style={{ width: 260, flexShrink: 0 }}
      aria-label={t('layerFilters.title')}
    >
      <h3 className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD}`}>
        {t('layerFilters.title')}
      </h3>

      <FilterSection
        title={t('layerFilters.section.smart')}
        items={smartSorted}
        activeIds={activeIds}
        onClick={handleClick}
        onContext={handleContextMenu}
        pinnedSet={pinnedSet}
        formatName={(f) => formatSmartName(f, t)}
      />

      <FilterSection
        title={t('layerFilters.section.groups')}
        items={groupFilters}
        activeIds={activeIds}
        onClick={handleClick}
        onContext={handleContextMenu}
        action={(
          <button type="button" onClick={() => ui.openGroupEditor(null)} className={colors.text.primary} aria-label={t('layerFilters.action.newGroup')}>
            <Plus size={14} />
          </button>
        )}
      />

      <FilterSection
        title={t('layerFilters.section.properties')}
        items={propertyFilters}
        activeIds={activeIds}
        onClick={handleClick}
        onContext={handleContextMenu}
        action={(
          <button type="button" onClick={() => ui.openRuleBuilder(null)} className={colors.text.primary} aria-label={t('layerFilters.action.newProperty')}>
            <Plus size={14} />
          </button>
        )}
      />

      <footer className={`${PANEL_LAYOUT.SPACING.GAP_SM} flex`}>
        <button type="button" onClick={handleExport} className={colors.text.primary} aria-label={t('layerFilters.action.export')}>
          <Download size={14} /> {t('layerFilters.action.export')}
        </button>
        <button type="button" onClick={handleImportClick} className={colors.text.primary} aria-label={t('layerFilters.action.import')}>
          <Upload size={14} /> {t('layerFilters.action.import')}
        </button>
        <input ref={importInputRef} type="file" accept=".json" hidden onChange={handleImportFile} />
      </footer>

      <LayerFilterRuleBuilder
        isOpen={ui.ruleBuilderOpen}
        initial={ui.ruleBuilderInitial}
        onClose={ui.closeRuleBuilder}
        onSubmit={ui.onSubmitFilter}
      />
      <LayerGroupFilterEditor
        isOpen={ui.groupEditorOpen}
        initial={ui.groupEditorInitial}
        onClose={ui.closeGroupEditor}
        onSubmit={ui.onSubmitFilter}
      />
      {ui.contextMenu ? (
        <LayerFilterContextMenu
          filterId={ui.contextMenu.filterId}
          x={ui.contextMenu.x}
          y={ui.contextMenu.y}
          onRename={() => handleRenameOrEdit(ui.contextMenu!.filterId, snapshot.userFilters, ui)}
          onEdit={() => handleRenameOrEdit(ui.contextMenu!.filterId, snapshot.userFilters, ui)}
          onDuplicate={() => {
            const filter = snapshot.userFilters.find((f) => f.id === ui.contextMenu!.filterId);
            if (filter) ui.onDuplicateFilter(filter);
          }}
          onDelete={() => ui.onDeleteFilter(ui.contextMenu!.filterId)}
          onPin={() => ui.onPinSmart(ui.contextMenu!.filterId)}
          onClose={ui.closeContextMenu}
        />
      ) : null}
    </aside>
  );
}

// ─── Internals ───────────────────────────────────────────────────────────────

interface FilterSectionProps {
  readonly title: string;
  readonly items: ReadonlyArray<LayerFilter>;
  readonly activeIds: ReadonlySet<string>;
  readonly onClick: (id: string) => (e: React.MouseEvent) => void;
  readonly onContext: (id: string) => (e: React.MouseEvent) => void;
  readonly action?: React.ReactNode;
  readonly pinnedSet?: ReadonlySet<string>;
  readonly formatName?: (f: LayerFilter) => string;
}

function FilterSection({
  title, items, activeIds, onClick, onContext, action, pinnedSet, formatName,
}: FilterSectionProps): React.ReactElement {
  return (
    <section>
      <header className="flex items-center justify-between">
        <h4>{title}</h4>
        {action ?? null}
      </header>
      <ul>
        {items.map((filter) => {
          const isActive = activeIds.has(filter.id);
          const isPinned = pinnedSet?.has(filter.id) ?? false;
          const display = formatName ? formatName(filter) : filter.name;
          return (
            <li key={filter.id}>
              <button
                type="button"
                onClick={onClick(filter.id)}
                onContextMenu={onContext(filter.id)}
                aria-pressed={isActive}
                style={isPinned ? { fontWeight: 600 } : undefined}
              >
                {filter.icon ? <span>{filter.icon}</span> : null} {display}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function sortPinnedFirst(
  filters: ReadonlyArray<LayerFilter>,
  pinned: ReadonlySet<string>,
): ReadonlyArray<LayerFilter> {
  if (pinned.size === 0) return filters;
  const pin: LayerFilter[] = [];
  const rest: LayerFilter[] = [];
  for (const f of filters) (pinned.has(f.id) ? pin : rest).push(f);
  return [...pin, ...rest];
}

function formatSmartName(filter: LayerFilter, t: (k: string, opts?: Record<string, unknown>) => string): string {
  // Smart filter names are i18n keys (see `getSmartFilters`); category smart
  // ids encode the interpolation token via `key::category` convention.
  const raw = filter.name;
  if (raw.includes('::')) {
    const [key, category] = raw.split('::');
    return t(key, { name: t(`layerFilters.aecCategory.${category}`) });
  }
  return t(raw);
}

function handleRenameOrEdit(
  filterId: string,
  userFilters: ReadonlyArray<LayerFilter>,
  ui: ReturnType<typeof useLayerFiltersUi>,
): void {
  const filter = userFilters.find((f) => f.id === filterId);
  if (!filter) return;
  if (isLayerGroupFilter(filter)) ui.openGroupEditor(filter);
  else if (isLayerPropertiesFilter(filter)) ui.openRuleBuilder(filter);
}
