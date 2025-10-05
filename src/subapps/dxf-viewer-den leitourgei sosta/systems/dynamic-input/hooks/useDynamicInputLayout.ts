'use client';

import { useCallback } from 'react';
import type { Point2D, Phase } from '../../../rendering/types/Types';

interface UseDynamicInputLayoutArgs {
  activeTool: string;
  drawingPhase: Phase;
  cursorPosition: Point2D | null;
}

export function useDynamicInputLayout({
  activeTool,
  drawingPhase,
  cursorPosition,
}: UseDynamicInputLayoutArgs) {
  
  // Καθορίζει ποια fields να εμφανίσει βάσει εργαλείου και φάσης
  const getFieldsToShow = useCallback((): string[] => {
    switch (activeTool) {
      case 'line':
      case 'rectangle':
      case 'measure-distance':
        if (drawingPhase === 'first-point') {
          return ['x', 'y', 'angle', 'length']; // 4 fields για 1ο σημείο
        } else if (drawingPhase === 'second-point') {
          return ['x', 'y']; // 2 fields για 2ο σημείο
        }
        break;
      case 'polyline':
      case 'polygon':
      case 'measure-area':
        return ['x', 'y', 'angle', 'length']; // Πάντα 4 fields
      case 'circle':
        if (drawingPhase === 'first-point') {
          return ['x', 'y']; // Phase 1: Μόνο X,Y για κέντρο κύκλου
        } else if (drawingPhase === 'second-point') {
          return ['radius']; // Phase 2: Μόνο radius field για εισαγωγή ακτίνας
        }
        return ['x', 'y']; // Fallback
      case 'circle-diameter':
        if (drawingPhase === 'first-point') {
          return ['x', 'y']; // Phase 1: Μόνο X,Y για κέντρο κύκλου
        } else if (drawingPhase === 'second-point') {
          return ['diameter']; // Phase 2: Μόνο diameter field για εισαγωγή διαμέτρου
        }
        return ['x', 'y']; // Fallback
      case 'circle-2p-diameter':
        if (drawingPhase === 'first-point') {
          return ['x', 'y']; // Phase 1: X,Y για πρώτο σημείο διαμέτρου
        } else if (drawingPhase === 'second-point') {
          return ['x', 'y']; // Phase 2: X,Y για δεύτερο σημείο διαμέτρου  
        }
        return ['x', 'y']; // Fallback
      default:
        return ['x', 'y', 'length']; // Default για άλλα εργαλεία
    }
    return ['x', 'y', 'angle', 'length'];
  }, [activeTool, drawingPhase]);

  // Σταθερό positioning: Πάντα αγκυρωμένο στον κέρσορα
  const getInputPosition = useCallback(() => {
    if (!cursorPosition) return { x: 0, y: 0 };
    
    // ΑΓΚΥΡΩΣΗ ΒΑΣΗΣ CONTAINER:
    // Θέλουμε η ΒΑΣΗ (bottom) του container να απέχει 15px ΠΑΝΩ από την οριζόντια του κέρσορα.
    // Χρησιμοποιούμε top = cursorY - 15 και transform: translateY(-100%) ώστε το bottom να «κάθεται» στο cursorY - 15.
    const x = cursorPosition.x + 15; // 15px δεξιά από την κάθετη του κέρσορα
    const y = cursorPosition.y - 15; // top ώστε η ΒΑΣΗ να είναι 15px ΠΑΝΩ από την οριζόντια του κέρσορα
    
    // Debug log για positioning
    console.debug('[DynamicInputOverlay] pos', { overlayX: x, overlayY: y, transform: 'translateY(-100%)' });
    
    return { x, y };
  }, [cursorPosition]);

  return {
    getFieldsToShow,
    getInputPosition,
  };
}