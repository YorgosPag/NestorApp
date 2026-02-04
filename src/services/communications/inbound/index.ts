'use server';

export {
  normalizeEmail,
  parseAddress,
  splitAddresses,
  resolveSubject,
  resolveProviderMessageId,
  resolveCompanyIdFromRecipients,
  processInboundEmail,
} from './email-inbound-service';

export type {
  ParsedAddress,
  InboundEmailInput,
  InboundEmailResult,
  InboundEmailAttachment,
  InboundAttachmentDownload,
  InboundRoutingRule,
  RoutingResolution,
} from './types';
