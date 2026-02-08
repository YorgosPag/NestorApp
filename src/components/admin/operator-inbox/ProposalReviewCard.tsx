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

import { useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckCircle, XCircle, Loader2, Mail, MessageSquare, Globe, Bot, RotateCcw, Pencil } from 'lucide-react';
import { EmailContentWithSignature } from '@/components/shared/email/EmailContentRenderer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import type {
  PipelineContext,
  PipelineAction,
  PipelineChannelValue,
  PipelineIntentTypeValue,
  DetectedIntent,
} from '@/types/ai-pipeline';

// ============================================================================
// TYPES
// ============================================================================

interface ProposalReviewCardProps {
  queueId: string;
  context: PipelineContext;
  onApprove: (queueId: string, modifiedActions?: PipelineAction[]) => Promise<void>;
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
// PROPOSAL ACTION RENDERER
// ============================================================================

/** Internal fields that should never be shown to operators */
const HIDDEN_ACTION_PARAMS = new Set([
  'companyId', 'contactId', 'senderEmail', 'isKnownContact',
]);

interface MatchedUnitDisplay {
  name?: string;
  type?: string;
  area?: number;
  floor?: number;
  building?: string;
  price?: number | null;
  rooms?: number | null;
}

interface ProposalActionRendererProps {
  action: PipelineAction;
  spacing: ReturnType<typeof useSpacingTokens>;
  typography: ReturnType<typeof useTypography>;
  t: (key: string) => string;
  editedDraftReply: string | null;
  onDraftReplyChange: (value: string) => void;
  onDraftReplyReset: () => void;
}

function ProposalActionRenderer({ action, spacing, typography, t, editedDraftReply, onDraftReplyChange, onDraftReplyReset }: ProposalActionRendererProps) {
  const params = action.params;

  // ── reply_property_list — UC-003 Property Search ──
  if (action.type === 'reply_property_list') {
    const senderName = params.senderName as string | undefined;
    const criteriaSummary = params.criteriaSummary as string | undefined;
    const matchingUnitsCount = params.matchingUnitsCount as number | undefined;
    const totalAvailable = params.totalAvailable as number | undefined;
    const matchingUnits = params.matchingUnits as MatchedUnitDisplay[] | undefined;
    const draftReply = params.draftReply as string | undefined;

    return (
      <section className={`${spacing.gap.sm} flex flex-col`}>
        {/* Header: Action type + summary */}
        <div className={`${spacing.gap.sm} flex flex-wrap items-center`}>
          <Badge variant="outline">{t('operatorInbox.actions.replyPropertyList')}</Badge>
          {senderName && (
            <span className={`${typography.body.sm} text-muted-foreground`}>
              → {senderName}
            </span>
          )}
        </div>

        {/* Search results summary */}
        <div className={`${spacing.gap.xs} flex flex-wrap items-center`}>
          {criteriaSummary && (
            <Badge variant="secondary">
              {t('operatorInbox.fields.criteria')}: {criteriaSummary}
            </Badge>
          )}
          <span className={typography.body.sm}>
            {matchingUnitsCount ?? 0} {t('operatorInbox.fields.matchingUnits')} ({totalAvailable ?? 0} {t('operatorInbox.fields.totalAvailable')})
          </span>
        </div>

        {/* Matched units list */}
        {matchingUnits && matchingUnits.length > 0 && (
          <ul className={`${spacing.margin.top.xs} ${spacing.gap.xs} list-disc list-inside`}>
            {matchingUnits.map((unit, idx) => (
              <li key={idx} className={`${typography.body.sm} text-muted-foreground`}>
                <strong>{unit.name}</strong>
                {unit.area ? ` — ${unit.area} τ.μ.` : ''}
                {unit.floor ? `, ${unit.floor}ος` : ''}
                {unit.building ? `, ${unit.building}` : ''}
                {unit.price != null ? `, ${unit.price.toLocaleString('el-GR')}€` : ''}
              </li>
            ))}
          </ul>
        )}

        {/* Draft reply email — editable */}
        {draftReply && (
          <Card className={spacing.margin.top.sm}>
            <CardContent className={spacing.padding.md}>
              <div className={`${spacing.gap.xs} flex items-center justify-between ${spacing.margin.bottom.xs}`}>
                <div className={`${spacing.gap.xs} flex items-center`}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  <h5 className={typography.label.sm}>
                    {t('operatorInbox.sections.draftReply')}
                  </h5>
                  {editedDraftReply !== null && (
                    <Badge variant="outline" className="text-xs">
                      {t('operatorInbox.draftEdited')}
                    </Badge>
                  )}
                </div>
                {editedDraftReply !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDraftReplyReset}
                    className="h-7 px-2 text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {t('operatorInbox.resetDraft')}
                  </Button>
                )}
              </div>
              <Textarea
                value={editedDraftReply ?? draftReply}
                onChange={(e) => onDraftReplyChange(e.target.value)}
                rows={6}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}
      </section>
    );
  }

