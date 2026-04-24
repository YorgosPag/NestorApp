/**
 * =============================================================================
 * SHOWCASE CORE — Public barrel (ADR-321)
 * =============================================================================
 *
 * Re-exports every Phase 1 factory + type so the folder registers as "used" to
 * dead-code scanners (knip) even between the Phase 2 migration commits that
 * progressively switch legacy surfaces onto the core. Also the canonical
 * import path for downstream consumers going forward.
 *
 * @module services/showcase-core
 */

export {
  ShowcaseEntityNotFoundError,
  ShowcaseTenantMismatchError,
  createShowcaseSnapshotBuilder,
} from './snapshot-builder-factory';
export type {
  BuildInfoParams,
  BrandingResolutionParams,
  ShowcaseSnapshotBuilder,
  ShowcaseSnapshotBuilderConfig,
} from './snapshot-builder-factory';

export { createShowcaseShareResolver } from './share-resolver-factory';
export type { ShowcaseShareResolverConfig } from './share-resolver-factory';

export {
  createLocaleFallback,
  resolveHeaderContactLabels,
  showcaseCtaLabelDefault,
  showcaseDescriptionSectionDefault,
  showcaseFloorplansTitleDefault,
  showcaseGeneratedOnDefault,
  showcasePhotosTitleDefault,
  showcasePoweredByDefault,
} from './labels-shared';
export type {
  ShowcaseEmailLabels,
  ShowcaseHeaderContactLabels,
  ShowcaseHeaderLabels,
  ShowcasePdfChromeLabels,
} from './labels-shared';

export { createShowcaseEmailBuilder } from './email-builder-factory';
export type {
  BuildShowcaseEmailParams,
  BuiltShowcaseEmail,
  ShowcaseEmailBodyHookParams,
  ShowcaseEmailBuilder,
  ShowcaseEmailBuilderConfig,
  ShowcaseEmailEntityHeading,
  ShowcaseEmailLabelAccessors,
  ShowcaseEmailRenderHookParams,
  ShowcaseEmailRenderHooks,
} from './email-builder-factory';

export { DEFAULT_SHOWCASE_PDF_MARGINS, ShowcasePDFService } from './pdf-service';
export type { ShowcaseRendererLike } from './pdf-service';

export {
  BaseShowcaseRenderer,
  formatShowcasePdfArea,
  formatShowcasePdfDate,
  formatShowcasePdfEuro,
  safeShowcaseValue,
} from './pdf-renderer-base';
export type {
  BaseShowcaseRendererConfig,
  BrandHeaderLogoAsset,
  ShowcaseExtraSectionsContext,
  ShowcasePdfChromeSlice,
  ShowcasePdfHeaderSlice,
  ShowcasePdfLocale,
  ShowcasePhotoAsset,
  ShowcaseSpecsRow,
} from './pdf-renderer-base';

export { createShowcasePdfRoute } from './api/create-pdf-route';
export type {
  CreateShowcasePdfRouteConfig,
  LoadShowcasePdfDataParams,
  ShowcasePdfResponseBody,
  ShowcasePdfRouteHandler,
} from './api/create-pdf-route';

export { createShowcaseEmailRoute } from './api/create-email-route';
export type {
  CreateShowcaseEmailRouteConfig,
  LoadShowcaseEmailParams,
  ShowcaseBuiltEmail,
  ShowcaseEmailBaseBody,
  ShowcaseEmailLoadResult,
  ShowcaseEmailLocale,
  ShowcaseEmailResponseBody,
  ShowcaseEmailRouteHandler,
} from './api/create-email-route';

export { createPublicShowcasePayloadRoute } from './api/create-public-payload-route';
export type {
  BuildPublicPayloadParams,
  CreatePublicPayloadRouteConfig,
  PublicShowcasePayloadHandler,
  ResolvedShowcaseShare,
} from './api/create-public-payload-route';

export { createPublicShowcasePdfRoute } from './api/create-public-pdf-route';
export type {
  CreatePublicPdfRouteConfig,
  PublicShowcasePdfHandler,
  ResolvedPublicPdfShare,
} from './api/create-public-pdf-route';
