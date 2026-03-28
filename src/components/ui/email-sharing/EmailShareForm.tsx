'use client';

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { EmailShareData, ShareData } from './types';
import '@/lib/design-system';

export type { EmailShareData, ShareData };

// Temporary simplified version to fix file reading errors
export interface EmailShareFormProps {
  shareData: ShareData;
  onEmailShare: (data: EmailShareData) => Promise<void> | void;
  onBack?: () => void;
  loading?: boolean;
}

export const EmailShareForm: React.FC<EmailShareFormProps> = ({
  shareData: _shareData,
  onEmailShare: _onEmailShare
}) => {
  const { t } = useTranslation('common');
  return (
    <div className="space-y-6">
      <div className="text-center">
        {t('photoManager.emailShareSimplified')}
      </div>
    </div>
  );
};

export default EmailShareForm;
