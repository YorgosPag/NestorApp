'use client';

/**
 * 📝 SSoT Description & Notes Card
 *
 * ADR-194: Canonical presentational card rendering the paired
 * "description" + "notes" textareas used at the bottom of space entity
 * info tabs (storage, parking, future units/offices).
 *
 * Presentational only — no hooks beyond design-system adapters, no data
 * layer coupling. Callers pass form values, callbacks and translated
 * labels. This keeps the i18n namespace per-entity (ADR-280) while
 * centralizing the UI.
 */

import { StickyNote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface DescriptionNotesCardLabels {
  title: string;
  description: string;
  notes: string;
}

export interface DescriptionNotesCardProps {
  description: string;
  notes: string;
  isEditing: boolean;
  onDescriptionChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  labels: DescriptionNotesCardLabels;
}

export function DescriptionNotesCard({
  description,
  notes,
  isEditing,
  onDescriptionChange,
  onNotesChange,
  labels,
}: DescriptionNotesCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <StickyNote className={cn(iconSizes.md, 'text-violet-500')} />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <fieldset className="space-y-1.5">
          <Label className={cn('text-xs', colors.text.muted)}>{labels.description}</Label>
          <Textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="h-20 text-sm resize-none"
            disabled={!isEditing}
          />
        </fieldset>
        <fieldset className="space-y-1.5">
          <Label className={cn('text-xs', colors.text.muted)}>{labels.notes}</Label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="h-20 text-sm resize-none"
            disabled={!isEditing}
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}
