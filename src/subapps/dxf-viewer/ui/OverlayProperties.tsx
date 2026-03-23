'use client';
/**
 * 🏢 OVERLAY PROPERTIES CONTENT
 *
 * Content component για overlay properties editing.
 * ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΜΟΝΟ μέσα στο DraggableOverlayProperties (FloatingPanel wrapper).
 * ΔΕΝ έχει δικό του Card wrapper - το FloatingPanel παρέχει τη δομή.
 *
 * @version 5.1.0 - ADR-258B: Entity linking dropdown (Radix Select) + auto-focus + status badge
 * @since 2025-01-25
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { getDynamicBackgroundClass } from '../../../components/ui/utils/dynamic-styles';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CommonBadge } from '../../../core/badges';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '../../../config/domain-constants';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, OVERLAY_STATUS_KEYS, type Overlay, type UpdateOverlayData, type Status, type OverlayKind } from '../overlays/types';
import { PANEL_LAYOUT } from '../config/panel-tokens';
// 🏢 ENTERPRISE (2026-01-26): Use centralized geometry functions - ADR Geometry Centralization
import { calculatePolygonArea, calculatePolygonPerimeter } from '../rendering/entities/shared/geometry-utils';
import { overlayVertexToPoint2D } from '../utils/entity-conversion';
// 🏢 ADR-090: Centralized Number Formatting
import { formatDistance } from '../rendering/entities/shared/distance-label-utils';
// 🏢 ADR-258B: Entity linking dropdown
import { useFloorEntitiesForLinking } from '../hooks/useFloorEntitiesForLinking';
import { useLevels } from '../systems/levels/useLevels';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import { commercialToPropertyStatus, getStatusColors } from '../config/color-mapping';

// ============================================================================
// TYPES
// ============================================================================

interface OverlayPropertiesProps {
  overlay: Overlay | null;
  onUpdate: (id: string, updates: UpdateOverlayData) => void;
  onClose?: () => void;
  /** All overlays on current level — for linked entity detection (ADR-258B) */
  overlays: Record<string, Overlay>;
}

interface PendingTransfer {
  entityId: string;
  fromOverlayId: string;
}

// ============================================================================
// 🏢 ENTERPRISE NOTE (2026-01-26): Polygon Calculations Centralized
// ============================================================================
// Local polygon functions REMOVED - now using centralized geometry-utils.ts
// Import: calculatePolygonArea, calculatePolygonPerimeter from geometry-utils
// Adapter: overlayVertexToPoint2D converts [number, number][] to Point2D[]
// Pattern: Adapter Pattern (GoF) for type conversion
// ============================================================================

// ============================================================================
// HELPERS — Kind-aware linked entity resolution (ADR-258B)
// ============================================================================

/** Extract the linked entity ID based on overlay kind — exhaustive switch */
function getLinkedEntityId(ov: Overlay): string | undefined {
  switch (ov.kind) {
    case 'unit': return ov.linked?.unitId;
    case 'parking': return ov.linked?.parkingId;
    case 'storage': return ov.linked?.storageId;
    case 'footprint': return undefined;
  }
}

