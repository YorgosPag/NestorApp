'use client';
/**
 * 🏢 OVERLAY PROPERTIES CONTENT
 *
 * Simplified panel: single entity selector dropdown (property/parking/storage).
 * Kind and status are auto-set from the selected entity — no manual inputs.
 *
 * @version 6.0.0 - ADR-258B: Unified entity selector (replaces kind/status/connectedEntity fields)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { getDynamicBackgroundClass } from '../../../components/ui/utils/dynamic-styles';
import { Button } from '../../../components/ui/button';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Separator } from '../../../components/ui/separator';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { CommonBadge } from '../../../core/badges';
import { SELECT_CLEAR_VALUE, isSelectClearValue } from '../../../config/domain-constants';
import { STATUS_COLORS, STATUS_LABELS, type Overlay, type UpdateOverlayData, type OverlayKind } from '../overlays/types';
import { PANEL_LAYOUT } from '../config/panel-tokens';
import { calculatePolygonArea, calculatePolygonPerimeter } from '../rendering/entities/shared/geometry-utils';
import { overlayVertexToPoint2D } from '../utils/entity-conversion';
import { formatDistance } from '../rendering/entities/shared/distance-label-utils';
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
  overlays: Record<string, Overlay>;
}

interface PendingTransfer {
  entityId: string;
  fromOverlayId: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getLinkedEntityId(ov: Overlay): string | undefined {
  switch (ov.kind) {
    case 'property': return ov.linked?.propertyId;
    case 'parking': return ov.linked?.parkingId;
    case 'storage': return ov.linked?.storageId;
    case 'footprint': return undefined;
  }
}

function buildLinkedPayload(kind: OverlayKind, entityId: string): Overlay['linked'] {
  switch (kind) {
    case 'property': return { propertyId: entityId };
    case 'parking': return { parkingId: entityId };
    case 'storage': return { storageId: entityId };
    case 'footprint': return undefined;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const OverlayProperties: React.FC<OverlayPropertiesProps> = ({ overlay, onUpdate, overlays }) => {
  const { t } = useTranslation(['dxf-viewer', 'dxf-viewer-settings', 'dxf-viewer-wizard', 'dxf-viewer-guides', 'dxf-viewer-panels', 'dxf-viewer-shell']);
  const colors = useSemanticColors();
  const iconSizes = useIconSizes();
  const { quick } = useBorderTokens();
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer | null>(null);

  const entitySelectTriggerRef = useRef<HTMLButtonElement>(null);
  const prevOverlayIdRef = useRef<string | null>(null);

  const { levels, currentLevelId } = useLevels();
  const { selectedBuilding } = useProjectHierarchy();

  const currentLevel = useMemo(
    () => (currentLevelId ? levels.find(l => l.id === currentLevelId) : undefined),
    [levels, currentLevelId]
  );

  const currentFloorId = currentLevel?.floorId;
  const derivedBuildingId = selectedBuilding?.id ?? currentLevel?.buildingId;

  const linkedEntityId = overlay ? getLinkedEntityId(overlay) : undefined;

  const { entities, loading: entitiesLoading } = useFloorEntitiesForLinking({
    buildingId: derivedBuildingId,
    floorId: currentFloorId,
    overlays,
    enabled: !!overlay && (!!derivedBuildingId || !!currentFloorId),
  });

  // Auto-focus entity dropdown when a new overlay appears
  useEffect(() => {
    if (!overlay) {
      prevOverlayIdRef.current = null;
      return;
    }
    if (prevOverlayIdRef.current !== null && prevOverlayIdRef.current !== overlay.id) {
      const timer = setTimeout(() => {
        entitySelectTriggerRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
    prevOverlayIdRef.current = overlay.id;
  }, [overlay]);

  if (!overlay) {
    return (
      <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.text.muted}`}>
        {t('overlayProperties.selectOverlay')}
      </p>
    );
  }

  const polygonPoints = overlay.polygon?.map(overlayVertexToPoint2D) ?? [];
  const area = calculatePolygonArea(polygonPoints);
  const perimeter = calculatePolygonPerimeter(polygonPoints);

  const handleEntitySelect = (value: string) => {
    if (isSelectClearValue(value)) {
      onUpdate(overlay.id, { linked: null });
      return;
    }
    const entity = entities.find(e => e.id === value);
    if (!entity) return;

    if (entity.linkedToOverlayId && entity.linkedToOverlayId !== overlay.id) {
      setPendingTransfer({ entityId: value, fromOverlayId: entity.linkedToOverlayId });
      setShowTransferDialog(true);
      return;
    }

    const kind = entity.kind as OverlayKind;
    const resolvedStatus = entity.commercialStatus
      ? commercialToPropertyStatus(entity.commercialStatus)
      : undefined;
    const updates: UpdateOverlayData = { kind, linked: buildLinkedPayload(kind, value) };
    if (resolvedStatus) updates.status = resolvedStatus;
    onUpdate(overlay.id, updates);
  };

  const handleTransferConfirm = () => {
    if (!pendingTransfer) return;
    const entity = entities.find(e => e.id === pendingTransfer.entityId);
    const kind = (entity?.kind ?? 'property') as OverlayKind;
    const resolvedStatus = entity?.commercialStatus
      ? commercialToPropertyStatus(entity.commercialStatus)
      : undefined;
    onUpdate(pendingTransfer.fromOverlayId, { linked: null });
    const updates: UpdateOverlayData = { kind, linked: buildLinkedPayload(kind, pendingTransfer.entityId) };
    if (resolvedStatus) updates.status = resolvedStatus;
    onUpdate(overlay.id, updates);
    setPendingTransfer(null);
    setShowTransferDialog(false);
  };

  return (
    <div className="space-y-1">
      {/* Color indicator + overlay ID */}
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

      {/* Unified entity selector */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.linkedEntity')}</Label>
        {!currentFloorId && !derivedBuildingId && (
          <p className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted}`}>
            {t('overlayProperties.noFloorLinked')}
          </p>
        )}
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
                        <span className={`${colors.text.muted} text-xs`}>
                          ({t(STATUS_LABELS[resolvedStatus])})
                        </span>
                      )}
                      {isLinkedElsewhere && (
                        <span className={`${colors.text.muted} text-xs`}>(linked)</span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {linkedEntityId && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={() => onUpdate(overlay.id, { linked: null })}
              title={t('overlayProperties.unlink')}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

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

      <Separator className="my-1" />

      {/* Geometry info */}
      <div className={PANEL_LAYOUT.SPACING.GAP_XS}>
        <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>{t('overlayProperties.geometry')}</Label>
        <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} leading-tight`}>
          <div>{t('overlayProperties.points')} {overlay.polygon ? overlay.polygon.length : 0}</div>
          <div>{t('overlayProperties.area')} {formatDistance(area)} m²</div>
          <div>{t('overlayProperties.perimeter')} {formatDistance(perimeter)} m</div>
        </div>
      </div>
    </div>
  );
};

export default OverlayProperties;
