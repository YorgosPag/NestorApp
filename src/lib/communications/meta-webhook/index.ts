/**
 * =============================================================================
 * META WEBHOOK SHARED CORE — PUBLIC BARREL
 * =============================================================================
 *
 * Shared Single Source of Truth for Meta Graph API webhook handlers
 * (Instagram / Messenger / WhatsApp). Big-player pattern: one shared core
 * (signature verify, GET handshake, pipeline batch, feedback payload parsing,
 * route wiring) + thin per-platform adapters that own only what genuinely
 * differs (payload schema, sender-id extraction, reply rendering).
 *
 * @module lib/communications/meta-webhook
 * @enterprise ADR-586 - Meta Webhook Shared Core (de-duplication)
 * @enterprise ADR-174 - Meta Omnichannel Integration
 */

export { verifyMetaWebhookSignature } from './meta-signature';
export {
  handleMetaWebhookGet,
  type MetaWebhookVerificationConfig,
} from './meta-verification';
export { triggerPipelineBatchAfterResponse } from './meta-pipeline-batch';
export {
  handleMetaWebhookPost,
  type MetaWebhookPostConfig,
} from './meta-post';
export {
  CATEGORY_MAP,
  parseFeedbackPayload,
  parseCategoryPayload,
  applyFeedbackRating,
  applyNegativeCategory,
  type ParsedFeedbackPayload,
  type ParsedCategoryPayload,
} from './meta-feedback';
export {
  createMetaWebhookRoute,
  type MetaWebhookHandler,
  type MetaWebhookHandlers,
  type MetaWebhookRoute,
} from './meta-webhook-route';
