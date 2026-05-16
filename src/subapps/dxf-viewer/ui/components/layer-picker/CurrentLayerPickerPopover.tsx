'use client';

/**
 * CurrentLayerPickerPopover — ADR-358 §5.5.bis Q8 Phase 7.
 *
 * Popover body shared by both trigger variants. Sections:
 *   1. Search input (live filter, no debounce — finite layer set)
 *   2. Most-used (top 5 from `LayerStore.recentLayerIds`, filtered)
 *   3. Grouped by AEC category, filtered, alphabetical inside each group
 *   4. Actions: New Layer (deferred Phase 7.5), Open Layer Manager
 *
 * Layer row shows: color swatch, name, visibility/lock/freeze icons.
 * Locked + frozen layers stay clickable but show a hint icon —
 * downstream "Can draw here?" guards live in ADR-344 CanEditLayerGuard.
 */

import * as React from 'react';
import { Eye, EyeOff, Lock, LockOpen, Search, Snowflake, Settings, Plus } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { SceneLayer, AecLayerCategory } from '../../../types/entities';
import type { LayerPickerActions, LayerPickerState, LayerGroup } from './useCurrentLayerPickerState';

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

export function CurrentLayerPickerPopover({
  state,
  actions,
}: CurrentLayerPickerPopoverProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (state.isOpen) {
      const id = window.setTimeout(() => searchRef.current?.focus(), 30);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [state.isOpen]);

  const hasResults =
    state.filteredRecent.length > 0 || state.filteredGroups.length > 0;

  return (
    <section
      data-testid="current-layer-picker-popover"
      className="flex flex-col max-h-[420px]"
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
            onPick={actions.selectLayer}
          />
        )}

        {state.filteredGroups.map((group) => (
          <LayerGroupSection
            key={group.category}
            group={group}
            currentLayerId={state.currentLayerId}
            onPick={actions.selectLayer}
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
          onClick={() => {
            window.dispatchEvent(new CustomEvent('dxf:open-layer-manager'));
            actions.setIsOpen(false);
          }}
        />
      </footer>
    </section>
  );
}

function LayerSection({
  titleKey,
  layers,
  currentLayerId,
  onPick,
}: {
  titleKey: string;
  layers: ReadonlyArray<SceneLayer>;
  currentLayerId: string | null;
  onPick: (id: string) => void;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <div>
      <h3 className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t(titleKey)}
      </h3>
      <ul role="listbox" aria-label={t(titleKey)}>
        {layers.map((layer) => (
          <LayerRow
            key={layer.id ?? layer.name}
            layer={layer}
            isCurrent={(layer.id ?? layer.name) === currentLayerId}
            onPick={onPick}
          />
        ))}
      </ul>
    </div>
  );
}

function LayerGroupSection({
  group,
  currentLayerId,
  onPick,
}: {
  group: LayerGroup;
  currentLayerId: string | null;
  onPick: (id: string) => void;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  return (
    <LayerSection
      titleKey={CATEGORY_LABEL_KEYS[group.category]}
      layers={group.layers}
      currentLayerId={currentLayerId}
      onPick={onPick}
    />
  );
}

function LayerRow({
  layer,
  isCurrent,
  onPick,
}: {
  layer: SceneLayer;
  isCurrent: boolean;
  onPick: (id: string) => void;
}): React.ReactElement {
  const layerId = layer.id ?? layer.name;
  const isDisabled = layer.locked || layer.frozen === true;
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(layerId)}
        aria-current={isCurrent ? 'true' : undefined}
        data-testid={`layer-row-${layerId}`}
        className={
          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ' +
          (isCurrent ? 'bg-accent/40 ' : 'hover:bg-muted ') +
          (isDisabled ? 'opacity-70' : '')
        }
      >
        <span
          className="h-3 w-3 shrink-0 rounded-[2px] border border-border"
          style={{ backgroundColor: layer.color }}
          aria-hidden
        />
        <span className="flex-1 truncate">{layer.name}</span>
        <LayerStatusIcons layer={layer} />
      </button>
    </li>
  );
}

function LayerStatusIcons({ layer }: { layer: SceneLayer }): React.ReactElement {
  return (
    <span className="flex items-center gap-1 text-muted-foreground">
      {layer.visible ? (
        <Eye className="h-3 w-3" aria-hidden />
      ) : (
        <EyeOff className="h-3 w-3" aria-hidden />
      )}
      {layer.locked ? (
        <Lock className="h-3 w-3" aria-hidden />
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
