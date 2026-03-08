'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase, Building2, Loader2 } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAllCompaniesForSelect } from '@/services/companies.service';
import type { ProjectFormData } from './general-tab/types';

interface CompanyOption {
    id: string;
    name: string;
}

interface BasicProjectInfoTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
    projectId: string;
    companyId?: string;
    /** 🏢 ENTERPRISE: Create mode — save company locally, no PATCH API call */
    isCreateMode?: boolean;
}

export function BasicProjectInfoTab({ data, setData, isEditing, companyId }: BasicProjectInfoTabProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    const spacing = useSpacingTokens();

    const [companies, setCompanies] = useState<CompanyOption[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // Load companies on mount
    useEffect(() => {
        let cancelled = false;
        setLoadingCompanies(true);

        getAllCompaniesForSelect()
            .then(result => {
                if (!cancelled) {
                    setCompanies(
                        result
                            .filter(c => c.id)
                            .map(c => ({ id: c.id!, name: c.companyName || '' }))
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingCompanies(false);
            });

        return () => { cancelled = true; };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleCompanySelect = (selectedId: string) => {
        const selected = companies.find(c => c.id === selectedId);
        setData(prev => ({
            ...prev,
            companyId: selectedId,
            companyName: selected?.name || '',
        }));
    };

    const currentCompanyId = data.companyId || companyId || '';

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
                        <Input id="name" name="name" value={data.name} onChange={handleChange} disabled={!isEditing} placeholder={t('basicInfo.projectTitlePlaceholder')} className="h-10" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="licenseTitle" className="text-sm font-medium">{t('basicInfo.licenseTitle')}</Label>
                        <Input id="licenseTitle" name="licenseTitle" value={data.licenseTitle} onChange={handleChange} disabled={!isEditing} placeholder={t('basicInfo.licenseTitlePlaceholder')} className="h-10" />
                    </div>
                </div>

                {/* Company Selection — Radix Select (ADR-001) */}
                <div className={spacing.spaceBetween.sm}>
                    <Label className="text-sm font-medium">
                        <span className={cn("inline-flex items-center", spacing.gap.sm)}>
                            <Building2 className={iconSizes.sm} />
                            {t('basicInfo.companyLink.label')}
                        </span>
                    </Label>
                    {loadingCompanies ? (
                        <div className={cn("flex items-center", spacing.gap.sm, "h-10 text-muted-foreground text-sm")}>
                            <Loader2 className={cn(iconSizes.sm, "animate-spin")} />
                            {t('basicInfo.companyLink.loading')}
                        </div>
                    ) : (
                        <Select
                            value={currentCompanyId}
                            onValueChange={handleCompanySelect}
                            disabled={!isEditing}
                        >
                            <SelectTrigger className="h-10">
                                <SelectValue placeholder={t('basicInfo.companyLink.placeholder')} />
                            </SelectTrigger>
                            <SelectContent>
                                {companies.map(company => (
                                    <SelectItem
                                        key={company.id}
                                        value={company.id}
                                        className="text-popover-foreground"
                                    >
                                        {company.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

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
                        placeholder={t('basicInfo.descriptionPlaceholder')}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
