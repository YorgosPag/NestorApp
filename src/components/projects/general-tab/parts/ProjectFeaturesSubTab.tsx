'use client';

/**
 * 🏢 ENTERPRISE: ProjectFeaturesSubTab — Inline editing for project features (booleans)
 *
 * Fields migrated from AddProjectDialog modal (Features tab):
 * hasPermits, hasFinancing, isEcological, hasSubcontractors, isActive, hasIssues
 *
 * Uses same isEditing pattern as BasicProjectInfoTab.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from '../types';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectFeaturesSubTabProps {
  data: ProjectFormData;
  setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  isEditing: boolean;
}

// =============================================================================
// FEATURE CHECKBOX CONFIG (DRY — avoids 6x duplicate markup)
// =============================================================================

const FEATURE_FIELDS = [
  'hasPermits',
  'hasFinancing',
  'isEcological',
  'hasSubcontractors',
  'isActive',
  'hasIssues',
] as const;

type FeatureField = typeof FEATURE_FIELDS[number];

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectFeaturesSubTab({ data, setData, isEditing }: ProjectFeaturesSubTabProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const handleCheckboxChange = (name: FeatureField, checked: boolean) => {
    setData(prev => ({ ...prev, [name]: checked }));
  };

  return (
    <Card>
      <CardHeader className={spacing.padding.sm}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <Settings2 className={`${iconSizes.md} text-primary`} />
          <CardTitle className={typography.card.titleCompact}>{t('dialog.tabs.features')}</CardTitle>
        </div>
        <CardDescription>{t('generalTab.tabs.featuresDescription')}</CardDescription>
      </CardHeader>
      <CardContent className={spacing.padding.sm}>
        <section className={cn('grid grid-cols-1 md:grid-cols-2', spacing.gap.md)}>
          {FEATURE_FIELDS.map(field => (
            <div key={field} className="flex items-center space-x-3">
              <Checkbox
                id={field}
                checked={data[field] as boolean}
                onCheckedChange={(checked) => handleCheckboxChange(field, checked as boolean)}
                disabled={!isEditing}
              />
              <Label htmlFor={field} className="text-sm font-medium">
                {t(`dialog.fields.${field}`)}
              </Label>
            </div>
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
