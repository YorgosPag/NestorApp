'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: PROPOSAL REVIEW CARD (UC-009)
 * =============================================================================
 *
 * Displays pipeline proposal details and operator action buttons.
 * Used inside the Operator Inbox accordion for each proposed item.
 *
 * @component ProposalReviewCard
 * @see ADR-080 (Pipeline Implementation)
 * @see UC-009 (Internal Operator Workflow)
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckCircle, XCircle, Loader2, Mail, MessageSquare, Globe, Bot } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import type {
  PipelineContext,
  PipelineChannelValue,
  PipelineIntentTypeValue,
} from '@/types/ai-pipeline';

// ============================================================================
// TYPES
// ============================================================================

interface ProposalReviewCardProps {
  queueId: string;
  context: PipelineContext;
  onApprove: (queueId: string) => Promise<void>;
  onReject: (queueId: string, reason: string) => Promise<void>;
  isProcessing: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

type IntentBadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

const getIntentBadgeVariant = (intent?: PipelineIntentTypeValue): IntentBadgeVariant => {
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

const getChannelIcon = (channel: PipelineChannelValue) => {
  switch (channel) {
    case 'email': return Mail;
    case 'telegram': return MessageSquare;
    default: return Globe;
  }
};

const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 90) return 'text-green-600 dark:text-green-400';
  if (confidence >= 60) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ProposalReviewCard({
  queueId,
  context,
  onApprove,
  onReject,
  isProcessing,
}: ProposalReviewCardProps) {
  const { t } = useTranslation('admin');
  const spacing = useSpacingTokens();
  const typography = useTypography();

  const [rejectReason, setRejectReason] = useState('');
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const intake = context.intake;
  const understanding = context.understanding;
  const proposal = context.proposal;

  const sender = intake?.normalized?.sender;
  const ChannelIcon = getChannelIcon(intake?.channel ?? 'email');
  const confidence = understanding?.confidence ?? 0;

  return (
    <article className={`${spacing.gap.md} flex flex-col`}>
      {/* Original Message Section */}
      <Card>
        <CardContent className={spacing.padding.md}>
          <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
            <h4 className={typography.label.sm}>
              {t('operatorInbox.sections.originalMessage')}
            </h4>
          </header>
          <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr]`}>
            <dt className={`${typography.body.sm} text-muted-foreground`}>
              {t('operatorInbox.fields.sender')}:
            </dt>
            <dd className={typography.body.sm}>
              {sender?.name ?? sender?.email ?? 'Unknown'}
            </dd>

            <dt className={`${typography.body.sm} text-muted-foreground`}>
              {t('operatorInbox.fields.channel')}:
            </dt>
            <dd>
              <Badge variant="outline" className={typography.body.sm}>
                {intake?.channel ?? '-'}
              </Badge>
            </dd>
          </dl>
          {intake?.normalized?.subject && (
            <p className={`${typography.body.sm} ${spacing.margin.top.sm} font-medium`}>
              {intake.normalized.subject}
            </p>
          )}
          {intake?.normalized?.contentText && (
            <p className={`${typography.body.sm} ${spacing.margin.top.xs} text-muted-foreground line-clamp-4`}>
              {intake.normalized.contentText}
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI Understanding Section */}
      {understanding && (
        <Card>
          <CardContent className={spacing.padding.md}>
            <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
              <Bot className="h-4 w-4 text-muted-foreground" />
              <h4 className={typography.label.sm}>
                {t('operatorInbox.sections.aiUnderstanding')}
              </h4>
            </header>
            <div className={`${spacing.gap.sm} flex flex-wrap items-center`}>
              <Badge variant={getIntentBadgeVariant(understanding.intent)}>
                {understanding.intent}
              </Badge>
              <span className={`${typography.body.sm} ${getConfidenceColor(confidence)}`}>
                {t('operatorInbox.fields.confidence')}: {confidence.toFixed(0)}%
              </span>
              <Badge variant="outline">
                {understanding.urgency ?? 'normal'}
              </Badge>
            </div>
            {understanding.rationale && (
              <p className={`${typography.body.sm} ${spacing.margin.top.xs} text-muted-foreground`}>
                {understanding.rationale}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Proposal Section */}
      {proposal && (
        <Card>
          <CardContent className={spacing.padding.md}>
            <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
              <h4 className={typography.label.sm}>
                {t('operatorInbox.sections.proposal')}
              </h4>
            </header>
            <p className={typography.body.sm}>{proposal.summary}</p>
            {proposal.suggestedActions.length > 0 && (
              <ul className={`${spacing.margin.top.sm} ${spacing.gap.xs} list-disc list-inside`}>
                {proposal.suggestedActions.map((action, idx) => (
                  <li key={idx} className={`${typography.body.sm} text-muted-foreground`}>
                    <Badge variant="outline" className="mr-1">{action.type}</Badge>
                    {JSON.stringify(action.params)}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <footer className={`${spacing.gap.sm} flex justify-end`}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowRejectDialog(true)}
          disabled={isProcessing}
        >
          <XCircle className="mr-1 h-4 w-4" />
          {t('operatorInbox.reject')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setShowApproveDialog(true)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-1 h-4 w-4" />
          )}
          {t('operatorInbox.approve')}
        </Button>
      </footer>

      {/* Approve Confirmation Dialog */}
      <ConfirmDialog
        open={showApproveDialog}
        onOpenChange={setShowApproveDialog}
        title={t('operatorInbox.approve')}
        description={t('operatorInbox.confirmApprove')}
        confirmText={t('operatorInbox.approve')}
        onConfirm={async () => {
          await onApprove(queueId);
          setShowApproveDialog(false);
        }}
      />

      {/* Reject Dialog */}
      <ConfirmDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        title={t('operatorInbox.reject')}
        description={t('operatorInbox.confirmReject')}
        confirmText={t('operatorInbox.reject')}
        variant="destructive"
        onConfirm={async () => {
          await onReject(queueId, rejectReason);
          setShowRejectDialog(false);
          setRejectReason('');
        }}
      >
        <label className={`${spacing.gap.xs} flex flex-col`}>
          <span className={typography.body.sm}>{t('operatorInbox.fields.reason')}</span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder={t('operatorInbox.fields.reason')}
          />
        </label>
      </ConfirmDialog>
    </article>
  );
}
