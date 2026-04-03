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

import { useCallback, useMemo, useState } from 'react';
import { Bot, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { EmailContentWithSignature } from '@/components/shared/email/EmailContentRenderer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  buildModifiedActions,
  getChannelIcon,
  getConfidenceColor,
  getIntentBadgeVariant,
} from './proposal-review-card/proposal-review-card-helpers';
import { ProposalActionContent } from './proposal-review-card/ProposalActionContent';
import { ProposalReviewDialogs } from './proposal-review-card/ProposalReviewDialogs';
import type { ProposalReviewCardProps } from './proposal-review-card/proposal-review-card-types';

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
  const colors = useSemanticColors();

  const [rejectReason, setRejectReason] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editedDraftReply, setEditedDraftReply] = useState<string | null>(null);

  const intake = context.intake;
  const understanding = context.understanding;
  const proposal = context.proposal;
  const sender = intake?.normalized?.sender;
  const confidence = understanding?.confidence ?? 0;
  const isDraftModified = editedDraftReply !== null;

  const channelIcon = useMemo(() => getChannelIcon(intake?.channel ?? 'email'), [intake?.channel]);

  const handleDraftReplyChange = useCallback((value: string) => {
    setEditedDraftReply(value);
  }, []);

  const handleDraftReplyReset = useCallback(() => {
    setEditedDraftReply(null);
  }, []);

  const handleApprove = useCallback(async () => {
    if (isDraftModified) {
      const modifiedActions = buildModifiedActions(proposal?.suggestedActions ?? [], editedDraftReply);
      await onApprove(queueId, modifiedActions);
    } else {
      await onApprove(queueId);
    }

    setApproveOpen(false);
  }, [editedDraftReply, isDraftModified, onApprove, proposal?.suggestedActions, queueId]);

  const handleReject = useCallback(async () => {
    await onReject(queueId, rejectReason);
    setRejectOpen(false);
    setRejectReason('');
  }, [onReject, queueId, rejectReason]);

  const ChannelIcon = channelIcon;

  return (
    <article className={`${spacing.gap.md} flex flex-col`}>
      <section>
        <Card>
          <CardContent className={spacing.padding.md}>
            <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
              <ChannelIcon className={`h-4 w-4 ${colors.text.muted}`} />
              <h4 className={typography.label.sm}>
                {t('operatorInbox.sections.originalMessage')}
              </h4>
            </header>
            <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr]`}>
              <dt className={`${typography.body.sm} ${colors.text.muted}`}>
                {t('operatorInbox.fields.sender')}:
              </dt>
              <dd className={typography.body.sm}>
                {sender?.name ?? sender?.email ?? 'Unknown'}
              </dd>

              <dt className={`${typography.body.sm} ${colors.text.muted}`}>
                {t('operatorInbox.fields.channel')}:
              </dt>
              <dd>
                <Badge variant="outline" className={typography.body.sm}>
                  {intake?.channel ?? '-'}
                </Badge>
              </dd>
            </dl>
            {intake?.normalized?.subject ? (
              <p className={`${typography.body.sm} ${spacing.margin.top.sm} font-medium`}>
                {intake.normalized.subject}
              </p>
            ) : null}
            {intake?.normalized?.contentText ? (
              <div className={`${typography.body.sm} ${spacing.margin.top.xs} ${colors.text.muted}`}>
                <EmailContentWithSignature content={intake.normalized.contentText} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {understanding ? (
        <section>
          <Card>
            <CardContent className={spacing.padding.md}>
              <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
                <Bot className={`h-4 w-4 ${colors.text.muted}`} />
                <h4 className={typography.label.sm}>
                  {t('operatorInbox.sections.aiUnderstanding')}
                </h4>
                {understanding.detectedIntents.length > 1 ? (
                  <Badge variant="default" className="text-xs">
                    {understanding.detectedIntents.length} {t('operatorInbox.multiIntent.detected')}
                  </Badge>
                ) : null}
              </header>

              <div className={`${spacing.gap.sm} flex flex-wrap items-center`}>
                {understanding.detectedIntents.length > 1 ? (
                  <span className={`${typography.body.sm} font-medium ${colors.text.muted}`}>
                    {t('operatorInbox.multiIntent.primary')}:
                  </span>
                ) : null}
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

              {understanding.detectedIntents.length > 1 ? (
                <section className={`${spacing.margin.top.xs} ${spacing.gap.sm} flex flex-col`}>
                  {understanding.detectedIntents.slice(1).map((detectedIntent, index) => (
                    <div key={`${detectedIntent.intent}-${index}`} className={`${spacing.gap.sm} flex flex-wrap items-center`}>
                      <span className={`${typography.body.sm} font-medium ${colors.text.muted}`}>
                        {t('operatorInbox.multiIntent.secondary')}:
                      </span>
                      <Badge variant={getIntentBadgeVariant(detectedIntent.intent)}>
                        {detectedIntent.intent}
                      </Badge>
                      <span className={`${typography.body.sm} ${getConfidenceColor(detectedIntent.confidence)}`}>
                        {detectedIntent.confidence.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </section>
              ) : null}

              {understanding.rationale ? (
                <p className={`${typography.body.sm} ${spacing.margin.top.xs} ${colors.text.muted}`}>
                  {understanding.rationale}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {proposal ? (
        <section>
          <Card>
            <CardContent className={spacing.padding.md}>
              <header className={`${spacing.gap.sm} flex items-center ${spacing.margin.bottom.sm}`}>
                <CheckCircle className={`h-4 w-4 ${colors.text.muted}`} />
                <h4 className={typography.label.sm}>
                  {t('operatorInbox.sections.proposal')}
                </h4>
              </header>
              <p className={typography.body.sm}>{proposal.summary}</p>
              {proposal.suggestedActions.length > 0 ? (
                <section className={`${spacing.margin.top.sm} ${spacing.gap.md} flex flex-col`}>
                  {proposal.suggestedActions.map((action, index) => (
                    <ProposalActionContent
                      key={`${action.type}-${index}`}
                      action={action}
                      spacing={spacing}
                      typography={typography}
                      t={t}
                      editedDraftReply={editedDraftReply}
                      onDraftReplyChange={handleDraftReplyChange}
                      onDraftReplyReset={handleDraftReplyReset}
                    />
                  ))}
                </section>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <footer className={`${spacing.gap.sm} flex justify-end`}>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setRejectOpen(true)}
          disabled={isProcessing}
        >
          <XCircle className="mr-1 h-4 w-4" />
          {t('operatorInbox.reject')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => setApproveOpen(true)}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Spinner size="small" color="inherit" className="mr-1" />
          ) : (
            <CheckCircle className="mr-1 h-4 w-4" />
          )}
          {t('operatorInbox.approve')}
        </Button>
      </footer>

      <ProposalReviewDialogs
        approveOpen={approveOpen}
        rejectOpen={rejectOpen}
        rejectReason={rejectReason}
        isDraftModified={isDraftModified}
        spacing={spacing}
        typography={typography}
        t={t}
        onApproveOpenChange={setApproveOpen}
        onRejectOpenChange={setRejectOpen}
        onRejectReasonChange={setRejectReason}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </article>
  );
}
