'use client';

/**
 * CurrentLayerPickerPopover — ADR-358 §5.5.bis Q8 Phase 7 (Google-grade).
 *
 * Popover body shared by both trigger variants. Sections:
 *   1. Search input (live filter, no debounce — finite layer set)
 *   2. Most-used (top 5 from `LayerStore.recentLayerIds`, alpha-filled when <5)
 *   3. Grouped by AEC category, filtered, alphabetical inside each group
 *   4. Actions footer: New Layer (deferred Phase 7.5), Manage Layers
 *
 * Each layer row:
 *   - Lucide category icon prefix on group header
 *   - Color swatch + name + visibility/lock/freeze icons
 *   - Right-click → ContextMenu (Set current / toggle vis/lock/freeze / Properties)
 *   - Frozen + locked-without-unlock-capability: row stays clickable, click
 *     produces a toast warning (logic in `useCurrentLayerPickerState.selectLayer`).
 *
 * Keyboard navigation (Q8 line 847):
 *   - ↑/↓ cycle through pickable layers (from search input or row)
 *   - Enter selects active row
 *   - Esc closes (handled by Radix Popover)
 */

import * as React from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Search,
  Snowflake,
  Settings,
  Plus,
} from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SceneLayer, AecLayerCategory } from '../../../types/entities';
import type {
  LayerPickerActions,
  LayerPickerState,
  LayerGroup,
} from './useCurrentLayerPickerState';
import { getCategoryIcon } from './layer-picker-category-icons';

const CATEGORY_LABEL_KEYS: Record<AecLayerCategory, string> = {
  architectural: 'layerPicker.category.architectural',
  structural: 'layerPicker.category.structural',
  electrical: 'layerPicker.category.electrical',
  mechanical: 'layerPicker.category.mechanical',
  plumbing: 'layerPicker.category.plumbing',
  fire: 'layerPicker.category.fire',
  civil: 'layerPicker.category.civil',
  telecom: 'layerPicker.category.telecom',
  interior: 'layerPicker.category.interior',
  general: 'layerPicker.category.general',
};

interface CurrentLayerPickerPopoverProps {
  readonly state: LayerPickerState;
  readonly actions: LayerPickerActions;
}

function flattenPickable(state: LayerPickerState): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const layer of state.filteredRecent) {
    const id = layer.id ?? layer.name;
    if (seen.has(id)) continue;
    ids.push(id);
    seen.add(id);
  }
  for (const group of state.filteredGroups) {
    for (const layer of group.layers) {
      const id = layer.id ?? layer.name;
      if (seen.has(id)) continue;
      ids.push(id);
      seen.add(id);
    }
  }
  return ids;
}

