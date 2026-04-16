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
import { Edit, Trash2, Layers, X } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized action icon colors
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem, ListCardAction } from '@/design-system';

// 🏢 DOMAIN TYPES - Level from DXF Viewer
import type { Level } from '@/subapps/dxf-viewer/systems/levels/config';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ENTITY_TYPES } from '@/config/domain-constants';
import '@/lib/design-system';

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
  /** Delete handler (with confirmation — trashes floorplan file) */
  onDelete?: (event: React.MouseEvent) => void;
  /** Close handler (unloads floorplan from canvas without trashing file) */
  onClose?: (event: React.MouseEvent) => void;
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
  onClose,
  compact = false,
  className,
}: LevelListCardProps) {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /**
   * ADR-309 Phase 3: Context-aware title based on floorplanType + entityLabel.
   * Falls back to level.name for legacy levels without context.
   */
  const contextTitle = useMemo<string>(() => {
    if (!level.floorplanType || !level.entityLabel) return level.name;
    switch (level.floorplanType) {
      case 'project':  return t('levelCard.title.project',  { label: level.entityLabel });
      case 'building': return t('levelCard.title.building', { label: level.entityLabel });
      case 'floor':    return t('levelCard.title.floor',    { label: level.entityLabel });
      case 'unit':     return t('levelCard.title.unit',     { label: level.entityLabel });
      default:         return level.name;
    }
  }, [level.floorplanType, level.entityLabel, level.name, t]);

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

    // Close action — unloads floorplan from canvas without trashing file
    if (onClose) {
      items.push({
        id: 'close',
        label: t('panels.levels.closeLevel'),
        icon: X,
        onClick: onClose,
        className: HOVER_TEXT_EFFECTS.BLUE,
      });
    }

    return items;
  }, [onEdit, onDelete, onClose, isOnlyLevel, t]);

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
      entityType={ENTITY_TYPES.BUILDING}
      title={contextTitle}
      badges={badges}
      stats={stats}
      actions={actions}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      compact
      hideStats={false}
      inlineBadges
      hideIcon // Hide icon to keep it minimal like current design
      className={className}
      aria-label={t('levelCard.ariaLabel', { name: contextTitle })}
    />
  );
}

LevelListCard.displayName = 'LevelListCard';

export default LevelListCard;
