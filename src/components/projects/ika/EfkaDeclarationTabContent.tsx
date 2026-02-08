'use client';

/**
 * =============================================================================
 * EfkaDeclarationTabContent — ΕΦΚΑ Project Declaration Tab
 * =============================================================================
 *
 * 5th sub-tab in IKA section. Manages:
 * - 7 required fields checklist
 * - ΕΦΚΑ status tracking (draft → submitted → active)
 * - ΑΜΟΕ storage
 * - Document tracking (Ε.1, Ε.3, Ε.4)
 *
 * Data stored as `efkaDeclaration` field on the project document.
 *
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React, { useState, useCallback } from 'react';
import { Landmark, Save, Loader2, AlertCircle, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useEfkaDeclaration } from './hooks/useEfkaDeclaration';
import { EfkaChecklist } from './components/EfkaChecklist';
import { EfkaStatusBadge } from './components/EfkaStatusBadge';
import { EfkaDocumentTracker } from './components/EfkaDocumentTracker';
import type { EfkaDeclarationData, EfkaProjectCategory } from './contracts';

interface EfkaDeclarationTabContentProps {
  projectId?: string;
}

export function EfkaDeclarationTabContent({ projectId }: EfkaDeclarationTabContentProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();

  const {
    declaration,
    isLoading,
    error,
    saveDeclaration,
    initializeDeclaration,
    completedFields,
    totalFields,
  } = useEfkaDeclaration(projectId);

  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<EfkaDeclarationData>>({});

  // Initialize form data when declaration loads
  React.useEffect(() => {
    if (declaration) {
      setFormData({
        employerVatNumber: declaration.employerVatNumber,
        projectAddress: declaration.projectAddress,
        projectDescription: declaration.projectDescription,
        startDate: declaration.startDate,
        estimatedEndDate: declaration.estimatedEndDate,
        estimatedWorkerCount: declaration.estimatedWorkerCount,
        projectCategory: declaration.projectCategory,
        amoe: declaration.amoe,
        notes: declaration.notes,
      });
    }
  }, [declaration]);

  const updateField = useCallback(<K extends keyof EfkaDeclarationData>(
    field: K,
    value: EfkaDeclarationData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setIsSaving(true);
      await saveDeclaration(formData);
    } finally {
      setIsSaving(false);
    }
  }, [formData, saveDeclaration]);

  const handleInitialize = useCallback(async () => {
    // TODO: Get actual userId from auth context
    await initializeDeclaration('current_user');
  }, [initializeDeclaration]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className={cn(iconSizes.lg, 'animate-spin text-muted-foreground')} />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <AlertCircle className={cn(iconSizes.md, colors.text.error)} />
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // No declaration yet — show init button
  if (!declaration) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Landmark className={cn(iconSizes.xl, 'text-muted-foreground mb-4')} />
          <p className="text-sm font-medium text-muted-foreground mb-4">
            {t('ika.efka.description')}
          </p>
          <Button onClick={handleInitialize}>
            <Plus className={cn(iconSizes.sm, spacing.margin.right.sm)} />
            {t('ika.efka.title')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      {/* Status header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={typography.card.titleCompact}>
                <Landmark className={cn(iconSizes.md, spacing.margin.right.sm, 'inline-block')} />
                {t('ika.efka.title')}
              </CardTitle>
              <CardDescription>{t('ika.efka.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <EfkaStatusBadge status={declaration.status} />
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className={cn(iconSizes.sm, spacing.margin.right.sm, 'animate-spin')} />
                ) : (
                  <Save className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                )}
                {t('ika.efka.save')}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* ΑΜΟΕ display */}
        {declaration.amoe && (
          <CardContent>
            <div className={cn('p-3 rounded-lg', colors.bg.success)}>
              <p className="text-sm font-medium">
                {t('ika.efka.amoe.fullLabel')}
              </p>
              <p className="text-lg font-bold">{declaration.amoe}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Checklist + Form in 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Checklist (sidebar) */}
        <div className="lg:col-span-1">
          <EfkaChecklist
            declaration={{ ...declaration, ...formData } as EfkaDeclarationData}
            completedFields={completedFields}
            totalFields={totalFields}
          />
        </div>

        {/* Form fields (main area) */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className={typography.card.titleCompact}>
                {t('ika.efka.checklist.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 1. ΑΦΜ Εργοδότη */}
              <div className="space-y-2">
                <Label htmlFor="employerVat">
                  {t('ika.efka.checklist.employerVatNumber')}
                </Label>
                <Input
                  id="employerVat"
                  value={formData.employerVatNumber ?? ''}
                  onChange={(e) => updateField('employerVatNumber', e.target.value || null)}
                  placeholder="123456789"
                  maxLength={9}
                />
              </div>

              {/* 2. Διεύθυνση Έργου */}
              <div className="space-y-2">
                <Label htmlFor="projectAddress">
                  {t('ika.efka.checklist.projectAddress')}
                </Label>
                <Input
                  id="projectAddress"
                  value={formData.projectAddress ?? ''}
                  onChange={(e) => updateField('projectAddress', e.target.value || null)}
                />
              </div>

              {/* 3. Περιγραφή Έργου */}
              <div className="space-y-2">
                <Label htmlFor="projectDescription">
                  {t('ika.efka.checklist.projectDescription')}
                </Label>
                <Textarea
                  id="projectDescription"
                  value={formData.projectDescription ?? ''}
                  onChange={(e) => updateField('projectDescription', e.target.value || null)}
                  rows={3}
                />
              </div>

              {/* 4 & 5: Dates side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">
                    {t('ika.efka.checklist.startDate')}
                  </Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate ?? ''}
                    onChange={(e) => updateField('startDate', e.target.value || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedEndDate">
                    {t('ika.efka.checklist.estimatedEndDate')}
                  </Label>
                  <Input
                    id="estimatedEndDate"
                    type="date"
                    value={formData.estimatedEndDate ?? ''}
                    onChange={(e) => updateField('estimatedEndDate', e.target.value || null)}
                  />
                </div>
              </div>

              {/* 6 & 7: Worker count & Category side by side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workerCount">
                    {t('ika.efka.checklist.estimatedWorkerCount')}
                  </Label>
                  <Input
                    id="workerCount"
                    type="number"
                    min={0}
                    value={formData.estimatedWorkerCount ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField('estimatedWorkerCount', val ? parseInt(val, 10) : null);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectCategory">
                    {t('ika.efka.checklist.projectCategory')}
                  </Label>
                  <Select
                    value={formData.projectCategory ?? ''}
                    onValueChange={(val) => updateField('projectCategory', (val || null) as EfkaProjectCategory | null)}
                  >
                    <SelectTrigger id="projectCategory">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="construction">
                        {t('ika.efka.categories.construction')}
                      </SelectItem>
                      <SelectItem value="technical">
                        {t('ika.efka.categories.technical')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ΑΜΟΕ (read-only until assigned) */}
              <div className="space-y-2">
                <Label htmlFor="amoe">
                  {t('ika.efka.amoe.label')}
                </Label>
                <Input
                  id="amoe"
                  value={formData.amoe ?? ''}
                  onChange={(e) => updateField('amoe', e.target.value || null)}
                  placeholder={t('ika.efka.amoe.placeholder')}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">
                  {t('ika.efka.notes')}
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes ?? ''}
                  onChange={(e) => updateField('notes', e.target.value || null)}
                  placeholder={t('ika.efka.notesPlaceholder')}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Documents tracker */}
      <EfkaDocumentTracker documents={declaration.documents} />
    </section>
  );
}