export function CurrentLayerPickerPopover({
  state,
  actions,
}: CurrentLayerPickerPopoverProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const searchRef = React.useRef<HTMLInputElement>(null);
  const rowRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const pickableIds = React.useMemo(
    () => flattenPickable(state),
    [state.filteredRecent, state.filteredGroups],
  );

  const [activeIndex, setActiveIndex] = React.useState(-1);

  React.useEffect(() => {
    if (state.isOpen) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    setActiveIndex(-1);
    return undefined;
  }, [state.isOpen]);

  React.useEffect(() => {
    if (activeIndex >= pickableIds.length) setActiveIndex(-1);
  }, [pickableIds.length, activeIndex]);

  const focusRowAt = React.useCallback(
    (idx: number) => {
      const id = pickableIds[idx];
      if (!id) return;
      setActiveIndex(idx);
      rowRefs.current.get(id)?.focus();
    },
    [pickableIds],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (pickableIds.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = activeIndex < 0 ? 0 : (activeIndex + 1) % pickableIds.length;
        focusRowAt(next);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next =
          activeIndex <= 0
            ? pickableIds.length - 1
            : activeIndex - 1;
        focusRowAt(next);
      } else if (e.key === 'Enter' && activeIndex >= 0) {
        e.preventDefault();
        const id = pickableIds[activeIndex];
        if (id) actions.selectLayer(id);
      }
    },
    [pickableIds, activeIndex, focusRowAt, actions],
  );

  const registerRow = React.useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) rowRefs.current.set(id, el);
      else rowRefs.current.delete(id);
    },
    [],
  );

  const hasResults =
    state.filteredRecent.length > 0 || state.filteredGroups.length > 0;

  return (
    <section
      data-testid="current-layer-picker-popover"
      className="flex flex-col max-h-[420px]"
      onKeyDown={handleKeyDown}
    >
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={searchRef}
          type="text"
          value={state.searchQuery}
          onChange={(e) => actions.setSearchQuery(e.target.value)}
          placeholder={t('layerPicker.searchPlaceholder')}
          aria-label={t('layerPicker.searchPlaceholder')}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </header>

      <div className="flex-1 overflow-y-auto py-1">
        {!hasResults && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {t('layerPicker.empty')}
          </p>
        )}

        {state.filteredRecent.length > 0 && (
          <LayerSection
            titleKey="layerPicker.mostUsed"
            layers={state.filteredRecent}
            currentLayerId={state.currentLayerId}
            canUnlockLayer={state.canUnlockLayer}
            actions={actions}
            registerRow={registerRow}
          />
        )}

        {state.filteredGroups.map((group) => (
          <LayerGroupSection
            key={group.category}
            group={group}
            currentLayerId={state.currentLayerId}
            canUnlockLayer={state.canUnlockLayer}
            actions={actions}
            registerRow={registerRow}
          />
        ))}
      </div>

      <footer className="flex items-center gap-1 px-2 py-1.5 border-t border-border">
        <ActionButton
          icon={<Plus className="h-3.5 w-3.5" aria-hidden />}
          labelKey="layerPicker.newLayer"
          disabled
          testId="layer-picker-action-new"
        />
        <ActionButton
          icon={<Settings className="h-3.5 w-3.5" aria-hidden />}
          labelKey="layerPicker.openManager"
          testId="layer-picker-action-manager"
          onClick={actions.openManager}
        />
      </footer>
    </section>
  );
}

interface SectionProps {
  titleKey: string;
  layers: ReadonlyArray<SceneLayer>;
  currentLayerId: string | null;
  canUnlockLayer: boolean;
  actions: LayerPickerActions;
  registerRow: (id: string) => (el: HTMLButtonElement | null) => void;
  headerIcon?: React.ReactNode;
}

function LayerSection({
  titleKey,
  layers,
  currentLayerId,
  canUnlockLayer,
  actions,
  registerRow,
  headerIcon,
}: SectionProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div>
      <h3 className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {headerIcon}
        {t(titleKey)}
      </h3>
      <ul role="listbox" aria-label={t(titleKey)}>
        {layers.map((layer) => (
          <LayerRow
            key={layer.id ?? layer.name}
            layer={layer}
            isCurrent={(layer.id ?? layer.name) === currentLayerId}
            canUnlockLayer={canUnlockLayer}
            actions={actions}
            registerRow={registerRow}
          />
        ))}
      </ul>
    </div>
  );
}

function LayerGroupSection({
  group,
  currentLayerId,
  canUnlockLayer,
  actions,
  registerRow,
}: {
  group: LayerGroup;
  currentLayerId: string | null;
  canUnlockLayer: boolean;
  actions: LayerPickerActions;
  registerRow: (id: string) => (el: HTMLButtonElement | null) => void;
}): React.ReactElement {
  const CategoryIcon = getCategoryIcon(group.category);
  return (
    <LayerSection
      titleKey={CATEGORY_LABEL_KEYS[group.category]}
      layers={group.layers}
      currentLayerId={currentLayerId}
      canUnlockLayer={canUnlockLayer}
      actions={actions}
      registerRow={registerRow}
      headerIcon={<CategoryIcon className="h-3 w-3 shrink-0" aria-hidden />}
    />
  );
}

