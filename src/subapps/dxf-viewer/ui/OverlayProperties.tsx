'use client';
/**
 * 🏢 OVERLAY PROPERTIES CONTENT
 *
 * Content component για overlay properties editing.
 * ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΜΟΝΟ μέσα στο DraggableOverlayProperties (FloatingPanel wrapper).
 * ΔΕΝ έχει δικό του Card wrapper - το FloatingPanel παρέχει τη δομή.
 *
 * @version 4.0.0 - Removed Card wrapper (used inside FloatingPanel)
 * @since 2025-01-25
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { getDynamicBackgroundClass } from '../../../components/ui/utils/dynamic-styles';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { CommonBadge } from '../../../core/badges';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, OVERLAY_STATUS_KEYS, type Overlay, type Status, type OverlayKind } from '../overlays/types';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE (2026-01-26): Use centralized geometry functions - ADR Geometry Centralization
import { calculatePolygonArea, calculatePolygonPerimeter } from '../rendering/entities/shared/geometry-utils';
import { overlayVertexToPoint2D } from '../utils/entity-conversion';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from '../rendering/entities/shared/distance-label-utils';

interface OverlayPropertiesProps {
  overlay: Overlay | null;
  onUpdate: (id: string, updates: Partial<Overlay>) => void;
  onClose?: () => void;
}

// ============================================================================
// 🏢 ENTERPRISE NOTE (2026-01-26): Polygon Calculations Centralized
// ============================================================================
// Local polygon functions REMOVED - now using centralized geometry-utils.ts
// Import: calculatePolygonArea, calculatePolygonPerimeter from geometry-utils
// Adapter: overlayVertexToPoint2D converts [number, number][] to Point2D[]
// Pattern: Adapter Pattern (GoF) for type conversion
// ============================================================================

/**
 * 🏢 OverlayProperties Content Component
 *
 * Renders overlay property fields WITHOUT Card wrapper.
 * The parent DraggableOverlayProperties provides FloatingPanel structure.
 */
export const OverlayProperties: React.FC<OverlayPropertiesProps> = ({ overlay, onUpdate }) => {
  const { t } = useTranslation(['dxf-viewer', 'properties']);
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [label, setLabel] = useState('');
  const [linkedUnitId, setLinkedUnitId] = useState('');

  useEffect(() => {
    if (overlay) {
      setLabel(overlay.label || '');
      setLinkedUnitId(overlay.linked?.unitId || '');
    }
  }, [overlay]);

  // 🏢 ENTERPRISE: Empty state - no overlay selected
  if (!overlay) {
    return (
      <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} text-muted-foreground`}>
        {t('overlayProperties.selectOverlay')}
      </p>
    );
  }

  // 🏢 ENTERPRISE: Convert tuple array to Point2D[] using centralized adapter
  const polygonPoints = overlay.polygon?.map(overlayVertexToPoint2D) ?? [];
  const area = calculatePolygonArea(polygonPoints);
  const perimeter = calculatePolygonPerimeter(polygonPoints);

  const handleLabelChange = (newLabel: string) => {
    setLabel(newLabel);
    onUpdate(overlay.id, { label: newLabel });
  };

  const handleStatusChange = (status: Status) => onUpdate(overlay.id, { status });
  const handleKindChange = (kind: OverlayKind) => onUpdate(overlay.id, { kind });

  const handleLinkedEntityUpdate = () => {
    const linked = linkedUnitId ? { unitId: linkedUnitId } : undefined;
    onUpdate(overlay.id, { linked });
  };

  // 🏢 ENTERPRISE: Content only - no Card wrapper (parent provides FloatingPanel)
  // 🏢 COMPACT: space-y-1 = 4px vertical gaps between sections
  return (
    <div className="space-y-1">
      {/* Basic Info */}
      <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
        <div
          className={`${iconSizes.sm} rounded ${quick.button} ${getDynamicBackgroundClass(STATUS_COLORS[overlay.status || 'for-sale'] as string)}`}
        />
        <CommonBadge
          status="company"
          customLabel={typeof overlay.id === 'string' ? overlay.id.slice(0, 8) : String(overlay.id || '').slice(0, 8)}
          variant="outline"
        />
      </div>

      <Separator className="my-1" />

      {/* Label */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label htmlFor="label" className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.label')}</Label>
        <Input
          id="label"
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          placeholder={t('overlayProperties.labelPlaceholder')}
          className={PANEL_LAYOUT.HEIGHT.INPUT_SM}
        />
      </div>

      {/* Status */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.status')}</Label>
        <Select value={overlay.status} onValueChange={handleStatusChange}>
          <SelectTrigger className={PANEL_LAYOUT.HEIGHT.INPUT_SM}><SelectValue /></SelectTrigger>
          <SelectContent>
            {OVERLAY_STATUS_KEYS.map(status => (
              <SelectItem key={status} value={status}>
                <div className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
                  <div
                    className={`${iconSizes.xs} rounded ${getDynamicBackgroundClass(String(STATUS_COLORS[status] || ''))}`}
                  />
                  {t(STATUS_LABELS[status])}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kind */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.type')}</Label>
        <Select value={overlay.kind} onValueChange={handleKindChange}>
          <SelectTrigger className={PANEL_LAYOUT.HEIGHT.INPUT_SM}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => (
              <SelectItem key={kind} value={kind}>{t(KIND_LABELS[kind])}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator className="my-1" />

      {/* Linked Entity (simplified) */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.linkedUnit')}</Label>
        <Input
          value={linkedUnitId}
          onChange={(e) => setLinkedUnitId(e.target.value)}
          onBlur={handleLinkedEntityUpdate}
          placeholder={t('overlayProperties.unitIdPlaceholder')}
          className={`${PANEL_LAYOUT.HEIGHT.INPUT_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}
        />
      </div>

      <Separator className="my-1" />

      {/* Geometry Info */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.geometry')}</Label>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} text-muted-foreground leading-tight`}>
          <div>{t('overlayProperties.points')} {overlay && overlay.polygon ? overlay.polygon.length : 0}</div>
          <div>{t('overlayProperties.area')} {formatDistance(area)} m²</div>
          <div>{t('overlayProperties.perimeter')} {formatDistance(perimeter)} m</div>
        </div>
      </div>
    </div>
  );
};

export default OverlayProperties;
