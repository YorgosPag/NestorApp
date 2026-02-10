'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Folder, Eye } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { ProjectFormData } from './general-tab/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('ProjectAttachmentsTab');

interface ProjectAttachmentsTabProps {
    data: Pick<ProjectFormData, 'mapPath' | 'floorPlanPath' | 'percentagesPath'>;
    setData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
}

export function ProjectAttachmentsTab({ data, setData }: ProjectAttachmentsTabProps) {
    // 🏢 ENTERPRISE: i18n hook
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const typography = useTypography();
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();
    const handleFileSelect = (field: string) => {
        // This would open a file dialog in a real application
        logger.info('Selecting file', { field });
    };

    return (
        <Card>
            <CardHeader className={spacing.padding.bottom.md}>
                <div className={cn("flex items-center", spacing.gap.sm)}>
                    <Folder className={`${iconSizes.md} text-primary`} />
                    <CardTitle className={typography.card.titleCompact}>{t('attachmentsTab.title')}</CardTitle>
                </div>
                <CardDescription>
                    {t('attachmentsTab.description')}
                </CardDescription>
            </CardHeader>
            <CardContent className={spacing.spaceBetween.md}>
                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="mapPath" className={typography.label.sm}>{t('attachmentsTab.projectMap')}</Label>
                    <div className={cn("flex items-center", spacing.gap.sm)}>
                        <Input
                            id="mapPath"
                            readOnly
                            value={data.mapPath}
                            className="h-10 bg-muted/30"
                        />
                        <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`} onClick={() => handleFileSelect('mapPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`}>
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>

                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="floorPlanPath" className={typography.label.sm}>{t('attachmentsTab.generalFloorPlan')}</Label>
                    <div className={cn("flex items-center", spacing.gap.sm)}>
                        <Input
                            id="floorPlanPath"
                            readOnly
                            value={data.floorPlanPath}
                            className="h-10 bg-muted/30"
                        />
                         <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`} onClick={() => handleFileSelect('floorPlanPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`}>
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>

                <div className={spacing.spaceBetween.sm}>
                    <Label htmlFor="percentagesPath" className={typography.label.sm}>{t('attachmentsTab.percentagesTable')}</Label>
                    <div className={cn("flex items-center", spacing.gap.sm)}>
                        <Input
                            id="percentagesPath"
                            readOnly
                            value={data.percentagesPath}
                            className="h-10 bg-muted/30"
                        />
                         <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`} onClick={() => handleFileSelect('percentagesPath')}>
                            <Folder className={iconSizes.sm} />
                        </Button>
                        <Button variant="outline" size="icon" className={`${iconSizes['2xl']} shrink-0`}>
                            <Eye className={iconSizes.sm} />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
