import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { HIDDEN_ACTION_PARAMS } from './proposal-review-card-helpers';
import {
  getCreateAppointmentActionView,
  getReplyPropertyListActionView,
  getVisibleActionParams,
} from './proposal-review-card-view-models';
import { ProposalDraftReplyEditor } from './ProposalDraftReplyEditor';
import type { ProposalActionContentProps } from './proposal-review-card-types';

export function ProposalActionContent({
  action,
  spacing,
  typography,
  t,
  editedDraftReply,
  onDraftReplyChange,
  onDraftReplyReset,
}: ProposalActionContentProps) {
  const colors = useSemanticColors();

  if (action.type === 'reply_property_list') {
    const actionView = getReplyPropertyListActionView(action);

    return (
      <section className={`${spacing.gap.sm} flex flex-col`}>
        <header className={`${spacing.gap.sm} flex flex-wrap items-center`}>
          <Badge variant="outline">{t('operatorInbox.actions.replyPropertyList')}</Badge>
          {actionView.senderName ? (
            <span className={`${typography.body.sm} ${colors.text.muted}`}>
              → {actionView.senderName}
            </span>
          ) : null}
        </header>

        <div className={`${spacing.gap.xs} flex flex-wrap items-center`}>
          {actionView.criteriaSummary ? (
            <Badge variant="secondary">
              {t('operatorInbox.fields.criteria')}: {actionView.criteriaSummary}
            </Badge>
          ) : null}
          <span className={typography.body.sm}>
            {actionView.matchingUnitsCount ?? 0} {t('operatorInbox.fields.matchingUnits')} ({actionView.totalAvailable ?? 0} {t('operatorInbox.fields.totalAvailable')})
          </span>
        </div>

        {actionView.matchingUnits && actionView.matchingUnits.length > 0 ? (
          <ul className={`${spacing.margin.top.xs} ${spacing.gap.xs} list-disc list-inside`}>
            {actionView.matchingUnits.map((unit, index) => (
              <li key={`${unit.name ?? 'unit'}-${index}`} className={`${typography.body.sm} ${colors.text.muted}`}>
                <strong>{unit.name}</strong>
                {unit.area ? ` - ${unit.area} τ.μ.` : ''}
                {unit.floor ? `, ${unit.floor}ος` : ''}
                {unit.building ? `, ${unit.building}` : ''}
                {unit.price != null ? `, ${unit.price.toLocaleString('el-GR')}€` : ''}
              </li>
            ))}
          </ul>
        ) : null}

        {actionView.draftReply ? (
          <ProposalDraftReplyEditor
            spacing={spacing}
            typography={typography}
            t={t}
            draftReply={actionView.draftReply}
            editedDraftReply={editedDraftReply}
            onDraftReplyChange={onDraftReplyChange}
            onDraftReplyReset={onDraftReplyReset}
          />
        ) : null}
      </section>
    );
  }

  if (action.type === 'create_appointment') {
    const actionView = getCreateAppointmentActionView(action);
    const notSpecified = t('operatorInbox.fields.notSpecified');

    return (
      <section className={`${spacing.gap.sm} flex flex-col`}>
        <header className={`${spacing.gap.sm} flex flex-wrap items-center`}>
          <Badge variant="outline">{t('operatorInbox.actions.createAppointment')}</Badge>
          {actionView.senderName ? (
            <span className={`${typography.body.sm} ${colors.text.muted}`}>
              → {actionView.senderName}
            </span>
          ) : null}
        </header>

        <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr] ${typography.body.sm} ${colors.text.muted}`}>
          <dt className="font-medium">{t('operatorInbox.fields.requestedDate')}:</dt>
          <dd>{actionView.requestedDate ?? notSpecified}</dd>

          <dt className="font-medium">{t('operatorInbox.fields.requestedTime')}:</dt>
          <dd>{actionView.requestedTime ?? notSpecified}</dd>

          {actionView.description ? (
            <>
              <dt className="font-medium">{t('operatorInbox.fields.description')}:</dt>
              <dd>{actionView.description}</dd>
            </>
          ) : null}
        </dl>

        {actionView.operatorBriefing ? (
          <Card className={`${spacing.margin.top.sm} ${actionView.hasTimeConflict ? 'border-destructive/50' : 'border-blue-500/50'}`}>
            <CardContent className={spacing.padding.md}>
              <h5 className={`${typography.label.sm} ${spacing.margin.bottom.xs} ${actionView.hasTimeConflict ? 'text-destructive' : 'text-blue-600 dark:text-blue-400'}`}>
                {t('operatorInbox.sections.aiBriefing')}
              </h5>
              <div className={`${typography.body.sm} whitespace-pre-line ${colors.text.muted}`}>
                {actionView.operatorBriefing}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {actionView.draftReply ? (
          <ProposalDraftReplyEditor
            spacing={spacing}
            typography={typography}
            t={t}
            draftReply={actionView.draftReply}
            editedDraftReply={editedDraftReply}
            aiGenerated={actionView.aiGenerated}
            onDraftReplyChange={onDraftReplyChange}
            onDraftReplyReset={onDraftReplyReset}
          />
        ) : null}
      </section>
    );
  }

  const visibleParams = getVisibleActionParams(action.params, HIDDEN_ACTION_PARAMS);

  return (
    <section className={`${spacing.gap.xs} flex flex-col`}>
      <Badge variant="outline">{action.type}</Badge>
      {visibleParams.length > 0 ? (
        <dl className={`${spacing.gap.xs} grid grid-cols-[auto_1fr] ${typography.body.sm} ${colors.text.muted}`}>
          {visibleParams.map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="font-medium">{key}:</dt>
              <dd>{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
