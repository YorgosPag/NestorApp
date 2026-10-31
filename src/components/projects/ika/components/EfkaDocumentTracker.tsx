/* eslint-disable design-system/prefer-design-system-imports */
'use client';

import React from 'react';
import { FileText, Check, Upload, Send, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { EfkaDocument, EfkaDocumentStatus } from '../contracts';

interface EfkaDocumentTrackerProps {
  documents: EfkaDocument[];
}

const STATUS_ICON_MAP: Record<EfkaDocumentStatus, React.ElementType> = {
  pending: Clock,
  uploaded: Upload,
  submitted: Send,
  approved: Check,
};

const STATUS_VARIANT_MAP: Record<EfkaDocumentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  uploaded: 'secondary',
  submitted: 'default',
  approved: 'default',
};

export function EfkaDocumentTracker({ documents }: EfkaDocumentTrackerProps) {
  const { t } = useTranslation('projects');
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const typography = useTypography();

  return (
    <Card>
      <CardHeader>
        <CardTitle className={typography.card.titleCompact}>
          <FileText className={cn(iconSizes.md, 'mr-2 inline-block')} />
          {t('ika.efka.documents.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2" role="list">
          {documents.map((docItem) => {
            const StatusIcon = STATUS_ICON_MAP[docItem.status];
            return (
              <li key={docItem.type} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn(
                    iconSizes.sm,
                    docItem.status === 'approved' ? colors.text.success :
                    docItem.status === 'submitted' ? colors.text.info :
                    colors.text.muted
                  )} />
                  <span className={typography.body.sm}>{docItem.label}</span>
                </div>
                <Badge variant={STATUS_VARIANT_MAP[docItem.status]}>
                  {t(`ika.efka.documents.status.${docItem.status}`)}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
