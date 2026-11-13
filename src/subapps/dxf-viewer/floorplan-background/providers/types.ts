import type { ViewTransform, Point2D } from '../../rendering/types/Types';
import type { DrawingAreaChrome } from '../../rendering/core/drawing-area';
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
  /**
   * Το chrome (χάρακες) γύρω από την περιοχή σχεδίασης — **ενίεται** από το DXF subapp ώστε
   * αυτό το υποσύστημα να μη χρειάζεται να ξέρει τη διάταξη του viewer.
   *
   * 🔑 Η αρχή του κόσμου κάθεται στην **κάτω-αριστερή γωνία της περιοχής σχεδίασης**, δηλαδή
   * στο `(leftRulerWidth, viewport.height − bottomRulerHeight)`. Πριν λεγόταν `margins:
   * {left, top}` και το `top` **δεν ήταν πάνω περιθώριο** — ήταν το ύψος του ΚΑΤΩ χάρακα με
   * λάθος όνομα, αντιγραμμένο από τον πυρήνα του DXF μαζί με το λάθος.
   *
   * @see subapps/dxf-viewer/rendering/core/drawing-area.ts — η μία πηγή
   */
  chrome: DrawingAreaChrome;
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

/**
 * Ίδια τοποθέτηση; Ακριβής σύγκριση: οι τιμές ταξιδεύουν ως JSON double (χωρίς απώλεια), και ο έλεγχος
 * σύγκρουσης της βαθμονόμησης (ADR-929 Φ5.2γ) θέλει «ό,τι διάβασα είναι ό,τι υπάρχει», όχι «περίπου».
 */
export function transformsEqual(a: BackgroundTransform, b: BackgroundTransform): boolean {
  return a.translateX === b.translateX
    && a.translateY === b.translateY
    && a.scaleX === b.scaleX
    && a.scaleY === b.scaleY
    && a.rotation === b.rotation;
}

// ─── Calibration ─────────────────────────────────────────────────────────────

export type CalibrationUnit = 'm' | 'cm' | 'mm' | 'ft' | 'in';

/** Οι μονάδες που δέχεται ο διάλογος βαθμονόμησης — ΜΙΑ λίστα για UI και server validator. */
export const CALIBRATION_UNITS: readonly CalibrationUnit[] = ['m', 'cm', 'mm', 'ft', 'in'];

export function isCalibrationUnit(value: unknown): value is CalibrationUnit {
  return typeof value === 'string' && (CALIBRATION_UNITS as readonly string[]).includes(value);
}

/**
 * ADR-929 Φ5.2γ — ο κωδικός της άρνησης `409` όταν η βαθμονόμηση στηρίχτηκε σε θέση που ο server
 * δεν έχει πια (άλλη καρτέλα / άλλος χρήστης). Συμβόλαιο client ⇄ server, μία δήλωση.
 */
export const CALIBRATION_STALE_ERROR_CODE = 'CALIBRATION_STALE';

/** Μία γνωστή απόσταση της βαθμονόμησης, όπως αποθηκεύεται (ADR-929 Φ5.2). */
export interface CalibrationReferenceRecord {
  /** Άκρα σε φυσικά pixel της εικόνας — έχουν νόημα για πάντα, ανεξάρτητα από pan/zoom. */
  pointA: Point2D;
  pointB: Point2D;
  realDistance: number;
  unit: CalibrationUnit;
  /**
   * ADR-929 Φ5.3γ — η διαβασμένη διάσταση από την οποία προήλθε η αναφορά (`PlanText.id`). Υπάρχει μόνο όταν
   * `origin === 'plan-dimensions'`: ίχνος ελέγχου «ποιο γραμμένο νούμερο ορίζει την κλίμακα».
   */
  sourceTextId?: string;
}

/**
 * ADR-929 Φ5.3γ — από πού ήρθε η βαθμονόμηση: σημεία που έδειξε ο άνθρωπος, ή οι γραμμένες διαστάσεις του σχεδίου
 * (πρόταση της αναγνώρισης που ο άνθρωπος εφάρμοσε με ρητή πράξη). Μία δήλωση, τη διαβάζει και ο διακομιστής.
 */
export const CALIBRATION_ORIGINS = ['manual', 'plan-dimensions'] as const;
export type CalibrationOrigin = (typeof CALIBRATION_ORIGINS)[number];

export function isCalibrationOrigin(value: unknown): value is CalibrationOrigin {
  return typeof value === 'string' && (CALIBRATION_ORIGINS as readonly string[]).includes(value);
}

/**
 * Η βαθμονόμηση ενός υποβάθρου. Τα `pointA/pointB/realDistance/unit` είναι η **πρώτη** αναφορά.
 *
 * ⚠️ Συμβατότητα (ADR-929 Φ5.2): εγγραφές πριν τη Φ5.2 δεν έχουν `sceneUnits` — υπολογίστηκαν με την
 * υπόθεση «σκηνή σε mm» και τα σημεία τους είναι pixel **οθόνης**. Η απουσία σημαίνει `'mm'`.
 */
export interface CalibrationData {
  method: 'two-point';
  pointA: Point2D;
  pointB: Point2D;
  realDistance: number;
  unit: CalibrationUnit;
  rotationDerived: boolean;
  calibratedAt: number;
  calibratedBy: string;
  /** Οι μονάδες της σκηνής τη στιγμή της βαθμονόμησης· απουσία = παλιά εγγραφή (mm). */
  sceneUnits?: CalibrationUnit;
  /**
   * Όλες οι αναφορές, σε pixel εικόνας: 1–2 από τον διάλογο, έως `CALIBRATION_LIMITS.maxReferences` από τις
   * διαστάσεις (ADR-929 Φ5.3γ).
   */
  references?: CalibrationReferenceRecord[];
  /** Ενιαία κλίμακα ή χωριστή X/Y (διόρθωση τεντώματος σαρωτή). */
  scaleMode?: 'uniform' | 'per-axis';
  /** ADR-929 Φ5.3γ — η προέλευση· απουσία = `'manual'` (κάθε εγγραφή πριν τη Φ5.3γ). */
  origin?: CalibrationOrigin;
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

/**
 * ADR-929 Δ7 Γ — το μέσο της πηγής: `vector` = σελίδα PDF χωρίς κυρίαρχη εικόνα (σχεδιασμένη σε CAD, άρα υπό κλίμακα) ·
 * `raster` = σάρωση, φωτογραφία ή εικόνα, όπου το αν είναι σκίτσο το κρίνουν οι γραμμένες διαστάσεις.
 */
export type SourceMedium = 'vector' | 'raster';

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
