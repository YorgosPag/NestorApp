// 'use client';
// import React, { useState } from 'react';
// import { DestinationWizard } from './DestinationWizard';
// import { ImportWizard } from '../ui/ImportWizard';
// import { useDxfPipeline } from '../pipeline/useDxfPipeline';
// import { useLevels } from '../systems/levels';
// import { useTranslation } from '@/i18n';

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
  
  // if (!isOpen) return null;

  // Mode Selector
  if (showModeSelector && selectedFile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
          <div className="p-6 border-b border-gray-600">
            <h2 className="text-xl font-semibold text-white">{t('import.mode.title')}</h2>
            <p className="text-gray-300 text-sm mt-2">
              {t('import.mode.file', { filename: selectedFile?.name })}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Enhanced Mode */}
            <button
              onClick={() => handleModeSelect('enhanced')}
              className="w-full p-4 border border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-900/20 transition-colors text-left"
              disabled={destinations.length === 0}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🔺</span>
                <div>
                  <h3 className="text-white font-medium">{t('import.mode.enhancedTitle')}</h3>
                  <p className="text-gray-300 text-sm">
                    {t('import.mode.enhancedDesc')}
                  </p>
                  {destinations.length === 0 && (
                    <p className="text-red-300 text-xs mt-1">
                      {t('import.mode.enhancedDisabled')}
                    </p>
                  )}
                </div>
              </div>
            </button>

            {/* Legacy Mode */}
            <button
              onClick={() => handleModeSelect('legacy')}
              className="w-full p-4 border border-gray-600 rounded-lg hover:border-gray-500 hover:bg-gray-700/30 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-white font-medium">{t('import.mode.legacyTitle')}</h3>
                  <p className="text-gray-300 text-sm">
                    {t('import.mode.legacyDesc')}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className="p-6 border-t border-gray-600 flex justify-between">
            <button
              onClick={handleWizardClose}
              className="px-4 py-2 text-gray-200 hover:text-white bg-gray-700 hover:bg-gray-600 rounded"
            >
              {t('import.common.cancel')}
            </button>
            <div className="text-sm text-gray-200">
              {t('import.common.destinations', { count: destinations.length })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // File Selection
  if (!selectedFile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4">
          <div className="p-6 border-b border-gray-600">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">{t('import.fileDialog.title')}</h2>
              <button 
                onClick={handleWizardClose}
                className="text-gray-400 hover:text-white text-2xl"
              >
                {t('import.common.close')}
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
              <input
                type="file"
                accept=".dxf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
                id="dxf-file-input"
              />
              <label htmlFor="dxf-file-input" className="cursor-pointer">
                <div className="text-4xl mb-4">📁</div>
                <p className="text-white font-medium mb-2">{t('import.fileDialog.choose')}</p>
                <p className="text-gray-200 text-sm">{t('import.fileDialog.hint')}</p>
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-gray-600">
            <div className="text-sm text-gray-200">
              {t('import.fileDialog.supported')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate wizard based on mode
  if (importMode === 'enhanced') {
    return (
      <DestinationWizard
        isOpen={true}
        onClose={handleWizardClose}
        selectedFile={selectedFile}
        onComplete={handleWizardComplete}
      />
    );
  } else {
    return (
      <ImportWizard
        isOpen={true}
        onClose={handleWizardClose}
        onComplete={handleWizardComplete}
      />
    );
  }
}