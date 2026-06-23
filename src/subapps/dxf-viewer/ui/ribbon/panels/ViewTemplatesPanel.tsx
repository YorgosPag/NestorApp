'use client';

/**
 * ADR-375 Phase B.3 — View Templates Panel.
 *
 * Ribbon widget that exposes the tenant's BIM View Templates library
 * (Revit Level 2: reusable presets of drawingScale + viewRange + objectStyles).
 *
 * Surface:
 *   - Trigger shows applied template name (or "—") for the current level.
 *   - Dropdown lists templates with [Apply] / [Update] / [Delete] per row.
 *   - "Save current as template…" footer with name input.
 *   - "Detach from template" appears when the current level is linked.
 *
 * Data flow:
 *   - Templates list:    `useViewTemplateStore` (Firestore subscription, ADR-355).
 *   - Current settings:  `useBimRenderSettingsStore` (Phase B.2 SSoT).
 *   - Levels / FK:       `useLevels()` (current level resolves
 *                        `appliedViewTemplateId`; linked count is computed
 *                        across all levels for cross-level edit fan-out).
 *
 * Mutations go through `view-template.service.ts`; level FK + bimRenderSettings
 * writes route through `updateDxfLevelWithPolicy` (ADR-286).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Check, Plus, Trash2, RefreshCw, Link2Off } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/RibbonTooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useAuth } from '@/auth/hooks/useAuth';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useBimRenderSettingsStore } from '../../../state/bim-render-settings-store';
import { useViewTemplateStore } from '../../../state/view-template-store';
import { useLevels } from '../../../systems/levels';
import {
  applyViewTemplate,
  createViewTemplate,
  deleteViewTemplate,
  detachViewTemplate,
  propagateToLinkedLevels,
  updateViewTemplate,
} from '../../../services/view-template.service';
import type { BimRenderSettings } from '../../../config/bim-render-settings-types';
import type { ViewTemplate } from '../../../config/view-template-types';

function buildSnapshot(
  drawingScale: number,
  viewRange: BimRenderSettings['viewRange'],
  objectStyles: BimRenderSettings['objectStyles'],
): BimRenderSettings {
  return { drawingScale, viewRange, objectStyles };
}

export const ViewTemplatesPanel: React.FC = () => {
  const { t } = useTranslation('dxf-viewer-shell');
  const colors = useSemanticColors();
  const { getStatusBorder, getFocusBorder } = useBorderTokens();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const { user } = useAuth();
  const companyId = user?.companyId ?? null;
  const userId = user?.uid ?? null;

  const { levels, currentLevelId } = useLevels();
  const currentLevel = useMemo(
    () => levels.find((l) => l.id === currentLevelId) ?? null,
    [levels, currentLevelId],
  );
  const appliedTemplateId = currentLevel?.appliedViewTemplateId ?? null;

  const drawingScale = useBimRenderSettingsStore((s) => s.drawingScale);
  const viewRange = useBimRenderSettingsStore((s) => s.viewRange);
  const objectStyles = useBimRenderSettingsStore((s) => s.objectStyles);

  const templates = useViewTemplateStore((s) => s.templates);
  const subscribe = useViewTemplateStore((s) => s.subscribe);
  const unsubscribeAll = useViewTemplateStore((s) => s.unsubscribeAll);

  // Mount-once subscription; unmount tears it down.
  useEffect(() => {
    if (!companyId) return;
    subscribe();
    return () => unsubscribeAll();
  }, [companyId, subscribe, unsubscribeAll]);

  const appliedName = useMemo(() => {
    if (!appliedTemplateId) return null;
    return templates.find((tpl) => tpl.id === appliedTemplateId)?.name ?? null;
  }, [appliedTemplateId, templates]);

  const linkedCount = useCallback(
    (templateId: string) =>
      levels.filter((l) => l.appliedViewTemplateId === templateId).length,
    [levels],
  );

  const handleApply = useCallback(
    async (template: ViewTemplate) => {
      if (!currentLevelId) return;
      await applyViewTemplate({ templateId: template.id, levelId: currentLevelId }, template);
      setOpen(false);
    },
    [currentLevelId],
  );

  const handleDetach = useCallback(async () => {
    if (!currentLevelId) return;
    await detachViewTemplate({ levelId: currentLevelId });
    setOpen(false);
  }, [currentLevelId]);

  const handleUpdate = useCallback(
    async (template: ViewTemplate) => {
      const snapshot = buildSnapshot(drawingScale, viewRange, objectStyles);
      await updateViewTemplate({ templateId: template.id, settings: snapshot });
      // Fan-out to every level still linked via FK so they pick up the new
      // settings (snapshot-copy model, locked decision #3).
      await propagateToLinkedLevels({ ...template, settings: snapshot }, levels);
    },
    [drawingScale, viewRange, objectStyles, levels],
  );

  const handleDelete = useCallback(async (template: ViewTemplate) => {
    await deleteViewTemplate(template.id);
  }, []);

  const handleSaveAs = useCallback(async () => {
    const trimmed = newName.trim();
    if (!trimmed || !companyId || !userId) return;
    const snapshot = buildSnapshot(drawingScale, viewRange, objectStyles);
    const created = await createViewTemplate(
      { name: trimmed, settings: snapshot },
      { companyId, userId },
    );
    if (currentLevelId) {
      await applyViewTemplate(
        { templateId: created.id, levelId: currentLevelId },
        created,
      );
    }
    setNewName('');
  }, [newName, companyId, userId, drawingScale, viewRange, objectStyles, currentLevelId]);

  const triggerLabel = appliedName ?? t('ribbon.commands.viewTemplates.none');

  return (
    <span className="dxf-ribbon-combobox-row">
      <span className="dxf-ribbon-combobox-label">
        {t('ribbon.commands.viewTemplates.label')}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t('ribbon.commands.viewTemplates.label')}
            className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT} ${colors.bg.backgroundSecondary} ${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS} select-none max-w-[12rem]`}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80 p-2">
          {templates.length === 0 ? (
            <p className={`px-2 py-3 text-center ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
              {t('ribbon.commands.viewTemplates.empty')}
            </p>
          ) : (
            <ul className="space-y-1">
              {templates.map((tpl) => {
                const isApplied = tpl.id === appliedTemplateId;
                const count = linkedCount(tpl.id);
                return (
                  <li
                    key={tpl.id}
                    className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded ${isApplied ? colors.bg.accent : ''}`}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`flex-1 truncate ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary}`}
                        >
                          {tpl.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>{tpl.name}</TooltipContent>
                    </Tooltip>
                    {count > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} font-mono px-1`}
                          >
                            ×{count}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('ribbon.commands.viewTemplates.linkedCount', { count })}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <button
                      type="button"
                      aria-label={t('ribbon.commands.viewTemplates.applyAriaLabel', { name: tpl.name })}
                      onClick={() => void handleApply(tpl)}
                      disabled={!currentLevelId || isApplied}
                      className={`${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} disabled:opacity-40 ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('ribbon.commands.viewTemplates.updateAriaLabel', { name: tpl.name })}
                      onClick={() => void handleUpdate(tpl)}
                      className={`${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={t('ribbon.commands.viewTemplates.deleteAriaLabel', { name: tpl.name })}
                      onClick={() => void handleDelete(tpl)}
                      className={`${PANEL_LAYOUT.SPACING.COMPACT_XS} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {appliedTemplateId && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <button
                type="button"
                onClick={() => void handleDetach()}
                className={`flex items-center gap-1.5 w-full ${PANEL_LAYOUT.SPACING.COMPACT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} ${PANEL_LAYOUT.TRANSITION.COLORS}`}
              >
                <Link2Off className="w-3 h-3" />
                {t('ribbon.commands.viewTemplates.detach')}
              </button>
            </>
          )}

          <DropdownMenuSeparator className="my-2" />
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('ribbon.commands.viewTemplates.namePlaceholder')}
              aria-label={t('ribbon.commands.viewTemplates.namePlaceholder')}
              className={`flex-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS} rounded ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${colors.bg.secondary} ${getStatusBorder('muted')} ${colors.text.inverted} ${getFocusBorder('input')} focus:outline-none`}
            />
            <button
              type="button"
              onClick={() => void handleSaveAs()}
              disabled={!newName.trim() || !companyId || !userId}
              aria-label={t('ribbon.commands.viewTemplates.saveAs')}
              className={`flex items-center gap-1 ${PANEL_LAYOUT.SPACING.COMPACT_XS} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.secondary} rounded ${HOVER_BACKGROUND_EFFECTS.MUTED} disabled:opacity-40 ${PANEL_LAYOUT.TRANSITION.COLORS}`}
            >
              <Plus className="w-3 h-3" />
              {t('ribbon.commands.viewTemplates.saveAs')}
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
};
