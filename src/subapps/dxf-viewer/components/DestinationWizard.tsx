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
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useProjectHierarchy } from '../contexts/ProjectHierarchyContext';
import { useDxfPipeline } from '../pipeline/useDxfPipeline';
import { HierarchicalDestinationSelector } from './HierarchicalDestinationSelector';
import type { DxfDestination, DxfProcessingOptions } from '../pipeline/types';
import { INTERACTIVE_PATTERNS, HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

interface DestinationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFile: File | null;
  onComplete: (result: DxfProcessingOptions) => void;
}

type WizardStep = 'destination' | 'options' | 'processing' | 'complete';

export function DestinationWizard({ isOpen, onClose, selectedFile, onComplete }: DestinationWizardProps) {
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const [currentStep, setCurrentStep] = useState<WizardStep>('destination');
  const [selectedDestination, setSelectedDestination] = useState<DxfDestination | null>(null);
  const [processingOptions, setProcessingOptions] = useState<Omit<DxfProcessingOptions, 'destination'> & { destination: DxfDestination | null }>({
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
      onComplete(result);
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

  const getDestinationColor = (type: string) => {
    switch (type) {
      case 'project': return `bg-blue-600 ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`;
      case 'building': return `bg-green-600 ${HOVER_BACKGROUND_EFFECTS.GREEN_BUTTON}`;
      case 'floor': return `bg-purple-600 ${HOVER_BACKGROUND_EFFECTS.PURPLE_BUTTON}`;
      case 'unit': return `bg-orange-600 ${HOVER_BACKGROUND_EFFECTS.ORANGE_BUTTON}`;
      case 'storage': return `bg-yellow-600 ${HOVER_BACKGROUND_EFFECTS.YELLOW_BUTTON}`;
      case 'parking': return `bg-indigo-600 ${HOVER_BACKGROUND_EFFECTS.INDIGO_BUTTON}`;
      default: return `bg-gray-600 ${HOVER_BACKGROUND_EFFECTS.GRAY_BUTTON}`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className={`flex justify-between items-center p-6 ${getStatusBorder('default')} border-b`}>
          <div>
            <h2 className="text-xl font-semibold text-white">DXF Import Wizard</h2>
            <p className="text-gray-400 text-sm mt-1">
              {selectedFile?.name && `Processing: ${selectedFile.name}`}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`text-gray-400 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} p-1`}
          >
            <X className={iconSizes.lg} />
          </button>
        </div>

        {/* Progress */}
        <div className={`p-6 ${getStatusBorder('default')} border-b`}>
          <div className="flex items-center space-x-4">
            {['destination', 'options', 'processing', 'complete'].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`${iconSizes.xl} rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step ? 'bg-blue-600 text-white' :
                  ['destination', 'options', 'processing', 'complete'].indexOf(currentStep) > index ? 'bg-green-600 text-white' :
                  'bg-gray-600 text-gray-300'
                }`}>
                  {index + 1}
                </div>
                {index < 3 && (
                  <div className={`${iconSizes['2xl']} h-1 mx-2 ${
                    ['destination', 'options', 'processing', 'complete'].indexOf(currentStep) > index ? 'bg-green-600' : 'bg-gray-600'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          
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
              <h3 className="text-lg font-medium text-white mb-4">
                Επιλογές επεξεργασίας
              </h3>
              <div className="bg-gray-700 p-4 rounded-lg mb-6">
                <div className="flex items-center space-x-3">
                  {React.createElement(getDestinationIcon(selectedDestination.type), {
                    className: `${iconSizes.lg} text-blue-400`
                  })}
                  <div>
                    <div className="text-white font-medium">{selectedDestination.label}</div>
                    <div className="text-gray-400 text-sm">Destination: {selectedDestination.type}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Process Layers</label>
                    <p className="text-gray-400 text-sm">Create status layers for property management</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={processingOptions.processLayers}
                    onChange={(e) => setProcessingOptions(prev => ({ ...prev, processLayers: e.target.checked }))}
                    className={`${iconSizes.md} text-blue-600 bg-gray-700 ${quick.checkbox} focus:ring-blue-500`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Preserve Grid</label>
                    <p className="text-gray-400 text-sm">Keep grid lines in the final view</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={processingOptions.preserveGrid}
                    onChange={(e) => setProcessingOptions(prev => ({ ...prev, preserveGrid: e.target.checked }))}
                    className={`${iconSizes.md} text-blue-600 bg-gray-700 ${quick.checkbox} focus:ring-blue-500`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Preserve Rulers</label>
                    <p className="text-gray-400 text-sm">Keep measurement rulers</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={processingOptions.preserveRulers}
                    onChange={(e) => setProcessingOptions(prev => ({ ...prev, preserveRulers: e.target.checked }))}
                    className={`${iconSizes.md} text-blue-600 bg-gray-700 ${quick.checkbox} focus:ring-blue-500`}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-white font-medium">Auto Scale</label>
                    <p className="text-gray-400 text-sm">Automatically scale to fit destination</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={processingOptions.autoScale}
                    onChange={(e) => setProcessingOptions(prev => ({ ...prev, autoScale: e.target.checked }))}
                    className={`${iconSizes.md} text-blue-600 bg-gray-700 ${quick.checkbox} focus:ring-blue-500`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Processing */}
          {currentStep === 'processing' && (
            <div className="text-center">
              <div className={`animate-spin ${iconSizes['2xl']} border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4`}></div>
              <h3 className="text-lg font-medium text-white mb-2">
                Επεξεργασία κάτοψης...
              </h3>
              <p className="text-gray-400">
                Η κάτοψη υποβάλλεται σε επεξεργασία και αποθηκεύεται στον επιλεγμένο προορισμό.
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {currentStep === 'complete' && (
            <div className="text-center">
              <div className={`${iconSizes['2xl']} bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4`}>
                <svg className={`${iconSizes.lg} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">
                Επιτυχής ολοκλήρωση!
              </h3>
              <p className="text-gray-400 mb-4">
                Η κάτοψη αποθηκεύτηκε επιτυχώς στον επιλεγμένο προορισμό.
              </p>
              {selectedDestination && (
                <div className="bg-gray-700 p-3 rounded-lg inline-block">
                  <div className="flex items-center space-x-2">
                    {React.createElement(getDestinationIcon(selectedDestination.type), {
                      className: `${iconSizes.md} text-green-400`
                    })}
                    <span className="text-white">{selectedDestination.label}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-between items-center p-6 ${getStatusBorder('default')} border-t`}>
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 'destination' || currentStep === 'processing'}
            className={`px-4 py-2 text-gray-300 ${INTERACTIVE_PATTERNS.TEXT_HIGHLIGHT} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            ← Προηγούμενο
          </button>
          
          <div className="flex space-x-3">
            {currentStep === 'complete' ? (
              <button
                onClick={handleClose}
                className={`px-6 py-2 bg-green-600 ${HOVER_BACKGROUND_EFFECTS.GREEN_BUTTON} text-white rounded-lg font-medium`}
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
                className={`px-6 py-2 bg-blue-600 ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON} disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium`}
              >
                {currentStep === 'options' ? 'Ξεκίνημα επεξεργασίας' : 'Επόμενο →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}