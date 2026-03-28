'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from './general-tab/types';
import '@/lib/design-system';

interface PermitsAndStatusTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
}

export const PermitsAndStatusTab = React.memo(function PermitsAndStatusTab({ data, setData, isEditing }: PermitsAndStatusTabProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    const spacing = useSpacingTokens();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSelectChange = (value: ProjectFormData['status']) => {
        setData((prev: ProjectFormData) => ({...prev, status: value}));
    };

    return (
        <Card>
            <CardHeader className={spacing.padding.bottom.md}>
                <div className={cn("flex items-center", spacing.gap.sm)}>
                    <FileText className={`${iconSizes.md} text-primary`} />
                    <CardTitle className={typography.card.titleCompact}>{t('permitsTab.title')}</CardTitle>
                </div>
                <CardDescription>
                    {t('permitsTab.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className={spacing.spaceBetween.md}>
                {/* Permit details — 5 fields in one row */}
                <div className={cn("grid grid-cols-1 md:grid-cols-5", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="buildingBlock" className={typography.label.sm}>{t('permitsTab.buildingBlock')}</Label>
                        <Input id="buildingBlock" name="buildingBlock" value={data.buildingBlock} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.buildingBlockPlaceholder')} size="md" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="protocolNumber" className={typography.label.sm}>{t('permitsTab.protocolNumber')}</Label>
                        <Input id="protocolNumber" name="protocolNumber" value={data.protocolNumber} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.protocolPlaceholder')} size="md" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="licenseNumber" className={typography.label.sm}>{t('permitsTab.licenseNumber')}</Label>
                        <Input id="licenseNumber" name="licenseNumber" value={data.licenseNumber} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.licensePlaceholder')} size="md" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="issuingAuthority" className={typography.label.sm}>{t('permitsTab.issuingAuthority')}</Label>
                        <Input id="issuingAuthority" name="issuingAuthority" value={data.issuingAuthority} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.authorityPlaceholder')} size="md" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="issueDate" className={typography.label.sm}>{t('permitsTab.issueDate')}</Label>
                        <Input id="issueDate" name="issueDate" type="date" value={data.issueDate} onChange={handleChange} disabled={!isEditing} size="md" />
                    </div>
                </div>

                {/* Project status */}
                <div className={cn("grid grid-cols-1 md:grid-cols-5", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label className={typography.label.sm}>{t('permitsTab.projectStatus')}</Label>
                        <Select value={data.status} onValueChange={(value) => handleSelectChange(value as ProjectFormData['status'])} disabled={!isEditing}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="completed" className="text-popover-foreground">{t('permitsTab.statusConstructed')}</SelectItem>
                                <SelectItem value="planning" className="text-popover-foreground">{t('permitsTab.statusPlanning')}</SelectItem>
                                <SelectItem value="in_progress" className="text-popover-foreground">{t('permitsTab.statusInProgress')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});