  // ── create_appointment — UC-001 Appointment Request ──
  if (action.type === 'create_appointment') {
    const senderName = params.senderName as string | undefined;
    const requestedDate = params.requestedDate as string | null;
    const requestedTime = params.requestedTime as string | null;
    const description = params.description as string | undefined;
    const draftReply = params.draftReply as string | undefined;
    const aiGenerated = params.aiGenerated as boolean | undefined;
    const operatorBriefing = params.operatorBriefing as string | undefined;
    const hasTimeConflict = params.hasTimeConflict as boolean | undefined;

    const notSpecified = t('operatorInbox.fields.notSpecified');

    return (
      <section className={`${spacing.gap.sm} flex flex-col`}>
        {/* Header: Action type + sender */}
        <div className={`${spacing.gap.sm} flex flex-wrap items-center`}>
          <Badge variant="outline">{t('operatorInbox.actions.createAppointment')}</Badge>
          {senderName && (
            <span className={`${typography.body.sm} text-muted-foreground`}>
              → {senderName}
            </span>
          )}
        </div>

        {/* Appointment details */}
        <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr] ${typography.body.sm} text-muted-foreground`}>
          <dt className="font-medium">{t('operatorInbox.fields.requestedDate')}:</dt>
          <dd>{requestedDate ?? notSpecified}</dd>

          <dt className="font-medium">{t('operatorInbox.fields.requestedTime')}:</dt>
          <dd>{requestedTime ?? notSpecified}</dd>

          {description && (
            <>
              <dt className="font-medium">{t('operatorInbox.fields.description')}:</dt>
              <dd>{description}</dd>
            </>
          )}
        </dl>

        {/* AI Briefing — internal operator info (calendar availability) */}
        {operatorBriefing && (
          <Card className={`${spacing.margin.top.sm} ${hasTimeConflict ? 'border-destructive/50' : 'border-blue-500/50'}`}>
            <CardContent className={spacing.padding.md}>
              <h5 className={`${typography.label.sm} ${spacing.margin.bottom.xs} ${hasTimeConflict ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`}>
                {t('operatorInbox.sections.aiBriefing')}
              </h5>
              <div className={`${typography.body.sm} whitespace-pre-line text-muted-foreground`}>
                {operatorBriefing}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Draft reply email — editable */}
        {draftReply && (
          <Card className={spacing.margin.top.sm}>
            <CardContent className={spacing.padding.md}>
              <div className={`${spacing.gap.xs} flex items-center justify-between ${spacing.margin.bottom.xs}`}>
                <div className={`${spacing.gap.xs} flex items-center`}>
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  <h5 className={typography.label.sm}>
                    {t('operatorInbox.sections.draftReply')}
                  </h5>
                  {aiGenerated && (
                    <Badge variant="secondary" className="text-xs">
                      AI
                    </Badge>
                  )}
                  {editedDraftReply !== null && (
                    <Badge variant="outline" className="text-xs">
                      {t('operatorInbox.draftEdited')}
                    </Badge>
                  )}
                </div>
                {editedDraftReply !== null && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDraftReplyReset}
                    className="h-7 px-2 text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {t('operatorInbox.resetDraft')}
                  </Button>
                )}
              </div>
              <Textarea
                value={editedDraftReply ?? draftReply}
                onChange={(e) => onDraftReplyChange(e.target.value)}
                rows={6}
                className="text-sm"
              />
            </CardContent>
          </Card>
        )}
      </section>
    );
  }

  // ── Generic fallback for other action types ──
  // Show only non-hidden params in a readable format
  const visibleParams = Object.entries(params).filter(
    ([key]) => !HIDDEN_ACTION_PARAMS.has(key)
  );

  return (
    <div className={`${spacing.gap.xs} flex flex-col`}>
      <Badge variant="outline">{action.type}</Badge>
      {visibleParams.length > 0 && (
        <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr] ${typography.body.sm} text-muted-foreground`}>
          {visibleParams.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-medium">{key}:</dt>
              <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

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
  const [editedDraftReply, setEditedDraftReply] = useState<string | null>(null);

  const intake = context.intake;
  const understanding = context.understanding;
  const proposal = context.proposal;

  const isDraftModified = editedDraftReply !== null;

  const handleDraftReplyChange = useCallback((value: string) => {
    setEditedDraftReply(value);
  }, []);

  const handleDraftReplyReset = useCallback(() => {
    setEditedDraftReply(null);
  }, []);

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
            <div className={`${typography.body.sm} ${spacing.margin.top.xs} text-muted-foreground`}>
              <EmailContentWithSignature content={intake.normalized.contentText} />
            </div>
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
              {understanding.detectedIntents && understanding.detectedIntents.length > 1 && (
                <Badge variant="default" className="text-xs">
                  {understanding.detectedIntents.length} {t('operatorInbox.multiIntent.detected')}
                </Badge>
              )}
            </header>

            {/* Primary Intent */}
            <div className={`${spacing.gap.sm} flex flex-wrap items-center`}>
              {understanding.detectedIntents && understanding.detectedIntents.length > 1 && (
                <span className={`${typography.body.sm} font-medium text-muted-foreground`}>
                  {t('operatorInbox.multiIntent.primary')}:
                </span>
              )}
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

            {/* Secondary Intents */}
            {understanding.detectedIntents && understanding.detectedIntents.length > 1 && (
              <div className={`${spacing.margin.top.xs} ${spacing.gap.sm} flex flex-col`}>
                {understanding.detectedIntents.slice(1).map((di, idx) => (
                  <div key={idx} className={`${spacing.gap.sm} flex flex-wrap items-center`}>
                    <span className={`${typography.body.sm} font-medium text-muted-foreground`}>
                      {t('operatorInbox.multiIntent.secondary')}:
                    </span>
                    <Badge variant={getIntentBadgeVariant(di.intent)}>
                      {di.intent}
                    </Badge>
                    <span className={`${typography.body.sm} ${getConfidenceColor(di.confidence)}`}>
                      {di.confidence.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

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
              <div className={`${spacing.margin.top.sm} ${spacing.gap.md} flex flex-col`}>
                {proposal.suggestedActions.map((action, idx) => (
                  <ProposalActionRenderer
                    key={idx}
                    action={action}
                    spacing={spacing}
                    typography={typography}
                    t={t}
                    editedDraftReply={editedDraftReply}
                    onDraftReplyChange={handleDraftReplyChange}
                    onDraftReplyReset={handleDraftReplyReset}
                  />
                ))}
              </div>
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
        description={isDraftModified
          ? t('operatorInbox.confirmApproveModified')
          : t('operatorInbox.confirmApprove')
        }
        confirmText={t('operatorInbox.approve')}
        onConfirm={async () => {
          if (isDraftModified) {
            const modifiedActions = (proposal?.suggestedActions ?? []).map(action => ({
              ...action,
              params: {
                ...action.params,
                ...(action.params.draftReply !== undefined
                  ? { draftReply: editedDraftReply }
                  : {}),
              },
            }));
            await onApprove(queueId, modifiedActions);
          } else {
            await onApprove(queueId);
          }
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
