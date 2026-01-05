'use client';
import React, { useState } from 'react';
import {
  Building,
  Building2,
  Home,
  DoorOpen,
  Package,
  ParkingCircle,
  Folder,
  X
} from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { AnimatedSpinner } from './modal/ModalLoadingStates';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { Checkbox } from '@/components/ui/checkbox';  // ✅ ENTERPRISE: Centralized Radix Checkbox
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import { useDxfPipeline } from '../pipeline/useDxfPipeline';
import { HierarchicalDestinationSelector } from './HierarchicalDestinationSelector';
import type { DxfDestination, DxfProcessingOptions, ProcessedDxfResult } from '../pipeline/types';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../config/panel-tokens';  // ✅ ENTERPRISE: Centralized spacing tokens

interface DestinationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFile: File | null;
  onComplete: (result: ProcessedDxfResult) => void;
}

type WizardStep = 'destination' | 'options' | 'processing' | 'complete';

export function DestinationWizard({ isOpen, onClose, selectedFile, onComplete }: DestinationWizardProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder, radius, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const [currentStep, setCurrentStep] = useState<WizardStep>('destination');
  const [selectedDestination, setSelectedDestination] = useState<DxfDestination | null>(null);
  const [processingOptions, setProcessingOptions] = useState<DxfProcessingOptions>({ // ✅ ENTERPRISE: Simplified type after DxfProcessingOptions.destination made nullable
    destination: null,
    processLayers: true,
    preserveGrid: false,
    preserveRulers: false,
    autoScale: true
  });

  const { getAvailableDestinations } = useProjectHierarchy();
  const { importDxfFileWithDestination, busy } = useDxfPipeline();
  
  const destinations = getAvailableDestinations();
  
  const handleDestinationSelect = (destId: string) => {
    const destination = destinations.find(d => d.id === destId);
    if (destination) {
      const dxfDest: DxfDestination = {
        id: destination.id,
        type: destination.type,
        label: destination.label,
        parentId: destination.parentId,
        metadata: destination.metadata
      };
      setSelectedDestination(dxfDest);
      setProcessingOptions(prev => ({ ...prev, destination: dxfDest }));
    }
  };

  const handleNextStep = () => {
    switch (currentStep) {
      case 'destination':
        if (selectedDestination) {
          setCurrentStep('options');
        }
        break;
      case 'options':
        setCurrentStep('processing');
        handleProcessing();
        break;
      case 'processing':
        setCurrentStep('complete');
        break;
    }
  };

  const handlePrevStep = () => {
    switch (currentStep) {
      case 'options':
        setCurrentStep('destination');
        break;
      case 'processing':
        setCurrentStep('options');
        break;
      case 'complete':
        setCurrentStep('processing');
        break;
    }
  };

  const handleProcessing = async () => {
    if (!selectedFile || !selectedDestination) return;

    try {
      const result = await importDxfFileWithDestination(
        selectedFile, 
        selectedDestination, 
        processingOptions
      );
      onComplete(result as ProcessedDxfResult);
      if (result.success) {
        setCurrentStep('complete');
      }
    } catch (error) {
      console.error('Processing failed:', error);
    }
  };

  const handleClose = () => {
    setCurrentStep('destination');
    setSelectedDestination(null);
    onClose();
  };

  if (!isOpen) return null;

  const getDestinationIcon = (type: string) => {
    switch (type) {
      case 'project': return Building;
      case 'building': return Building2;
      case 'floor': return Home;
      case 'unit': return DoorOpen;
      case 'storage': return Package;
      case 'parking': return ParkingCircle;
      default: return Folder;
    }
  };

  // ✅ ENTERPRISE: Destination colors με CSS variables
  const getDestinationColor = (type: string) => {
    switch (type) {
      case 'project': return `${colors.bg.info} ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`;
      case 'building': return `${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.GREEN_BUTTON}`;
      case 'floor': return `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.PURPLE_BUTTON}`;
      case 'unit': return `${colors.bg.warning} ${HOVER_BACKGROUND_EFFECTS.ORANGE_BUTTON}`;
      case 'storage': return `${colors.bg.warning} ${HOVER_BACKGROUND_EFFECTS.YELLOW_BUTTON}`;
      case 'parking': return `${colors.bg.info} ${HOVER_BACKGROUND_EFFECTS.INDIGO_BUTTON}`;
      default: return `${colors.bg.hover} ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON}`;
    }
  };

  return (
    <div className={`fixed inset-0 ${colors.bg.modalBackdrop} flex items-center justify-center ${PANEL_LAYOUT.Z_INDEX['50']}`}>
      <div className={`${colors.bg.secondary} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.SHADOW.XL} max-w-2xl w-full ${PANEL_LAYOUT.MARGIN.X_LG} max-h-[90vh] ${PANEL_LAYOUT.OVERFLOW.Y_AUTO}`}>
        
        {/* Header */}
        <header className={`flex justify-between items-center ${PANEL_LAYOUT.SPACING.XXL} ${getDirectionalBorder('default', 'bottom')}`}>
          <div>
            <h2 className={`${PANEL_LAYOUT.TYPOGRAPHY.XL} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${colors.text.primary}`}>DXF Import Wizard</h2>
            <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.MARGIN.TOP_XS}`}>
              {selectedFile?.name && `Processing: ${selectedFile.name}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} ${PANEL_LAYOUT.SPACING.XS}`}
          >
            <X className={iconSizes.lg} />
          </button>
        </header>

        {/* Progress */}
        <nav className={`${PANEL_LAYOUT.SPACING.XXL} ${getDirectionalBorder('default', 'bottom')}`}>
          <ol className={`flex items-center ${PANEL_LAYOUT.SPACING.GAP_H_LG}`}>
            {['destination', 'options', 'processing', 'complete'].map((step, index) => (
              <li key={step} className="flex items-center">
                <span className={`${iconSizes.xl} ${PANEL_LAYOUT.ROUNDED.FULL} flex items-center justify-center ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${
                  currentStep === step ? `${colors.bg.info} ${colors.text.inverted}` :
                  ['destination', 'options', 'processing', 'complete'].indexOf(currentStep) > index ? `${colors.bg.success} ${colors.text.inverted}` :
                  `${colors.bg.hover} ${colors.text.muted}`
                }`}>
                  {index + 1}
                </span>
                {index < 3 && (
                  <span className={`${iconSizes['2xl']} ${PANEL_LAYOUT.HEIGHT.XS} ${PANEL_LAYOUT.MARGIN.X_SM} ${
                    ['destination', 'options', 'processing', 'complete'].indexOf(currentStep) > index ? colors.bg.success : colors.bg.hover
                  }`} />
                )}
              </li>
            ))}
          </ol>
        </nav>

        {/* Content */}
        <main className={PANEL_LAYOUT.SPACING.XXL}>
          {/* Step 1: Hierarchical Destination Selection */}
          {currentStep === 'destination' && (
            <HierarchicalDestinationSelector
              onDestinationSelect={handleDestinationSelect}
              selectedDestination={selectedDestination}
            />
          )}

          {/* Step 2: Processing Options */}
          {currentStep === 'options' && selectedDestination && (
            <div>
              <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
                Επιλογές επεξεργασίας
              </h3>
              <div className={`${colors.bg.hover} ${PANEL_LAYOUT.CONTAINER.PADDING} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.MARGIN.BOTTOM_XL}`}>
                <div className={`flex items-center ${PANEL_LAYOUT.GAP.MD}`}>
                  {React.createElement(getDestinationIcon(selectedDestination.type), {
                    className: `${iconSizes.lg} ${colors.text.info}`
                  })}
                  <div>
                    <div className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>{selectedDestination.label}</div>
                    <div className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>Destination: {selectedDestination.type}</div>
                  </div>
                </div>
              </div>

              <div className={PANEL_LAYOUT.SPACING.GAP_LG}>
                <div className="flex items-center justify-between">
                  <div>
                    <label className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Process Layers</label>
                    <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>Create status layers for property management</p>
                  </div>
                  <Checkbox
                    checked={processingOptions.processLayers}
                    onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, processLayers: checked === true }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Preserve Grid</label>
                    <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>Keep grid lines in the final view</p>
                  </div>
                  <Checkbox
                    checked={processingOptions.preserveGrid}
                    onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, preserveGrid: checked === true }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Preserve Rulers</label>
                    <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>Keep measurement rulers</p>
                  </div>
                  <Checkbox
                    checked={processingOptions.preserveRulers}
                    onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, preserveRulers: checked === true }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className={`${colors.text.primary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}>Auto Scale</label>
                    <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>Automatically scale to fit destination</p>
                  </div>
                  <Checkbox
                    checked={processingOptions.autoScale}
                    onCheckedChange={(checked) => setProcessingOptions(prev => ({ ...prev, autoScale: checked === true }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {currentStep === 'processing' && (
            <div className="text-center">
              <AnimatedSpinner size="large" className={`mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`} />
              <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
                Επεξεργασία κάτοψης...
              </h3>
              <p className={colors.text.muted}>
                Η κάτοψη υποβάλλεται σε επεξεργασία και αποθηκεύεται στον επιλεγμένο προορισμό.
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center">
              <div className={`${iconSizes['2xl']} ${colors.bg.success} ${PANEL_LAYOUT.ROUNDED.FULL} flex items-center justify-center mx-auto ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
                <svg className={`${iconSizes.lg} ${colors.text.primary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className={`${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${colors.text.primary} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>
                Επιτυχής ολοκλήρωση!
              </h3>
              <p className={`${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG}`}>
                Η κάτοψη αποθηκεύτηκε επιτυχώς στον επιλεγμένο προορισμό.
              </p>
              {selectedDestination && (
                <div className={`${colors.bg.hover} ${PANEL_LAYOUT.SPACING.MD} ${PANEL_LAYOUT.ROUNDED.LG} inline-block`}>
                  <div className={`flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
                    {React.createElement(getDestinationIcon(selectedDestination.type), {
                      className: `${iconSizes.md} ${colors.text.success}`
                    })}
                    <span className={`${colors.text.primary}`}>{selectedDestination.label}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className={`flex justify-between items-center ${PANEL_LAYOUT.SPACING.XXL} ${getDirectionalBorder('default', 'top')}`}>
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 'destination' || currentStep === 'processing'}
            className={`${PANEL_LAYOUT.BUTTON.PADDING} ${colors.text.muted} ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} disabled:${PANEL_LAYOUT.OPACITY['50']} disabled:${PANEL_LAYOUT.CURSOR.NOT_ALLOWED}`}
          >
            ← Προηγούμενο
          </button>

          <div className={`flex ${PANEL_LAYOUT.GAP.MD}`}>
            {currentStep === 'complete' ? (
              <button
                onClick={handleClose}
                className={`${PANEL_LAYOUT.BUTTON.PADDING_XL} ${colors.bg.success} ${HOVER_BACKGROUND_EFFECTS.GREEN_BUTTON} ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}
              >
                Ολοκλήρωση
              </button>
            ) : (
              <button
                onClick={handleNextStep}
                disabled={
                  (currentStep === 'destination' && !selectedDestination) ||
                  currentStep === 'processing' ||
                  busy
                }
                className={`${PANEL_LAYOUT.BUTTON.PADDING_XL} ${colors.bg.info} ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON} disabled:${colors.bg.hover} disabled:cursor-not-allowed ${colors.text.inverted} ${PANEL_LAYOUT.ROUNDED.LG} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM}`}
              >
                {currentStep === 'options' ? 'Ξεκίνημα επεξεργασίας' : 'Επόμενο →'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}