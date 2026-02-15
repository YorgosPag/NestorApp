'use client';

/**
 * 🏢 ENTERPRISE: ProjectDetailsSubTab — Inline editing for project details
 *
 * Fields migrated from AddProjectDialog modal (Details tab):
 * type, priority, riskLevel, complexity, budget, totalValue,
 * totalArea, duration, startDate, completionDate, client, location
 *
 * Uses same isEditing pattern as BasicProjectInfoTab.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from '../types';
import type {
  ProjectType,
  ProjectPriority,
  ProjectRiskLevel,
  ProjectComplexity,
} from '@/types/project';

// =============================================================================
// TYPES
// =============================================================================

interface ProjectDetailsSubTabProps {
  data: ProjectFormData;
  setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  isEditing: boolean;
}

// =============================================================================
// DROPDOWN OPTIONS (type-safe — same as AddProjectDialog)
// =============================================================================

const PROJECT_TYPE_OPTIONS: ProjectType[] = [
  'residential', 'commercial', 'industrial', 'mixed', 'infrastructure', 'renovation',
];

const PRIORITY_OPTIONS: ProjectPriority[] = ['low', 'medium', 'high', 'critical'];

const RISK_LEVEL_OPTIONS: ProjectRiskLevel[] = ['low', 'medium', 'high', 'critical'];

const COMPLEXITY_OPTIONS: ProjectComplexity[] = [
  'simple', 'moderate', 'complex', 'highly_complex',
];

// =============================================================================
// COMPONENT
// =============================================================================

export function ProjectDetailsSubTab({ data, setData, isEditing }: ProjectDetailsSubTabProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNumberChange = (name: keyof ProjectFormData, value: string) => {
    const numValue = value === '' ? '' : Number(value);
    setData(prev => ({ ...prev, [name]: numValue }));
  };

  const handleSelectChange = (name: keyof ProjectFormData, value: string) => {
    setData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card>
      <CardHeader className={spacing.padding.sm}>
        <div className={cn('flex items-center', spacing.gap.sm)}>
          <ClipboardList className={`${iconSizes.md} text-primary`} />
          <CardTitle className={typography.card.titleCompact}>{t('dialog.tabs.details')}</CardTitle>
        </div>
        <CardDescription>{t('dialog.editDescription')}</CardDescription>
      </CardHeader>
      <CardContent className={cn(spacing.padding.sm, spacing.spaceBetween.md)}>
        {/* Row 1: Client + Type */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="client" className="text-sm font-medium">{t('dialog.fields.client')}</Label>
            <Input
              id="client"
              name="client"
              value={data.client}
              onChange={handleChange}
              placeholder={t('dialog.fields.clientPlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="location" className="text-sm font-medium">{t('dialog.fields.location')}</Label>
            <Input
              id="location"
              name="location"
              value={data.location}
              onChange={handleChange}
              placeholder={t('dialog.fields.locationPlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
        </div>

        {/* Row 2: Type + Priority */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label className="text-sm font-medium">{t('dialog.fields.type')}</Label>
            <Select
              value={data.type || undefined}
              onValueChange={(v) => handleSelectChange('type', v)}
              disabled={!isEditing}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('dialog.fields.typePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_TYPE_OPTIONS.map(type => (
                  <SelectItem key={type} value={type}>{t(`projectType.${type}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label className="text-sm font-medium">{t('dialog.fields.priority')}</Label>
            <Select
              value={data.priority || undefined}
              onValueChange={(v) => handleSelectChange('priority', v)}
              disabled={!isEditing}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('dialog.fields.priorityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{t(`priority.${p}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>

        {/* Row 3: Risk Level + Complexity */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label className="text-sm font-medium">{t('dialog.fields.riskLevel')}</Label>
            <Select
              value={data.riskLevel || undefined}
              onValueChange={(v) => handleSelectChange('riskLevel', v)}
              disabled={!isEditing}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('dialog.fields.riskLevelPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {RISK_LEVEL_OPTIONS.map(rl => (
                  <SelectItem key={rl} value={rl}>{t(`riskLevel.${rl}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label className="text-sm font-medium">{t('dialog.fields.complexity')}</Label>
            <Select
              value={data.complexity || undefined}
              onValueChange={(v) => handleSelectChange('complexity', v)}
              disabled={!isEditing}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder={t('dialog.fields.complexityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {COMPLEXITY_OPTIONS.map(c => (
                  <SelectItem key={c} value={c}>{t(`complexity.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </fieldset>
        </div>

        {/* Row 4: Budget + Total Value */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="budget" className="text-sm font-medium">{t('dialog.fields.budget')}</Label>
            <Input
              id="budget"
              name="budget"
              type="number"
              value={data.budget}
              onChange={(e) => handleNumberChange('budget', e.target.value)}
              placeholder={t('dialog.fields.budgetPlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="totalValue" className="text-sm font-medium">{t('dialog.fields.totalValue')}</Label>
            <Input
              id="totalValue"
              name="totalValue"
              type="number"
              value={data.totalValue}
              onChange={(e) => handleNumberChange('totalValue', e.target.value)}
              placeholder={t('dialog.fields.totalValuePlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
        </div>

        {/* Row 5: Total Area + Duration */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="totalArea" className="text-sm font-medium">{t('dialog.fields.totalArea')}</Label>
            <Input
              id="totalArea"
              name="totalArea"
              type="number"
              value={data.totalArea}
              onChange={(e) => handleNumberChange('totalArea', e.target.value)}
              placeholder={t('dialog.fields.totalAreaPlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="duration" className="text-sm font-medium">{t('dialog.fields.duration')}</Label>
            <Input
              id="duration"
              name="duration"
              type="number"
              value={data.duration}
              onChange={(e) => handleNumberChange('duration', e.target.value)}
              placeholder={t('dialog.fields.durationPlaceholder')}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
        </div>

        {/* Row 6: Start Date + Completion Date */}
        <div className={cn('grid grid-cols-1 lg:grid-cols-2', spacing.gap.md)}>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="startDate" className="text-sm font-medium">{t('dialog.fields.startDate')}</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              value={data.startDate}
              onChange={handleChange}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
          <fieldset className={spacing.spaceBetween.sm}>
            <Label htmlFor="completionDate" className="text-sm font-medium">{t('dialog.fields.completionDate')}</Label>
            <Input
              id="completionDate"
              name="completionDate"
              type="date"
              value={data.completionDate}
              onChange={handleChange}
              disabled={!isEditing}
              className="h-10"
            />
          </fieldset>
        </div>
      </CardContent>
    </Card>
  );
}
