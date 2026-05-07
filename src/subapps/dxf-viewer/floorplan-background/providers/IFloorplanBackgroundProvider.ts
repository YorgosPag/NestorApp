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

  setActivePage?(page: number): Promise<void>;

  dispose(): void | Promise<void>;
}
