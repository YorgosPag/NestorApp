'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Edit, Save, X, CheckCircle, Copy } from 'lucide-react';
// 🏢 ENTERPRISE: Import from canonical location
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
// 🏢 ENTERPRISE: i18n - Full internationalization support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface GeneralProjectHeaderProps {
    isEditing: boolean;
    autoSaving: boolean;
    lastSaved: Date | null;
    setIsEditing: (isEditing: boolean) => void;
    handleSave: () => void;
    /** 🏢 ENTERPRISE: Human-readable project code (e.g., "PRJ-001") */
    projectCode?: string;
    /** 🏢 ENTERPRISE: Technical Firestore document ID (for support/debugging) */
    projectId?: string;
    /** 🏢 ENTERPRISE: Indicates if save operation is in progress */
    isSaving?: boolean;
    /** 🏢 ENTERPRISE: Error message from failed save operation */
    saveError?: string | null;
}

export function GeneralProjectHeader({
    isEditing,
    autoSaving,
    lastSaved,
    setIsEditing,
    handleSave,
    projectCode,
    projectId,
    isSaving = false,
    saveError = null
}: GeneralProjectHeaderProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    // 🏢 ENTERPRISE: Centralized spacing tokens
    const spacing = useSpacingTokens();
    const typography = useTypography();
    const [copied, setCopied] = React.useState(false);

    const handleCancel = () => {
        // Here you might want to reset form data to its initial state
        setIsEditing(false);
    };

    /** 🏢 ENTERPRISE: Copy technical ID to clipboard for support/debugging */
    const handleCopyTechnicalId = async () => {
        if (!projectId) return;
        try {
            await navigator.clipboard.writeText(projectId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    /** 🏢 ENTERPRISE: Display code - prioritize projectCode, fallback to truncated ID */
    const displayCode = projectCode || (projectId ? `ID: ${projectId.substring(0, 8)}...` : 'ID: ---');

    return (
        <div className={cn("flex items-center justify-between", spacing.margin.bottom.md)}>
            <div className={cn("flex items-center", spacing.gap.sm)}>
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="cursor-pointer" onClick={handleCopyTechnicalId}>
                                <CommonBadge
                                  status="company"
                                  customLabel={displayCode}
                                  variant="secondary"
                                  size="sm"
                                  className={`${colors.bg.infoSubtle} ${colors.text.info}`}
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">
                            <div className={spacing.spaceBetween.xs}>
                                <p className={typography.label.xs}>{t('projectHeader.technicalIdLabel')}</p>
                                <div className={cn("flex items-center", spacing.gap.sm)}>
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                        {projectId || 'N/A'}
                                    </code>
                                    <Copy className={cn(iconSizes.xs, copied ? colors.text.success : '')} />
                                </div>
                                {copied && <p className={cn(typography.body.xs, colors.text.success)}>{t('projectHeader.copied')}</p>}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <CommonBadge
                  status="company"
                  customLabel={t('projectHeader.residentialBadge')}
                  variant="outline"
                  size="sm"
                />
                
                {isEditing && (
                <div className={cn("flex items-center", typography.body.xs, spacing.gap.sm)}>
                    {autoSaving ? (
                    <>
                        <AnimatedSpinner size="small" />
                        <span className={colors.text.info}>{t('projectHeader.saving')}</span>
                    </>
                    ) : lastSaved ? (
                    <>
                        <CheckCircle className={`${iconSizes.xs} ${colors.text.success}`} />
                        <span className={colors.text.success}>
                        {t('projectHeader.savedAt', { time: lastSaved.toLocaleTimeString() })}
                        </span>
                    </>
                    ) : null}
                </div>
                )}
            </div>
      
            <div className={cn("flex items-center", spacing.gap.sm)}>
                {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                    {t('projectHeader.edit')}
                </Button>
                ) : (
                <>
                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                        <X className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                        {t('projectHeader.cancel')}
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <>
                                <AnimatedSpinner size="small" className="mr-2" />
                                {t('projectHeader.saving')}
                            </>
                        ) : (
                            <>
                                <Save className={cn(iconSizes.sm, spacing.margin.right.sm)} />
                                {t('projectHeader.save')}
                            </>
                        )}
                    </Button>
                    {saveError && (
                        <span className={cn(typography.body.xs, colors.text.error)}>
                            {saveError}
                        </span>
                    )}
                </>
                )}
            </div>
        </div>
    );
}
