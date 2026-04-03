import { Globe, Mail, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PipelineAction, PipelineChannelValue, PipelineIntentTypeValue } from '@/types/ai-pipeline';
import type { IntentBadgeVariant } from './proposal-review-card-types';

const DRAFT_REPLY_PARAM = 'draftReply';

export const HIDDEN_ACTION_PARAMS = new Set([
  'companyId',
  'contactId',
  'senderEmail',
  'isKnownContact',
]);

export const getIntentBadgeVariant = (intent?: PipelineIntentTypeValue): IntentBadgeVariant => {
  switch (intent) {
    case 'invoice':
    case 'payment_notification':
      return 'default';
    case 'defect_report':
      return 'destructive';
    case 'appointment_request':
    case 'property_search':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const getChannelIcon = (channel: PipelineChannelValue): LucideIcon => {
  switch (channel) {
    case 'email':
      return Mail;
    case 'telegram':
      return MessageSquare;
    default:
      return Globe;
  }
};

export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return 'text-green-600 dark:text-green-400';
  if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

export const buildModifiedActions = (
  actions: PipelineAction[],
  editedDraftReply: string | null,
): PipelineAction[] => {
  return actions.map((action) => {
    if (!(DRAFT_REPLY_PARAM in action.params)) {
      return action;
    }

    return {
      ...action,
      params: {
        ...action.params,
        [DRAFT_REPLY_PARAM]: editedDraftReply,
      },
    };
  });
};
