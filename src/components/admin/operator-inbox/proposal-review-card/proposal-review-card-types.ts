import type { PipelineAction, PipelineContext, PipelineIntentTypeValue } from '@/types/ai-pipeline';
import type { useSpacingTokens } from '@/hooks/useSpacingTokens';
import type { useTypography } from '@/hooks/useTypography';

export interface ProposalReviewCardProps {
  queueId: string;
  context: PipelineContext;
  onApprove: (queueId: string, modifiedActions?: PipelineAction[]) => Promise<void>;
  onReject: (queueId: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}

export type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface MatchedUnitDisplay {
  name?: string;
  type?: string;
  area?: number;
  floor?: number;
  building?: string;
  price?: number | null;
  rooms?: number | null;
}

export interface ReplyPropertyListActionView {
  senderName?: string;
  criteriaSummary?: string;
  matchingUnitsCount?: number;
  totalAvailable?: number;
  matchingUnits?: MatchedUnitDisplay[];
  draftReply?: string;
}

export interface CreateAppointmentActionView {
  senderName?: string;
  requestedDate: string | null;
  requestedTime: string | null;
  description?: string;
  draftReply?: string;
  aiGenerated?: boolean;
  operatorBriefing?: string;
  hasTimeConflict?: boolean;
}

export interface ProposalActionRendererSharedProps {
  spacing: ReturnType<typeof useSpacingTokens>;
  typography: ReturnType<typeof useTypography>;
  t: (key: string) => string;
}

export interface ProposalActionContentProps extends ProposalActionRendererSharedProps {
  action: PipelineAction;
  editedDraftReply: string | null;
  onDraftReplyChange: (value: string) => void;
  onDraftReplyReset: () => void;
}

export interface ProposalReviewDialogsProps extends ProposalActionRendererSharedProps {
  approveOpen: boolean;
  rejectOpen: boolean;
  rejectReason: string;
  isDraftModified: boolean;
  onApproveOpenChange: (open: boolean) => void;
  onRejectOpenChange: (open: boolean) => void;
  onRejectReasonChange: (value: string) => void;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}
