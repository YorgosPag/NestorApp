// 🌐 i18n: All labels converted to i18n keys - 2026-01-25
'use client';

/**
 * 🗺️ ENTERPRISE OVERLAY LIST CARD - Domain Component
 *
 * Domain-specific card for DXF Viewer overlays (regions/areas) in list views.
 * Extends ListCard with overlay-specific defaults and stats.
 *
 * @fileoverview Overlay domain card using centralized ListCard.
 * @enterprise Fortune 500 compliant - ZERO hardcoded values
 * @see ListCard for base component
 * @see NAVIGATION_ENTITIES for entity config
 * @see src/subapps/dxf-viewer/overlays/types.ts for Overlay types
 * @author Enterprise Architecture Team
 * @since 2026-01-25
 */

import React, { useMemo, forwardRef } from 'react';
// 🏢 ENTERPRISE: All icons from centralized NAVIGATION_ENTITIES
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
// 🏢 PHASE 1: Additional icons (not in NAVIGATION_ENTITIES yet)
import { Maximize2, Link2, Footprints, Eye, EyeOff, Edit, Trash2 } from 'lucide-react';
// 🏢 ENTERPRISE: Centralized action icon colors
import { HOVER_TEXT_EFFECTS } from '@/components/ui/effects';

// 🏢 DESIGN SYSTEM
import { ListCard } from '@/design-system';
import type { StatItem, ListCardAction } from '@/design-system';

// 🏢 CENTRALIZED FORMATTERS
import { formatNumber } from '@/lib/intl-utils';

// 🏢 DOMAIN TYPES - Overlay from DXF Viewer
import type { Overlay, OverlayKind, Status } from '@/subapps/dxf-viewer/overlays/types';

// 🏢 BADGE VARIANT MAPPING
import type { ListCardBadgeVariant } from '@/design-system/components/ListCard/ListCard.types';
import type { NavigationEntityType } from '@/components/navigation/config/navigation-entities';

// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// 🏢 TYPES
// =============================================================================

export interface OverlayListCardProps {
  /** Overlay data from DXF Viewer */
  overlay: Overlay;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Whether overlay is visible on canvas */
  isVisible?: boolean;
  /** Click handler */
  onSelect?: () => void;
  /** Visibility toggle handler */
  onToggleVisibility?: (event: React.MouseEvent) => void;
  /** Edit handler */
  onEdit?: (event: React.MouseEvent) => void;
  /** Delete handler */
  onDelete?: (event: React.MouseEvent) => void;
  /** Compact mode */
  compact?: boolean;
  /** Additional className */
  className?: string;
}

// =============================================================================
// 🏢 STATUS TO BADGE VARIANT MAPPING (Sales/Rental Status)
// =============================================================================

/**
 * ✅ DOMAIN SEPARATION: Property status mapping for overlays
 * Maps DXF overlay status to badge variants
 * Uses PropertyStatus from @/constants/property-statuses-enterprise
 */
const STATUS_BADGE_VARIANTS: Record<Status, ListCardBadgeVariant> = {
  'for-sale': 'info',              // Προς Πώληση
  'for-rent': 'secondary',         // Προς Ενοικίαση
  'for-sale-and-rent': 'info',     // Πώληση & Ενοικίαση (ADR-258)
  'reserved': 'warning',           // Κρατημένο
  'sold': 'success',               // Πωλήθηκε
  'rented': 'success',             // Ενοικιάστηκε
  'landowner': 'default',          // Ιδιοκτήτης Γης
  'under-negotiation': 'warning',  // Υπό Διαπραγμάτευση
  'coming-soon': 'info',           // Σύντομα Διαθέσιμο
  'off-market': 'outline',         // Εκτός Αγοράς
  'unavailable': 'destructive',    // Μη Διαθέσιμο
};

// =============================================================================
// 🏢 KIND TO ENTITY TYPE MAPPING
// =============================================================================

/**
 * Maps OverlayKind to NavigationEntityType for icon/color resolution
 */
const KIND_TO_ENTITY: Record<OverlayKind, NavigationEntityType> = {
  'unit': 'unit',
  'parking': 'parking',
  'storage': 'storage',
  'footprint': 'building', // Use building icon for footprint
};

// =============================================================================
// 🏢 GEOMETRY UTILITIES
// =============================================================================

/**
 * Calculate polygon area using Shoelace formula
 * @param polygon Array of [x, y] coordinates
 * @returns Area in square units (m²)
 */
function calculatePolygonArea(polygon: Array<[number, number]>): number {
  if (polygon.length < 3) return 0;

  let area = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }

  return Math.abs(area) / 2;
}

/**
 * Calculate polygon perimeter
 * @param polygon Array of [x, y] coordinates
 * @returns Perimeter in linear units (m)
 */
