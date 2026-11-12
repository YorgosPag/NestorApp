import type { PlanRaster, RecognitionRaster } from '@/lib/geometry/raster/plan-raster';
import type { RasterRectPx } from '../../types/coordinate-space';
import type {
  NaturalBounds,
  ProviderCapabilities,
  ProviderLoadResult,
  ProviderRenderParams,
  ProviderSource,
} from './types';

export interface IFloorplanBackgroundProvider {
  readonly id: 'pdf-page' | 'image';
  readonly capabilities: ProviderCapabilities;
  readonly supportedMimeTypes: ReadonlyArray<string>;

  loadAsync(source: ProviderSource): Promise<ProviderLoadResult>;

  render(ctx: CanvasRenderingContext2D, params: ProviderRenderParams): void;

  getNaturalBounds(): NaturalBounds;

  /**
   * ADR-929 Φ5: τα pixel της ήδη αποκωδικοποιημένης πηγής (RGBA, `naturalBounds`), **νέο** buffer σε κάθε κλήση.
   * `null` πριν το `loadAsync` ή μετά το `dispose`. Βλ. `provider-plan-raster.ts`.
   */
  getPlanRaster(): PlanRaster | null;

  /**
   * ADR-929 §6.16 βήμα 4: τα pixel για **αναγνώριση** (OCR), στην πυκνότερη ανάλυση που έχει η πηγή — για σάρωση PDF η εγγενής
   * της, αλλιώς ό,τι το `getPlanRaster()` με `naturalPerRasterPx = 1`. Η εμφάνιση δεν αλλάζει. `null` όπως το `getPlanRaster`.
   */
  getRecognitionRaster(): Promise<RecognitionRaster | null>;

  /**
   * ADR-929 Δ21 (δ) βήμα 1: μικρογραφία (PNG) μιας περιοχής σε px των `naturalBounds`, κομμένη απευθείας από την ήδη
   * αποκωδικοποιημένη πηγή, με μεγαλύτερη πλευρά ≤ `maxEdgePx`. `null` όπως το `getPlanRaster`, ή περιοχή εκτός εικόνας.
   * Βλ. `cropPlanRegion` (`provider-plan-raster.ts`).
   */
  getRegionImage(rect: RasterRectPx, maxEdgePx: number): Promise<Blob | null>;

  setActivePage?(page: number): Promise<void>;

  dispose(): void | Promise<void>;
}
