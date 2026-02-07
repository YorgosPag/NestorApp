'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Briefcase } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
// 🏢 ENTERPRISE: Centralized entity icons/colors (ZERO hardcoded values)
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from './general-tab/types';

interface BasicProjectInfoTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
}

export function BasicProjectInfoTab({ data, setData, isEditing }: BasicProjectInfoTabProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

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
                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="companyName" className="text-sm font-medium">{t('basicInfo.company')}</Label>
                     <div className="relative">
                        {/* 🏢 ENTERPRISE: Using centralized company icon/color */}
                        <NAVIGATION_ENTITIES.company.icon className={cn("absolute left-3 top-1/2 -translate-y-1/2", iconSizes.sm, NAVIGATION_ENTITIES.company.color)} />
                        <Input
                            id="companyName"
                            name="companyName"
                            value={data.companyName}
                            disabled
                            className="h-10 bg-muted/50 pl-10 font-medium"
                        />
                    </div>
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
                    />
                </div>
            </CardContent>
        </Card>
    );
}
