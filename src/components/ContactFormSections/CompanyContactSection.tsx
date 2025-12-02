'use client';

import React from 'react';

interface CompanyContactSectionProps {
  formData: any;
  handleChange: any;
  handleSelectChange: any;
  handleLogoChange: any;
  handleUploadedLogoURL: any;
  disabled?: boolean;
}

export function CompanyContactSection({
  formData,
  handleChange,
  handleSelectChange,
  handleLogoChange,
  handleUploadedLogoURL,
  disabled = false
}: CompanyContactSectionProps) {

  console.log('🧪 SIMPLE RENDER TEST: CompanyContactSection is rendering now!', { timestamp: new Date().getTime() });
  console.log('🔍 SIMPLE DEBUG: Props received:', { formData: !!formData, handleLogoChange: !!handleLogoChange });

  return (
    <div style={{ padding: '20px', border: '2px solid red', margin: '10px' }}>
      <h3>🏢 COMPANY SECTION - SIMPLE TEST</h3>
      <p>Type: {formData?.type}</p>
      <p>Loading: {disabled ? 'Yes' : 'No'}</p>

      <div style={{ margin: '20px 0', padding: '20px', border: '1px dashed blue' }}>
        <h4>📸 SIMPLE FILE UPLOAD TEST</h4>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              console.log('🔥 SIMPLE: handleLogoChange called με:', file.name);
              handleLogoChange(file);
            }
          }}
          disabled={disabled}
        />
        <p>Click to select logo file...</p>
      </div>
    </div>
  );
}