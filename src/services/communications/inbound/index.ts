export {
  normalizeEmail,
  parseAddress,
  splitAddresses,
  resolveSubject,
  resolveProviderMessageId,
  resolveCompanyIdFromRecipients,
  processInboundEmail,
} from './email-inbound-service';

export {
  enqueueInboundEmail,
  claimNextQueueItems,
  claimRetryableItems,
  processQueueItem,
  markQueueItemCompleted,
  markQueueItemFailed,
  recoverStaleItems,
  getQueueStats,
  getQueueHealth,
} from './email-queue-service';

export type {
  ParsedAddress,
  InboundEmailInput,
  InboundEmailResult,
  InboundEmailAttachment,
  InboundAttachmentDownload,
  InboundRoutingRule,
  RoutingResolution,
  MailgunStorageInfo,
} from './types';
