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

// ADR-700 — snapshot field primitives + label catalog access
export {
  buildShowcaseIdentityFields,
  buildShowcaseMetricFields,
  createShowcaseRelationLoader,
  formatShowcaseFloorLabel,
  pickShowcaseNumber,
  pickShowcaseNumberOrUndefined,
  pickShowcaseString,
  pickShowcaseStringOrUndefined,
} from './snapshot-field-primitives';
export type { ShowcaseRelationLoaderConfig } from './snapshot-field-primitives';

export {
  createEnumLabelTranslator,
  getShowcaseCatalog,
  readShowcaseCatalogSections,
  resolveShowcaseHeaderLabels,
  resolveShowcaseMediaTitles,
} from './labels-catalog';
export type {
  ShowcaseCatalogSections,
  ShowcaseEnumTranslator,
} from './labels-catalog';

export { createShowcaseShareResolver } from './share-resolver-factory';
export type {
  ShowcaseResolvedData,
  ShowcaseShareResolverConfig,
} from './share-resolver-factory';

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

export { createShowcaseEmailBuilder, standardShowcaseEmailLabels } from './email-builder-factory';
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
  StandardShowcaseEmailLabelShape,
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

// =============================================================================
// ADR-698 — Public showcase token surface: declarations instead of hooks
// =============================================================================

export { createUnifiedPublicShowcasePayloadRoute } from './api/create-unified-public-payload-route';
export type { UnifiedPublicPayloadRouteConfig } from './api/create-unified-public-payload-route';

export { assembleUnifiedShowcasePayload } from './unified-showcase-payload';
export type {
  UnifiedShowcasePayload,
  UnifiedShowcasePayloadShareFacts,
} from './unified-showcase-payload';

export { createUnifiedPublicShowcasePdfRoute } from './api/create-unified-public-pdf-route';
export type { UnifiedPublicPdfRouteConfig } from './api/create-unified-public-pdf-route';

export { sanitizeShowcaseFilenameStem } from './showcase-filename';

export { createPublicTokenRouteExport } from './api/create-token-route-export';
export type {
  PublicTokenHandler,
  PublicTokenRateLimit,
  TokenSegmentData,
} from './api/create-token-route-export';

export {
  incrementPublicShareAccess,
  lookupPublicShowcaseShare,
} from './api/public-share-lookup';
export type {
  LookupPublicShowcaseShareParams,
  PublicShowcaseShare,
} from './api/public-share-lookup';

export {
  SHOWCASE_MEDIA_LIMIT,
  loadShowcaseMedia,
  loadShowcaseMediaBuckets,
} from './public-media';
export type {
  LoadShowcaseMediaParams,
  ShowcaseMediaBuckets,
  ShowcaseMediaItem,
} from './public-media';
