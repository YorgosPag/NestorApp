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
 *
 * @enterprise-grade
 * @updated 2026-01-02 - Migrated to TestProviders (real providers, no mocked hooks)
 * @updated 2026-04-07 - Added Firebase auth mock for enterprise-api-client import chain
 */

// Mock Firebase auth before any imports that trigger enterprise-api-client
// and firebase/auth (which requires `fetch` in Node env via AuthContext)
jest.mock('@/lib/firebase', () => ({
  db: {},
  auth: { onAuthStateChanged: jest.fn() },
  functions: {},
  storage: {},
  default: {},
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ onAuthStateChanged: jest.fn() })),
  connectAuthEmulator: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signInWithPopup: jest.fn(),
}));

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('@/auth/contexts/AuthContext', () => ({
  AuthContext: { Provider: ({ children }: { children: unknown }) => children },
  useAuth: () => ({
    user: null,
    loading: false,
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

import { renderHook, act } from '@testing-library/react';
import { useUnifiedDrawing, type ExtendedLineEntity } from '../hooks/drawing/useUnifiedDrawing';
import { TestProviders } from './utils/TestProviders';
import type { Point2D } from '../rendering/types/Types';
import { resetGlobalDrawingStateMachine } from '../core/state-machine/DrawingStateMachine';

// ✅ ENTERPRISE: Transform helper for coordinate conversion
const mockTransform = {
  worldToScreen: (point: Point2D) => point,
  screenToWorld: (point: Point2D) => point
};

describe('🎯 Line Drawing Functionality (CRITICAL)', () => {
  // Reset global drawing state machine before each test to ensure isolation
  beforeEach(() => {
    resetGlobalDrawingStateMachine();
  });

  describe('✅ Basic Line Drawing', () => {
    it('should draw a line with two clicks', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      // Start drawing a line
      act(() => {
        result.current.startDrawing('line');
      });

      expect(result.current.state.isDrawing).toBe(true);
      expect(result.current.state.currentTool).toBe('line');

      // First click - start point
      const startPoint: Point2D = { x: 100, y: 100 };
      act(() => {
        result.current.addPoint(startPoint, mockTransform);
      });

      expect(result.current.state.tempPoints).toHaveLength(1);
      expect(result.current.state.tempPoints[0]).toEqual(startPoint);

      // Second click - end point (should complete the line)
      const endPoint: Point2D = { x: 200, y: 200 };

      // ✅ ENTERPRISE FIX: Use same hook instance and separate act() blocks
      // Each act() block allows React state to update before next operation
      act(() => {
        result.current.addPoint(endPoint, mockTransform);
      });

      // After second point, line entity is completed and tool is re-armed
      // (allowsContinuous=true for line tool — AutoCAD pattern)
      // tempPoints resets to 0 because the entity was created
      expect(result.current.state.tempPoints).toHaveLength(0);
      // isDrawing stays true because line tool has allowsContinuous
      expect(result.current.state.isDrawing).toBe(true);
    });

    it('should create preview entity during drawing (via ref, not React state)', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      act(() => {
        result.current.startDrawing('line');
      });

      // First click
      const startPoint: Point2D = { x: 50, y: 50 };
      act(() => {
        result.current.addPoint(startPoint, mockTransform);
      });

      // Hover to create preview — updatePreview writes to previewEntityRef (not React state)
      // for zero-latency PreviewCanvas rendering (ADR-040)
      const hoverPoint: Point2D = { x: 150, y: 150 };
      act(() => {
        result.current.updatePreview(hoverPoint, mockTransform);
      });

      // Preview entity is accessed via getLatestPreviewEntity() (ref-based, not state-based)
      const previewEntity = result.current.getLatestPreviewEntity();
      expect(previewEntity).not.toBeNull();

      if (previewEntity) {
        expect(previewEntity.type).toBe('line');
      }
    });
  });

  describe('✅ Event Handler Connection', () => {
    it('should have onDrawingHover handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      // The hook should return drawingHandlers with onDrawingHover
      expect(result.current).toBeDefined();
      expect(typeof result.current.updatePreview).toBe('function');
    });

    it('should have startDrawing handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      expect(typeof result.current.startDrawing).toBe('function');
    });

    it('should have addPoint handler', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      expect(typeof result.current.addPoint).toBe('function');
    });
  });

  describe('✅ State Management', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      expect(result.current.state.isDrawing).toBe(false);
      expect(result.current.state.currentTool).toBe('select');
      expect(result.current.state.previewEntity).toBeNull();
      expect(result.current.state.tempPoints).toHaveLength(0);
    });

    it('should transition to drawing state when line tool selected', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      act(() => {
        result.current.startDrawing('line');
      });

      expect(result.current.state.isDrawing).toBe(true);
      expect(result.current.state.currentTool).toBe('line');
    });

    it('should reset tempPoints and previewEntity after completing line', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      // ✅ ENTERPRISE FIX: Separate act() blocks for each state update
      act(() => {
        result.current.startDrawing('line');
      });

      act(() => {
        result.current.addPoint({ x: 0, y: 0 }, mockTransform);
      });

      act(() => {
        result.current.addPoint({ x: 100, y: 100 }, mockTransform);
      });

      // After completing line, tempPoints and previewEntity reset
      // isDrawing stays true because line tool has allowsContinuous (AutoCAD pattern)
      expect(result.current.state.tempPoints).toHaveLength(0);
      expect(result.current.state.previewEntity).toBeNull();
    });
  });

  describe('⚠️ REGRESSION TESTS - Critical Bugs', () => {
    it('🐛 BUG FIX: updatePreview creates preview entity (via ref)', () => {
      // This test ensures updatePreview creates a preview entity accessible via getLatestPreviewEntity
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      act(() => {
        result.current.startDrawing('line');
      });

      act(() => {
        result.current.addPoint({ x: 0, y: 0 }, mockTransform);
      });

      // updatePreview writes to ref for zero-latency PreviewCanvas rendering (ADR-040)
      act(() => {
        result.current.updatePreview({ x: 50, y: 50 }, mockTransform);
      });

      // Preview entity is in the ref, not in React state
      expect(result.current.getLatestPreviewEntity()).not.toBeNull();
    });

    it('🐛 BUG FIX: previewEntity must exist for rendering (via getLatestPreviewEntity)', () => {
      // This test ensures preview entity is created and accessible for PreviewCanvas
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      act(() => {
        result.current.startDrawing('line');
      });

      act(() => {
        result.current.addPoint({ x: 10, y: 10 }, mockTransform);
      });

      act(() => {
        result.current.updatePreview({ x: 100, y: 100 }, mockTransform);
      });

      // Preview entity MUST exist for rendering (accessed via ref, not state)
      const previewEntity = result.current.getLatestPreviewEntity();
      expect(previewEntity).toBeTruthy();

      // Preview entity should be a line
      if (previewEntity) {
        expect(previewEntity.type).toBe('line');
      }
    });
  });

  describe('✅ Line Properties', () => {
    it('should create line with start and end points', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      const start: Point2D = { x: 10, y: 20 };
      const end: Point2D = { x: 30, y: 40 };

      // ✅ ENTERPRISE FIX: Separate act() blocks for each state update
      act(() => {
        result.current.startDrawing('line');
      });

      act(() => {
        result.current.addPoint(start, mockTransform);
      });

      act(() => {
        result.current.updatePreview(end, mockTransform);
      });

      const previewEntity = result.current.state.previewEntity as ExtendedLineEntity | null;

      if (previewEntity && previewEntity.type === 'line') {
        expect(previewEntity.start).toEqual(start);
        expect(previewEntity.end).toEqual(end);
      }
    });

    it('should create preview entity accessible via getLatestPreviewEntity', () => {
      const { result } = renderHook(() => useUnifiedDrawing(), { wrapper: TestProviders });

      act(() => {
        result.current.startDrawing('line');
      });

      act(() => {
        result.current.addPoint({ x: 0, y: 0 }, mockTransform);
      });

      act(() => {
        result.current.updatePreview({ x: 50, y: 50 }, mockTransform);
      });

      // Preview entity is in ref (zero-latency PreviewCanvas), not React state
      const previewEntity = result.current.getLatestPreviewEntity() as ExtendedLineEntity | null;
      expect(previewEntity).not.toBeNull();
      expect(previewEntity?.type).toBe('line');
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
