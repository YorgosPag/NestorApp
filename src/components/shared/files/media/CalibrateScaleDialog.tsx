/**
 * ENTERPRISE: CalibrateScaleDialog — 2-click manual scale calibration.
 *
 * Lets the user pick two points on a raster (PDF/Image) background and type
 * the real-world distance + unit they correspond to. Computes
 * `unitsPerMeter = pixelDistance / realInMeters` and POSTs to
 * `/api/floorplan-backgrounds/[id]/calibrate` (Phase 9 STEP D).
 *
 * Bundle isolation: NO imports from `src/subapps/dxf-viewer/`. Local React
 * state only — never reads/writes `floorplan_overlays` directly. The
 * persisted `BackgroundScale` is consumed by `MeasureToolOverlay` (STEP H)
 * and the dimension/measurement renderers (STEP E) for real-meter labels.
 *
 * @module components/shared/files/media/CalibrateScaleDialog
 * @enterprise ADR-340 §3.6 / Phase 9 STEP I
 */

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BackgroundScale } from '@/types/floorplan-overlays';

type RealUnit = 'mm' | 'cm' | 'm';

const TO_METERS: Record<RealUnit, number> = { mm: 0.001, cm: 0.01, m: 1 };

const STROKE_COLOR = '#FF6B35';
const POINT_RADIUS = 5;
const CANVAS_W = 640;
const CANVAS_H = 420;

interface Point {
  x: number;
  y: number;
}

export interface CalibrateScaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Background id used for the POST endpoint. */
  backgroundId: string;
  /** URL of the background image to display for click-calibration. */
  imageSrc: string | null;
  /** Called once the server has acknowledged the calibration write. */
  onCalibrated?: (scale: BackgroundScale) => void;
}

export function CalibrateScaleDialog({
  open,
  onOpenChange,
  backgroundId,
  imageSrc,
  onCalibrated,
}: CalibrateScaleDialogProps) {
  const { t } = useTranslation(['files-media']);
  const [points, setPoints] = useState<Point[]>([]);
  const [realDistance, setRealDistance] = useState<string>('');
  const [unit, setUnit] = useState<RealUnit>('m');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPoints([]);
      setRealDistance('');
      setUnit('m');
      setError(null);
      setIsSaving(false);
    }
  }, [open]);

  const handleAddPoint = useCallback((p: Point) => {
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  }, []);

  const handleReset = useCallback(() => {
    setPoints([]);
    setError(null);
  }, []);

  const realNum = Number(realDistance);
  const canSave =
    points.length === 2 && Number.isFinite(realNum) && realNum > 0 && !isSaving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    const dist = pixelDistance(points[0], points[1]);
    if (dist <= 0) {
      setError(t('floorplan.calibrate.errorZeroDistance'));
      return;
    }
    const realInMeters = realNum * TO_METERS[unit];
    if (realInMeters <= 0) {
      setError(t('floorplan.calibrate.errorInvalidDistance'));
      return;
    }
    const scale: BackgroundScale = {
      unitsPerMeter: dist / realInMeters,
      sourceUnit: 'pixel',
    };
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(
        API_ROUTES.FLOORPLAN_BACKGROUNDS.CALIBRATE(backgroundId),
        { scale },
      );
      onCalibrated?.(scale);
      onOpenChange(false);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }, [canSave, points, realNum, unit, backgroundId, onCalibrated, onOpenChange, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{t('floorplan.calibrate.title')}</DialogTitle>
          <DialogDescription>{t('floorplan.calibrate.instructions')}</DialogDescription>
        </DialogHeader>
        <CalibrateCanvas imageSrc={imageSrc} points={points} onAddPoint={handleAddPoint} />
        <p className="text-sm text-muted-foreground">
          {t('floorplan.calibrate.points', { count: points.length })}
        </p>
        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="cal-distance">{t('floorplan.calibrate.realDistanceLabel')}</Label>
            <Input
              id="cal-distance"
              type="number"
              min={0}
              step="any"
              value={realDistance}
              onChange={(e) => setRealDistance(e.target.value)}
              placeholder={t('floorplan.calibrate.realDistancePlaceholder')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cal-unit">{t('floorplan.calibrate.unitLabel')}</Label>
            <Select value={unit} onValueChange={(v) => setUnit(v as RealUnit)}>
              <SelectTrigger id="cal-unit"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mm">{t('floorplan.calibrate.unitMm')}</SelectItem>
                <SelectItem value="cm">{t('floorplan.calibrate.unitCm')}</SelectItem>
                <SelectItem value="m">{t('floorplan.calibrate.unitM')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={handleReset} disabled={isSaving || points.length === 0}>
            {t('floorplan.calibrate.reset')}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('floorplan.calibrate.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving ? t('floorplan.calibrate.saving') : t('floorplan.calibrate.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface CalibrateCanvasProps {
  imageSrc: string | null;
  points: Point[];
  onAddPoint: (p: Point) => void;
}

function CalibrateCanvas({ imageSrc, points, onAddPoint }: CalibrateCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!imageSrc) {
      imgRef.current = null;
      drawScene(canvasRef.current, null, []);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      drawScene(canvasRef.current, img, points);
    };
    img.src = imageSrc;
    // intentional: re-load only when src changes; point redraws covered below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  useEffect(() => {
    drawScene(canvasRef.current, imgRef.current, points);
  }, [points]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current;
      if (!c) return;
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (c.width / rect.width);
      const y = (e.clientY - rect.top) * (c.height / rect.height);
      onAddPoint({ x, y });
    },
    [onAddPoint],
  );

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      onClick={handleClick}
      className={cn('w-full h-auto cursor-crosshair border rounded bg-muted/30')}
    />
  );
}

// ─── Helpers (pure, ≤40 LOC each) ─────────────────────────────────────────────

function drawScene(
  canvas: HTMLCanvasElement | null,
  img: HTMLImageElement | null,
  points: ReadonlyArray<Point>,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (img) {
    const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }
  ctx.strokeStyle = STROKE_COLOR;
  ctx.fillStyle = STROKE_COLOR;
  ctx.lineWidth = 2;
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
  }
}

function pixelDistance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

export default CalibrateScaleDialog;
