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
import { createLevelSceneManagerAdapter } from '../entity-creation/LevelSceneManagerAdapter';
import {
  getLayerStoreSnapshot,
  subscribeLayerStore,
} from '../../stores/LayerStore';
import { useDisplayUnit } from '../../hooks/common/useDisplayUnit';
// ADR-532 B4 — this micro-leaf self-subscribes to the selection set so the
// CanvasSection orchestrator no longer re-renders to feed it selectedEntityIds.
import { useSelectedEntityIds } from '../selection/useSelectedEntities';
import { DISPLAY_UNIT_LABELS } from '../../config/units';
import {
  COMMON_LINETYPES,
  buildLineFormState,
  deriveEndPoint,
  getEntityGroups,
  type LineFormState,
  type PropertyDescriptor,
} from './entity-property-schema';
// ADR-362 §7 — DIMENSION support: schema-driven rows + dim read/apply model.
import { buildDimensionFormState, buildDimensionPatch } from './dimension-property-model';
// LINE read/apply model (mirror of the dimension model — keeps this component < 500 lines).
import { buildLinePatch } from './line-property-model';
import { PropertyGroupRows, type PropertySelectOption } from './PropertyGroupRows';
import { NumberInputRow, ReadonlyInputRow, PaletteFooter } from './PropertiesPaletteRows';
import { listArrowheadBlockNames } from '../dimensions/dim-arrowhead-blocks';
import type { DxfScene, DxfLine, DxfDimension } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { ICommand } from '../../core/commands/interfaces';
import styles from './PropertiesPalette.module.css';
import type { LevelSceneWriter } from '../levels/level-scene-accessor';

// ADR-362 §7 — «Πάχος» option list for the dimension palette (ByLayer + common ISO mm).
const DIM_LINEWEIGHT_OPTIONS = ['ByLayer', '0.13', '0.18', '0.25', '0.35', '0.5', '0.7', '1.0'] as const;


interface Props {
  dxfScene: DxfScene | null;
  activeTool: string;
  executeCommand: (cmd: ICommand) => void;
  levelManager: LevelSceneWriter;
}

