'use client';

/**
 * ADR-375 Phase C.4 — Visibility/Graphics Panel (Revit V/G equivalent).
 *
 * Per-view override table: 16 BIM categories × columns:
 *   Visibility toggle | Projection Pen | Projection Color | Projection Pattern
 *                     | Cut Pen        | Cut Color        | Cut Pattern
 *
 * Reads from `useBimRenderSettingsStore` (SSoT).
 * Writes via `setObjectStyleField`, `setObjectStyleVisibility`,
 *   `setObjectStyleVgColor`, `setObjectStyleVgPattern` (500ms debounce → Firestore).
 *
 * Priority stack: per-element > per-view (this panel) > global ObjectStyles > DEFAULT.
 *
 * ADR-375 v2.15 (2026-06-02): ported from a Radix `DropdownMenu` to the
 * centralized `FloatingPanel` SSoT (`@/components/ui/floating`). The table is
 * now a larger (`text-sm`, wider columns), draggable floating panel that stays
 * open while the user edits the canvas — Revit/AutoCAD palette behaviour — and
 * is toggled from the ribbon trigger. The previous Radix nested-overlay
 * focus-trap workaround is no longer needed: `FloatingPanel` does not contain
 * focus (`aria-modal="false"`), so the nested `UnifiedColorPicker` dialog opens
 * without recursion.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, Eye, EyeOff, RotateCcw, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/RibbonTooltip';
import { FloatingPanel } from '@/components/ui/floating';
import { Input } from '@/components/ui/input';
import { normalizeForSearch } from '@/utils/greek-text';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { BIM_CATEGORIES, type BimCategory } from '../../../config/bim-object-styles';
import { type LinePatternKey } from '../../../config/bim-line-patterns';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { UnifiedColorPicker } from '../../color/UnifiedColorPicker';
import { BimPenSelect, BimPatternSelect, BimLineweightSelect } from '../components/BimStyleSelects';

/**
 * Shared grid template for the header and every category row (8 columns):
 *   label | visibility | proj-pen | proj-color | proj-pattern | cut-pen | cut-color | cut-pattern.
 * Wider than the legacy dropdown for a comfortable, palette-style table.
 */
const GRID_TEMPLATE = '150px 32px 58px 86px 140px 58px 86px 140px';

/** Floating panel size — fits all 16 categories + header + reset without overflow. */
const PANEL_DIMENSIONS = { width: 880, height: 640 } as const;

