import type { PipelineAction } from '@/types/ai-pipeline';

// SSoT re-exports from shared
export { getIntentBadgeVariant, getConfidenceColor } from '@/components/admin/shared/intent-badge-utils';
export { getChannelIconComponent as getChannelIcon } from '@/lib/channel-icon-map';

const DRAFT_REPLY_PARAM = 'draftReply';

export const HIDDEN_ACTION_PARAMS = new Set([
  'companyId',
  'contactId',
  'senderEmail',
  'isKnownContact',
]);

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
