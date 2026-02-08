'use client';

import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { EfkaDeclarationData, EfkaChecklistItem } from '../contracts';

interface EfkaChecklistProps {
  declaration: EfkaDeclarationData | null;
  completedFields: number;
  totalFields: number;
}

const CHECKLIST_FIELDS: EfkaChecklistItem['fieldKey'][] = [
  'employerVatNumber',
  'projectAddress',
  'projectDescription',
  'startDate',
  'estimatedEndDate',
  'estimatedWorkerCount',
  'projectCategory',
];

export function EfkaChecklist({ declaration, completedFields, totalFields }: EfkaChecklistProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();

  const isFieldCompleted = (fieldKey: EfkaChecklistItem['fieldKey']): boolean => {
    if (!declaration) return false;
    const value = declaration[fieldKey];
    return value !== null && value !== undefined && value !== '';
  };

  const allComplete = completedFields === totalFields;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={typography.card.titleCompact}>
          {t('ika.efka.checklist.title')}
        </CardTitle>
        <p className={cn('text-sm', allComplete ? colors.text.success : 'text-muted-foreground')}>
          {allComplete
            ? t('ika.efka.checklist.allComplete')
            : t('ika.efka.checklist.completion', {
                completed: String(completedFields),
                total: String(totalFields),
              })
          }
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3" role="list">
          {CHECKLIST_FIELDS.map((fieldKey) => {
            const completed = isFieldCompleted(fieldKey);
            return (
              <li key={fieldKey} className="flex items-center gap-3">
                {completed ? (
                  <CheckCircle className={cn(iconSizes.sm, colors.text.success)} />
                ) : (
                  <Circle className={cn(iconSizes.sm, 'text-muted-foreground')} />
                )}
                <span className={cn(
                  'text-sm',
                  completed ? 'line-through text-muted-foreground' : 'text-foreground'
                )}>
                  {t(`ika.efka.checklist.${fieldKey}`)}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
