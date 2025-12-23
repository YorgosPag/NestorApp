'use client';
import React, { useState } from 'react';
import DxfImportModal from '../components/DxfImportModal';
import { useIconSizes } from '@/hooks/useIconSizes';

interface Props {
  className?: string;
  title?: string;
  onFileSelect?: (file: File, encoding?: string) => void; // Added encoding parameter
}

export default function UploadDxfButton({ 
  className, 
  title = 'Upload DXF', 
  onFileSelect
}: Props) {
  const iconSizes = useIconSizes();
  const [showModal, setShowModal] = useState(false);

  const handleImport = async (file: File, encoding: string) => {
    onFileSelect?.(file, encoding);
  };

  const handleButtonClick = () => {
    setShowModal(true);
  };

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={handleButtonClick}
        title={title}
        aria-label={title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <svg 
          viewBox="0 0 24 24" 
          className={iconSizes.sm} 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 5 17 10"/>
          <line x1="12" y1="5" x2="12" y2="20"/>
        </svg>
      </button>

      <DxfImportModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onImport={handleImport}
      />
    </>
  );
}
