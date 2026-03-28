'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NAVIGATION_ENTITIES } from '@/components/navigation/config';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from './general-tab/types';
import '@/lib/design-system';

interface BasicProjectInfoTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
    projectId: string;
}

export const BasicProjectInfoTab = React.memo(function BasicProjectInfoTab({ data, setData, isEditing }: BasicProjectInfoTabProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    const spacing = useSpacingTokens();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

    return (
        <Card>
            <CardHeader className={spacing.padding.sm}>
                <div className={cn("flex items-center", spacing.gap.sm)}>
                    <NAVIGATION_ENTITIES.project.icon className={`${iconSizes.md} ${NAVIGATION_ENTITIES.project.color}`} />
                    <CardTitle className={typography.card.titleCompact}>{t('basicInfo.title')}</CardTitle>
                </div>
                <CardDescription>
                    {t('basicInfo.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className={cn(spacing.padding.sm, spacing.spaceBetween.md)}>
                <div className={cn("grid grid-cols-1 lg:grid-cols-2", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="name" className={typography.label.sm}>{t('basicInfo.projectTitle')}</Label>
                        <Input id="name" name="name" value={data.name} onChange={handleChange} disabled={!isEditing} placeholder={t('basicInfo.projectTitlePlaceholder')} size="md" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="licenseTitle" className={typography.label.sm}>{t('basicInfo.licenseTitle')}</Label>
                        <Input id="licenseTitle" name="licenseTitle" value={data.licenseTitle} onChange={handleChange} disabled={!isEditing} placeholder={t('basicInfo.licenseTitlePlaceholder')} size="md" />
                    </div>
                </div>

                {/* Company link moved to top-level EntityLinkCard in GeneralProjectTab */}

                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="description" className={typography.label.sm}>{t('basicInfo.projectDescription')}</Label>
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
});
