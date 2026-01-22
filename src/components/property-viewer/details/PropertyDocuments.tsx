'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';
// 🏢 ENTERPRISE: Centralized spacing tokens
import { useSpacingTokens } from '@/hooks/useSpacingTokens';

interface PropertyDocumentsProps {
  documents: ExtendedPropertyDetails['documents'];
}

export function PropertyDocuments({ documents }: PropertyDocumentsProps) {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className={spacing.spaceBetween.sm}>
      <h4 className={`text-xs font-medium flex items-center ${spacing.gap.sm}`}>
        <FileText className={iconSizes.xs} />
        {t('documents.title')}
      </h4>
      <div className={spacing.spaceBetween.sm}>
        {documents?.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between text-xs">
            <span className="truncate">{doc.name}</span>
            <Button variant="ghost" size="sm" className={`${iconSizes.lg} p-0`}>
              <ExternalLink className={iconSizes.xs} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
