'use client';

/**
 * useLayerFiltersUi — UI orchestration for Layer Filters Phase 11.
 *
 * Owns transient UI state (modal open/close, context menu position, drag-drop
 * target). Delegates persistence + state to `LayerFiltersStore`. Returns a
 * stable, memoized API for `LayerFiltersSidebar` and its modal children.
 */

import { useCallback, useState } from 'react';
import { triggerExportDownload } from '@/lib/exports/trigger-export-download';
import {
  removeUserFilter,
  selectFilter,
  togglePinnedSmart,
  upsertUserFilter,
  type FilterSelectionModifier,
} from '../../../stores/LayerFiltersStore';
import {
  exportFiltersAsJson,
  importFiltersFromJson,
} from '../../../services/layer-filter-io';
import type {
  LayerFilter,
  LayerGroupFilter,
  LayerPropertiesFilter,
} from '../../../types/layer-filters';

export interface ContextMenuState {
  readonly filterId: string;
  readonly x: number;
  readonly y: number;
}

export interface LayerFiltersUi {
  readonly ruleBuilderOpen: boolean;
  readonly ruleBuilderInitial: LayerPropertiesFilter | null;
  readonly openRuleBuilder: (initial?: LayerPropertiesFilter | null) => void;
  readonly closeRuleBuilder: () => void;

  readonly groupEditorOpen: boolean;
  readonly groupEditorInitial: LayerGroupFilter | null;
  readonly openGroupEditor: (initial?: LayerGroupFilter | null) => void;
  readonly closeGroupEditor: () => void;

  readonly contextMenu: ContextMenuState | null;
  readonly openContextMenu: (filterId: string, x: number, y: number) => void;
  readonly closeContextMenu: () => void;

  readonly onSelectFilter: (filterId: string, modifier: FilterSelectionModifier) => void;
  readonly onSubmitFilter: (filter: LayerFilter) => void;
  readonly onDeleteFilter: (filterId: string) => void;
  readonly onDuplicateFilter: (filter: LayerFilter) => void;
  readonly onPinSmart: (smartId: string) => void;

  readonly onExport: (filters: ReadonlyArray<LayerFilter>, projectName: string) => void;
  readonly onImport: (text: string, existing: ReadonlyArray<LayerFilter>) => ReturnType<typeof importFiltersFromJson>;
}

export function useLayerFiltersUi(): LayerFiltersUi {
  const [ruleBuilderOpen, setRuleBuilderOpen] = useState(false);
  const [ruleBuilderInitial, setRuleBuilderInitial] = useState<LayerPropertiesFilter | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);
  const [groupEditorInitial, setGroupEditorInitial] = useState<LayerGroupFilter | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const openRuleBuilder = useCallback((initial: LayerPropertiesFilter | null = null) => {
    setRuleBuilderInitial(initial);
    setRuleBuilderOpen(true);
  }, []);
  const closeRuleBuilder = useCallback(() => setRuleBuilderOpen(false), []);

  const openGroupEditor = useCallback((initial: LayerGroupFilter | null = null) => {
    setGroupEditorInitial(initial);
    setGroupEditorOpen(true);
  }, []);
  const closeGroupEditor = useCallback(() => setGroupEditorOpen(false), []);

  const openContextMenu = useCallback((filterId: string, x: number, y: number) => {
    setContextMenu({ filterId, x, y });
  }, []);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const onSelectFilter = useCallback((filterId: string, modifier: FilterSelectionModifier) => {
    selectFilter(filterId, modifier);
  }, []);

  const onSubmitFilter = useCallback((filter: LayerFilter) => {
    upsertUserFilter(filter);
  }, []);

  const onDeleteFilter = useCallback((filterId: string) => {
    removeUserFilter(filterId);
  }, []);

  const onDuplicateFilter = useCallback((filter: LayerFilter) => {
    const dup: LayerFilter = { ...filter, name: `${filter.name} (copy)` };
    // ID is regenerated when caller passes to LayerFilterRuleBuilder/GroupEditor without `initial.id`.
    // For a direct duplicate, use the dedicated editor: open it pre-populated.
    if (dup.kind === 'group') openGroupEditor({ ...dup, id: '' as never } as LayerGroupFilter);
    else openRuleBuilder({ ...dup, id: '' as never } as LayerPropertiesFilter);
  }, [openGroupEditor, openRuleBuilder]);

  const onPinSmart = useCallback((smartId: string) => {
    togglePinnedSmart(smartId);
  }, []);

  const onExport = useCallback((filters: ReadonlyArray<LayerFilter>, projectName: string) => {
    const { json, filename } = exportFiltersAsJson({ filters, projectName });
    triggerBrowserDownload(json, filename);
  }, []);

  const onImport = useCallback((text: string, existing: ReadonlyArray<LayerFilter>) => {
    const result = importFiltersFromJson({ text, existing });
    for (const filter of result.imported) upsertUserFilter(filter);
    return result;
  }, []);

  return {
    ruleBuilderOpen, ruleBuilderInitial, openRuleBuilder, closeRuleBuilder,
    groupEditorOpen, groupEditorInitial, openGroupEditor, closeGroupEditor,
    contextMenu, openContextMenu, closeContextMenu,
    onSelectFilter, onSubmitFilter, onDeleteFilter, onDuplicateFilter, onPinSmart,
    onExport, onImport,
  };
}

function triggerBrowserDownload(text: string, filename: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([text], { type: 'application/json' });
  triggerExportDownload({ blob, filename });
}
