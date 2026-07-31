/**
 * ✅ ΦΑΣΗ 7: Compatibility shim updated to use unified coordinate transforms
 * @deprecated This file is a compatibility shim.
 * Please migrate to importing directly from rendering/core/CoordinateTransforms.ts
 * This shim will be removed in v2.0.0
 */

// CoordinateTransforms import removed - use direct import from rendering/core/CoordinateTransforms.ts
import {
  MARGINS,
  RULER_SIZE,
} from './systems/rulers-grid/config';
// Point2D, ViewTransform, Viewport imports removed - not needed anymore

// Legacy compatibility types
export type RectLike = { width: number; height: number };

// ✅ DEPRECATED COORDINATE FUNCTIONS REMOVED
// Use CoordinateTransforms directly from rendering/core/CoordinateTransforms.ts

// Direct re-exports for simple constants
/** @deprecated Use RULER_SIZE from systems/rulers-grid/config.ts */
export { RULER_SIZE };

/**
 * @deprecated Το `MARGINS` είναι **προβολή** του `DRAWING_AREA_CHROME`. Για «πού είναι η περιοχή
 * σχεδίασης» χρησιμοποίησε `getDrawingAreaRect()` από `rendering/core/drawing-area.ts`.
 *
 * (Η προηγούμενη γραφή έδειχνε στο `systems/rulers-grid/config.ts`, που **επίσης** το
 * re-export-άρει με `@deprecated` δείχνοντας πίσω εδώ — κύκλος που δεν οδηγούσε ποτέ στην πηγή.)
 */
export { MARGINS };

import { HIT_TEST_RADIUS_PX, CALIB_TOLERANCE_PX } from './config/tolerance-config';

// Re-export tolerance constants from central config
export { HIT_TEST_RADIUS_PX, CALIB_TOLERANCE_PX };

// 🔴 ΑΦΑΙΡΕΘΗΚΑΝ (2026-07-31): `RULER_LEFT_PAD = 30` / `RULER_BOTTOM_PAD = 30` — δύο ακόμη
// hardcoded «30» χωρίς προέλευση, **μηδέν καταναλωτές** σε όλο το `src/`. Ήταν λανθάνουσα
// έβδομη απάντηση στο «πού είναι η περιοχή σχεδίασης». Η μία απάντηση ζει στο
// `rendering/core/drawing-area.ts` (`DRAWING_AREA_CHROME` / `getDrawingAreaRect`).