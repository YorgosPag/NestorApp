'use client';

import React from 'react';
import { CommonBadge } from '@/core/badges';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { Button } from '@/components/ui/button';
import { Edit, Save, X, CheckCircle, Copy } from 'lucide-react';
import { AnimatedSpinner } from '@/subapps/dxf-viewer/components/modal/ModalLoadingStates';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
}

export function GeneralProjectHeader({
    isEditing,
    autoSaving,
    lastSaved,
    setIsEditing,
    handleSave,
    projectCode,
    projectId
}: GeneralProjectHeaderProps) {
    const iconSizes = useIconSizes();
    const colors = useSemanticColors();
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
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
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
                            <div className="space-y-1">
                                <p className="font-medium text-xs">Technical ID (για support):</p>
                                <div className="flex items-center gap-2">
                                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                                        {projectId || 'N/A'}
                                    </code>
                                    <Copy className={`w-3 h-3 ${copied ? 'text-green-500' : ''}`} />
                                </div>
                                {copied && <p className="text-xs text-green-500">Αντιγράφηκε!</p>}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <CommonBadge
                  status="company"
                  customLabel="Οικιστικό"
                  variant="outline"
                  size="sm"
                />
                
                {isEditing && (
                <div className="flex items-center gap-2 text-xs">
                    {autoSaving ? (
                    <>
                        <AnimatedSpinner size="small" />
                        <span className={colors.text.info}>Αποθήκευση...</span>
                    </>
                    ) : lastSaved ? (
                    <>
                        <CheckCircle className={`${iconSizes.xs} ${colors.text.success}`} />
                        <span className={colors.text.success}>
                        Αποθηκεύτηκε {lastSaved.toLocaleTimeString('el-GR')}
                        </span>
                    </>
                    ) : null}
                </div>
                )}
            </div>
      
            <div className="flex items-center gap-2">
                {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit className={`${iconSizes.sm} mr-2`} />
                    Επεξεργασία
                </Button>
                ) : (
                <>
                    <Button variant="outline" size="sm" onClick={handleCancel}>
                        <X className={`${iconSizes.sm} mr-2`} />
                        Ακύρωση
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        <Save className={`${iconSizes.sm} mr-2`} />
                        Αποθήκευση
                    </Button>
                </>
                )}
            </div>
        </div>
    );
}
