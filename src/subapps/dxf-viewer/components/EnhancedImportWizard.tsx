// 'use client';
// import React, { useState } from 'react';
// import { DestinationWizard } from './DestinationWizard';
// import { ImportWizard } from '../ui/ImportWizard';
// import { useDxfPipeline } from '../pipeline/useDxfPipeline';
// import { useLevels } from '../systems/levels';
// import { useTranslation } from '@/i18n';

// DEPRECATED - Use SimpleProjectDialog instead
import { useBorderTokens } from '@/hooks/useBorderTokens';

// interface EnhancedImportWizardProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onComplete: () => void;
// }

// type ImportMode = 'enhanced' | 'legacy';

// DEPRECATED - Use SimpleProjectDialog instead
interface EnhancedImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function EnhancedImportWizard({ isOpen, onClose, onComplete }: EnhancedImportWizardProps) {
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  // const { t } = useTranslation('dxf-viewer');
  // const [importMode, setImportMode] = useState<ImportMode>('enhanced');
  // const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // const [showModeSelector, setShowModeSelector] = useState(true);
  
  // const { getDestinations } = useDxfPipeline();
  // const { startImportWizard } = useLevels();
  // const destinations = getDestinations();

  // const handleFileSelect = (file: File) => {
  //   setSelectedFile(file);
  //   setShowModeSelector(true);
  // };

  // const handleModeSelect = (mode: ImportMode) => {
  //   setImportMode(mode);
  //   setShowModeSelector(false);
  //   if (mode === 'legacy' && selectedFile) {
  //     startImportWizard(selectedFile); // <-- περνάμε το αρχείο στον wizard
  //   }
  // };

  // const handleWizardClose = () => {
  //   setShowModeSelector(true);
  //   setSelectedFile(null);
  //   setImportMode('enhanced');
  //   onClose();
  // };

  // const handleWizardComplete = (result?: unknown) => {

  //   onComplete();
  //   handleWizardClose();
  // };

  // DEPRECATED COMPONENT - Returns null
  return null;
}