'use client';

/**
 * @module ui/panels/guide-panel/GuidePanel
 * @description Floating panel showing all guides and construction points with per-item actions.
 *
 * Pattern: CursorSettingsPanel (FloatingPanel ADR-084 compound component).
 * Position: Top-right, 320x480px, draggable.
 * Toggle: Toolbar button + keyboard chord G→L.
 *
 * @see ADR-189 §4.13 (Guide Panel UI)
 * @see CursorSettingsPanel.tsx (template)
 * @since 2026-02-21
 */

import React, { useCallback } from 'react';
import { Ruler, Eye, EyeOff, Trash2, Magnet } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PanelPositionCalculator, PANEL_LAYOUT } from '../../../config/panel-tokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n';
import { useGuideState } from '../../../hooks/state/useGuideState';
import { useConstructionPointState } from '../../../hooks/state/useConstructionPointState';
import { EventBus } from '../../../systems/events/EventBus';
import { usePromptDialog } from '../../../systems/prompt-dialog';
import { GuideListSection } from './GuideListSection';
import { ConstructionPointSection } from './ConstructionPointSection';

// ============================================================================
// PANEL DIMENSIONS
// ============================================================================

const GUIDE_PANEL_DIMENSIONS = {
  width: 320,
  height: 480,
} as const;

const SSR_FALLBACK_POSITION = { x: 100, y: 100 };

