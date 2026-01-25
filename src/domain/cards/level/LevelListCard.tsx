// 🌐 i18n: All labels converted to i18n keys - 2026-01-25
'use client';

/**
 * 🏢 ENTERPRISE LEVEL LIST CARD - Domain Component
 *
 * Domain-specific card for DXF Viewer floor levels in list views.
 * Extends ListCard with level-specific defaults and stats.
 *
 * @fileoverview Level domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @see src/subapps/dxf-viewer/systems/levels/config.ts for Level types
 * @author Enterprise Architecture Team
 * @since 2026-01-25
 */

import React, { useMemo } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 Action icons
import { Edit, Trash2, Layers } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized action icon colors
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem, ListCardAction } from '@/design-system';

// 🏢 DOMAIN TYPES - Level from DXF Viewer
import type { Level } from '@/subapps/dxf-viewer/systems/levels/config';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface LevelListCardProps {
  /** Level data from DXF Viewer */
  level: Level;
  /** Number of entities in this level's scene */
  entityCount?: number;
  /** Whether card is selected (current level) */
  isSelected?: boolean;
  /** Whether this is the only level (prevents delete) */
  isOnlyLevel?: boolean;
  /** Click handler - select this level */
  onSelect?: () => void;
  /** Edit/Rename handler */
  onEdit?: (event: React.MouseEvent) => void;
  /** Delete handler */
  onDelete?: (event: React.MouseEvent) => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🏢 LevelListCard Component
 *
 * Domain-specific card for DXF Viewer floor levels.
 * Uses ListCard with level defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <LevelListCard
 *   level={level}
 *   entityCount={scene?.entities?.length || 0}
 *   isSelected={currentLevelId === level.id}
 *   isOnlyLevel={levels.length === 1}
 *   onSelect={() => setCurrentLevel(level.id)}
 *   onEdit={(e) => startEditing(level)}
 *   onDelete={(e) => handleDeleteLevel(level.id)}
 * />
 * ```
 */
export function LevelListCard({
  level,
  entityCount = 0,
  isSelected = false,
  isOnlyLevel = false,
  onSelect,
  onEdit,
  onDelete,
  compact = false,
  className,
}: LevelListCardProps) {
  const { t } = useTranslation('dxf-viewer');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /**
   * 🏢 Build stats array for level info
   */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Entity count with layer icon
    items.push({
      icon: Layers,
      iconColor: entityCount > 0 ? NAVIGATION_ENTITIES.building.color : 'text-slate-400',
      label: t('levelCard.stats.elements'),
      value: entityCount > 0
        ? t('panels.levels.elementsCount', { count: entityCount })
        : t('panels.levels.emptyLevel'),
    });

    return items;
  }, [entityCount, t]);

  /**
   * 🏢 Build badges from level properties
   */
  const badges = useMemo(() => {
    const items: Array<{ label: string; variant: 'default' | 'secondary' | 'info' }> = [];

    // Default level badge
    if (level.isDefault) {
      items.push({
        label: t('levelCard.badges.default'),
        variant: 'info',
      });
    }

    return items;
  }, [level.isDefault, t]);

  /**
   * 🏢 Build actions array for ListCard
   * Actions: Edit (Rename), Delete
   */
  const actions = useMemo<ListCardAction[]>(() => {
    const items: ListCardAction[] = [];

    // Edit/Rename action - 🏢 ENTERPRISE: Centralized BLUE color
    if (onEdit) {
      items.push({
        id: 'edit',
        label: t('panels.levels.renameLevel'),
        icon: Edit,
        onClick: onEdit,
        className: HOVER_TEXT_EFFECTS.BLUE,
      });
    }

    // Delete action (only if not the only level) - 🏢 ENTERPRISE: Centralized RED color
    if (onDelete && !isOnlyLevel) {
      items.push({
        id: 'delete',
        label: t('panels.levels.deleteLevel'),
        icon: Trash2,
        onClick: onDelete,
        className: HOVER_TEXT_EFFECTS.RED,
      });
    }

    return items;
  }, [onEdit, onDelete, isOnlyLevel, t]);

  // ==========================================================================
  // 🏢 HANDLERS
  // ==========================================================================

  const handleClick = () => {
    onSelect?.();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <ListCard
      entityType="building"
      title={level.name}
      badges={badges}
      stats={stats}
      actions={actions}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      compact={true}
      hideStats={false}
      inlineBadges={true}
      hideIcon={true} // Hide icon to keep it minimal like current design
      className={className}
      aria-label={t('levelCard.ariaLabel', { name: level.name })}
    />
  );
}

LevelListCard.displayName = 'LevelListCard';

export default LevelListCard;
