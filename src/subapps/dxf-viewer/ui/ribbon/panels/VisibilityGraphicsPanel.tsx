'use client';

/**
 * ADR-375 Phase C.4 — Visibility/Graphics Panel (Revit V/G equivalent).
 *
 * Per-view override table: 12 BIM categories × columns:
 *   Visibility toggle | Projection Pen | Projection Color | Projection Pattern
 *                     | Cut Pen        | Cut Color        | Cut Pattern
 *
 * Reads from `useBimRenderSettingsStore` (SSoT).
 * Writes via `setObjectStyleField`, `setObjectStyleVisibility`,
 *   `setObjectStyleVgColor`, `setObjectStyleVgPattern` (500ms debounce → Firestore).
 *
 * Priority stack: per-element > per-view (this panel) > global ObjectStyles > DEFAULT.
 */

import React, { useState, useCallback } from 'react';
import { ChevronDown, Eye, EyeOff, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { BIM_CATEGORIES, type BimCategory } from '../../../config/bim-object-styles';
import { BIM_LINE_PATTERNS, type LinePatternKey } from '../../../config/bim-line-patterns';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { UnifiedColorPicker } from '../../color/UnifiedColorPicker';

const PEN_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 1);

const PATTERN_OPTIONS: LinePatternKey[] = [
  'solid', 'dashed', 'dashed2', 'dotted', 'center', 'hidden', 'dashdot', 'phantom',
];

export const VisibilityGraphicsPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const [open, setOpen] = useState(false);

  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);
  const setObjectStyleField = useBimRenderSettingsStore((s) => s.setObjectStyleField);
  const setObjectStyleVisibility = useBimRenderSettingsStore((s) => s.setObjectStyleVisibility);
  const setObjectStyleVgColor = useBimRenderSettingsStore((s) => s.setObjectStyleVgColor);
  const setObjectStyleVgPattern = useBimRenderSettingsStore((s) => s.setObjectStyleVgPattern);
  const resetToDefaults = useBimRenderSettingsStore((s) => s.resetToDefaults);

  const handlePen = useCallback(
    (cat: BimCategory, key: 'projectionPen' | 'cutPen', v: string) => {
      const pen = parseInt(v, 10);
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
    setOpen(false);
  }, [resetToDefaults]);

  const hiddenCount = BIM_CATEGORIES.filter(
    (cat) => objectStyles[cat].visible === false,
  ).length;

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.visibilityGraphics.label')}
      </span>
      {/*
        ADR-375 v2.9: modal={false} + onInteractOutside preserve για nested
        EnterpriseColorDialog. Default modal={true} έβαζε Radix FocusScope
        contain που συγκρουόταν με το React Aria FocusScope του dialog →
        focusin/focusout recursion crash (browser freeze). Industry-standard
        Radix nested-overlay pattern: disable dropdown focus trap, preserve
        open state όταν click target = portaled dialog.
      */}
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.visibilityGraphics.openAriaLabel')}
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
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="p-2"
          style={{ minWidth: '640px' }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest('[role="dialog"]')) e.preventDefault();
          }}
        >
          {/* Header row */}
          <div className={`grid gap-x-1.5 gap-y-0.5 items-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-medium mb-1`}
            style={{ gridTemplateColumns: '100px 22px 44px 64px 56px 44px 64px 56px' }}>
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

          {/* Category rows */}
          {BIM_CATEGORIES.map((cat) => {
            const style = objectStyles[cat];
            const isHidden = style.visible === false;
            return (
              <div
                key={cat}
                className={`grid gap-x-1.5 gap-y-0.5 items-center py-0.5 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${isHidden ? colors.text.muted : colors.text.secondary}`}
                style={{ gridTemplateColumns: '100px 22px 44px 64px 56px 44px 64px 56px' }}
              >
                <span className="truncate font-medium">
                  {t(`ribbon.commands.objectStyles.categories.${cat}`)}
                </span>

                {/* Visibility toggle */}
                <button
                  onClick={() => handleVisibility(cat)}
                  aria-label={t('ribbon.commands.visibilityGraphics.toggleVisibility', { cat })}
                  aria-pressed={!isHidden}
                  className={`flex justify-center items-center w-5 h-5 rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                >
                  {isHidden
                    ? <EyeOff className="w-3 h-3 opacity-60" />
                    : <Eye className="w-3 h-3 opacity-80" />}
                </button>

                {/* Projection Pen */}
                <select
                  value={style.projectionPen}
                  onChange={(e) => handlePen(cat, 'projectionPen', e.target.value)}
                  disabled={isHidden}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.secondary} ${colors.text.inverted} rounded px-1 py-0.5 border-0 focus:outline-none font-mono`}
                >
                  {PEN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

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
                <select
                  value={style.projectionPattern ?? 'solid'}
                  onChange={(e) => handlePattern(cat, 'projectionPattern', e.target.value)}
                  disabled={isHidden}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.secondary} ${colors.text.inverted} rounded px-1 py-0.5 border-0 focus:outline-none`}
                >
                  {PATTERN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{t(`ribbon.commands.visibilityGraphics.patterns.${p}`)}</option>
                  ))}
                </select>

                {/* Cut Pen */}
                <select
                  value={style.cutPen}
                  onChange={(e) => handlePen(cat, 'cutPen', e.target.value)}
                  disabled={isHidden}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.secondary} ${colors.text.inverted} rounded px-1 py-0.5 border-0 focus:outline-none font-mono`}
                >
                  {PEN_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>

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
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t('ribbon.commands.visibilityGraphics.cutColorTitle')}</TooltipContent>
                </Tooltip>

                {/* Cut Pattern */}
                <select
                  value={style.cutPattern ?? 'solid'}
                  onChange={(e) => handlePattern(cat, 'cutPattern', e.target.value)}
                  disabled={isHidden}
                  className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.bg.secondary} ${colors.text.inverted} rounded px-1 py-0.5 border-0 focus:outline-none`}
                >
                  {PATTERN_OPTIONS.map((p) => (
                    <option key={p} value={p}>{t(`ribbon.commands.visibilityGraphics.patterns.${p}`)}</option>
                  ))}
                </select>
              </div>
            );
          })}

          <DropdownMenuSeparator className="my-2" />
          <button
            onClick={handleReset}
            aria-label={t('ribbon.commands.visibilityGraphics.resetAriaLabel')}
            className={`flex items-center gap-1.5 w-full ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
          >
            <RotateCcw className="w-3 h-3" />
            {t('ribbon.commands.visibilityGraphics.reset')}
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
