'use client';

/**
 * PROPERTIES PALETTE — ADR-357 §4 G9 Phase 10
 *
 * ADR-040 micro-leaf subscriber: sole React consumer of PropertiesPaletteStore.
 * Opened/closed by F11 (toggle). Shows ALL properties of the selected LINE entity.
 *
 * Groups: Geometry (startX/Y, endX/Y readonly, length, angle)
 *         Style (layer, color, linetype)
 *
 * Edits committed as UpdateEntityCommand → CommandHistory (undo-able).
 * Closes on Esc. Apply on "Apply" button or Enter.
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
import { PropertiesPaletteStore } from './PropertiesPaletteStore';
import { UpdateEntityCommand } from '../../core/commands/entity-commands/UpdateEntityCommand';
import { LevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../stores/LayerStore';
import { useDisplayUnit } from '../../hooks/common/useDisplayUnit';
import { fromDisplay, DISPLAY_UNIT_LABELS, type DisplayUnit } from '../../config/units';
import {
  COMMON_LINETYPES,
  buildLineFormState,
  deriveEndPoint,
  type LineFormState,
} from './entity-property-schema';
import type { DxfScene, DxfLine } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ICommand } from '../../core/commands/interfaces';
import type { SceneModel } from '../../types/scene';
import styles from './PropertiesPalette.module.css';

interface LevelManagerLike {
  getLevelScene: (id: string) => SceneModel | null;
  setLevelScene: (id: string, scene: SceneModel) => void;
  currentLevelId: string | null;
}

interface Props {
  dxfScene: DxfScene | null;
  selectedEntityIds: string[];
  activeTool: string;
  executeCommand: (cmd: ICommand) => void;
  levelManager: LevelManagerLike;
}

export function PropertiesPalette({
  dxfScene,
  selectedEntityIds,
  activeTool,
  executeCommand,
  levelManager,
}: Props) {
  const paletteSnap = useSyncExternalStore(
    PropertiesPaletteStore.subscribe,
    PropertiesPaletteStore.getSnapshot,
    PropertiesPaletteStore.getSnapshot,
  );
  const layerStoreSnap = useSyncExternalStore(
    subscribeLayerStore,
    getLayerStoreSnapshot,
    getLayerStoreSnapshot,
  );
  const { t } = useTranslation('dxf-viewer-shell');
  const { displayUnit } = useDisplayUnit();
  const unitLabel = DISPLAY_UNIT_LABELS[displayUnit];

  const [form, setForm] = useState<LineFormState>({
    startX: '0', startY: '0', lengthDisplay: '0', angleDeg: '0',
    layerId: '', color: '', linetype: 'ByLayer',
  });

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    geometry: true,
    style: true,
  });

  const entityId = selectedEntityIds[0] ?? null;

  // Reinit form when entity changes
  useEffect(() => {
    if (!entityId || !dxfScene) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'line') return;
    setForm(buildLineFormState(entity as DxfLine, displayUnit));
  }, [entityId, dxfScene, displayUnit]);

  // Close when palette loses focus to a non-select tool (optional — palette stays open)
  // Per industry standard, Properties Palette persists across tool changes.

  // ADR-364: Esc → close via centralized Escape Command Bus.
  useEscapeHandler({
    id: 'properties-palette',
    priority: ESC_PRIORITY.POPOVER_DROPDOWN,
    allowWhenEditable: true,
    canHandle: () => paletteSnap.open,
    handle: () => { PropertiesPaletteStore.close(); return true; },
  });

  const handleApply = useCallback(() => {
    if (!entityId || !dxfScene || !levelManager.currentLevelId) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'line') return;
    const line = entity as DxfLine;

    const patch: Record<string, unknown> = {};

    // Start point
    const newStartXMm = fromDisplay(parseFloat(form.startX), displayUnit);
    const newStartYMm = fromDisplay(parseFloat(form.startY), displayUnit);
    if (!isNaN(newStartXMm) && !isNaN(newStartYMm)) {
      const origStartX = line.start.x;
      const origStartY = line.start.y;
      if (Math.abs(newStartXMm - origStartX) > 0.0001 || Math.abs(newStartYMm - origStartY) > 0.0001) {
        patch.start = { x: newStartXMm, y: newStartYMm };
      }
    }

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
    const origLinetype = entity.linetypeName ?? 'ByLayer';
    if (form.linetype !== origLinetype) {
      patch.linetypeName = form.linetype === 'ByLayer' ? undefined : form.linetype;
    }

    // Length + Angle → recompute end
    const startX = patch.start ? (patch.start as { x: number }).x : line.start.x;
    const startY = patch.start ? (patch.start as { x: number; y: number }).y : line.start.y;
    const dx0 = line.end.x - line.start.x;
    const dy0 = line.end.y - line.start.y;
    const origLengthMm = Math.hypot(dx0, dy0);
    let origAngleDeg = Math.atan2(-dy0, dx0) * (180 / Math.PI);
    if (origAngleDeg < 0) origAngleDeg += 360;

    const newLengthMm = fromDisplay(parseFloat(form.lengthDisplay), displayUnit);
    const newAngleDeg = parseFloat(form.angleDeg);
    const finalLength = isNaN(newLengthMm) ? origLengthMm : newLengthMm;
    const finalAngle = isNaN(newAngleDeg) ? origAngleDeg : newAngleDeg;
    const finalRad = finalAngle * (Math.PI / 180);

    if (
      Math.abs(finalLength - origLengthMm) > 0.0001 ||
      Math.abs(finalAngle - origAngleDeg) > 0.0001 ||
      patch.start
    ) {
      patch.end = {
        x: startX + finalLength * Math.cos(finalRad),
        y: startY - finalLength * Math.sin(finalRad),
      };
    }

    if (Object.keys(patch).length === 0) return;

    const sceneManager = new LevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    const cmd = new UpdateEntityCommand(
      entityId,
      patch,
      sceneManager,
      t('propertiesPalette.cmdLabel'),
    );
    executeCommand(cmd);
  }, [entityId, dxfScene, form, layerStoreSnap, levelManager, displayUnit, executeCommand, t]);

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!paletteSnap.open) return null;

  const entity = entityId ? dxfScene?.entities.find(e => e.id === entityId) : null;
  const isLine = entity?.type === 'line';
  const derived = isLine ? deriveEndPoint(form, entity as DxfLine, displayUnit) : null;

  return (
    <div
      className={styles.palette}
      role="dialog"
      aria-label={t('propertiesPalette.title')}
    >
      <header className={styles.header}>
        <span className={styles.headerTitle}>
          <span>{t('propertiesPalette.title')}</span>
          {isLine && (
            <span className={styles.entityBadge}>
              {t('propertiesPalette.entityLine')}
            </span>
          )}
        </span>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => PropertiesPaletteStore.close()}
          aria-label={t('propertiesPalette.close')}
        >
          ✕
        </button>
      </header>

      {!entity && (
        <p className={styles.emptyMsg}>{t('propertiesPalette.noSelection')}</p>
      )}

      {entity && !isLine && (
        <p className={styles.emptyMsg}>{t('propertiesPalette.unsupported')}</p>
      )}

      {isLine && (
        <>
          {/* Geometry group */}
          <section className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              onClick={() => toggleGroup('geometry')}
            >
              <span>{t('propertiesPalette.groups.geometry')}</span>
              <span className={`${styles.chevron} ${openGroups.geometry ? styles.chevronOpen : ''}`}>▶</span>
            </button>
            {openGroups.geometry && (
              <div className={styles.groupBody}>
                {/* Start X */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.startX')}</span>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      type="number"
                      step="any"
                      value={form.startX}
                      onChange={e => setForm(prev => ({ ...prev, startX: e.target.value }))}
                    />
                    <span className={styles.unit}>{unitLabel}</span>
                  </div>
                </div>
                {/* Start Y */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.startY')}</span>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.input}
                      type="number"
                      step="any"
                      value={form.startY}
                      onChange={e => setForm(prev => ({ ...prev, startY: e.target.value }))}
                    />
                    <span className={styles.unit}>{unitLabel}</span>
                  </div>
                </div>
                {/* End X (readonly derived) */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.endX')}</span>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.inputReadonly}
                      type="text"
                      readOnly
                      value={derived?.endX ?? ''}
                    />
                    <span className={styles.unit}>{unitLabel}</span>
                  </div>
                </div>
                {/* End Y (readonly derived) */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.endY')}</span>
                  <div className={styles.inputWrap}>
                    <input
                      className={styles.inputReadonly}
                      type="text"
                      readOnly
                      value={derived?.endY ?? ''}
                    />
                    <span className={styles.unit}>{unitLabel}</span>
                  </div>
                </div>
                {/* Length */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.length')}</span>
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
                  <span className={styles.label}>{t('propertiesPalette.props.angle')}</span>
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
              </div>
            )}
          </section>

          {/* Style group */}
          <section className={styles.group}>
            <button
              type="button"
              className={styles.groupHeader}
              onClick={() => toggleGroup('style')}
            >
              <span>{t('propertiesPalette.groups.style')}</span>
              <span className={`${styles.chevron} ${openGroups.style ? styles.chevronOpen : ''}`}>▶</span>
            </button>
            {openGroups.style && (
              <div className={styles.groupBody}>
                {/* Layer */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.layer')}</span>
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
                  <span className={styles.label}>{t('propertiesPalette.props.color')}</span>
                  <div className={styles.inputWrap}>
                    {form.color && (
                      <span
                        className={styles.colorSwatch}
                        style={{ '--qp-swatch': form.color } as React.CSSProperties}
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
                {/* Linetype */}
                <div className={styles.row}>
                  <span className={styles.label}>{t('propertiesPalette.props.linetype')}</span>
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
              </div>
            )}
          </section>

          <footer className={styles.footer}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={() => PropertiesPaletteStore.close()}
            >
              {t('propertiesPalette.close')}
            </button>
            <button
              type="button"
              className={styles.btnApply}
              onClick={handleApply}
            >
              {t('propertiesPalette.apply')}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
