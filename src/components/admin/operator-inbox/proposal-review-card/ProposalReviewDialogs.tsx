import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Textarea } from '@/components/ui/textarea';
import type { ProposalReviewDialogsProps } from './proposal-review-card-types';

export function ProposalReviewDialogs({
  approveOpen,
  rejectOpen,
  rejectReason,
  isDraftModified,
  spacing,
  typography,
  t,
  onApproveOpenChange,
  onRejectOpenChange,
  onRejectReasonChange,
  onApprove,
  onReject,
}: ProposalReviewDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={onApproveOpenChange}
        title={t('operatorInbox.approve')}
        description={isDraftModified
          ? t('operatorInbox.confirmApproveModified')
          : t('operatorInbox.confirmApprove')}
        confirmText={t('operatorInbox.approve')}
        onConfirm={onApprove}
      />

      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={onRejectOpenChange}
        title={t('operatorInbox.reject')}
        description={t('operatorInbox.confirmReject')}
        confirmText={t('operatorInbox.reject')}
        variant="destructive"
        onConfirm={onReject}
      >
        <label className={`${spacing.gap.xs} flex flex-col`}>
          <span className={typography.body.sm}>{t('operatorInbox.fields.reason')}</span>
          <Textarea
            size="sm"
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            className="min-h-[80px]"
            placeholder={t('operatorInbox.fields.reason')}
          />
        </label>
      </ConfirmDialog>
    </>
  );
}