/** Build the `linked` payload for a specific kind + entity ID — exhaustive switch */
function buildLinkedPayload(kind: OverlayKind, entityId: string): Overlay['linked'] {
  switch (kind) {
    case 'unit': return { unitId: entityId };
    case 'parking': return { parkingId: entityId };
    case 'storage': return { storageId: entityId };
    case 'footprint': return undefined;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * 🏢 OverlayProperties Content Component
 *
 * Renders overlay property fields WITHOUT Card wrapper.
 * The parent DraggableOverlayProperties provides FloatingPanel structure.
 */
export const OverlayProperties: React.FC<OverlayPropertiesProps> = ({ overlay, onUpdate, overlays }) => {
  const { t } = useTranslation('dxf-viewer');
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [label, setLabel] = useState('');
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);

  // 🏢 ADR-258B: Ref for auto-focus entity dropdown on new overlay
  const entitySelectTriggerRef = useRef<HTMLButtonElement>(null);
  const prevOverlayIdRef = useRef<string | null>(null);

  // 🏢 ADR-258B: Floor context for entity filtering
  const { levels, currentLevelId } = useLevels();
  const { selectedBuilding } = useProjectHierarchy();

  const currentFloorId = useMemo(() => {
    if (!currentLevelId) return undefined;
    return levels.find(l => l.id === currentLevelId)?.floorId;
  }, [levels, currentLevelId]);

  // Derive linked status BEFORE hooks (needed for enabled check)
  const isLinkableKind = overlay?.kind !== 'footprint';
  const linkedEntityId = overlay ? getLinkedEntityId(overlay) : undefined;
  const hasLinkedEntity = !!linkedEntityId;

  // 🔍 DEBUG (REMOVE): Entity linking diagnostics
  console.log('[OverlayProperties] Entity linking debug:', {
    currentLevelId,
    currentFloorId,
    buildingId: selectedBuilding?.id,
    overlayKind: overlay?.kind,
    isLinkableKind,
    levelsCount: levels.length,
    levelsWithFloorId: levels.filter(l => l.floorId).map(l => ({ id: l.id, floorId: l.floorId })),
  });

  // 🏢 ADR-258B: Floor-filtered entities for linking dropdown
  // Units: API supports floorId-only (company-scoped). Parking/Storage: needs buildingId.
  const { entities, loading: entitiesLoading } = useFloorEntitiesForLinking({
    kind: overlay?.kind ?? 'unit',
    buildingId: selectedBuilding?.id,
    floorId: currentFloorId,
    overlays,
    enabled: !!overlay && isLinkableKind && (!!selectedBuilding?.id || !!currentFloorId),
  });

  // Sync label with overlay changes
  useEffect(() => {
    if (overlay) {
      setLabel(overlay.label || '');
    }
  }, [overlay]);

  // 🏢 ADR-258B: Auto-focus entity dropdown when a NEW overlay appears (after polygon save)
  useEffect(() => {
    if (!overlay) {
      prevOverlayIdRef.current = null;
      return;
    }
    // Only focus when overlay ID changes to a NEW value (not on initial mount)
    if (prevOverlayIdRef.current !== null && prevOverlayIdRef.current !== overlay.id) {
      // New overlay appeared — schedule focus after render
      const timer = setTimeout(() => {
        entitySelectTriggerRef.current?.focus();
      }, 150); // Small delay for Firestore snapshot to populate overlayStore
      return () => clearTimeout(timer);
    }
    prevOverlayIdRef.current = overlay.id;
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

  // 🏢 ADR-258B: Entity linking handlers
  const handleEntitySelect = (value: string) => {
    if (isSelectClearValue(value)) {
      handleUnlink();
      return;
    }

    const entity = entities.find(e => e.id === value);
    if (!entity) return;

    // Duplicate prevention: if entity linked to ANOTHER overlay → transfer dialog
    if (entity.linkedToOverlayId && entity.linkedToOverlayId !== overlay.id) {
      setPendingTransfer({ entityId: value, fromOverlayId: entity.linkedToOverlayId });
      setShowTransferDialog(true);
      return;
    }

    // Direct link
    onUpdate(overlay.id, { linked: buildLinkedPayload(overlay.kind, value) });
  };

  const handleTransferConfirm = () => {
    if (!pendingTransfer) return;
    // 1. Unlink from old overlay (null, not undefined — Firestore rejects undefined)
    onUpdate(pendingTransfer.fromOverlayId, { linked: null });
    // 2. Link to current overlay
    onUpdate(overlay.id, { linked: buildLinkedPayload(overlay.kind, pendingTransfer.entityId) });
    setPendingTransfer(null);
    setShowTransferDialog(false);
  };

  const handleUnlink = () => {
    // ADR-258B: Use null (not undefined) — overlay-store filters out undefined, Firestore accepts null
    onUpdate(overlay.id, { linked: null });
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

      {/* Status — ADR-258: Disabled when entity is linked (status derived from entity.commercialStatus) */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.status')}</Label>
        <Select
          value={overlay.status}
          onValueChange={handleStatusChange}
          disabled={hasLinkedEntity}
        >
          <SelectTrigger
            className={`${PANEL_LAYOUT.HEIGHT.INPUT_SM} ${hasLinkedEntity ? 'opacity-50' : ''}`}
            title={hasLinkedEntity ? t('overlayProperties.statusLinkedHint') : undefined}
          >
            <SelectValue />
          </SelectTrigger>
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

      {/* 🏢 ADR-258B: Linked Entity — Radix Select dropdown (ADR-001) */}
      {isLinkableKind && (
        <>
          <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
            <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.linkedEntity')}</Label>
            <div className="flex items-center gap-1">
              <Select
                value={linkedEntityId ?? SELECT_CLEAR_VALUE}
                onValueChange={handleEntitySelect}
                disabled={entitiesLoading}
              >
                <SelectTrigger
                  ref={entitySelectTriggerRef}
                  className={`${PANEL_LAYOUT.HEIGHT.INPUT_SM} flex-1 ${entitiesLoading ? 'opacity-50' : ''}`}
                >
                  <SelectValue placeholder={
                    entitiesLoading
                      ? t('overlayProperties.loadingEntities')
                      : t('overlayProperties.selectEntity')
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_CLEAR_VALUE}>
                    {t('overlayProperties.noEntity')}
                  </SelectItem>
                  {entities.map(entity => {
                    const isLinkedElsewhere = !!entity.linkedToOverlayId
                      && entity.linkedToOverlayId !== overlay.id;
                    const resolvedStatus = entity.commercialStatus
                      ? commercialToPropertyStatus(entity.commercialStatus)
                      : null;
                    const statusFill = resolvedStatus
                      ? getStatusColors(resolvedStatus)?.fill
                      : null;
                    return (
                      <SelectItem
                        key={entity.id}
                        value={entity.id}
                        className={isLinkedElsewhere ? 'opacity-50' : ''}
                      >
                        <span className="flex items-center gap-1.5">
                          {statusFill && (
                            <span
                              className={`inline-block size-2 rounded-full shrink-0 ${getDynamicBackgroundClass(statusFill)}`}
                            />
                          )}
                          <span>{entity.displayName}</span>
                          {resolvedStatus && (
                            <span className="text-muted-foreground text-xs">
                              ({t(STATUS_LABELS[resolvedStatus])})
                            </span>
                          )}
                          {isLinkedElsewhere && (
                            <span className="text-muted-foreground text-xs">(linked)</span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Unlink button — visible only when entity is linked */}
              {linkedEntityId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  onClick={handleUnlink}
                  title={t('overlayProperties.unlink')}
                >
                  <X className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Transfer confirmation dialog (ADR-003 centralized) */}
          <ConfirmDialog
            open={showTransferDialog}
            onOpenChange={setShowTransferDialog}
            title={t('overlayProperties.transferTitle')}
            description={t('overlayProperties.transferDescription')}
            onConfirm={handleTransferConfirm}
            onCancel={() => {
              setPendingTransfer(null);
              setShowTransferDialog(false);
            }}
            variant="warning"
            confirmText={t('overlayProperties.transferConfirm')}
          />
        </>
      )}

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