interface LayerRowProps {
  layer: SceneLayer;
  isCurrent: boolean;
  canUnlockLayer: boolean;
  actions: LayerPickerActions;
  registerRow: (id: string) => (el: HTMLButtonElement | null) => void;
}

function LayerRow({
  layer,
  isCurrent,
  canUnlockLayer,
  actions,
  registerRow,
}: LayerRowProps): React.ReactElement {
  const layerId = layer.id ?? layer.name;
  const isFrozen = layer.frozen === true;
  const isLockBlocked = layer.locked && !canUnlockLayer;
  const isDimmed = isFrozen || isLockBlocked;
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            ref={registerRow(layerId)}
            type="button"
            tabIndex={-1}
            onClick={() => actions.selectLayer(layerId)}
            aria-current={isCurrent ? 'true' : undefined}
            data-testid={`layer-row-${layerId}`}
            className={
              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' +
              (isCurrent ? 'bg-accent/40 ' : 'hover:bg-muted ') +
              (isDimmed ? 'opacity-60' : '')
            }
          >
            <span
              className="h-3 w-3 shrink-0 rounded-[2px] border border-border"
              style={{ backgroundColor: layer.color }}
              aria-hidden
            />
            <span className="flex-1 truncate">{layer.name}</span>
            <LayerStatusIcons layer={layer} isLockBlocked={isLockBlocked} />
          </button>
        </ContextMenuTrigger>
        <LayerRowContextMenu
          layerId={layerId}
          isFrozen={isFrozen}
          isLockBlocked={isLockBlocked}
          actions={actions}
        />
      </ContextMenu>
    </li>
  );
}

function LayerRowContextMenu({
  layerId,
  isFrozen,
  isLockBlocked,
  actions,
}: {
  layerId: string;
  isFrozen: boolean;
  isLockBlocked: boolean;
  actions: LayerPickerActions;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <ContextMenuContent className="z-[1900] w-56">
      <ContextMenuItem
        onSelect={() => actions.selectLayer(layerId)}
        disabled={isFrozen || isLockBlocked}
        data-testid={`layer-ctx-set-current-${layerId}`}
      >
        {t('layerPicker.contextMenu.setCurrent')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => actions.toggleVisibility(layerId)}
        data-testid={`layer-ctx-toggle-vis-${layerId}`}
      >
        {t('layerPicker.contextMenu.toggleVisibility')}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => actions.toggleLock(layerId)}
        data-testid={`layer-ctx-toggle-lock-${layerId}`}
      >
        {t('layerPicker.contextMenu.toggleLock')}
      </ContextMenuItem>
      <ContextMenuItem
        onSelect={() => actions.toggleFreeze(layerId)}
        data-testid={`layer-ctx-toggle-freeze-${layerId}`}
      >
        {t('layerPicker.contextMenu.toggleFreeze')}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem
        onSelect={() => actions.openProperties(layerId)}
        data-testid={`layer-ctx-properties-${layerId}`}
      >
        {t('layerPicker.contextMenu.openProperties')}
      </ContextMenuItem>
    </ContextMenuContent>
  );
}

function LayerStatusIcons({
  layer,
  isLockBlocked,
}: {
  layer: SceneLayer;
  isLockBlocked: boolean;
}): React.ReactElement {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {layer.visible ? (
        <Eye className="h-3 w-3" aria-hidden />
      ) : (
        <EyeOff className="h-3 w-3" aria-hidden />
      )}
      {layer.locked ? (
        <Lock
          className={`h-3 w-3 ${isLockBlocked ? 'text-destructive' : ''}`}
          aria-hidden
        />
      ) : (
        <LockOpen className="h-3 w-3" aria-hidden />
      )}
      {layer.frozen === true && <Snowflake className="h-3 w-3" aria-hidden />}
    </span>
  );
}

function ActionButton({
  icon,
  labelKey,
  onClick,
  disabled,
  testId,
}: {
  icon: React.ReactNode;
  labelKey: string;
  onClick?: () => void;
  disabled?: boolean;
  testId: string;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      <span>{t(labelKey)}</span>
    </button>
  );
}
