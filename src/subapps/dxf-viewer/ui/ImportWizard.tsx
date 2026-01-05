'use client';
import React from 'react';
import { useLevels } from '../systems/levels';
import { WizardProgress } from './components/WizardProgress';
import { LevelSelectionStep } from './wizard/LevelSelectionStep';
import { CalibrationStep } from './wizard/CalibrationStep';
import { PreviewStep } from './wizard/PreviewStep';
import { X } from 'lucide-react';
import { useWizardNavigation } from '../hooks/useWizardNavigation';
import { INTERACTIVE_PATTERNS } from '../../../components/ui/effects';
import { useIconSizes } from '../../../hooks/useIconSizes';
import { useBorderTokens } from '../../../hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized layout tokens

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function ImportWizard({ isOpen, onClose, onComplete }: ImportWizardProps) {
  const iconSizes = useIconSizes();
  const { quick, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const { importWizard } = useLevels();
  const navigation = useWizardNavigation({ onComplete, onClose });
  const stepInfo = navigation.getStepInfo();
  
  if (!isOpen) return null;

  const renderStep = () => {
    switch (importWizard.step) {
      case 'level':
        return <LevelSelectionStep onNext={() => {}} onClose={() => {}} />;
      case 'calibration':
        return <CalibrationStep />;
      case 'preview':
        return <PreviewStep />;
      default:
        return (
          <div className={`${PANEL_LAYOUT.SPACING.XXL} text-center`}>
            <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>Σφάλμα</h3>
            <p className={`${colors.text.muted} ${PANEL_LAYOUT.SPACING.XXL}`}>Άγνωστο βήμα εισαγωγής</p>
            <button
              onClick={onClose}
              className={`${PANEL_LAYOUT.BUTTON.PADDING} ${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS}`}
            >
              Κλείσιμο
            </button>
          </div>
        );
    }
  };

  return (
    <div className={`fixed inset-0 ${colors.bg.modalBackdrop} flex items-center justify-center z-50`}>
      <div className={`${colors.bg.secondary} ${PANEL_LAYOUT.CONTAINER.BORDER_RADIUS} shadow-xl ${quick.muted} w-full max-w-2xl max-h-[90vh] flex flex-col`}>
        
        {/* Header */}
        <header className={`flex items-center justify-between ${PANEL_LAYOUT.SPACING.MD} ${getDirectionalBorder('muted', 'bottom')}`}>
          <div>
            <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.XL} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary}`}>Εισαγωγή DXF</h2>
            <p className={`${PANEL_LAYOUT.BUTTON.TEXT_SIZE} ${colors.text.muted}`}>
              Βήμα {stepInfo.number} από {stepInfo.totalSteps}: {stepInfo.title}
              {importWizard.file && ` • ${importWizard.file.name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`${PANEL_LAYOUT.SPACING.SM} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HOVER} ${INTERACTIVE_PATTERNS.SUBTLE_HOVER} rounded`}
          >
            <X className={iconSizes.md} />
          </button>
        </header>

        {/* Progress */}
        <div className={`${PANEL_LAYOUT.SPACING.HORIZONTAL_MD} ${PANEL_LAYOUT.SPACING.VERTICAL_SM} ${colors.bg.hover}`}>
          <WizardProgress currentStep={stepInfo.number} totalSteps={stepInfo.totalSteps} />
        </div>

        {/* Content */}
        <main className={`overflow-y-auto max-h-[calc(90vh-200px)] ${PANEL_LAYOUT.SPACING.LG}`}>
          {renderStep()}
        </main>

        {/* Footer */}
        <footer className={`${PANEL_LAYOUT.SPACING.MD} ${getDirectionalBorder('muted', 'top')} flex justify-between`}>
          <button
            onClick={navigation.handleBack}
            disabled={stepInfo.number === 1}
            className={`${PANEL_LAYOUT.BUTTON.PADDING} ${colors.bg.hover} ${INTERACTIVE_PATTERNS.BUTTON_SECONDARY_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} disabled:opacity-50`}
          >
            Πίσω
          </button>
          <button
            onClick={navigation.handleNext}
            disabled={!navigation.canProceed()}
            className={`${PANEL_LAYOUT.BUTTON.PADDING_LG} ${colors.bg.info} ${INTERACTIVE_PATTERNS.BUTTON_PRIMARY_HOVER} ${colors.text.inverted} ${PANEL_LAYOUT.BUTTON.BORDER_RADIUS} disabled:opacity-50`}
          >
            {stepInfo.number === stepInfo.totalSteps ? 'Εισαγωγή' : 'Επόμενο'}
          </button>
        </footer>

      </div>
    </div>
  );
}
