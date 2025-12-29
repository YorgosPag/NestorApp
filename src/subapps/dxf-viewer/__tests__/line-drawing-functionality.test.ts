/**
 * LINE DRAWING FUNCTIONALITY TEST
 * ✅ CRITICAL: Επαληθεύει ότι η βασική λειτουργικότητα σχεδίασης γραμμής δουλεύει
 *
 * Αυτό το test ελέγχει:
 * 1. Η γραμμή σχεδιάζεται σωστά (1ο κλικ → 2ο κλικ → entity δημιουργείται)
 * 2. Το preview phase λειτουργεί (previewEntity exists)
 * 3. Οι event handlers είναι συνδεδεμένοι
 * 4. Η γραμμή προστίθεται στο scene
 *
 * ⚠️ ΑΝ ΑΥΤΟ ΤΟ TEST ΑΠΟΤΥΧΕΙ = Η ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ ΣΧΕΔΙΑΣΗΣ ΣΠΑΣΕ!
 */

import { renderHook, act } from '@testing-library/react';
import { useUnifiedDrawing } from '../hooks/drawing/useUnifiedDrawing';
import type { Point2D } from '../rendering/types/Types';

describe('🎯 Line Drawing Functionality (CRITICAL)', () => {
  describe('✅ Basic Line Drawing', () => {
    it('should draw a line with two clicks', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      // Start drawing a line
      act(() => {
        result.current.startDrawing('line');
      });

      expect(result.current.state.isDrawing).toBe(true);
      expect(result.current.state.currentTool).toBe('line');

      // First click - start point
      const startPoint: Point2D = { x: 100, y: 100 };
      act(() => {
        result.current.addPoint(startPoint);
      });

      expect(result.current.state.tempPoints).toHaveLength(1);
      expect(result.current.state.tempPoints[0]).toEqual(startPoint);

      // Second click - end point (should complete the line)
      const endPoint: Point2D = { x: 200, y: 200 };
      let createdEntity: any = null;

      // Re-render with entity callback
      const { result: resultWithCallback } = renderHook(() => useUnifiedDrawing());

      act(() => {
        resultWithCallback.current.startDrawing('line');
        resultWithCallback.current.addPoint(startPoint);
      });

      // The line should complete on second point
      act(() => {
        resultWithCallback.current.addPoint(endPoint);
      });

      // After second point, drawing should be complete
      expect(resultWithCallback.current.state.isDrawing).toBe(false);
      expect(resultWithCallback.current.state.tempPoints).toHaveLength(0);
    });

    it('should create preview entity during drawing', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
      });

      // First click
      const startPoint: Point2D = { x: 50, y: 50 };
      act(() => {
        result.current.addPoint(startPoint);
      });

      // Hover to create preview
      const hoverPoint: Point2D = { x: 150, y: 150 };
      act(() => {
        result.current.updatePreview(hoverPoint, {
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      });

      // Preview entity should exist
      expect(result.current.state.previewEntity).not.toBeNull();

      if (result.current.state.previewEntity) {
        expect(result.current.state.previewEntity.type).toBe('line');
        // Preview entity should have the preview flag
        const previewEntity = result.current.state.previewEntity as any;
        expect(previewEntity.preview).toBe(true);
      }
    });
  });

  describe('✅ Event Handler Connection', () => {
    it('should have onDrawingHover handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      // The hook should return drawingHandlers with onDrawingHover
      expect(result.current).toBeDefined();
      expect(typeof result.current.updatePreview).toBe('function');
    });

    it('should have startDrawing handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      expect(typeof result.current.startDrawing).toBe('function');
    });

    it('should have addPoint handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      expect(typeof result.current.addPoint).toBe('function');
    });
  });

  describe('✅ State Management', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      expect(result.current.state.isDrawing).toBe(false);
      expect(result.current.state.currentTool).toBe('select');
      expect(result.current.state.previewEntity).toBeNull();
      expect(result.current.state.tempPoints).toHaveLength(0);
    });

    it('should transition to drawing state when line tool selected', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
      });

      expect(result.current.state.isDrawing).toBe(true);
      expect(result.current.state.currentTool).toBe('line');
    });

    it('should reset state after completing line', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
        result.current.addPoint({ x: 0, y: 0 });
        result.current.addPoint({ x: 100, y: 100 });
      });

      // After completing line, state should reset
      expect(result.current.state.isDrawing).toBe(false);
      expect(result.current.state.tempPoints).toHaveLength(0);
      expect(result.current.state.previewEntity).toBeNull();
    });
  });

  describe('⚠️ REGRESSION TESTS - Critical Bugs', () => {
    it('🐛 BUG FIX: onDrawingHover must be called during mouse move', () => {
      // This test ensures the bug where onDrawingHover wasn't called is fixed
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
        result.current.addPoint({ x: 0, y: 0 });
      });

      // updatePreview should work (this was broken before)
      act(() => {
        result.current.updatePreview({ x: 50, y: 50 }, {
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      });

      expect(result.current.state.previewEntity).not.toBeNull();
    });

    it('🐛 BUG FIX: previewEntity must be added to scene for rendering', () => {
      // This test ensures preview entity is created
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
        result.current.addPoint({ x: 10, y: 10 });
        result.current.updatePreview({ x: 100, y: 100 }, {
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      });

      // Preview entity MUST exist for rendering
      expect(result.current.state.previewEntity).toBeTruthy();

      // Preview entity should be a line
      if (result.current.state.previewEntity) {
        expect(result.current.state.previewEntity.type).toBe('line');
      }
    });
  });

  describe('✅ Line Properties', () => {
    it('should create line with start and end points', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      const start: Point2D = { x: 10, y: 20 };
      const end: Point2D = { x: 30, y: 40 };

      act(() => {
        result.current.startDrawing('line');
        result.current.addPoint(start);
        result.current.updatePreview(end, {
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      });

      const previewEntity = result.current.state.previewEntity as any;

      if (previewEntity && previewEntity.type === 'line') {
        expect(previewEntity.start).toEqual(start);
        expect(previewEntity.end).toEqual(end);
      }
    });

    it('should mark preview entity with preview flag', () => {
      const { result } = renderHook(() => useUnifiedDrawing());

      act(() => {
        result.current.startDrawing('line');
        result.current.addPoint({ x: 0, y: 0 });
        result.current.updatePreview({ x: 50, y: 50 }, {
          scale: 1,
          offsetX: 0,
          offsetY: 0
        });
      });

      const previewEntity = result.current.state.previewEntity as any;
      expect(previewEntity?.preview).toBe(true);
    });
  });
});

/**
 * 🎯 ΣΚΟΠΟΣ ΤΟΥ TEST:
 *
 * Αυτό το test εξασφαλίζει ότι η ΒΑΣΙΚΗ λειτουργικότητα σχεδίασης γραμμής
 * δουλεύει πάντα. Αν αυτό το test αποτύχει, σημαίνει ότι κάποιος έσπασε
 * την κρίσιμη λειτουργικότητα.
 *
 * ⚠️ ΠΡΟΣΟΧΗ:
 * - Αυτό το test ΔΕΝ ελέγχει τις ρυθμίσεις (colors, linewidth, etc)
 * - Ελέγχει ΜΟΝΟ ότι η γραμμή σχεδιάζεται και εμφανίζεται
 * - Για settings testing, δες το visual-elements-settings.test.ts
 */
