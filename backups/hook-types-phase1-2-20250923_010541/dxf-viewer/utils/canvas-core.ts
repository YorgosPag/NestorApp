import { coordTransforms } from '../systems/rulers-grid/config';

// Simplified canvas-core - χρησιμοποιεί το ενιαίο coordinate system

export type ViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export class CanvasCore {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = context;
  }

  clear() {
    // Simplified: Use canvas dimensions directly
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

/**
 * Shared selection utility functions to eliminate duplicates
 * Used by useCanvasSelection.ts and useCanvasTools.ts
 */
export const createSelectionUtils = () => ({
  toggleEntitySelection: (entityId: string, selectedEntityIds: string[]) => {
    return selectedEntityIds.includes(entityId)
      ? selectedEntityIds.filter(id => id !== entityId)
      : [...selectedEntityIds, entityId];
  }
});

/**
 * Shared mouse handling utilities to eliminate duplicates
 * Used by useCanvasMouseHandling.ts and useCanvasInteractions.ts
 */
export const createMouseUtils = (transform?: ViewTransform) => ({
  screenToWorld: (screenPoint: { x: number; y: number }) => {
    if (!transform) return screenPoint;
    return coordTransforms.screenToWorld(screenPoint, transform);
  },
  
  getScreenPointFromEvent: (e: MouseEvent | React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } => {
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  },
  
  handleMouseMove: (
    e: MouseEvent,
    onWorldPoint: (worldPoint: { x: number; y: number }) => void
  ) => {
    if (!transform) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = coordTransforms.screenToWorld({ x: screenX, y: screenY }, transform);
    onWorldPoint(worldPoint);
  }
});

/**
 * Shared DXF import utilities to eliminate duplicates
 * Used by useDxfImport.ts and useDxfPipeline.ts
 */
export const createDxfImportUtils = () => ({
  processImportResult: (result: any, onSuccess?: (scene: any) => void, onError?: (error: string) => void) => {
    console.log('📊 DXF Import result:', {
      success: result.success,
      hasScene: !!result.scene,
      error: result.error,
      stats: result.stats
    });
    
    if (result.success && result.scene) {
      console.log('✅ DXF import successful:', {
        entities: result.scene.entities.length,
        layers: Object.keys(result.scene.layers).length,
        bounds: result.scene.bounds
      });
      onSuccess?.(result.scene);
      return result.scene;
    } else {
      const errorMsg = result.error || 'Import failed - unknown reason';
      console.error('❌ DXF import failed:', errorMsg);
      onError?.(errorMsg);
      return null;
    }
  },

  handleImportError: (err: unknown, onError?: (error: string) => void) => {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error('⛔ Exception during DXF import:', err);
    onError?.(errorMessage);
    return null;
  }
});

/**
 * Shared wizard/dialog utilities to eliminate duplicates
 * Used by SimpleProjectDialog.tsx and DestinationWizard.tsx
 */
export const createWizardUtils = () => ({
  createStepNavigator: <T extends string>(initialStep: T, validSteps: T[]) => ({
    currentStep: initialStep,
    canGoNext: (currentStep: T, requiredData?: any) => {
      // Common logic για validating step progression
      const currentIndex = validSteps.indexOf(currentStep);
      const hasNext = currentIndex < validSteps.length - 1;
      
      // Μπορούμε να προσθέσουμε custom validation logic εδώ
      return hasNext && !!requiredData;
    },
    
    canGoPrevious: (currentStep: T) => {
      const currentIndex = validSteps.indexOf(currentStep);
      return currentIndex > 0;
    },
    
    getNextStep: (currentStep: T): T | null => {
      const currentIndex = validSteps.indexOf(currentStep);
      return currentIndex < validSteps.length - 1 ? validSteps[currentIndex + 1] : null;
    },
    
    getPreviousStep: (currentStep: T): T | null => {
      const currentIndex = validSteps.indexOf(currentStep);
      return currentIndex > 0 ? validSteps[currentIndex - 1] : null;
    }
  }),

  createWizardActions: (onStepChange: (step: any) => void, onComplete: () => void, onCancel: () => void) => ({
    handleNext: (currentStep: any, validSteps: any[], requiredData?: any) => {
      const currentIndex = validSteps.indexOf(currentStep);
      if (currentIndex < validSteps.length - 1 && requiredData) {
        onStepChange(validSteps[currentIndex + 1]);
      } else if (currentIndex === validSteps.length - 1) {
        onComplete();
      }
    },
    
    handlePrevious: (currentStep: any, validSteps: any[]) => {
      const currentIndex = validSteps.indexOf(currentStep);
      if (currentIndex > 0) {
        onStepChange(validSteps[currentIndex - 1]);
      }
    },
    
    handleCancel: () => {
      onCancel();
    }
  })
});

export default CanvasCore;
