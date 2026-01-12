'use client';
import React, { useState, useEffect } from 'react';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useDynamicBackgroundClass } from '../../../components/ui/utils/dynamic-styles';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { X } from 'lucide-react';
import { CommonBadge } from '../../../core/badges';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, type Overlay, type Status, type OverlayKind } from '../overlays/types';
import { PANEL_LAYOUT } from '../config/panel-tokens';

interface OverlayPropertiesProps {
  overlay: Overlay | null;
  onUpdate: (id: string, updates: Partial<Overlay>) => void;
  onClose?: () => void;
}

/**
 * Enterprise-grade type guard for polygon validation
 * Implements defensive programming principles used by major software companies
 */
function isValidPolygon(polygon: unknown): polygon is Array<[number, number]> {
  return (
    Array.isArray(polygon) &&
    polygon.length >= 3 &&
    polygon.every(point =>
      Array.isArray(point) &&
      point.length === 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number'
    )
  );
}

/**
 * Safe polygon area calculation with enterprise error handling
 * Uses Shoelace formula with comprehensive input validation
 */
function calculatePolygonArea(polygon: unknown): number {
  if (!isValidPolygon(polygon)) return 0;

  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i][0] * polygon[j][1] - polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area) / 2;
}

/**
 * Safe polygon perimeter calculation with enterprise error handling
 * Uses Euclidean distance formula with comprehensive input validation
 */
function calculatePolygonPerimeter(polygon: unknown): number {
  if (!isValidPolygon(polygon)) return 0;

  let perimeter = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const dx = polygon[j][0] - polygon[i][0];
    const dy = polygon[j][1] - polygon[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}

export const OverlayProperties: React.FC<OverlayPropertiesProps> = ({ overlay, onUpdate, onClose }) => {
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

  if (!overlay) {
    return (
      <Card className={PANEL_LAYOUT.WIDTH.PANEL_SM}>
        <CardHeader><CardTitle className={PANEL_LAYOUT.BUTTON.TEXT_SIZE}>Ιδιότητες Overlay</CardTitle></CardHeader>
        <CardContent>
          <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} text-muted-foreground`}>Επιλέξτε ένα overlay για να δείτε τις ιδιότητές του.</p>
        </CardContent>
      </Card>
    );
  }

  const area = calculatePolygonArea(overlay.polygon);
  const perimeter = calculatePolygonPerimeter(overlay.polygon);

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

  return (
    <Card className={PANEL_LAYOUT.WIDTH.PANEL_SM}>
      <CardHeader className={PANEL_LAYOUT.PADDING.BOTTOM_SM}>
        <div className="flex items-center justify-between">
          <CardTitle className={PANEL_LAYOUT.BUTTON.TEXT_SIZE}>Ιδιότητες Overlay</CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className={iconSizes.sm} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={PANEL_LAYOUT.SPACING.GAP_LG}>
        {/* Basic Info */}
        <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <div
            className={`${iconSizes.sm} rounded ${quick.button} ${useDynamicBackgroundClass(STATUS_COLORS[overlay.status || 'for-sale'] as string)}`}
          />
          <CommonBadge
            status="company"
            customLabel={typeof overlay.id === 'string' ? overlay.id.slice(0, 8) : String(overlay.id || '').slice(0, 8)}
            variant="outline"
          />
        </div>

        <Separator />

        {/* Label */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <Label htmlFor="label" className={PANEL_LAYOUT.TYPOGRAPHY.XS}>Ετικέτα</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="π.χ. A-12, P-034"
            className={PANEL_LAYOUT.HEIGHT.XL}
          />
        </div>

        {/* Status */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>Κατάσταση</Label>
          <Select value={overlay.status} onValueChange={handleStatusChange}>
            <SelectTrigger className={PANEL_LAYOUT.HEIGHT.XL}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as Status[]).map(status => (
                <SelectItem key={status} value={status}>
                  <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    <div
                      className={`${iconSizes.xs} rounded ${useDynamicBackgroundClass(String(STATUS_COLORS[status] || ''))}`}
                    />
                    {STATUS_LABELS[status]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kind */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>Τύπος</Label>
          <Select value={overlay.kind} onValueChange={handleKindChange}>
            <SelectTrigger className={PANEL_LAYOUT.HEIGHT.XL}><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => (
                <SelectItem key={kind} value={kind}>{KIND_LABELS[kind]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Linked Entity (simplified) */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>Συνδεδεμένη Μονάδα</Label>
          <Input
            value={linkedUnitId}
            onChange={(e) => setLinkedUnitId(e.target.value)}
            onBlur={handleLinkedEntityUpdate}
            placeholder="Unit ID"
            className={`${PANEL_LAYOUT.HEIGHT.INPUT_SM} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}
          />
        </div>

        <Separator />

        {/* Geometry Info */}
        <div className={PANEL_LAYOUT.SPACING.GAP_SM}>
          <Label className={PANEL_LAYOUT.TYPOGRAPHY.XS}>Γεωμετρία</Label>
          <div className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} text-muted-foreground ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            <div>Σημεία: {overlay && overlay.polygon ? overlay.polygon.length : 0}</div>
            <div>Εμβαδό: {area.toFixed(2)} m²</div>
            <div>Περίμετρος: {perimeter.toFixed(2)} m</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OverlayProperties;
