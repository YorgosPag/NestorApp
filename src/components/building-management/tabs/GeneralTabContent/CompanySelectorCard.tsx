'use client';

/**
 * =============================================================================
 * ENTERPRISE: CompanySelectorCard Component
 * =============================================================================
 *
 * Allows linking a building to a company.
 * Follows ProjectSelectorCard pattern for consistency.
 *
 * Uses:
 * - Radix Select (ADR-001 canonical)
 * - getAllActiveCompanies() service
 * - updateBuilding() via API (Admin SDK)
 * - Centralized design tokens (ZERO inline styles)
 *
 * @enterprise Fortune 500-grade component
 * @created 2026-02-06
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Building2, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { getAllActiveCompanies } from '@/services/companies.service';
import type { CompanyContact } from '@/types/contacts';
import { updateBuilding } from '../../building-services';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';

// =============================================================================
// TYPES
// =============================================================================

interface CompanySelectorCardProps {
  /** Building ID for update */
  buildingId: string;
  /** Current companyId (if any) */
  currentCompanyId?: string;
  /** Callback after successful update */
  onCompanyChanged?: (newCompanyId: string, companyName: string) => void;
  /** If in edit mode */
  isEditing?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CompanySelectorCard({
  buildingId,
  currentCompanyId,
  onCompanyChanged,
  isEditing = true,
}: CompanySelectorCardProps) {
  const { t } = useTranslation('building');
  const iconSizes = useIconSizes();
  const { getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const typography = useTypography();

  // State management
  const [companies, setCompanies] = useState<CompanyContact[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(currentCompanyId || '__none__');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      setLoading(true);
      try {
        const companiesData = await getAllActiveCompanies();
        setCompanies(companiesData);
        console.log(`✅ [CompanySelectorCard] Loaded ${companiesData.length} companies`);
      } catch (error) {
        console.error('❌ [CompanySelectorCard] Error loading companies:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanies();
  }, []);

  // Sync with external currentCompanyId changes
  useEffect(() => {
    if (currentCompanyId !== undefined) {
      setSelectedCompanyId(currentCompanyId || '__none__');
    }
  }, [currentCompanyId]);

  // Handle company selection
  const handleCompanyChange = useCallback((value: string) => {
    setSelectedCompanyId(value);
    setSaveStatus('idle');
  }, []);

  // Save via Enterprise API (Admin SDK)
  const handleSave = useCallback(async () => {
    if (!buildingId) {
      console.error('❌ [CompanySelectorCard] No buildingId provided');
      return;
    }

    setSaving(true);
    setSaveStatus('idle');

    try {
      const companyIdToSave = selectedCompanyId === '__none__' ? null : selectedCompanyId;
      const selectedCompany = companies.find(c => c.id === selectedCompanyId);
      const companyName = selectedCompany?.companyName || '';

      const result = await updateBuilding(buildingId, {
        companyId: companyIdToSave,
        company: companyName,
      });

      if (result.success) {
        console.log(`✅ [CompanySelectorCard] Building ${buildingId} linked to company ${companyIdToSave}`);
        setSaveStatus('success');

        if (onCompanyChanged && companyIdToSave) {
          onCompanyChanged(companyIdToSave, companyName);
        }

        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        console.error('❌ [CompanySelectorCard] Error:', result.error);
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('❌ [CompanySelectorCard] Error saving:', error);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }, [buildingId, selectedCompanyId, companies, onCompanyChanged]);

  // Check if value changed
  const hasChanges = selectedCompanyId !== (currentCompanyId || '__none__');

  // Get current company name for display
  const currentCompanyName = companies.find(c => c.id === currentCompanyId)?.companyName;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn('flex items-center gap-2', typography.card.titleCompact)}>
          <Building2 className={iconSizes.md} />
          {t('companySelector.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Selector */}
        <fieldset className="space-y-2">
          <Label htmlFor="company-selector">{t('companySelector.label')}</Label>

          {loading ? (
            <section className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className={cn(iconSizes.sm, 'animate-spin')} />
              <span>{t('companySelector.loading')}</span>
            </section>
          ) : (
            <Select
              value={selectedCompanyId}
              onValueChange={handleCompanyChange}
              disabled={!isEditing}
            >
              <SelectTrigger
                id="company-selector"
                className={cn(
                  !isEditing && 'bg-muted',
                  saveStatus === 'success' && getStatusBorder('success'),
                  saveStatus === 'error' && getStatusBorder('error')
                )}
              >
                <SelectValue placeholder={t('companySelector.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t('companySelector.noCompany')}
                </SelectItem>

                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id!}>
                    {company.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </fieldset>

        {/* Current company info (when not editing) */}
        {!isEditing && currentCompanyName && (
          <p className={cn('text-sm', colors.text.muted)}>
            {t('companySelector.currentCompany')} <strong>{currentCompanyName}</strong>
          </p>
        )}

        {/* Save button and status */}
        {isEditing && (
          <footer className="flex items-center justify-between pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              variant={hasChanges ? 'default' : 'outline'}
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 className={cn(iconSizes.sm, 'mr-2 animate-spin')} />
                  {t('companySelector.saving')}
                </>
              ) : (
                <>
                  <Save className={cn(iconSizes.sm, 'mr-2')} />
                  {t('companySelector.save')}
                </>
              )}
            </Button>

            {saveStatus === 'success' && (
              <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <CheckCircle className={iconSizes.sm} />
                {t('companySelector.success')}
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400">
                <AlertCircle className={iconSizes.sm} />
                {t('companySelector.error')}
              </span>
            )}
          </footer>
        )}
      </CardContent>
    </Card>
  );
}

export default CompanySelectorCard;
