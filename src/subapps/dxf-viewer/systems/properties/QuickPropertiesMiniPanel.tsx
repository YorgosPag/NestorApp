'use client';

/**
 * QUICK PROPERTIES MINI-PANEL — ADR-357 §4 G9 Phase 9
 *
 * ADR-040 micro-leaf subscriber: the ONLY React consumer of QuickPropertiesMiniPanelStore.
 * Opened on double-click of a LINE entity (activeTool='select').
 * Shows 5 editable properties: Layer / Color / Length / Angle / Linetype.
 *
 * Edits are committed as a single UpdateEntityCommand → fully undo-able.
 * Closes on Esc / Enter / click-outside / activeTool change.
 *
 * RULE (ADR-040): mounted as a sibling of CanvasLayerStack — orchestrators stay
 * subscription-free.
 */

import React, {
  useSyncExternalStore,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEscapeHandler, ESC_PRIORITY } from '@/subapps/dxf-viewer/systems/escape-bus';
import { QuickPropertiesMiniPanelStore } from './QuickPropertiesMiniPanelStore';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { LevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../stores/LayerStore';
import { useDisplayUnit } from '../../hooks/common/useDisplayUnit';
import { formatDisplayValue, fromDisplay, DISPLAY_UNIT_LABELS, type DisplayUnit } from '../../config/units';
import type { DxfScene, DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import styles from './QuickPropertiesMiniPanel.module.css';

const COMMON_LINETYPES = [
  'ByLayer', 'Continuous', 'DASHED', 'DASHED2', 'DASHEDX2',
  'HIDDEN', 'HIDDEN2', 'HIDDENX2', 'CENTER', 'CENTER2', 'CENTERX2',
  'DOT', 'DOT2', 'DOTX2', 'DASHDOT', 'DASHDOT2', 'DASHDOTX2',
  'BORDER', 'DIVIDE', 'PHANTOM',
] as const;

interface LevelManagerLike {
  getLevelScene: (id: string) => SceneModel | null;
  setLevelScene: (id: string, scene: SceneModel) => void;
  currentLevelId: string | null;
}

interface Props {
  dxfScene: DxfScene | null;
  activeTool: string;
  executeCommand: (cmd: ICommand) => void;
  levelManager: LevelManagerLike;
}

interface FormState {
  layerId: string;
  color: string;
  lengthDisplay: string;
  angleDeg: string;
  linetype: string;
}

function buildInitialFormState(entity: DxfLine, displayUnit: DisplayUnit): FormState {
  const dx = entity.end.x - entity.start.x;
  const dy = entity.end.y - entity.start.y;
  const lengthMm = Math.hypot(dx, dy);
  let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return {
    layerId: entity.layerId ?? '',
    color: entity.colorMode === 'Concrete' ? (entity.color ?? '') : '',
    lengthDisplay: formatDisplayValue(lengthMm, displayUnit),
    angleDeg: angle.toFixed(4),
    linetype: entity.linetypeName ?? 'ByLayer',
  };
}

export function QuickPropertiesMiniPanel({
  dxfScene, activeTool, executeCommand, levelManager,
}: Props) {
  const snapshot = useSyncExternalStore(
    QuickPropertiesMiniPanelStore.subscribe,
    QuickPropertiesMiniPanelStore.getSnapshot,
    QuickPropertiesMiniPanelStore.getSnapshot,
  );
  const layerStoreSnap = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();
  const panelRef = useRef<HTMLDivElement | null>(null);

  const { entityId, position, open } = snapshot;

  const [form, setForm] = useState<FormState>({
    layerId: '', color: '', lengthDisplay: '0', angleDeg: '0', linetype: 'ByLayer',
  });

  // Reinit form when entityId changes
  useEffect(() => {
    if (!entityId || !open || !dxfScene) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'line') return;
    setForm(buildInitialFormState(entity as DxfLine, displayUnit));
  }, [entityId, open, dxfScene, displayUnit]);

  // Close when activeTool leaves 'select'
  useEffect(() => {
    if (open && activeTool !== 'select') {
      QuickPropertiesMiniPanelStore.close();
    }
  }, [activeTool, open]);

  // ADR-364: Esc → close via centralized Escape Command Bus.
  useEscapeHandler({
    id: 'quick-properties-mini-panel',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => open,
    handle: () => { QuickPropertiesMiniPanelStore.close(); return true; },
  });

  // Enter → apply
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.stopPropagation(); handleApply(); }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  });

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        QuickPropertiesMiniPanelStore.close();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const handleApply = useCallback(() => {
    if (!entityId || !dxfScene || !levelManager.currentLevelId) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'line') return;
    const line = entity as DxfLine;

    const patch: Record<string, unknown> = {};

    // Layer
    const newLayerId = form.layerId;
    if (newLayerId && newLayerId !== (entity.layerId ?? '')) {
      patch.layerId = newLayerId;
      const layerObj = layerStoreSnap.layers.find(l => l.id === newLayerId);
      if (layerObj) patch.layer = layerObj.name;
    }

    // Color
    const colorTrimmed = form.color.trim();
    const originalColor = entity.colorMode === 'Concrete' ? (entity.color ?? '') : '';
    if (colorTrimmed !== originalColor) {
      if (colorTrimmed === '') {
        patch.colorMode = 'ByLayer';
        patch.color = null;
      } else {
        patch.colorMode = 'Concrete';
        patch.color = colorTrimmed;
      }
    }

    // Linetype
    const newLinetype = form.linetype;
    const origLinetype = entity.linetypeName ?? 'ByLayer';
    if (newLinetype !== origLinetype) {
      patch.linetypeName = newLinetype === 'ByLayer' ? undefined : newLinetype;
    }

    // Length + Angle — recompute end point
    const dx0 = line.end.x - line.start.x;
    const dy0 = line.end.y - line.start.y;
    const origLengthMm = Math.hypot(dx0, dy0);
    let origAngleDeg = Math.atan2(-dy0, dx0) * (180 / Math.PI);
    if (origAngleDeg < 0) origAngleDeg += 360;

    const newLengthDisplay = parseFloat(form.lengthDisplay);
    const newAngleDeg = parseFloat(form.angleDeg);
    const newLengthMm = isNaN(newLengthDisplay) ? origLengthMm : fromDisplay(newLengthDisplay, displayUnit);
    const finalAngleDeg = isNaN(newAngleDeg) ? origAngleDeg : newAngleDeg;
    const finalAngleRad = finalAngleDeg * (Math.PI / 180);

    if (
      Math.abs(newLengthMm - origLengthMm) > 0.0001 ||
      Math.abs(finalAngleDeg - origAngleDeg) > 0.0001
    ) {
      patch.end = {
        x: line.start.x + newLengthMm * Math.cos(finalAngleRad),
        y: line.start.y - newLengthMm * Math.sin(finalAngleRad),
      };
    }

    if (Object.keys(patch).length === 0) {
      QuickPropertiesMiniPanelStore.close();
      return;
    }

    const sceneManager = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    const cmd = new UpdateEntityCommand(entityId, patch, sceneManager, t('quickProperties.miniPanel.title'));
    executeCommand(cmd);
    QuickPropertiesMiniPanelStore.close();
  }, [entityId, dxfScene, form, layerStoreSnap, levelManager, displayUnit, executeCommand, t]);

  if (!open || !entityId || !position || activeTool !== 'select' || !dxfScene) return null;

  const entity = dxfScene.entities.find(e => e.id === entityId);
  if (!entity || entity.type !== 'line') return null;

  const unitLabel = DISPLAY_UNIT_LABELS[displayUnit];

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ left: position.x + 16, top: position.y + 8 }}
      role="dialog"
      aria-label={t('quickProperties.miniPanel.title')}
    >
      <header className={styles.header}>
        <span>{t('quickProperties.miniPanel.title')}</span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => QuickPropertiesMiniPanelStore.close()}
          aria-label={t('quickProperties.miniPanel.cancel')}
        >
          ✕
        </button>
      </header>

      <section className={styles.body}>
        {/* Layer */}
        <div className={styles.row}>
          <span className={styles.label}>{t('quickProperties.miniPanel.layer')}</span>
          <div className={styles.inputWrap}>
            <select
              className={styles.select}
              value={form.layerId}
              onChange={e => setForm(prev => ({ ...prev, layerId: e.target.value }))}
            >
              {layerStoreSnap.layers.map(l => (
                <option key={l.id ?? l.name} value={l.id ?? l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Color */}
        <div className={styles.row}>
          <span className={styles.label}>{t('quickProperties.miniPanel.color')}</span>
          <div className={styles.inputWrap}>
            {form.color && (
              <span
                className={styles.colorSwatch}
                style={{ '--qp-mini-swatch': form.color } as React.CSSProperties}
              />
            )}
            <input
              className={styles.input}
              type="text"
              placeholder="ByLayer"
              value={form.color}
              onChange={e => setForm(prev => ({ ...prev, color: e.target.value }))}
            />
          </div>
        </div>

        {/* Length */}
        <div className={styles.row}>
          <span className={styles.label}>{t('quickProperties.miniPanel.length')}</span>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type="number"
              step="any"
              min="0.001"
              value={form.lengthDisplay}
              onChange={e => setForm(prev => ({ ...prev, lengthDisplay: e.target.value }))}
            />
            <span className={styles.unit}>{unitLabel}</span>
          </div>
        </div>

        {/* Angle */}
        <div className={styles.row}>
          <span className={styles.label}>{t('quickProperties.miniPanel.angle')}</span>
          <div className={styles.inputWrap}>
            <input
              className={styles.input}
              type="number"
              step="any"
              min="0"
              max="360"
              value={form.angleDeg}
              onChange={e => setForm(prev => ({ ...prev, angleDeg: e.target.value }))}
            />
            <span className={styles.unit}>°</span>
          </div>
        </div>

        {/* Linetype */}
        <div className={styles.row}>
          <span className={styles.label}>{t('quickProperties.miniPanel.linetype')}</span>
          <div className={styles.inputWrap}>
            <select
              className={styles.select}
              value={form.linetype}
              onChange={e => setForm(prev => ({ ...prev, linetype: e.target.value }))}
            >
              {COMMON_LINETYPES.map(lt => (
                <option key={lt} value={lt}>{lt}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={() => QuickPropertiesMiniPanelStore.close()}
        >
          {t('quickProperties.miniPanel.cancel')}
        </button>
        <button
          type="button"
          className={styles.btnApply}
          onClick={handleApply}
        >
          {t('quickProperties.miniPanel.apply')}
        </button>
      </footer>
    </div>
  );
}