function calculatePolygonPerimeter(polygon: Array<[number, number]>): number {
  if (polygon.length < 2) return 0;

  let perimeter = 0;
  const n = polygon.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = polygon[j][0] - polygon[i][0];
    const dy = polygon[j][1] - polygon[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

// =============================================================================
// 🏢 COMPONENT
// =============================================================================

/**
 * 🗺️ OverlayListCard Component
 *
 * Domain-specific card for DXF Viewer overlays (regions/areas).
 * Uses ListCard with overlay defaults from NAVIGATION_ENTITIES.
 *
 * @example
 * ```tsx
 * <OverlayListCard
 *   overlay={overlay}
 *   isSelected={selectedOverlayId === overlay.id}
 *   onSelect={() => handleOverlaySelect(overlay.id)}
 *   onEdit={() => handleOverlayEdit(overlay.id)}
 *   onDelete={() => handleOverlayDelete(overlay.id)}
 * />
 * ```
 */
export const OverlayListCard = forwardRef<HTMLElement, OverlayListCardProps>(function OverlayListCard({
  overlay,
  isSelected = false,
  isVisible = true,
  onSelect,
  onToggleVisibility,
  onEdit,
  onDelete,
  compact = false,
  className,
}, ref) {
  const { t } = useTranslation('dxf-viewer');

  // ==========================================================================
  // 🏢 COMPUTED VALUES (Memoized)
  // ==========================================================================

  /**
   * Determine entity type from overlay kind for icon/color
   */
  const entityType = useMemo<NavigationEntityType>(() => {
    return KIND_TO_ENTITY[overlay.kind] || 'unit';
  }, [overlay.kind]);

  /**
   * 🏢 Build stats array with ICONS + VALUES for compact inline display
   * Format: 🏠 Μονάδα | 📐 85 m² | 🔗 Συνδεδεμένο
   */
  const stats = useMemo<StatItem[]>(() => {
    const items: StatItem[] = [];

    // Kind with appropriate icon
    const kindEntityConfig = NAVIGATION_ENTITIES[entityType];
    items.push({
      icon: kindEntityConfig.icon,
      iconColor: kindEntityConfig.color,
      label: t('overlayCard.stats.kind'),
      value: t(`overlayProperties.kindLabels.${overlay.kind}`, { defaultValue: overlay.kind }),
    });

    // Calculated area from polygon
    if (overlay.polygon && overlay.polygon.length >= 3) {
      const area = calculatePolygonArea(overlay.polygon);
      if (area > 0) {
        items.push({
          icon: Maximize2,
          iconColor: NAVIGATION_ENTITIES.area.color,
          label: t('overlayCard.stats.area'),
          value: `${formatNumber(area, { maximumFractionDigits: 1 })} m²`,
        });
      }
    }

    // Linked entity indicator
    const hasLink = overlay.linked && (
      overlay.linked.unitId ||
      overlay.linked.parkingId ||
      overlay.linked.storageId
    );

    if (hasLink) {
      items.push({
        icon: Link2,
        iconColor: 'text-blue-600',
        label: t('overlayCard.stats.linked'),
        value: t('overlayCard.stats.linkedYes'),
      });
    }

    // Vertex count (for complex polygons)
    if (overlay.polygon && overlay.polygon.length > 4) {
      items.push({
        icon: Footprints,
        iconColor: 'text-slate-500',
        label: t('overlayCard.stats.vertices'),
        value: String(overlay.polygon.length),
      });
    }

    return items;
  }, [overlay.kind, overlay.polygon, overlay.linked, entityType, t]);

  /**
   * Build badges from status
   */
  const badges = useMemo(() => {
    if (!overlay.status) return [];

    const statusLabel = t(`propertyStatus.${overlay.status}`, { defaultValue: overlay.status });
    const variant = STATUS_BADGE_VARIANTS[overlay.status] || 'default';

    return [{ label: statusLabel, variant }];
  }, [overlay.status, t]);

  /**
   * Build title from label or generate from kind + id
   */
  const title = useMemo(() => {
    if (overlay.label) return overlay.label;

    // Generate title from kind + short id
    const kindLabel = t(`overlayProperties.kindLabels.${overlay.kind}`, { defaultValue: overlay.kind });
    const shortId = overlay.id.slice(-4).toUpperCase();
    return `${kindLabel} ${shortId}`;
  }, [overlay.label, overlay.kind, overlay.id, t]);

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

  /**
   * 🏢 Build actions array for ListCard
   * Actions: Visibility Toggle, Edit, Delete
   */
  const actions = useMemo<ListCardAction[]>(() => {
    const items: ListCardAction[] = [];

    // Visibility toggle action - 🏢 ENTERPRISE: Dynamic color based on state
    // Visible = GREEN (πράσινο), Hidden = GRAY (γκρι)
    if (onToggleVisibility) {
      items.push({
        id: 'visibility',
        label: isVisible ? t('overlayList.hide') : t('overlayList.show'),
        icon: isVisible ? Eye : EyeOff,
        onClick: onToggleVisibility,
        className: isVisible ? HOVER_TEXT_EFFECTS.GREEN : HOVER_TEXT_EFFECTS.GRAY,
      });
    }

    // Edit action - 🏢 ENTERPRISE: Centralized BLUE color
    if (onEdit) {
      items.push({
        id: 'edit',
        label: t('overlayList.edit'),
        icon: Edit,
        onClick: onEdit,
        className: HOVER_TEXT_EFFECTS.BLUE,
      });
    }

    // Delete action - 🏢 ENTERPRISE: Centralized RED color
    if (onDelete) {
      items.push({
        id: 'delete',
        label: t('overlayList.delete'),
        icon: Trash2,
        onClick: onDelete,
        className: HOVER_TEXT_EFFECTS.RED,
      });
    }

    return items;
  }, [onToggleVisibility, onEdit, onDelete, isVisible, t]);

  // ==========================================================================
  // 🏢 RENDER
  // ==========================================================================

  return (
    <ListCard
      ref={ref}
      entityType={entityType}
      title={title}
      badges={badges}
      stats={stats}
      actions={actions}
      isSelected={isSelected}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      compact
      hideStats={false}
      inlineBadges
      hideIcon={false} // Show icon to differentiate kinds
      className={className}
      aria-label={t('overlayCard.ariaLabel', { name: title })}
    />
  );
});

export default OverlayListCard;
