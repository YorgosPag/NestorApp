'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, ExternalLink } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';
// 🏢 ENTERPRISE: i18n support
import { useTranslation } from '@/i18n/hooks/useTranslation';

interface PropertyDocumentsProps {
  documents: ExtendedPropertyDetails['documents'];
}

export function PropertyDocuments({ documents }: PropertyDocumentsProps) {
  const iconSizes = useIconSizes();
  // 🏢 ENTERPRISE: i18n hook
  const { t } = useTranslation('properties');

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium flex items-center gap-1">
        <FileText className={iconSizes.xs} />
        {t('documents.title')}
      </h4>
      <div className="space-y-1">
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
