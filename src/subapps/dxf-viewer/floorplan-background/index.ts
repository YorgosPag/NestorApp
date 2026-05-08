export type { IFloorplanBackgroundProvider } from './providers/IFloorplanBackgroundProvider';

export { ImageProvider } from './providers/ImageProvider';
export { PdfPageProvider } from './providers/PdfPageProvider';

export type {
  BackgroundTransform,
  BackgroundScale,
  CadCoordinateAdaptation,
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

export { registerProviders } from './providers/register-providers';

export {
  useFloorplanBackgroundStore,
  getFloorProvider,
  selectFloorSlot,
  selectActiveFloorId,
  selectPendingReplaceRequest,
  selectCalibrationSession,
} from './stores/floorplanBackgroundStore';

export type {
  FloorSlot,
  PendingReplaceRequest,
  CalibrationSession,
} from './stores/floorplanBackgroundStore';

export { useFloorplanBackground } from './hooks/useFloorplanBackground';
export type { UseFloorplanBackgroundResult } from './hooks/useFloorplanBackground';

export { useFloorplanBackgroundForLevel } from './hooks/useFloorplanBackgroundForLevel';
export type { FloorplanBackgroundForLevelResult } from './hooks/useFloorplanBackgroundForLevel';

export { useFloorplanBackgroundPersistence } from './hooks/useFloorplanBackgroundPersistence';

export { useCalibration } from './hooks/useCalibration';
export type { UseCalibrationResult } from './hooks/useCalibration';

export { FloorplanBackgroundApiClient } from './services/floorplan-background-api-client';
export type {
  GetByFloorResponse,
  UploadResponse,
  PatchResponse,
  PatchCalibrationResponse,
  DeleteResponse,
  UploadInput,
  PatchTransformInput,
  PatchCalibrationInput,
  FloorPolygonState,
} from './services/floorplan-background-api-client';

export { FloorplanBackgroundCanvas } from './components/FloorplanBackgroundCanvas';
export type { FloorplanBackgroundCanvasProps } from './components/FloorplanBackgroundCanvas';

export { FloorplanBackgroundPanel } from './components/FloorplanBackgroundPanel';
export type { FloorplanBackgroundPanelProps } from './components/FloorplanBackgroundPanel';

export { ReplaceConfirmDialog } from './components/ReplaceConfirmDialog';
export { CalibrationDialog } from './components/CalibrationDialog';
export { CalibrationPolygonRemapDialog } from './components/CalibrationPolygonRemapDialog';
export type { CalibrationPolygonRemapDialogProps } from './components/CalibrationPolygonRemapDialog';
