'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { CheckCircle, Copy } from 'lucide-react';
import { Spinner as AnimatedSpinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTypography } from '@/hooks/useTypography';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { AutoSaveStatusIndicator } from '@/components/shared/AutoSaveStatusIndicator';
import type { SaveStatus } from '@/types/auto-save';
import '@/lib/design-system';

interface GeneralProjectHeaderProps {
    isEditing: boolean;
    /** @deprecated Use autoSaveStatus instead (ADR-248) */
    autoSaving?: boolean;
    lastSaved: Date | null;
    projectCode?: string;
    projectId?: string;
    isSaving?: boolean;
    /** ADR-248: Centralized auto-save status */
    autoSaveStatus?: SaveStatus;
    /** ADR-248: Auto-save error message */
    autoSaveError?: string | null;
    /** ADR-248: Retry callback for failed auto-save */
    onAutoSaveRetry?: () => void;
}

export function GeneralProjectHeader({
    isEditing,
    autoSaving,
    lastSaved,
    projectCode,
    projectId,
    isSaving = false,
    autoSaveStatus,
    autoSaveError,
    onAutoSaveRetry,
}: GeneralProjectHeaderProps) {
    const { t } = useTranslation('projects');
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
    const spacing = useSpacingTokens();
    const typography = useTypography();
    const { copy, copied } = useCopyToClipboard();

    const handleCopyTechnicalId = async () => {
        if (!projectId) return;
        await copy(projectId);
    };

    const displayCode = projectCode || (projectId ? `ID: ${projectId.substring(0, 8)}...` : 'ID: ---');

    return (
        <div className={cn("flex items-center justify-between", spacing.margin.bottom.md)}>
            <div className={cn("flex items-center", spacing.gap.sm)}>
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
                                    <code className={cn(typography.body.xs, "bg-muted px-1 py-0.5 rounded")}>
                                        {projectId || 'N/A'}
                                    </code>
                                    <Copy className={cn(iconSizes.xs, copied ? colors.text.success : '')} />
                                </div>
                                {copied && <p className={cn(typography.body.xs, colors.text.success)}>{t('projectHeader.copied')}</p>}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                <CommonBadge
                  status="company"
                  customLabel={t('projectHeader.residentialBadge')}
                  variant="outline"
                  size="sm"
                />

                {isEditing && autoSaveStatus && (
                  <AutoSaveStatusIndicator
                    status={autoSaveStatus}
                    lastSaved={lastSaved}
                    error={autoSaveError}
                    variant="inline"
                    onRetry={onAutoSaveRetry}
                  />
                )}
                {/* Fallback for legacy autoSaving prop */}
                {isEditing && !autoSaveStatus && (autoSaving || lastSaved) && (
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

            {/* Save status indicators */}
            {isSaving && (
                <div className={cn("flex items-center", spacing.gap.sm)}>
                    <AnimatedSpinner size="small" />
                    <span className={cn(typography.body.xs, colors.text.info)}>{t('projectHeader.saving')}</span>
                </div>
            )}
        </div>
    );
}
