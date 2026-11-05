import type { PlanRaster } from '@/lib/geometry/raster/plan-raster';
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

  setActivePage?(page: number): Promise<void>;

  dispose(): void | Promise<void>;
}
