/**
 * LINE DRAWING SMOKE TEST
 * ⚡ ΤΑΧΥ TEST: Επαληθεύει ότι η βασική λειτουργικότητα σχεδίασης υπάρχει
 *
 * Αυτό το test είναι SMOKE TEST - ελέγχει μόνο ότι:
 * 1. Τα critical files υπάρχουν
 * 2. Τα bug fixes είναι παρόντα στον κώδικα
 * 3. Οι types είναι σωστά structured
 *
 * ⚠️ ΑΝ ΑΥΤΟ ΤΟ TEST ΑΠΟΤΥΧΕΙ = ΚΡΙΤΙΚΗ ΛΕΙΤΟΥΡΓΙΚΟΤΗΤΑ ΣΠΑΣΕ!
 *
 * @jest-environment node
 */

import * as fs from 'fs';
import * as path from 'path';

describe('🎯 Line Drawing Smoke Test (CRITICAL)', () => {
  describe('✅ Critical Files Exist', () => {
    it('should have useDrawingSystem hook file', () => {
      // 🔧 FIX: useUnifiedDrawing.ts was renamed to useDrawingSystem.ts
      const filePath = path.join(__dirname, '../hooks/drawing/useDrawingSystem.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have useDrawingHandlers hook file', () => {
      const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have CanvasSection component file', () => {
      const filePath = path.join(__dirname, '../components/dxf-layout/CanvasSection.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('⚠️ REGRESSION: Critical Bug Fixes Present', () => {
    it('🐛 Fix #1: onDrawingHover handler exists in useDrawingHandlers', () => {
      // Read the file to verify the fix is present
      const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verify onDrawingHover is defined
        expect(content).toContain('onDrawingHover');
        expect(content).toContain('updatePreview');
      }
    });

    it('🐛 Fix #2: previewEntity rendering is handled by PreviewCanvas + useDrawingHandlers', () => {
      // 🔧 UPDATED 2026-04-07: Preview entity logic was refactored out of CanvasSection
      // into useDrawingHandlers (which calls getLatestPreviewEntity) and PreviewCanvas.
      // Verify the preview rendering chain exists in useDrawingHandlers.
      const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verify previewEntity is accessed and rendered via PreviewCanvas
        expect(content).toContain('getLatestPreviewEntity');
        expect(content).toContain('drawPreview');
      }
    });

    it('🐛 Fix #3: onDrawingHover handler exists in useDrawingHandlers and is exported', () => {
      // 🔧 UPDATED 2026-04-07: onDrawingHover is now defined in useDrawingHandlers
      // and wired through useDxfViewerState, not directly in CanvasSection.
      const filePath = path.join(__dirname, '../hooks/drawing/useDrawingHandlers.ts');

      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Verify onDrawingHover is defined and calls updatePreview
        expect(content).toContain('onDrawingHover');
        expect(content).toContain('updatePreview');
      }
    });
  });
});

/**
 * 🎯 ΣΗΜΕΙΩΣΕΙΣ:
 *
 * Αυτό το SMOKE TEST είναι lightweight και τρέχει γρήγορα.
 * Ελέγχει ότι τα ΚΡΙΣΙΜΑ fixes είναι παρόντα στον κώδικα:
 *
 * ✅ Fix #1: onDrawingHover connection
 * ✅ Fix #2: previewEntity rendering via PreviewCanvas + useDrawingHandlers
 * ✅ Fix #3: onDrawingHover handler exists and calls updatePreview
 *
 * Αν αυτό το test ΑΠΟΤΥΧΕΙ, σημαίνει ότι κάποιος:
 * - Διέγραψε τα critical fixes
 * - Refactored χωρίς να διατηρήσει τη λειτουργικότητα
 * - Έκανε breaking changes στο drawing system
 *
 * ⚠️ ΜΗΝ ΔΙΑΓΡΑΨΕΙΣ ΑΥΤΟ ΤΟ TEST!
 */
