'use client';

/**
 * LayerGroupFilterEditor — modal for creating / editing a Group Filter
 * (ADR-358 §5.7.bis Q11 Phase 11).
 *
 * Group filter = manual list of layer ids. User picks layers via a checkbox
 * list filtered by an inline search box. Reuses LayerStore snapshot.
 */

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from '@/i18n';
import { nowISO } from '@/lib/date-local';
import { BaseModal } from '../../../components/shared/BaseModal';
import { Input } from '@/components/ui/input';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { generateLayerFilterGroupId } from '@/services/enterprise-id.service';
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../../stores/LayerStore';
import type { LayerGroupFilter } from '../../../types/layer-filters';

export interface LayerGroupFilterEditorProps {
  readonly isOpen: boolean;
  readonly initial?: LayerGroupFilter | null;
  readonly onClose: () => void;
  readonly onSubmit: (filter: LayerGroupFilter) => void;
}

export function LayerGroupFilterEditor({
  isOpen, initial, onClose, onSubmit,
}: LayerGroupFilterEditorProps): React.ReactElement | null {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const { getStatusBorder } = useBorderTokens();

  const snapshot = useSyncExternalStore(subscribeLayerStore, getLayerStoreSnapshot, getLayerStoreSnapshot);

  const [name, setName] = useState(initial?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initial?.layerIds ?? []));
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setName(initial?.name ?? '');
      setSelectedIds(new Set(initial?.layerIds ?? []));
      setSearch('');
    }
  }, [isOpen, initial]);

  const visibleLayers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return snapshot.layers;
    return snapshot.layers.filter((l) => l.name.toLowerCase().includes(q));
  }, [snapshot.layers, search]);

  const toggle = (id: string): void => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleSubmit = (): void => {
    const id = initial?.id ?? generateLayerFilterGroupId();
    const nowIso = nowISO();
    const filter: LayerGroupFilter = {
      kind: 'group',
      id,
      name: name.trim() || t('layerFilters.placeholder.untitled'),
      source: initial?.source ?? 'user-created',
      createdAt: initial?.createdAt ?? nowIso,
      updatedAt: nowIso,
      layerIds: Array.from(selectedIds),
    };
    onSubmit(filter);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={initial ? t('layerFilters.group.editTitle') : t('layerFilters.group.createTitle')}
      size="md"
      footer={(
        <footer className={`${PANEL_LAYOUT.SPACING.GAP_SM} flex justify-end`}>
          <button type="button" onClick={onClose} className={colors.text.muted}>
            {t('layerFilters.action.cancel')}
          </button>
          <button type="button" onClick={handleSubmit} className={colors.text.primary}>
            {t('layerFilters.action.save')}
          </button>
        </footer>
      )}
    >
      <section className={PANEL_LAYOUT.SPACING.GAP_SM}>
        <label className={colors.text.primary} htmlFor="lf-group-name">{t('layerFilters.builder.nameLabel')}</label>
        <Input
          id="lf-group-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('layerFilters.group.namePlaceholder')}
        />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('layerFilters.group.searchPlaceholder')}
        />
        <ul
          className={`${getStatusBorder('muted')} ${PANEL_LAYOUT.PADDING.LEFT_SM} ${PANEL_LAYOUT.PADDING.RIGHT_SM} ${PANEL_LAYOUT.PADDING.VERTICAL_XS} max-h-72 overflow-y-auto`}
        >
          {visibleLayers.map((layer) => (
            <li key={layer.id} className={`${PANEL_LAYOUT.SPACING.GAP_XS} flex items-center`}>
              <input
                type="checkbox"
                id={`lf-group-l-${layer.id}`}
                checked={selectedIds.has(layer.id)}
                onChange={() => toggle(layer.id)}
              />
              <label htmlFor={`lf-group-l-${layer.id}`} className={colors.text.primary}>
                {layer.name}
              </label>
            </li>
          ))}
        </ul>
        <small className={colors.text.muted}>
          {t('layerFilters.group.selectedCount', { count: selectedIds.size })}
        </small>
      </section>
    </BaseModal>
  );
}
