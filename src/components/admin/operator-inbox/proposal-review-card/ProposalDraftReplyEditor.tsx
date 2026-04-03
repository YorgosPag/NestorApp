import { Pencil, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { ProposalActionRendererSharedProps } from './proposal-review-card-types';

interface ProposalDraftReplyEditorProps extends ProposalActionRendererSharedProps {
  draftReply: string;
  editedDraftReply: string | null;
  aiGenerated?: boolean;
  onDraftReplyChange: (value: string) => void;
  onDraftReplyReset: () => void;
}

export function ProposalDraftReplyEditor({
  spacing,
  typography,
  t,
  draftReply,
  editedDraftReply,
  aiGenerated,
  onDraftReplyChange,
  onDraftReplyReset,
}: ProposalDraftReplyEditorProps) {
  const colors = useSemanticColors();

  return (
    <Card className={spacing.margin.top.sm}>
      <CardContent className={spacing.padding.md}>
        <header className={`${spacing.gap.xs} flex items-center justify-between ${spacing.margin.bottom.xs}`}>
          <div className={`${spacing.gap.xs} flex items-center`}>
            <Pencil className={`h-3.5 w-3.5 ${colors.text.muted}`} />
            <h5 className={typography.label.sm}>
              {t('operatorInbox.sections.draftReply')}
            </h5>
            {aiGenerated ? (
              <Badge variant="secondary" className="text-xs">
                AI
              </Badge>
            ) : null}
            {editedDraftReply !== null ? (
              <Badge variant="outline" className="text-xs">
                {t('operatorInbox.draftEdited')}
              </Badge>
            ) : null}
          </div>
          {editedDraftReply !== null ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDraftReplyReset}
              className="h-7 px-2 text-xs"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              {t('operatorInbox.resetDraft')}
            </Button>
          ) : null}
        </header>
        <Textarea
          value={editedDraftReply ?? draftReply}
          onChange={(event) => onDraftReplyChange(event.target.value)}
          rows={6}
          className="text-sm"
        />
      </CardContent>
    </Card>
  );
}
