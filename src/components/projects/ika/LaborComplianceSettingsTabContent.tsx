/* eslint-disable design-system/prefer-design-system-imports */
'use client';

/**
 * =============================================================================
 * LaborComplianceSettingsTabContent — Admin panel for EFKA insurance config
 * =============================================================================
 *
 * 6th sub-tab in the IKA tab. Allows the accountant to:
 * - View/edit 28 insurance classes (KPK 781)
 * - View/edit contribution rates (employer + employee)
 * - Seed defaults to Firestore
 * - Update annually when new EFKA circular is issued
 *
 * @module components/projects/ika/LaborComplianceSettingsTabContent
 * @enterprise ADR-090 — IKA/EFKA Labor Compliance System
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Save, RefreshCw, Pencil, X, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/providers/NotificationProvider';
import { LaborComplianceService } from '@/services/labor-compliance';
import {
  saveLaborComplianceConfigWithPolicy,
  seedLaborComplianceDefaultsWithPolicy,
} from '@/services/labor-compliance/labor-compliance-mutation-gateway';
import type { LaborComplianceDocument } from '@/services/labor-compliance';
import type { InsuranceClass, ContributionRates } from './contracts';
import {
  DEFAULT_INSURANCE_CLASSES,
  DEFAULT_CONTRIBUTION_RATES,
} from './contracts';
import { InsuranceClassesTable } from './components/InsuranceClassesTable';
import { ContributionRatesCard } from './components/ContributionRatesCard';

interface LaborComplianceSettingsTabContentProps {
  /** Project ID from parent IKA tab */
  projectId?: string;
}

