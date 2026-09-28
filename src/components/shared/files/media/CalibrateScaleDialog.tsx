/**
 * ENTERPRISE: CalibrateScaleDialog — 2-click manual scale calibration.
 *
 * Lets the user pick two points on a raster (PDF/Image) background and type
 * the real-world distance + unit they correspond to. Computes
 * `unitsPerMeter = imagePixelDistance / realInMeters` and either POSTs to
 * `/api/floorplan-backgrounds/[id]/calibrate` (Phase 9 STEP D) or hands the
 * value to the consumer's own `onSave` (ADR-884 Φ2στ-β — the 360° tour
 * stores the scale on its own floor-plan record, through its one writer).
 *
 * 🔴 **Pixels of the IMAGE, never of the canvas** (fixed 2026-09-27, ADR-884
 * §4.13): the image is drawn "contain" inside a fixed 640×420 canvas, and the
 * dialog used to measure the click distance in *canvas* pixels — so the scale
 * depended on how large the image happened to be, while every consumer
 * (`MeasureToolOverlay`: `rasterSize` = natural size) measures in image
 * pixels. Clicks now go through `boxToImagePoint` (`lib/geometry/scale-calibration`).
 *
 * Bundle isolation: NO imports from `src/subapps/dxf-viewer/`. Local React
 * state only — never reads/writes `floorplan_overlays` directly. The
 * persisted `BackgroundScale` is consumed by `MeasureToolOverlay` (STEP H)
 * and the dimension/measurement renderers (STEP E) for real-meter labels.
 *
 * @module components/shared/files/media/CalibrateScaleDialog
 * @enterprise ADR-340 §3.6 / Phase 9 STEP I · ADR-884 Φ2στ-β
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
import {
  CALIBRATION_UNITS,
  boxToImagePoint,
  imageToBoxPoint,
  pixelDistance,
  pixelsPerMetre,
  type CalibrationUnit,
  type PixelPoint,
  type PixelSize,
} from '@/lib/geometry/scale-calibration';
import type { BackgroundScale } from '@/types/floorplan-overlays';

const STROKE_COLOR = '#FF6B35';
const POINT_RADIUS = 5;
const CANVAS_W = 640;
const CANVAS_H = 420;

const UNIT_LABEL_KEY: Readonly<Record<CalibrationUnit, string>> = {
  mm: 'floorplan.calibrate.unitMm',
  cm: 'floorplan.calibrate.unitCm',
  m: 'floorplan.calibrate.unitM',
};

/** Where the calibration goes: the floorplan-background endpoint, or the consumer's own writer. */
type CalibratePersistence =
  | { /** Background id used for the POST endpoint. */ backgroundId: string; onSave?: never }
  | { backgroundId?: never; /** The consumer persists `unitsPerMeter` (image pixels per metre) itself. */ onSave: (unitsPerMeter: number) => Promise<void> };

export type CalibrateScaleDialogProps = CalibratePersistence & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL of the background image to display for click-calibration. */
  imageSrc: string | null;
  /** Called once the calibration has been persisted. */
  onCalibrated?: (scale: BackgroundScale) => void;
};

function usePersist(props: CalibratePersistence) {
  const { backgroundId, onSave } = props;
  return useCallback(async (scale: BackgroundScale) => {
    if (onSave !== undefined) return onSave(scale.unitsPerMeter);
    await apiClient.post(API_ROUTES.FLOORPLAN_BACKGROUNDS.CALIBRATE(backgroundId), { scale });
  }, [backgroundId, onSave]);
}

export function CalibrateScaleDialog(props: CalibrateScaleDialogProps) {
  const { open, onOpenChange, imageSrc, onCalibrated } = props;
  const { t } = useTranslation(['files-media']);
  const persist = usePersist(props);
  const [points, setPoints] = useState<PixelPoint[]>([]);
  const [realDistance, setRealDistance] = useState<string>('');
  const [unit, setUnit] = useState<CalibrationUnit>('m');
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

  const handleAddPoint = useCallback((p: PixelPoint) => {
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
    if (pixelDistance(points[0], points[1]) <= 0) {
      setError(t('floorplan.calibrate.errorZeroDistance'));
      return;
    }
    const unitsPerMeter = pixelsPerMetre(points[0], points[1], realNum, unit);
    if (unitsPerMeter === null) {
      setError(t('floorplan.calibrate.errorInvalidDistance'));
      return;
    }
    const scale: BackgroundScale = { unitsPerMeter, sourceUnit: 'pixel' };
    setIsSaving(true);
    setError(null);
    try {
      await persist(scale);
      onCalibrated?.(scale);
      onOpenChange(false);
    } catch (e) {
      setError(toErrorMessage(e));
    } finally {
      setIsSaving(false);
    }
  }, [canSave, points, realNum, unit, persist, onCalibrated, onOpenChange, t]);

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
            <Select value={unit} onValueChange={(v) => setUnit(CALIBRATION_UNITS.find((u) => u === v) ?? 'm')}>
              <SelectTrigger id="cal-unit"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CALIBRATION_UNITS.map((u) => <SelectItem key={u} value={u}>{t(UNIT_LABEL_KEY[u])}</SelectItem>)}
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
  /** In IMAGE pixels. */
  points: PixelPoint[];
  onAddPoint: (p: PixelPoint) => void;
}

function naturalSize(img: HTMLImageElement | null): PixelSize | null {
  return img === null || img.naturalWidth <= 0 || img.naturalHeight <= 0 ? null : { width: img.naturalWidth, height: img.naturalHeight };
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
      const image = naturalSize(imgRef.current);
      // No image yet ⇒ no image pixel to map to: a canvas-pixel point would be a wrong scale.
      if (!c || image === null) return;
      const rect = c.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (c.width / rect.width);
      const y = (e.clientY - rect.top) * (c.height / rect.height);
      const point = boxToImagePoint({ x, y }, { width: c.width, height: c.height }, image);
      if (point !== null) onAddPoint(point);
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
  points: ReadonlyArray<PixelPoint>,
): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const image = naturalSize(img);
  if (img === null || image === null) return;
  const box = { width: canvas.width, height: canvas.height };
  const topLeft = imageToBoxPoint({ x: 0, y: 0 }, box, image);
  const bottomRight = imageToBoxPoint({ x: image.width, y: image.height }, box, image);
  ctx.drawImage(img, topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  drawPoints(ctx, points.map((p) => imageToBoxPoint(p, box, image)));
}

function drawPoints(ctx: CanvasRenderingContext2D, points: ReadonlyArray<PixelPoint>): void {
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
