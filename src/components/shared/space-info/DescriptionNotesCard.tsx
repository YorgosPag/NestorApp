/* eslint-disable design-system/prefer-design-system-imports */
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

/** The description/notes slice of a space form. */
export interface DescriptionNotesForm {
  description: string;
  notes: string;
}

export interface DescriptionNotesCardProps {
  form: DescriptionNotesForm;
  isEditing: boolean;
  /** Write one field back into the owner's form state. */
  onChange: (key: keyof DescriptionNotesForm, value: string) => void;
  /**
   * Namespaced translate function (ADR-280) — the label keys are identical for
   * every space entity, so the card resolves them itself rather than making each
   * caller re-declare the same block.
   */
  t: (key: string) => string;
}

export function DescriptionNotesCard({
  form,
  isEditing,
  onChange,
  t,
}: DescriptionNotesCardProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const colors = useSemanticColors();

  const labels = {
    title: t('general.descriptionNotes'),
    description: t('general.fields.description'),
    notes: t('general.fields.notes'),
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <StickyNote className={cn(iconSizes.md, 'text-primary')} />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <fieldset className="space-y-1.5">
          <Label className={cn('text-xs', colors.text.muted)}>{labels.description}</Label>
          <Textarea
            value={form.description}
            onChange={(e) => onChange('description', e.target.value)}
            className="h-20 text-sm resize-none"
            disabled={!isEditing}
          />
        </fieldset>
        <fieldset className="space-y-1.5">
          <Label className={cn('text-xs', colors.text.muted)}>{labels.notes}</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => onChange('notes', e.target.value)}
            className="h-20 text-sm resize-none"
            disabled={!isEditing}
          />
        </fieldset>
      </CardContent>
    </Card>
  );
}