export function LaborComplianceSettingsTabContent({ projectId: _projectId }: LaborComplianceSettingsTabContentProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();
  const spacing = useSpacingTokens();
  const _borders = useBorderTokens();
  const { user } = useAuth();
  const notifications = useNotifications();

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isFromFirestore, setIsFromFirestore] = useState(false);
  const [fullDoc, setFullDoc] = useState<LaborComplianceDocument | null>(null);

  // Editable state
  const [classes, setClasses] = useState<InsuranceClass[]>(DEFAULT_INSURANCE_CLASSES);
  const [rates, setRates] = useState<ContributionRates>(DEFAULT_CONTRIBUTION_RATES);
  const [activeYear, setActiveYear] = useState(new Date().getFullYear());
  const [sourceCircular, setSourceCircular] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  // --- Load data ---
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const doc = await LaborComplianceService.getFullDocument();
      if (doc) {
        setFullDoc(doc);
        setClasses([...doc.insuranceClasses]);
        setRates({ ...doc.contributionRates });
        setActiveYear(doc.activeYear);
        setSourceCircular(doc.sourceCircular ?? '');
        setEffectiveDate(doc.effectiveDate);
        setIsFromFirestore(true);
      } else {
        setFullDoc(null);
        setClasses([...DEFAULT_INSURANCE_CLASSES]);
        setRates({ ...DEFAULT_CONTRIBUTION_RATES });
        setIsFromFirestore(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load';
      notifications.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, [notifications]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Handlers ---
  const handleClassChange = useCallback(
    (index: number, field: keyof Pick<InsuranceClass, 'minDailyWage' | 'maxDailyWage' | 'imputedDailyWage'>, value: number) => {
      setClasses(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    []
  );

  const handleRateChange = useCallback((newRates: ContributionRates) => {
    setRates(newRates);
  }, []);

  const handleSave = useCallback(async () => {
    if (!user?.uid) return;

    // Validate first
    const classValidation = LaborComplianceService.validateInsuranceClasses(classes);
    if (!classValidation.valid) {
      notifications.error(`${t('ika.efkaSettingsTab.validationError')}: ${classValidation.errors[0]}`);
      return;
    }
    const rateValidation = LaborComplianceService.validateContributionRates(rates);
    if (!rateValidation.valid) {
      notifications.error(`${t('ika.efkaSettingsTab.validationError')}: ${rateValidation.errors[0]}`);
      return;
    }

    try {
      setIsSaving(true);
      await saveLaborComplianceConfigWithPolicy({
        classes,
        rates,
        metadata: {
          year: activeYear,
          userId: user.uid,
          sourceCircular: sourceCircular || null,
          effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
        },
      });
      notifications.success(t('ika.efkaSettingsTab.saveSuccess'));
      setIsEditing(false);
      await loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      notifications.error(msg);
    } finally {
      setIsSaving(false);
    }
  }, [user, classes, rates, activeYear, sourceCircular, effectiveDate, notifications, t, loadData]);

  const handleSeed = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setIsSeeding(true);
      const seeded = await seedLaborComplianceDefaultsWithPolicy({
        userId: user.uid,
      });
      if (seeded) {
        notifications.success(t('ika.efkaSettingsTab.seedSuccess'));
        await loadData();
      } else {
        notifications.info('Document already exists');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Seed failed';
      notifications.error(msg);
    } finally {
      setIsSeeding(false);
    }
  }, [user, notifications, t, loadData]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    // Reset to stored values
    if (fullDoc) {
      setClasses([...fullDoc.insuranceClasses]);
      setRates({ ...fullDoc.contributionRates });
      setActiveYear(fullDoc.activeYear);
      setSourceCircular(fullDoc.sourceCircular ?? '');
      setEffectiveDate(fullDoc.effectiveDate);
    } else {
      setClasses([...DEFAULT_INSURANCE_CLASSES]);
      setRates({ ...DEFAULT_CONTRIBUTION_RATES });
    }
  }, [fullDoc]);

  if (isLoading) {
    return (
      <section className={cn('flex items-center justify-center', spacing.padding.xl)}>
        <RefreshCw className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} />
      </section>
    );
  }

  return (
    <section className={cn('space-y-2', spacing.padding.top.md)}>
      {/* Header */}
      <header className="flex items-center justify-between">
        <hgroup>
          <h2 className={cn(typography.heading.h3, 'flex items-center gap-2')}>
            <Settings className={iconSizes.md} />
            {t('ika.efkaSettingsTab.title')}
          </h2>
          <p className={cn(typography.body.sm, colors.text.muted)}>
            {t('ika.efkaSettingsTab.description')}
          </p>
        </hgroup>
        <nav className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className={iconSizes.sm} />
                <span className="ml-1">{t('projectHeader.cancel')}</span>
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <Save className={iconSizes.sm} />
                <span className="ml-1">
                  {isSaving ? t('ika.efkaSettingsTab.saving') : t('ika.efkaSettingsTab.save')}
                </span>
              </Button>
            </>
          ) : (
            <>
              {!isFromFirestore && (
                <Button variant="outline" onClick={handleSeed} disabled={isSeeding}>
                  <RefreshCw className={cn(iconSizes.sm, isSeeding && 'animate-spin')} />
                  <span className="ml-1">
                    {isSeeding ? t('ika.efkaSettingsTab.seeding') : t('ika.efkaSettingsTab.seedDefaults')}
                  </span>
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className={iconSizes.sm} />
                <span className="ml-1">{t('projectHeader.edit')}</span>
              </Button>
            </>
          )}
        </nav>
      </header>

      {/* Defaults banner */}
      {!isFromFirestore && (
        <aside className={cn(
          'flex items-center gap-2 rounded-md border px-2 py-2',
          'bg-amber-50 border-amber-200 text-amber-800',
          'dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200'
        )}>
          <Info className={iconSizes.sm} />
          <p className={typography.body.sm}>{t('ika.efkaSettingsTab.usingDefaults')}</p>
        </aside>
      )}

      {/* General Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className={typography.heading.h4}>
            {t('ika.efkaSettingsTab.generalCard')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className={cn(typography.label.sm, colors.text.muted, 'mb-1')}>
                {t('ika.efkaSettingsTab.activeYear')}
              </dt>
              <dd>
                {isEditing ? (
                  <Input
                    type="number"
                    min="2020"
                    max="2100"
                    value={activeYear}
                    onChange={(e) => setActiveYear(parseInt(e.target.value, 10) || activeYear)}
                    className="w-28"
                  />
                ) : (
                  <span className={typography.label.md}>{activeYear}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className={cn(typography.label.sm, colors.text.muted, 'mb-1')}>
                {t('ika.efkaSettingsTab.sourceCircular')}
              </dt>
              <dd>
                {isEditing ? (
                  <Input
                    value={sourceCircular}
                    onChange={(e) => setSourceCircular(e.target.value)}
                    placeholder={t('ika.efkaSettingsTab.sourceCircularPlaceholder')}
                  />
                ) : (
                  <span className={typography.body.md}>{sourceCircular || '—'}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className={cn(typography.label.sm, colors.text.muted, 'mb-1')}>
                {t('ika.efkaSettingsTab.effectiveDate')}
              </dt>
              <dd>
                {isEditing ? (
                  <Input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-40"
                  />
                ) : (
                  <span className={typography.body.md}>{effectiveDate || '—'}</span>
                )}
              </dd>
            </div>
            {fullDoc && (
              <div>
                <dt className={cn(typography.label.sm, colors.text.muted, 'mb-1')}>
                  {t('ika.efkaSettingsTab.lastUpdated')}
                </dt>
                <dd>
                  <span className={typography.body.md}>
                    {new Date(fullDoc.lastUpdated).toLocaleDateString('el-GR')}
                  </span>
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Insurance Classes Card */}
      <Card>
        <CardHeader>
          <CardTitle className={typography.heading.h4}>
            {t('ika.efkaSettingsTab.insuranceClassesCard')} ({classes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <InsuranceClassesTable
            classes={classes}
            isEditing={isEditing}
            onClassChange={handleClassChange}
          />
        </CardContent>
      </Card>

      {/* Contribution Rates Card */}
      <Card>
        <CardHeader>
          <CardTitle className={typography.heading.h4}>
            {t('ika.efkaSettingsTab.contributionRatesCard')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContributionRatesCard
            rates={rates}
            isEditing={isEditing}
            onRateChange={handleRateChange}
          />
        </CardContent>
      </Card>
    </section>
  );
}
