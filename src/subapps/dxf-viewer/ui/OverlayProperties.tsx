'use client';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { Button } from '../../../components/ui/button';
import { Separator } from '../../../components/ui/separator';
import { X } from 'lucide-react';
import { CommonBadge } from '../../../core/badges';
import { STATUS_COLORS, STATUS_LABELS, KIND_LABELS, type Overlay, type Status, type OverlayKind } from '../overlays/types';
import { layoutUtilities } from '@/styles/design-tokens';

interface OverlayPropertiesProps {
  overlay: Overlay | null;
  onUpdate: (id: string, updates: Partial<Overlay>) => void;
  onClose?: () => void;
}

function calculatePolygonArea(polygon: Array<[number, number]>): number {
  if (polygon.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    area += polygon[i][0] * polygon[j][1] - polygon[j][0] * polygon[i][1];
  }
  return Math.abs(area) / 2;
}

function calculatePolygonPerimeter(polygon: Array<[number, number]>): number {
  if (polygon.length < 2) return 0;
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
      <Card className="w-80">
        <CardHeader><CardTitle className="text-sm">Ιδιότητες Overlay</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Επιλέξτε ένα overlay για να δείτε τις ιδιότητές του.</p>
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
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Ιδιότητες Overlay</CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded border"
            style={layoutUtilities.dxf.colors.backgroundColor(
              STATUS_COLORS[overlay.status || 'for-sale']
            )}
          />
          <CommonBadge
            status="company"
            customLabel={overlay.id.slice(0, 8)}
            variant="outline"
          />
        </div>

        <Separator />

        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor="label" className="text-xs">Ετικέτα</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="π.χ. A-12, P-034"
            className="h-8"
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs">Κατάσταση</Label>
          <Select value={overlay.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as Status[]).map(status => (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={layoutUtilities.dxf.colors.backgroundColor(STATUS_COLORS[status])}
                    />
                    {STATUS_LABELS[status]}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kind */}
        <div className="space-y-2">
          <Label className="text-xs">Τύπος</Label>
          <Select value={overlay.kind} onValueChange={handleKindChange}>
            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as OverlayKind[]).map(kind => (
                <SelectItem key={kind} value={kind}>{KIND_LABELS[kind]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Linked Entity (simplified) */}
        <div className="space-y-2">
          <Label className="text-xs">Συνδεδεμένη Μονάδα</Label>
          <Input
            value={linkedUnitId}
            onChange={(e) => setLinkedUnitId(e.target.value)}
            onBlur={handleLinkedEntityUpdate}
            placeholder="Unit ID"
            className="h-7 text-xs"
          />
        </div>

        <Separator />

        {/* Geometry Info */}
        <div className="space-y-2">
          <Label className="text-xs">Γεωμετρία</Label>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Σημεία: {overlay.polygon.length}</div>
            <div>Εμβαδό: {area.toFixed(2)} m²</div>
            <div>Περίμετρος: {perimeter.toFixed(2)} m</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