export function PropertiesPalette({
  dxfScene,
  activeTool,
  executeCommand,
  levelManager,
}: Props) {
  // ADR-532 B4 — selection-set leaf subscription (was a prop from CanvasSection).
  const selectedEntityIds = useSelectedEntityIds();
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
  // ADR-362 §7 — DIMENSION form (schema-driven, all values as strings).
  const [dimForm, setDimForm] = useState<Record<string, string>>({});

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    geometry: true,
    style: true,
  });

  const entityId = selectedEntityIds[0] ?? null;

  // Reinit form when entity changes
  useEffect(() => {
    if (!entityId || !dxfScene) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity) return;
    if (entity.type === 'line') {
      setForm(buildLineFormState(entity as DxfLine, displayUnit));
    } else if (entity.type === 'dimension') {
      // canvas-v2 wraps the dimension → read the flat DimensionEntity from `.dimensionEntity`.
      const next = buildDimensionFormState((entity as DxfDimension).dimensionEntity, displayUnit);
      // Localise the read-only variant token (model stays pure — no i18n inside it).
      next.dimType = t(`propertiesPalette.dimTypes.${next.dimType}`);
      setDimForm(next);
    }
  }, [entityId, dxfScene, displayUnit, t]);

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

    const patch = buildLinePatch(line, form, layerStoreSnap.layers, displayUnit);
    if (Object.keys(patch).length === 0) return;

    const sceneManager = createLevelSceneManagerAdapter(
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

  // ADR-362 §7 — apply the edited DIMENSION form (entity-root fields + nested
  // `overrides`) as ONE undoable UpdateEntityCommand (mirror of the line path).
  const handleApplyDimension = useCallback(() => {
    if (!entityId || !dxfScene || !levelManager.currentLevelId) return;
    const entity = dxfScene.entities.find(e => e.id === entityId);
    if (!entity || entity.type !== 'dimension') return;
    const patch = buildDimensionPatch((entity as DxfDimension).dimensionEntity, dimForm);
    if (Object.keys(patch).length === 0) return;
    const sceneManager = createLevelSceneManagerAdapter(
      levelManager.getLevelScene,
      levelManager.setLevelScene,
      levelManager.currentLevelId,
    );
    executeCommand(new UpdateEntityCommand(entityId, patch, sceneManager, t('propertiesPalette.cmdLabel')));
  }, [entityId, dxfScene, dimForm, levelManager, executeCommand, t]);

  // Dynamic + enum option resolver for the dimension select rows (layers / lineweights /
  // arrow blocks are dynamic; linetype/tad/lunit come from the descriptor's static list).
  const resolveDimOptions = useCallback(
    (descriptor: PropertyDescriptor): readonly PropertySelectOption[] => {
      switch (descriptor.key) {
        case 'layerId':
          return layerStoreSnap.layers.map(l => ({ value: l.id ?? l.name, label: l.name }));
        case 'dimlwd':
          return DIM_LINEWEIGHT_OPTIONS.map(v => ({ value: v, label: v }));
        case 'dimblk':
          return listArrowheadBlockNames().map(n => ({ value: n, label: n }));
        default:
          return (descriptor.options ?? []).map(v => ({
            value: v,
            // Linetype names are literal; text-position / unit enums are i18n-labelled.
            label: descriptor.key === 'dimltype' ? v : t(`propertiesPalette.opts.${v}`),
          }));
      }
    },
    [layerStoreSnap, t],
  );

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!paletteSnap.open) return null;

  const entity = entityId ? dxfScene?.entities.find(e => e.id === entityId) : null;
  const isLine = entity?.type === 'line';
  const isDimension = entity?.type === 'dimension';
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
          {isDimension && (
            <span className={styles.entityBadge}>
              {t('propertiesPalette.entityDimension')}
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

      {entity && !isLine && !isDimension && (
        <p className={styles.emptyMsg}>{t('propertiesPalette.unsupported')}</p>
      )}

      {isDimension && (
        <>
          <PropertyGroupRows
            groups={getEntityGroups('dimension') ?? []}
            form={dimForm}
            onFieldChange={(key, value) => setDimForm(prev => ({ ...prev, [key]: value }))}
            resolveOptions={resolveDimOptions}
            unitLabel={unitLabel}
            t={t}
          />
          <PaletteFooter onApply={handleApplyDimension} t={t} />
        </>
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
                <NumberInputRow
                  label={t('propertiesPalette.props.startX')}
                  value={form.startX}
                  onChange={v => setForm(prev => ({ ...prev, startX: v }))}
                  unitLabel={unitLabel}
                />
                <NumberInputRow
                  label={t('propertiesPalette.props.startY')}
                  value={form.startY}
                  onChange={v => setForm(prev => ({ ...prev, startY: v }))}
                  unitLabel={unitLabel}
                />
                <ReadonlyInputRow
                  label={t('propertiesPalette.props.endX')}
                  value={derived?.endX ?? ''}
                  unitLabel={unitLabel}
                />
                <ReadonlyInputRow
                  label={t('propertiesPalette.props.endY')}
                  value={derived?.endY ?? ''}
                  unitLabel={unitLabel}
                />
                <NumberInputRow
                  label={t('propertiesPalette.props.length')}
                  value={form.lengthDisplay}
                  onChange={v => setForm(prev => ({ ...prev, lengthDisplay: v }))}
                  unitLabel={unitLabel}
                  min="0.001"
                />
                <NumberInputRow
                  label={t('propertiesPalette.props.angle')}
                  value={form.angleDeg}
                  onChange={v => setForm(prev => ({ ...prev, angleDeg: v }))}
                  unitLabel="°"
                  min="0"
                  max="360"
                />
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

          <PaletteFooter onApply={handleApply} t={t} />
        </>
      )}
    </div>
  );
}
