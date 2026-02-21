'use client';

/**
 * @module ui/panels/guide-panel/ConstructionPointSection
 * @description Construction point list grouped by groupId with delete actions.
 *
 * @see ADR-189 §4.13 (Guide Panel UI)
 * @since 2026-02-21
 */

import React, { useMemo, useCallback } from 'react';
import { Trash2, Eye, EyeOff, Lock, Unlock, Pencil } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import type { ConstructionPoint } from '../../../systems/guides/guide-types';
import type { TFunction } from 'i18next';

// ============================================================================
// TYPES
// ============================================================================

interface ConstructionPointSectionProps {
  points: readonly ConstructionPoint[];
  onDeletePoint: (pointId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onHoverPoint: (pointId: string | null) => void;
  onTogglePointVisible: (pointId: string, visible: boolean) => void;
  onTogglePointLock: (pointId: string, locked: boolean) => void;
  onEditPointLabel: (pointId: string) => void;
  t: TFunction;
}

interface PointGroup {
  groupId: string | null;
  label: string;
  points: ConstructionPoint[];
}

// ============================================================================
// POINT ITEM
// ============================================================================

const PointItem = React.memo<{
  point: ConstructionPoint;
  onDelete: (pointId: string) => void;
  onHover: (pointId: string | null) => void;
  onToggleVisible: (pointId: string, visible: boolean) => void;
  onToggleLock: (pointId: string, locked: boolean) => void;
  onEditLabel: (pointId: string) => void;
  t: TFunction;
}>(({ point, onDelete, onHover, onToggleVisible, onToggleLock, onEditLabel, t }) => {
  const iconSizes = useIconSizes();

  const handleMouseEnter = useCallback(() => onHover(point.id), [point.id, onHover]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);

  return (
    <li
      className={`flex items-center ${PANEL_LAYOUT.GAP.XS} ${PANEL_LAYOUT.SPACING.XS} rounded hover:bg-accent/50 group`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className={`flex-1 ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_FAMILY.CODE} truncate ${!point.visible ? 'opacity-40' : ''}`}>
        ({point.point.x.toFixed(1)}, {point.point.y.toFixed(1)})
        {point.label && <span className="ml-1 opacity-60">— {point.label}</span>}
      </span>

      {/* Action buttons (visible on hover) */}
      <nav className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onEditLabel(point.id)}>
              <Pencil className={iconSizes.xs} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guidePanel.editLabel')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onToggleVisible(point.id, !point.visible)}>
              {point.visible
                ? <Eye className={iconSizes.xs} />
                : <EyeOff className={`${iconSizes.xs} opacity-40`} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{point.visible ? t('guidePanel.hide') : t('guidePanel.show')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => onToggleLock(point.id, !point.locked)}>
              {point.locked
                ? <Lock className={`${iconSizes.xs} text-amber-500`} />
                : <Unlock className={iconSizes.xs} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{point.locked ? t('guidePanel.unlock') : t('guidePanel.lock')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              disabled={point.locked}
              onClick={() => onDelete(point.id)}
            >
              <Trash2 className={`${iconSizes.xs} ${point.locked ? 'opacity-20' : 'text-destructive'}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guidePanel.delete')}</TooltipContent>
        </Tooltip>
      </nav>
    </li>
  );
});
PointItem.displayName = 'PointItem';

// ============================================================================
// CONSTRUCTION POINT SECTION
// ============================================================================

export const ConstructionPointSection: React.FC<ConstructionPointSectionProps> = ({
  points, onDeletePoint, onDeleteGroup, onHoverPoint, onTogglePointVisible, onTogglePointLock, onEditPointLabel, t,
}) => {
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();

  const groups = useMemo<PointGroup[]>(() => {
    const map = new Map<string | null, ConstructionPoint[]>();
    for (const pt of points) {
      const key = pt.groupId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pt);
    }

    const result: PointGroup[] = [];
    for (const [groupId, pts] of map) {
      result.push({
        groupId,
        label: groupId ?? t('guidePanel.individualPoints'),
        points: pts,
      });
    }
    return result;
  }, [points, t]);

  if (points.length === 0) return null;

  return (
    <section>
      {groups.map((group) => (
        <Collapsible key={group.groupId ?? '__individual'} defaultOpen>
          <CollapsibleTrigger className={`flex items-center ${PANEL_LAYOUT.GAP.XS} w-full ${PANEL_LAYOUT.SPACING.XS} hover:bg-accent/30 rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary}`}>
            <span className="inline-block w-2 h-2 rounded-full shrink-0 bg-amber-400" />
            <span className="flex-1 text-left truncate">{group.label}</span>
            <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>({group.points.length})</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className={PANEL_LAYOUT.MARGIN.LEFT_SM}>
              {group.points.map(pt => (
                <PointItem
                  key={pt.id}
                  point={pt}
                  onDelete={onDeletePoint}
                  onHover={onHoverPoint}
                  onToggleVisible={onTogglePointVisible}
                  onToggleLock={onTogglePointLock}
                  onEditLabel={onEditPointLabel}
                  t={t}
                />
              ))}
            </ul>
            {/* Delete entire group button */}
            {group.groupId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${PANEL_LAYOUT.MARGIN.LEFT_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS} h-6 text-destructive`}
                    onClick={() => onDeleteGroup(group.groupId!)}
                  >
                    <Trash2 className={`${iconSizes.xs} mr-1`} />
                    {t('guidePanel.deleteGroup')}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('guidePanel.deleteGroup')}</TooltipContent>
              </Tooltip>
            )}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </section>
  );
};
