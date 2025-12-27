// 'use client';
// import React, { useState } from 'react';
// import { DestinationWizard } from './DestinationWizard';
// import { ImportWizard } from '../ui/ImportWizard';
// import { useDxfPipeline } from '../pipeline/useDxfPipeline';
// import { useLevels } from '../systems/levels';
// import { useTranslation } from '@/i18n';

// DEPRECATED - Use SimpleProjectDialog instead
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

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
  
  // if (!isOpen) return null;

  // Mode Selector
  if (showModeSelector && selectedFile) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
        <div className={`${colors.bg.secondary} ${getStatusBorder('muted')} rounded-lg shadow-2xl max-w-md w-full mx-4`}>
          <div className={`p-6 ${getDirectionalBorder('muted', 'bottom')}`}>
            <h2 className={`text-xl font-semibold ${colors.text.primary}`}>{t('import.mode.title')}</h2>
            <p className="${colors.text.muted} text-sm mt-2">
              {t('import.mode.file', { filename: selectedFile?.name })}
            </p>
          </div>

          <div className="p-6 space-y-4">
            {/* Enhanced Mode */}
            <button
              onClick={() => handleModeSelect('enhanced')}
              className={`w-full p-4 ${getStatusBorder('muted')} rounded-lg ${getStatusBorder('info', 'hover:')} hover:${colors.bg.infoLight} transition-colors text-left`}
              disabled={destinations.length === 0}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🔺</span>
                <div>
                  <h3 className={`${colors.text.primary} font-medium`}>{t('import.mode.enhancedTitle')}</h3>
                  <p className="${colors.text.muted} text-sm">
                    {t('import.mode.enhancedDesc')}
                  </p>
                  {destinations.length === 0 && (
                    <p className={`${colors.text.error} text-xs mt-1`}>
                      {t('import.mode.enhancedDisabled')}
                    </p>
                  )}
                </div>
              </div>
            </button>

            {/* Legacy Mode */}
            <button
              onClick={() => handleModeSelect('legacy')}
              className={`w-full p-4 ${getStatusBorder('muted')} rounded-lg ${getStatusBorder('muted', 'hover:')} hover:${colors.bg.hover}/30 transition-colors text-left`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className={`${colors.text.primary} font-medium`}>{t('import.mode.legacyTitle')}</h3>
                  <p className="${colors.text.muted} text-sm">
                    {t('import.mode.legacyDesc')}
                  </p>
                </div>
              </div>
            </button>
          </div>

          <div className={`p-6 ${getDirectionalBorder('muted', 'top')} flex justify-between`}>
            <button
              onClick={handleWizardClose}
              className="px-4 py-2 ${colors.text.secondary} hover:${colors.text.primary} ${colors.bg.hover} hover:${colors.bg.accent} rounded"
            >
              {t('import.common.cancel')}
            </button>
            <div className="text-sm ${colors.text.secondary}">
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
        <div className={`${colors.bg.secondary} ${getStatusBorder('muted')} rounded-lg shadow-2xl max-w-md w-full mx-4`}>
          <div className={`p-6 ${getDirectionalBorder('muted', 'bottom')}`}>
            <div className="flex justify-between items-center">
              <h2 className={`text-xl font-semibold ${colors.text.primary}`}>{t('import.fileDialog.title')}</h2>
              <button 
                onClick={handleWizardClose}
                className="${colors.text.muted} hover:${colors.text.primary} text-2xl"
              >
                {t('import.common.close')}
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className={`border border-dashed ${getStatusBorder('muted')} rounded-lg p-8 text-center ${getStatusBorder('muted', 'hover:')} transition-colors`}>
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
                <p className={`${colors.text.primary} font-medium mb-2`}>{t('import.fileDialog.choose')}</p>
                <p className="${colors.text.secondary} text-sm">{t('import.fileDialog.hint')}</p>
              </label>
            </div>
          </div>

          <div className={`p-6 ${getDirectionalBorder('muted', 'top')}`}>
            <div className="text-sm ${colors.text.secondary}">
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