const getClientPosition = () => {
  return PanelPositionCalculator.getTopRightPosition(
    GUIDE_PANEL_DIMENSIONS.width,
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

interface GuidePanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const GuidePanel: React.FC<GuidePanelProps> = ({ isVisible, onClose }) => {
  const { t } = useTranslation('dxf-viewer');
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  // Guide state
  const {
    guides, guidesVisible, snapEnabled: guideSnapEnabled,
    removeGuide, toggleVisibility, toggleSnap, clearAll: clearAllGuides, getStore,
  } = useGuideState();

  // Construction point state
  const {
    points, pointCount, deletePoint, clearAll: clearAllPoints, getStore: getPointStore,
  } = useConstructionPointState();

  // Prompt dialog for label editing
  const { prompt } = usePromptDialog();

  // ── Guide actions ──

  const handleToggleGuideVisible = useCallback((guideId: string, visible: boolean) => {
    getStore().setGuideVisible(guideId, visible);
  }, [getStore]);

  const handleToggleGuideLock = useCallback((guideId: string, locked: boolean) => {
    getStore().setGuideLocked(guideId, locked);
  }, [getStore]);

  const handleDeleteGuide = useCallback((guideId: string) => {
    removeGuide(guideId);
  }, [removeGuide]);

  const handleHoverGuide = useCallback((guideId: string | null) => {
    EventBus.emit('grid:guide-panel-highlight', { guideId });
  }, []);

  const handleEditLabel = useCallback(async (guideId: string) => {
    const guide = getStore().getGuideById(guideId);
    if (!guide) return;

    const result = await prompt({
      title: t('guidePanel.editLabel'),
      label: t('guidePanel.editLabelMessage'),
      defaultValue: guide.label ?? '',
    });

    if (result !== null) {
      getStore().setGuideLabel(guideId, result.trim() || null);
    }
  }, [getStore, prompt, t]);

  // ── Construction point actions ──

  const handleDeletePoint = useCallback((pointId: string) => {
    deletePoint(pointId);
  }, [deletePoint]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    // Direct store call (same pattern as clearAll — not undoable for batch group delete)
    getPointStore().removePointsByGroupId(groupId);
  }, [getPointStore]);

  const handleHoverPoint = useCallback((pointId: string | null) => {
    EventBus.emit('grid:point-panel-highlight', { pointId });
  }, []);

  const handleTogglePointVisible = useCallback((pointId: string, visible: boolean) => {
    getPointStore().setPointVisible(pointId, visible);
  }, [getPointStore]);

  const handleTogglePointLock = useCallback((pointId: string, locked: boolean) => {
    getPointStore().setPointLocked(pointId, locked);
  }, [getPointStore]);

  const handleEditPointLabel = useCallback(async (pointId: string) => {
    const point = getPointStore().getPointById(pointId);
    if (!point) return;

    const result = await prompt({
      title: t('guidePanel.editLabel'),
      label: t('guidePanel.editLabelMessage'),
      defaultValue: point.label ?? '',
    });

    if (result !== null) {
      getPointStore().setPointLabel(pointId, result.trim() || null);
    }
  }, [getPointStore, prompt, t]);

  // ── Bulk actions ──

  const handleDeleteAllGuides = useCallback(() => {
    clearAllGuides();
  }, [clearAllGuides]);

  const handleDeleteAllPoints = useCallback(() => {
    clearAllPoints();
  }, [clearAllPoints]);

  if (!isVisible) return null;

  const guideCount = guides.length;
  const totalCount = guideCount + pointCount;

  return (
    <FloatingPanel
      defaultPosition={SSR_FALLBACK_POSITION}
      dimensions={GUIDE_PANEL_DIMENSIONS}
      onClose={onClose}
      isVisible={isVisible}
      className="w-[320px]"
      draggableOptions={{ getClientPosition }}
    >
      <FloatingPanel.Header
        title={t('guidePanel.title')}
        icon={<Ruler />}
      />
      <FloatingPanel.Content>
        <section className="space-y-3">
          {/* Global Actions Bar */}
          <nav className={`flex items-center ${PANEL_LAYOUT.GAP.XS} flex-wrap`}>
            {/* Toggle all visibility */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={guidesVisible ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={toggleVisibility}
                >
                  {guidesVisible ? <Eye className={iconSizes.xs} /> : <EyeOff className={iconSizes.xs} />}
                  <span className={`ml-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{t('guidePanel.toggleAll')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('guidePanel.toggleAll')}</TooltipContent>
            </Tooltip>

            {/* Snap toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={guideSnapEnabled ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7"
                  onClick={toggleSnap}
                >
                  <Magnet className={iconSizes.xs} />
                  <span className={`ml-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{t('guidePanel.snapToGuides')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('guidePanel.snapToGuides')}</TooltipContent>
            </Tooltip>

            {/* Delete all guides */}
            {guideCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={handleDeleteAllGuides}
                  >
                    <Trash2 className={iconSizes.xs} />
                    <span className={`ml-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{t('guidePanel.deleteAllGuides')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('guidePanel.deleteAllGuides')}</TooltipContent>
              </Tooltip>
            )}

            {/* Delete all points */}
            {pointCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-destructive"
                    onClick={handleDeleteAllPoints}
                  >
                    <Trash2 className={iconSizes.xs} />
                    <span className={`ml-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{t('guidePanel.deleteAllPoints')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('guidePanel.deleteAllPoints')}</TooltipContent>
              </Tooltip>
            )}
          </nav>

          {/* Empty state */}
          {totalCount === 0 && (
            <p className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} text-center py-6`}>
              {t('guidePanel.empty')}
            </p>
          )}

          {/* Guide list */}
          <GuideListSection
            guides={guides}
            onToggleVisible={handleToggleGuideVisible}
            onToggleLock={handleToggleGuideLock}
            onDelete={handleDeleteGuide}
            onHover={handleHoverGuide}
            onEditLabel={handleEditLabel}
            t={t}
          />

          {/* Construction points */}
          <ConstructionPointSection
            points={points}
            onDeletePoint={handleDeletePoint}
            onDeleteGroup={handleDeleteGroup}
            onHoverPoint={handleHoverPoint}
            onTogglePointVisible={handleTogglePointVisible}
            onTogglePointLock={handleTogglePointLock}
            onEditPointLabel={handleEditPointLabel}
            t={t}
          />

          {/* Footer stats */}
          {totalCount > 0 && (
            <footer className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} text-center pt-2 border-t border-border`}>
              {t('guidePanel.stats', { guideCount, pointCount })}
            </footer>
          )}
        </section>
      </FloatingPanel.Content>
    </FloatingPanel>
  );
};
