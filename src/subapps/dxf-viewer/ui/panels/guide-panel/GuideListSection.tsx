'use client';

/**
 * @module ui/panels/guide-panel/GuideListSection
 * @description Guide list with B7 group support — grouped guides first, then ungrouped by axis.
 *
 * @see ADR-189 §4.13 (Guide Panel UI)
 * @see ADR-189 §4.3 B7 (Guide Groups)
 * @since 2026-02-21
 */

import React, { useMemo, useCallback } from 'react';
import { Eye, EyeOff, Lock, Unlock, Trash2, Pencil, FolderOpen } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { PANEL_LAYOUT } from '../../../config/panel-tokens';
import { GUIDE_COLORS, isDiagonalGuide } from '../../../systems/guides/guide-types';
import type { Guide, GuideGroup, GridAxis } from '../../../systems/guides/guide-types';
import type { TFunction } from 'i18next';

// ============================================================================
// TYPES
// ============================================================================

interface GuideListSectionProps {
  guides: readonly Guide[];
  groups: readonly GuideGroup[];
  onToggleVisible: (guideId: string, visible: boolean) => void;
  onToggleLock: (guideId: string, locked: boolean) => void;
  onDelete: (guideId: string) => void;
  onHover: (guideId: string | null) => void;
  onEditLabel: (guideId: string) => void;
  /** B7: Group-level actions */
  onToggleGroupVisible: (groupId: string, visible: boolean) => void;
  onToggleGroupLock: (groupId: string, locked: boolean) => void;
  onDeleteGroup: (groupId: string) => void;
  onRenameGroup: (groupId: string) => void;
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
// B7: GROUP HEADER (with group-level actions)
// ============================================================================

interface GroupHeaderProps {
  group: GuideGroup;
  memberCount: number;
  onToggleVisible: (groupId: string, visible: boolean) => void;
  onToggleLock: (groupId: string, locked: boolean) => void;
  onDelete: (groupId: string) => void;
  onRename: (groupId: string) => void;
  t: TFunction;
}

const GroupHeader = React.memo<GroupHeaderProps>(({
  group, memberCount, onToggleVisible, onToggleLock, onDelete, onRename, t,
}) => {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  return (
    <CollapsibleTrigger className={`flex items-center ${PANEL_LAYOUT.GAP.XS} w-full ${PANEL_LAYOUT.SPACING.XS} hover:bg-accent/30 rounded ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.secondary} group/grp`}>
      <FolderOpen className="w-3.5 h-3.5 shrink-0" style={{ color: group.color }} />
      <span className={`flex-1 text-left truncate ${!group.visible ? 'opacity-40' : ''}`}>{group.name}</span>
      <span className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>({memberCount})</span>

      {/* Group-level action buttons */}
      <nav className="flex items-center opacity-0 group-hover/grp:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onRename(group.id)}>
              <Pencil className={iconSizes.xs} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guideGroups.rename')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onToggleVisible(group.id, !group.visible)}>
              {group.visible
                ? <Eye className={iconSizes.xs} />
                : <EyeOff className={`${iconSizes.xs} opacity-40`} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{group.visible ? t('guidePanel.hide') : t('guidePanel.show')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onToggleLock(group.id, !group.locked)}>
              {group.locked
                ? <Lock className={`${iconSizes.xs} text-amber-500`} />
                : <Unlock className={iconSizes.xs} />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{group.locked ? t('guidePanel.unlock') : t('guidePanel.lock')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => onDelete(group.id)}>
              <Trash2 className={`${iconSizes.xs} text-destructive`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('guideGroups.deleteGroup')}</TooltipContent>
        </Tooltip>
      </nav>
    </CollapsibleTrigger>
  );
});
GroupHeader.displayName = 'GroupHeader';

// ============================================================================
// GUIDE LIST SECTION
// ============================================================================

export const GuideListSection: React.FC<GuideListSectionProps> = ({
  guides, groups,
  onToggleVisible, onToggleLock, onDelete, onHover, onEditLabel,
  onToggleGroupVisible, onToggleGroupLock, onDeleteGroup, onRenameGroup,
  t,
}) => {
  const colors = useSemanticColors();

  // Separate grouped vs ungrouped guides
  const { groupedByGroup, ungrouped } = useMemo(() => {
    const byGroup = new Map<string, Guide[]>();
    const noGroup: Guide[] = [];

    for (const guide of guides) {
      if (guide.groupId) {
        if (!byGroup.has(guide.groupId)) byGroup.set(guide.groupId, []);
        byGroup.get(guide.groupId)!.push(guide);
      } else {
        noGroup.push(guide);
      }
    }

    return { groupedByGroup: byGroup, ungrouped: noGroup };
  }, [guides]);

  // Ungrouped guides by axis (original view)
  const ungroupedByAxis = useMemo<GroupedGuides>(() => {
    const result: GroupedGuides = { x: [], y: [], xz: [] };
    for (const guide of ungrouped) {
      const key = guide.axis.toLowerCase() as keyof GroupedGuides;
      if (key in result) {
        result[key].push(guide);
      }
    }
    return result;
  }, [ungrouped]);

  if (guides.length === 0) return null;

  return (
    <section>
      {/* B7: Named groups first */}
      {groups.map((group) => {
        const memberGuides = groupedByGroup.get(group.id) ?? [];
        if (memberGuides.length === 0) return null;

        return (
          <Collapsible key={group.id} defaultOpen>
            <GroupHeader
              group={group}
              memberCount={memberGuides.length}
              onToggleVisible={onToggleGroupVisible}
              onToggleLock={onToggleGroupLock}
              onDelete={onDeleteGroup}
              onRename={onRenameGroup}
              t={t}
            />
            <CollapsibleContent>
              <ul className={PANEL_LAYOUT.MARGIN.LEFT_SM}>
                {memberGuides.map(guide => (
                  <GuideItem
                    key={guide.id}
                    guide={guide}
                    onToggleVisible={onToggleVisible}
                    onToggleLock={onToggleLock}
                    onDelete={onDelete}
                    onHover={onHover}
                    onEditLabel={onEditLabel}
                    color={guide.style?.color ?? group.color}
                    t={t}
                  />
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        );
      })}

      {/* Ungrouped guides by axis (original view) */}
      {AXIS_GROUPS.map(({ key, colorKey, i18nKey }) => {
        const groupGuides = ungroupedByAxis[key];
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
