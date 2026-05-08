import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type {
  FloorplanOverlay as SharedFloorplanOverlay,
  BackgroundScale,
} from '@/types/floorplan-overlays';

export type { ViewTransform, Point2D };
export type { BackgroundScale } from '@/types/floorplan-overlays';

// ─── Natural bounds ───────────────────────────────────────────────────────────

export interface NaturalBounds {
  width: number;
  height: number;
}

// ─── Provider capabilities ────────────────────────────────────────────────────

export interface ProviderCapabilities {
  multiPage: boolean;
  exifAware: boolean;
  vectorEquivalent: boolean;
  calibratable: boolean;
}

// ─── Provider source ──────────────────────────────────────────────────────────

export type ProviderSource =
  | { kind: 'file'; file: File }
  | { kind: 'url'; url: string }
  | { kind: 'storage-path'; path: string };

// ─── Load result ──────────────────────────────────────────────────────────────

export interface ProviderLoadResult {
  success: boolean;
  bounds?: NaturalBounds;
  metadata?: Record<string, unknown>;
  error?: string;
}

// ─── CAD coordinate adaptation ────────────────────────────────────────────────

export interface CadCoordinateAdaptation {
  mode: 'cad-y-up';
  /** Ruler/origin margins applied before world transform. Matches DXF subsystem. */
  margins: { left: number; top: number };
}

// ─── Render params ────────────────────────────────────────────────────────────

export interface ProviderRenderParams {
  transform: BackgroundTransform;
  worldToCanvas: ViewTransform;
  viewport: { width: number; height: number };
  opacity: number;
  /** Optional CAD adaptation. When set, provider applies Y-flip + margins. */
  cad?: CadCoordinateAdaptation;
}

// ─── Background transform ─────────────────────────────────────────────────────

export interface BackgroundTransform {
  translateX: number;
  translateY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

export const DEFAULT_BACKGROUND_TRANSFORM: Readonly<BackgroundTransform> = {
  translateX: 0,
  translateY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
} as const;

// ─── Calibration ─────────────────────────────────────────────────────────────

export type CalibrationUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in';

export interface CalibrationData {
  method: 'two-point';
  pointA: Point2D;
  pointB: Point2D;
  realDistance: number;
  unit: CalibrationUnit;
  rotationDerived: boolean;
  calibratedAt: number;
  calibratedBy: string;
}

// ─── Provider metadata ────────────────────────────────────────────────────────

export interface ProviderMetadata {
  pdfPageNumber?: number;
  imageOrientation?: number;
  imageMimeType?: string;
  imageDecoderUsed?: 'native' | 'utif';
}

// ─── Provider ID ─────────────────────────────────────────────────────────────

export type ProviderId = 'pdf-page' | 'image';

// ─── Domain entity: FloorplanBackground ──────────────────────────────────────

export interface FloorplanBackground {
  id: string;
  companyId: string;
  floorId: string;
  fileId: string;
  providerId: ProviderId;
  providerMetadata: ProviderMetadata;
  naturalBounds: NaturalBounds;
  transform: BackgroundTransform;
  calibration: CalibrationData | null;
  /**
   * Conversion metadata for dimensions/measurements (ADR-340 Phase 8).
   * Native units → real-world meters. Set by `floorplan-scale.service`.
   */
  scale?: BackgroundScale;
  opacity: number;
  visible: boolean;
  locked: boolean;
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  updatedBy: string;
}

// ─── Domain entity: FloorplanOverlay ─────────────────────────────────────────
//
// SSoT moved to `@/types/floorplan-overlays` (ADR-340 Phase 8 — multi-kind
// discriminated union). This file re-exports the shared type to keep the
// `floorplan-background` barrel stable for existing consumers.

export type FloorplanOverlay = SharedFloorplanOverlay;

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isBackgroundTransform(value: unknown): value is BackgroundTransform {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as BackgroundTransform;
  return (
    typeof t.translateX === 'number' &&
    typeof t.translateY === 'number' &&
    typeof t.scaleX === 'number' &&
    typeof t.scaleY === 'number' &&
    typeof t.rotation === 'number'
  );
}

export function isNaturalBounds(value: unknown): value is NaturalBounds {
  if (typeof value !== 'object' || value === null) return false;
  const b = value as NaturalBounds;
  return typeof b.width === 'number' && typeof b.height === 'number';
}

export function isProviderLoadResult(value: unknown): value is ProviderLoadResult {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as ProviderLoadResult).success === 'boolean';
}
