'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileText, Settings } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from './general-tab/types';

interface PermitsAndStatusTabProps {
    data: ProjectFormData;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
    isEditing: boolean;
}

export function PermitsAndStatusTab({ data, setData, isEditing }: PermitsAndStatusTabProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setData((prev: ProjectFormData) => ({...prev, [e.target.name]: e.target.value}));
    };

    const handleSelectChange = (value: ProjectFormData['status']) => {
        setData((prev: ProjectFormData) => ({...prev, status: value}));
    };

    const handleCheckboxChange = (checked: boolean | "indeterminate") => {
        setData((prev: ProjectFormData) => ({...prev, showOnWeb: checked === true}));
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
                <div className={cn("grid grid-cols-1 md:grid-cols-4", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="buildingBlock" className="text-sm font-medium">{t('permitsTab.buildingBlock')}</Label>
                        <Input id="buildingBlock" name="buildingBlock" value={data.buildingBlock} onChange={handleChange} disabled={!isEditing} className="h-10" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="protocolNumber" className="text-sm font-medium">{t('permitsTab.protocolNumber')}</Label>
                        <Input id="protocolNumber" name="protocolNumber" value={data.protocolNumber} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.protocolPlaceholder')} className="h-10" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="licenseNumber" className="text-sm font-medium">{t('permitsTab.licenseNumber')}</Label>
                        <Input id="licenseNumber" name="licenseNumber" value={data.licenseNumber} onChange={handleChange} disabled={!isEditing} className="h-10 text-primary font-medium" />
                    </div>
                    <div className={spacing.spaceBetween.sm}>
                        <Label htmlFor="issuingAuthority" className="text-sm font-medium">{t('permitsTab.issuingAuthority')}</Label>
                        <Input id="issuingAuthority" name="issuingAuthority" value={data.issuingAuthority} onChange={handleChange} disabled={!isEditing} placeholder={t('permits.authorityPlaceholder')} className="h-10" />
                    </div>
                </div>

                <div className={cn("grid grid-cols-1 md:grid-cols-3 items-end", spacing.gap.md)}>
                    <div className={spacing.spaceBetween.sm}>
                        <Label className="text-sm font-medium">{t('permitsTab.projectStatus')}</Label>
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
                    <div className={spacing.spaceBetween.sm}>
                        <Label className="text-sm font-medium">{t('permitsTab.options')}</Label>
                        <div className="flex items-center space-x-2 h-10">
                            <Checkbox id="show-on-web" checked={data.showOnWeb} onCheckedChange={handleCheckboxChange} disabled={!isEditing} />
                            <Label htmlFor="show-on-web" className="text-sm">{t('permitsTab.showOnWeb')}</Label>
                        </div>
                    </div>
                    <div className="flex justify-start">
                        <Button variant="outline" className="h-10" disabled={!isEditing}>
                            <Settings className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                            {t('permitsTab.selectProject')}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
