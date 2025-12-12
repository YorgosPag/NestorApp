'use client';
import React from 'react';
import { useLevels } from '../systems/levels';
import { WizardProgress } from './components/WizardProgress';
import { LevelSelectionStep } from './wizard/LevelSelectionStep';
import { CalibrationStep } from './wizard/CalibrationStep';
import { PreviewStep } from './wizard/PreviewStep';
import { X } from 'lucide-react';
import { useWizardNavigation } from '../hooks/useWizardNavigation';
import { INTERACTIVE_PATTERNS } from '@/components/ui/effects';

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
  const { importWizard } = useLevels();
  const navigation = useWizardNavigation({ onComplete, onClose });
  const stepInfo = navigation.getStepInfo();
  
  if (!isOpen) return null;

  const renderStep = () => {
    switch (importWizard.step) {
      case 'level':
        return <LevelSelectionStep />;
      case 'calibration':
        return <CalibrationStep />;
      case 'preview':
        return <PreviewStep />;
      default:
        return (
          <div className="p-6 text-center">
            <h3 className="text-lg font-semibold text-white mb-4">Σφάλμα</h3>
            <p className="text-gray-300 mb-6">Άγνωστο βήμα εισαγωγής</p>
            <button
              onClick={onClose}
              className={`px-4 py-2 bg-gray-600 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-white rounded`}
            >
              Κλείσιμο
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl border border-gray-600 w-full max-w-2xl max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-600">
          <div>
            <h2 className="text-xl font-semibold text-white">Εισαγωγή DXF</h2>
            <p className="text-sm text-gray-400">
              Βήμα {stepInfo.number} από {stepInfo.totalSteps}: {stepInfo.title}
              {importWizard.file && ` • ${importWizard.file.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-2 text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} rounded`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 bg-gray-750">
          <WizardProgress currentStep={stepInfo.number} totalSteps={stepInfo.totalSteps} />
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)] p-6">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-600 flex justify-between">
          <button
            onClick={navigation.handleBack}
            disabled={stepInfo.number === 1}
            className={`px-4 py-2 bg-gray-600 ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} text-white rounded disabled:opacity-50`}
          >
            Πίσω
          </button>
          <button
            onClick={navigation.handleNext}
            disabled={!navigation.canProceed()}
            className={`px-6 py-2 bg-blue-600 ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} text-white rounded disabled:opacity-50`}
          >
            {stepInfo.number === stepInfo.totalSteps ? 'Εισαγωγή' : 'Επόμενο'}
          </button>
        </div>

      </div>
    </div>
  );
}
