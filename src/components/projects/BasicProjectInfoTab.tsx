'use client';

import React, { useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Building2 } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { EntityLinkCard } from '@/components/shared/EntityLinkCard';
import type { EntityLinkOption } from '@/components/shared/EntityLinkCard';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { ProjectFormData } from './general-tab/types';

interface BasicProjectInfoTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
    projectId: string;
    companyId?: string;
    /** 🏢 ENTERPRISE: Create mode — save company locally, no PATCH API call */
    isCreateMode?: boolean;
}

export function BasicProjectInfoTab({ data, setData, isEditing, projectId, companyId, isCreateMode }: BasicProjectInfoTabProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    const spacing = useSpacingTokens();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

    const loadCompanies = useCallback(async (): Promise<EntityLinkOption[]> => {
        const companies = await getAllCompaniesForSelect();
        return companies
            .filter(c => c.id)
            .map(c => ({ id: c.id!, name: c.companyName || '' }));
    }, []);

    const saveCompany = useCallback(async (newId: string | null, name: string) => {
        if (isCreateMode) {
            // 🏢 ENTERPRISE: Create mode — save locally only, no API call
            setData(prev => ({ ...prev, companyId: newId || '', companyName: name || '' }));
            return { success: true };
        }

        try {
            await apiClient.patch(`/api/projects/${projectId}`, {
                companyId: newId,
                company: name || null,
            });
            setData(prev => ({ ...prev, companyId: newId || '', companyName: name || '' }));
            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update',
            };
        }
    }, [projectId, setData, isCreateMode]);

    return (
        <Card>
            <CardHeader className={spacing.padding.sm}>
                <div className={cn("flex items-center", spacing.gap.sm)}>
                    <Briefcase className={`${iconSizes.md} text-primary`} />
                    <CardTitle className={typography.card.titleCompact}>{t('basicInfo.title')}</CardTitle>
                </div>
                <CardDescription>
                    {t('basicInfo.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className={cn(spacing.padding.sm, spacing.spaceBetween.md)}>
                <div className={cn("grid grid-cols-1 lg:grid-cols-2", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="name" className="text-sm font-medium">{t('basicInfo.projectTitle')}</Label>
                        <Input id="name" name="name" value={data.name} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="licenseTitle" className="text-sm font-medium">{t('basicInfo.licenseTitle')}</Label>
                        <Input id="licenseTitle" name="licenseTitle" value={data.licenseTitle} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                </div>

                {/* Company Link — EntityLinkCard (centralized) */}
                <EntityLinkCard
                    cardId="project-company-link"
                    icon={Building2}
                    currentValue={companyId}
                    loadOptions={loadCompanies}
                    onSave={saveCompany}
                    isEditing={isEditing}
                    searchable
                    searchPlaceholder="Αναζήτηση εταιρείας..."
                    labels={{
                        title: t('basicInfo.companyLink.title'),
                        label: t('basicInfo.companyLink.label'),
                        placeholder: t('basicInfo.companyLink.placeholder'),
                        noSelection: t('basicInfo.companyLink.noSelection'),
                        loading: t('basicInfo.companyLink.loading'),
                        save: t('basicInfo.companyLink.save'),
                        saving: t('basicInfo.companyLink.saving'),
                        success: t('basicInfo.companyLink.success'),
                        error: t('basicInfo.companyLink.error'),
                        currentLabel: t('basicInfo.companyLink.currentLabel'),
                    }}
                />

                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="description" className="text-sm font-medium">{t('basicInfo.projectDescription')}</Label>
                    <Textarea
                        id="description"
                        name="description"
                        rows={4}
                        className="resize-none"
                        value={data.description}
                        onChange={handleChange}
                        disabled={!isEditing}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
