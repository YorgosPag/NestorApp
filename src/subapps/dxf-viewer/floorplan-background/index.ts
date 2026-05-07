export type { IFloorplanBackgroundProvider } from './providers/IFloorplanBackgroundProvider';

export { ImageProvider } from './providers/ImageProvider';

export type {
  BackgroundTransform,
  CalibrationData,
  CalibrationUnit,
  FloorplanBackground,
  FloorplanOverlay,
  NaturalBounds,
  ProviderCapabilities,
  ProviderLoadResult,
  ProviderMetadata,
  ProviderId,
  ProviderRenderParams,
  ProviderSource,
  Point2D,
  ViewTransform,
} from './providers/types';

export {
  DEFAULT_BACKGROUND_TRANSFORM,
  isBackgroundTransform,
  isNaturalBounds,
  isProviderLoadResult,
} from './providers/types';

export {
  providerRegistry,
  registerProvider,
  getProvider,
} from './providers/provider-registry';
