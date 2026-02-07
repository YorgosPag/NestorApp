'use client';

import React from 'react';

import type { EmailShareData, ShareData } from './types';

export type { EmailShareData, ShareData };

// Temporary simplified version to fix file reading errors
export interface EmailShareFormProps {
  shareData: ShareData;
  onEmailShare: (data: EmailShareData) => Promise<void> | void;
  onBack?: () => void;
  loading?: boolean;
}

export const EmailShareForm: React.FC<EmailShareFormProps> = ({
  shareData,
  onEmailShare
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        Email Share Form - Temporarily Simplified
      </div>
    </div>
  );
};

export default EmailShareForm;