export const VisibilityGraphicsPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setObjectStyleField = useBimRenderSettingsStore((s) => s.setObjectStyleField);
  const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);
  const setObjectStyleVgColor = useBimRenderSettingsStore((s) => s.setObjectStyleVgColor);
  const setObjectStyleVgPattern = useBimRenderSettingsStore((s) => s.setObjectStyleVgPattern);
  const resetToDefaults = useBimRenderSettingsStore((s) => s.resetToDefaults);

  // ADR-375 — «DXF Σχέδιο» import row (Revit «Imported Categories»).
  const dxfImport = useBimRenderSettingsStore((s) => s.dxfImport);
  const setDxfImportVisibility = useBimRenderSettingsStore((s) => s.setDxfImportVisibility);
  const setDxfImportColor = useBimRenderSettingsStore((s) => s.setDxfImportColor);
  const setDxfImportLineweight = useBimRenderSettingsStore((s) => s.setDxfImportLineweight);

  const handlePen = useCallback(
    (cat: BimCategory, key: 'projectionPen' | 'cutPen', pen: number) => {
      if (pen >= 1 && pen <= 16) setObjectStyleField(cat, key, pen);
    },
    [setObjectStyleField],
  );

  const handleVisibility = useCallback(
    (cat: BimCategory) => {
      const current = objectStyles[cat].visible;
      setObjectStyleVisibility(cat, current === false ? true : false);
    },
    [objectStyles, setObjectStyleVisibility],
  );

  const handleColor = useCallback(
    (cat: BimCategory, key: 'projectionColor' | 'cutColor', v: string) => {
      setObjectStyleVgColor(cat, key, v || null);
    },
    [setObjectStyleVgColor],
  );

  const handlePattern = useCallback(
    (cat: BimCategory, key: 'projectionPattern' | 'cutPattern', v: string) => {
      setObjectStyleVgPattern(cat, key, v as LinePatternKey);
    },
    [setObjectStyleVgPattern],
  );

  const handleReset = useCallback(() => {
    resetToDefaults();
  }, [resetToDefaults]);

  const hiddenCount = BIM_CATEGORIES.filter(
    (cat) => objectStyles[cat].visible === false,
  ).length;

  // Filter categories by typed text (accent-insensitive, matches translated label).
  const filteredCategories = useMemo<readonly BimCategory[]>(() => {
    const query = normalizeForSearch(filter.trim());
    if (!query) return BIM_CATEGORIES;
    return BIM_CATEGORIES.filter((cat) =>
      normalizeForSearch(t(`ribbon.commands.objectStyles.categories.${cat}`)).includes(query),
    );
  }, [filter, t]);

  // ADR-375 — the «DXF Σχέδιο» master row shows unless the active filter excludes it.
  const dxfRowMatchesFilter = useMemo(() => {
    const query = normalizeForSearch(filter.trim());
    if (!query) return true;
    return normalizeForSearch(t('ribbon.commands.visibilityGraphics.dxfImportRow')).includes(query);
  }, [filter, t]);

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.visibilityGraphics.label')}
      </span>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('ribbon.commands.visibilityGraphics.openAriaLabel')}
        aria-expanded={open}
        className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none`}
      >
        {hiddenCount > 0 ? (
          <EyeOff className="w-3 h-3 opacity-80" />
        ) : (
          <Eye className="w-3 h-3 opacity-60" />
        )}
        <span>{hiddenCount > 0 ? t('ribbon.commands.visibilityGraphics.hiddenCount', { count: hiddenCount }) : t('ribbon.commands.visibilityGraphics.allVisible')}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <FloatingPanel
          isVisible={open}
          onClose={() => setOpen(false)}
          dimensions={PANEL_DIMENSIONS}
          draggableOptions={{
            getClientPosition: () => ({
              x: Math.max(16, window.innerWidth - PANEL_DIMENSIONS.width - 24),
              y: 96,
            }),
          }}
          className="z-50"
          data-testid="visibility-graphics-floating-panel"
        >
          <FloatingPanel.Header
            title={t('ribbon.commands.visibilityGraphics.panelTitle')}
            icon={hiddenCount > 0 ? <EyeOff /> : <Eye />}
          />
          <FloatingPanel.Content className={`max-h-[70vh] overflow-y-auto ${colors.text.secondary}`}>
            {/* Filter field — πληκτρολόγησε κείμενο για να στενέψεις τη λίστα κατηγοριών */}
            <div className="relative mb-2">
              <Search className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${colors.text.muted}`} />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('ribbon.commands.visibilityGraphics.filterPlaceholder')}
                aria-label={t('ribbon.commands.visibilityGraphics.filterAriaLabel')}
                className="h-8 pl-7"
              />
            </div>

            {/* Header row */}
            <div
              className={`grid gap-x-2 gap-y-0.5 items-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium mb-1`}
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              <span></span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-center">{t('ribbon.commands.visibilityGraphics.visibleHeaderShort')}</span>
                </TooltipTrigger>
                <TooltipContent>{t('ribbon.commands.visibilityGraphics.visibleHeader')}</TooltipContent>
              </Tooltip>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.projPen')}</span>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.projColor')}</span>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.projPattern')}</span>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.cutPen')}</span>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.cutColor')}</span>
              <span className="text-center">{t('ribbon.commands.visibilityGraphics.cutPattern')}</span>
            </div>

            {/* ADR-375 — «DXF Σχέδιο» master row (Revit «Imported Categories»): one row
                controlling ALL raw DXF entities. Per-layer detail stays in the Layer Manager. */}
            {dxfRowMatchesFilter && (
              <div
                className={`grid gap-x-2 gap-y-0.5 items-center py-0.5 mb-1 pb-1 border-b border-border ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${dxfImport.visible === false ? colors.text.muted : colors.text.secondary}`}
                style={{ gridTemplateColumns: GRID_TEMPLATE }}
              >
                <span className="truncate font-semibold">
                  {t('ribbon.commands.visibilityGraphics.dxfImportRow')}
                </span>
                <button
                  onClick={() => setDxfImportVisibility(dxfImport.visible === false)}
                  aria-label={t('ribbon.commands.visibilityGraphics.dxfImportToggle')}
                  aria-pressed={dxfImport.visible !== false}
                  className={`flex justify-center items-center w-6 h-6 rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                >
                  {dxfImport.visible === false
                    ? <EyeOff className="w-3.5 h-3.5 opacity-60" />
                    : <Eye className="w-3.5 h-3.5 opacity-80" />}
                </button>
                <BimLineweightSelect
                  value={dxfImport.projectionLineweightMm}
                  onChange={setDxfImportLineweight}
                  allowUnset
                  disabled={dxfImport.visible === false}
                  aria-label={t('ribbon.commands.visibilityGraphics.dxfImportWeightTitle')}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <UnifiedColorPicker
                        variant="modal"
                        value={dxfImport.projectionColor ?? '#888888'}
                        onChange={(v) => setDxfImportColor(v || null)}
                        disabled={dxfImport.visible === false}
                        title={t('ribbon.commands.visibilityGraphics.dxfImportColorTitle')}
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('ribbon.commands.visibilityGraphics.dxfImportColorTitle')}</TooltipContent>
                </Tooltip>
                <span />
                <span />
                <span />
                <span />
              </div>
            )}

            {/* Category rows */}
            {filteredCategories.map((cat) => {
              const style = objectStyles[cat];
              const isHidden = style.visible === false;
              return (
                <div
                  key={cat}
                  className={`grid gap-x-2 gap-y-0.5 items-center py-0.5 ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${isHidden ? colors.text.muted : colors.text.secondary}`}
                  style={{ gridTemplateColumns: GRID_TEMPLATE }}
                >
                  <span className="truncate font-medium">
                    {t(`ribbon.commands.objectStyles.categories.${cat}`)}
                  </span>

                  {/* Visibility toggle */}
                  <button
                    onClick={() => handleVisibility(cat)}
                    aria-label={t('ribbon.commands.visibilityGraphics.toggleVisibility', { cat })}
                    aria-pressed={!isHidden}
                    className={`flex justify-center items-center w-6 h-6 rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                  >
                    {isHidden
                      ? <EyeOff className="w-3.5 h-3.5 opacity-60" />
                      : <Eye className="w-3.5 h-3.5 opacity-80" />}
                  </button>

                  {/* Projection Pen */}
                  <BimPenSelect
                    value={style.projectionPen}
                    onChange={(pen) => handlePen(cat, 'projectionPen', pen)}
                    disabled={isHidden}
                    aria-label={t('ribbon.commands.visibilityGraphics.projPen')}
                  />

                  {/* Projection Color — ADR-375 v2.7: UnifiedColorPicker (Enterprise dialog) αντί native Windows input */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <UnifiedColorPicker
                          variant="modal"
                          value={style.projectionColor ?? '#888888'}
                          onChange={(v) => handleColor(cat, 'projectionColor', v)}
                          disabled={isHidden}
                          title={t('ribbon.commands.visibilityGraphics.projColorTitle')}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('ribbon.commands.visibilityGraphics.projColorTitle')}</TooltipContent>
                  </Tooltip>

                  {/* Projection Pattern */}
                  <BimPatternSelect
                    value={style.projectionPattern ?? 'solid'}
                    onChange={(p) => handlePattern(cat, 'projectionPattern', p)}
                    disabled={isHidden}
                    aria-label={t('ribbon.commands.visibilityGraphics.projPattern')}
                  />

                  {/* Cut Pen */}
                  <BimPenSelect
                    value={style.cutPen}
                    onChange={(pen) => handlePen(cat, 'cutPen', pen)}
                    disabled={isHidden}
                    aria-label={t('ribbon.commands.visibilityGraphics.cutPen')}
                  />

                  {/* Cut Color — ADR-375 v2.7: UnifiedColorPicker (Enterprise dialog) αντί native Windows input */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <UnifiedColorPicker
                          variant="modal"
                          value={style.cutColor ?? '#000000'}
                          onChange={(v) => handleColor(cat, 'cutColor', v)}
                          disabled={isHidden}
                          title={t('ribbon.commands.visibilityGraphics.cutColorTitle')}
                          showModalFooter={false}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('ribbon.commands.visibilityGraphics.cutColorTitle')}</TooltipContent>
                  </Tooltip>

                  {/* Cut Pattern */}
                  <BimPatternSelect
                    value={style.cutPattern ?? 'solid'}
                    onChange={(p) => handlePattern(cat, 'cutPattern', p)}
                    disabled={isHidden}
                    aria-label={t('ribbon.commands.visibilityGraphics.cutPattern')}
                  />
                </div>
              );
            })}

            {filteredCategories.length === 0 && !dxfRowMatchesFilter && (
              <p className={`py-3 text-center ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted}`}>
                {t('ribbon.commands.visibilityGraphics.noResults')}
              </p>
            )}

            <button
              onClick={handleReset}
              aria-label={t('ribbon.commands.visibilityGraphics.resetAriaLabel')}
              className={`flex items-center gap-1.5 w-full mt-2 ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t('ribbon.commands.visibilityGraphics.reset')}
            </button>
          </FloatingPanel.Content>
        </FloatingPanel>
      )}
    </span>
  );
};
