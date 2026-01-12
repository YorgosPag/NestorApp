'use client';

import React from 'react';

/** Share data for email sharing */
interface ShareData {
  title?: string;
  url?: string;
  description?: string;
  [key: string]: unknown;
}

/** Email share submission data */
interface EmailShareSubmitData {
  recipients: string[];
  subject: string;
  message: string;
  shareData: ShareData;
}

// Temporary simplified version to fix file reading errors
export interface EmailShareFormProps {
  shareData: ShareData;
  onEmailShare: (data: EmailShareSubmitData) => void;
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