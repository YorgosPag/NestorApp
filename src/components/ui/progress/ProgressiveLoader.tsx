'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface LoadingStep {
  id: string;
  label: string;
  description?: string;
  weight?: number; // Relative weight for progress calculation
  estimatedTime?: number; // Estimated time in ms
}

interface ProgressiveLoaderProps {
  steps: LoadingStep[];
  currentStep?: string;
  progress?: number; // Override automatic progress calculation
  showSteps?: boolean;
  showEstimatedTime?: boolean;
  className?: string;
  onStepChange?: (stepId: string, progress: number) => void;
}

export function ProgressiveLoader({
  steps,
  currentStep,
  progress,
  showSteps = true,
  showEstimatedTime = true,
  className,
  onStepChange
}: ProgressiveLoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState(Date.now());

  // Calculate progress based on current step
  const calculateProgress = useCallback(() => {
    if (progress !== undefined) return progress;

    if (!currentStep) return 0;

    const currentStepIndex = steps.findIndex(step => step.id === currentStep);
    if (currentStepIndex === -1) return 0;

    const totalWeight = steps.reduce((sum, step) => sum + (step.weight || 1), 0);
    const completedWeight = steps
      .slice(0, currentStepIndex)
      .reduce((sum, step) => sum + (step.weight || 1), 0);

    const currentStepWeight = steps[currentStepIndex]?.weight || 1;
    const currentStepProgress = completedWeight + (currentStepWeight * 0.5); // Assume 50% through current step

    return Math.round((currentStepProgress / totalWeight) * 100);
  }, [steps, currentStep, progress]);

  // Update progress
  useEffect(() => {
    const newProgress = calculateProgress();
    setInternalProgress(newProgress);
    
    // Calculate estimated time remaining
    if (showEstimatedTime && newProgress > 0) {
      const elapsed = Date.now() - startTime;
      const estimatedTotal = (elapsed / newProgress) * 100;
      const remaining = estimatedTotal - elapsed;
      setEstimatedTimeRemaining(Math.max(0, remaining));
    }

    // Notify parent of step change
    if (currentStep && onStepChange) {
      onStepChange(currentStep, newProgress);
    }
  }, [calculateProgress, currentStep, onStepChange, showEstimatedTime, startTime]);

  const currentStepData = steps.find(step => step.id === currentStep);
  const currentStepIndex = currentStep ? steps.findIndex(step => step.id === currentStep) : -1;

  const formatTime = (ms: number) => {
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Progress bar */}
      <div className="space-y-2">
        <Progress 
          value={internalProgress} 
          className="h-2"
        />
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>{internalProgress}% Complete</span>
          {estimatedTimeRemaining !== null && showEstimatedTime && (
            <span>{formatTime(estimatedTimeRemaining)} remaining</span>
          )}
        </div>
      </div>

      {/* Current step info */}
      {currentStepData && (
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <div>
            <p className="font-medium text-sm">{currentStepData.label}</p>
            {currentStepData.description && (
              <p className="text-xs text-muted-foreground">{currentStepData.description}</p>
            )}
          </div>
        </div>
      )}

      {/* Step list */}
      {showSteps && (
        <div className="space-y-2">
          {steps.map((step, index) => {
            const isCompleted = currentStepIndex > index;
            const isCurrent = currentStep === step.id;
            const isPending = currentStepIndex < index;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-center space-x-3 p-2 rounded-md text-sm",
                  isCompleted && "text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950/20",
                  isCurrent && "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/20",
                  isPending && "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center text-xs",
                    isCompleted && "bg-green-600 text-white",
                    isCurrent && "bg-blue-600 text-white animate-pulse",
                    isPending && "bg-muted"
                  )}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <div className="flex-1">
                  <span className="font-medium">{step.label}</span>
                  {step.description && (
                    <p className="text-xs opacity-75">{step.description}</p>
                  )}
                </div>
                {step.estimatedTime && isCurrent && (
                  <span className="text-xs opacity-75">~{formatTime(step.estimatedTime)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Preset configurations for common loading scenarios
export const LoadingPresets = {
  // Data fetching
  dataFetch: [
    { id: 'connecting', label: 'Connecting to server', weight: 1 },
    { id: 'authenticating', label: 'Authenticating', weight: 1 },
    { id: 'fetching', label: 'Fetching data', weight: 3 },
    { id: 'processing', label: 'Processing results', weight: 2 },
  ] as LoadingStep[],

  // File upload
  fileUpload: [
    { id: 'preparing', label: 'Preparing upload', weight: 1 },
    { id: 'uploading', label: 'Uploading file', weight: 5 },
    { id: 'processing', label: 'Processing file', weight: 3 },
    { id: 'finalizing', label: 'Finalizing', weight: 1 },
  ] as LoadingStep[],

  // Application loading
  appInit: [
    { id: 'assets', label: 'Loading assets', description: 'Scripts, styles, and resources', weight: 2 },
    { id: 'auth', label: 'Checking authentication', description: 'Verifying user session', weight: 1 },
    { id: 'config', label: 'Loading configuration', description: 'User preferences and settings', weight: 1 },
    { id: 'data', label: 'Loading initial data', description: 'Essential application data', weight: 3 },
    { id: 'finalizing', label: 'Finalizing setup', description: 'Preparing interface', weight: 1 },
  ] as LoadingStep[],

  // Component lazy loading
  componentLoad: [
    { id: 'downloading', label: 'Downloading component', weight: 3 },
    { id: 'parsing', label: 'Parsing code', weight: 1 },
    { id: 'initializing', label: 'Initializing', weight: 1 },
  ] as LoadingStep[],

  // DXF file processing
  dxfProcessing: [
    { id: 'parsing', label: 'Parsing DXF file', description: 'Reading file structure', weight: 2 },
    { id: 'entities', label: 'Processing entities', description: 'Converting drawing elements', weight: 4 },
    { id: 'layers', label: 'Organizing layers', description: 'Grouping by layers and properties', weight: 1 },
    { id: 'rendering', label: 'Preparing render', description: 'Creating 3D scene', weight: 2 },
    { id: 'optimizing', label: 'Optimizing', description: 'Performance optimizations', weight: 1 },
  ] as LoadingStep[],
};

// Hook for managing progressive loading state
export function useProgressiveLoader(steps: LoadingStep[]) {
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const nextStep = useCallback(() => {
    const currentIndex = currentStep ? steps.findIndex(s => s.id === currentStep) : -1;
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= steps.length) {
      setIsComplete(true);
      setCurrentStep(null);
      setProgress(100);
    } else {
      setCurrentStep(steps[nextIndex].id);
    }
  }, [currentStep, steps]);

  const goToStep = useCallback((stepId: string) => {
    if (steps.some(s => s.id === stepId)) {
      setCurrentStep(stepId);
      setIsComplete(false);
    }
  }, [steps]);

  const reset = useCallback(() => {
    setCurrentStep(null);
    setProgress(0);
    setIsComplete(false);
  }, []);

  const start = useCallback(() => {
    if (steps.length > 0) {
      setCurrentStep(steps[0].id);
      setIsComplete(false);
    }
  }, [steps]);

  return {
    currentStep,
    progress,
    isComplete,
    nextStep,
    goToStep,
    reset,
    start
  };
}

export default ProgressiveLoader;