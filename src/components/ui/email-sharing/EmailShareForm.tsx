'use client';

import React from 'react';

// Temporary simplified version to fix file reading errors
export interface EmailShareFormProps {
  shareData: any;
  onEmailShare: (data: any) => void;
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