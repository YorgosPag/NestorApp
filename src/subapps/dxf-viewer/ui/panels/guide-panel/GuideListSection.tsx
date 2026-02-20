'use client';

/**
 * @module ui/panels/guide-panel/GuideListSection
 * @description Guide list grouped by axis (X, Y, XZ) with per-item actions.
 *
 * @see ADR-189 §4.13 (Guide Panel UI)
 * @since 2026-02-21
 */

import React, { useMemo, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Pencil } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { GUIDE_COLORS, isDiagonalGuide } from '../../../systems/guides/guide-types';
import type { Guide, GridAxis } from '../../../systems/guides/guide-types';
import type { TFunction } from 'i18next';

// ============================================================================
// TYPES
// ============================================================================

interface GuideListSectionProps {
  guides: readonly Guide[];
  onToggleVisible: (guideId: string, visible: boolean) => void;
  onToggleLock: (guideId: string, locked: boolean) => void;
  onDelete: (guideId: string) => void;
  onHover: (guideId: string | null) => void;
  onEditLabel: (guideId: string) => void;
  t: TFunction;
}

interface GroupedGuides {
  x: Guide[];
  y: Guide[];
  xz: Guide[];
}

// ============================================================================
// AXIS GROUP CONFIG
// ============================================================================

const AXIS_GROUPS: Array<{ key: keyof GroupedGuides; axis: GridAxis; colorKey: keyof typeof GUIDE_COLORS; i18nKey: string }> = [
  { key: 'x', axis: 'X', colorKey: 'X', i18nKey: 'xGuides' },
  { key: 'y', axis: 'Y', colorKey: 'Y', i18nKey: 'yGuides' },
  { key: 'xz', axis: 'XZ', colorKey: 'XZ', i18nKey: 'xzGuides' },
];

// ============================================================================
// GUIDE ITEM
// ============================================================================

interface GuideItemProps {
  guide: Guide;
  onToggleVisible: (guideId: string, visible: boolean) => void;
  onToggleLock: (guideId: string, locked: boolean) => void;
  onDelete: (guideId: string) => void;
  onHover: (guideId: string | null) => void;
  onEditLabel: (guideId: string) => void;
  color: string;
  t: TFunction;
}

const GuideItem = React.memo<GuideItemProps>(({
  guide, onToggleVisible, onToggleLock, onDelete, onHover, onEditLabel, color, t,
}) => {
  const iconSizes = useIconSizes();

  const displayText = useMemo(() => {
    if (guide.label) return guide.label;
    if (isDiagonalGuide(guide)) {
      return `(${guide.startPoint.x.toFixed(0)}, ${guide.startPoint.y.toFixed(0)}) → (${guide.endPoint.x.toFixed(0)}, ${guide.endPoint.y.toFixed(0)})`;
    }
    return `${guide.axis} = ${guide.offset.toFixed(1)}`;
  }, [guide]);

  const handleMouseEnter = useCallback(() => onHover(guide.id), [guide.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  return (
    <li
      className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.XS} rounded hover:bg-accent/50 group`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Color dot */}
      <span
        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Label / offset */}
      <span className={`flex-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.CODE} truncate ${!guide.visible ? 'opacity-40' : ''}`}>
        {displayText}
      </span>

      {/* Action buttons (visible on hover) */}
      <nav className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditLabel(guide.id)}>
              <Pencil className={iconSizes.xs} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guidePanel.editLabel')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onToggleVisible(guide.id, !guide.visible)}>
              {guide.visible
                ? <Eye className={iconSizes.xs} />
                : <EyeOff className={`${iconSizes.xs} opacity-40`} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{guide.visible ? t('guidePanel.hide') : t('guidePanel.show')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onToggleLock(guide.id, !guide.locked)}>
              {guide.locked
                ? <Lock className={`${iconSizes.xs} text-amber-500`} />
                : <Unlock className={iconSizes.xs} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{guide.locked ? t('guidePanel.unlock') : t('guidePanel.lock')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={guide.locked}
              onClick={() => onDelete(guide.id)}
            >
              <Trash2 className={`${iconSizes.xs} ${guide.locked ? 'opacity-20' : 'text-destructive'}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guidePanel.delete')}</TooltipContent>
        </Tooltip>
      </nav>
    </li>
  );
});
GuideItem.displayName = 'GuideItem';

// ============================================================================
// GUIDE LIST SECTION
// ============================================================================

export const GuideListSection: React.FC<GuideListSectionProps> = ({
  guides, onToggleVisible, onToggleLock, onDelete, onHover, onEditLabel, t,
}) => {
  const colors = useSemanticColors();

  const grouped = useMemo<GroupedGuides>(() => {
    const result: GroupedGuides = { x: [], y: [], xz: [] };
    for (const guide of guides) {
      const key = guide.axis.toLowerCase() as keyof GroupedGuides;
      if (key in result) {
        result[key].push(guide);
      }
    }
    return result;
  }, [guides]);

  if (guides.length === 0) return null;

  return (
    <section>
      {AXIS_GROUPS.map(({ key, colorKey, i18nKey }) => {
        const groupGuides = grouped[key];
        if (groupGuides.length === 0) return null;

        const color = GUIDE_COLORS[colorKey];

        return (
          <Collapsible key={key} defaultOpen>
            <CollapsibleTrigger className={`flex items-center ${PANEL_LAYOUT.GAP.XS} w-full ${PANEL_LAYOUT.SPACING.XS} hover:bg-accent/30 rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary}`}>
              <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="flex-1 text-left">{t(`guidePanel.${i18nKey}`)}</span>
              <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>({groupGuides.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className={`${PANEL_LAYOUT.MARGIN.LEFT_SM}`}>
                {groupGuides.map(guide => (
                  <GuideItem
                    key={guide.id}
                    guide={guide}
                    onToggleVisible={onToggleVisible}
                    onToggleLock={onToggleLock}
                    onDelete={onDelete}
                    onHover={onHover}
                    onEditLabel={onEditLabel}
                    color={color}
                    t={t}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </section>
  );
};
